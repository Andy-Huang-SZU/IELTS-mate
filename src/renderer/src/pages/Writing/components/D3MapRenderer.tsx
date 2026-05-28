import { useEffect, useRef, useState } from 'react'
import * as d3 from 'd3'
import type { ChartData, MapView, MapFeature } from '../../../services/writing'

const FEATURE_STYLES: Record<string, { fill: string; stroke: string; strokeWidth: number }> = {
  building: { fill: '#DFE6E9', stroke: '#636E72', strokeWidth: 1 },
  road: { fill: 'none', stroke: '#636E72', strokeWidth: 2.5 },
  river: { fill: 'none', stroke: '#74B9FF', strokeWidth: 2 },
  park: { fill: '#00B894', stroke: '#00B894', strokeWidth: 0.5 },
  lake: { fill: '#74B9FF', stroke: '#74B9FF', strokeWidth: 0.5 },
  area: { fill: '#FDCB6E', stroke: '#FDCB6E', strokeWidth: 0.5 },
  label: { fill: '#2D3436', stroke: 'none', strokeWidth: 0 },
}

// Z-order for layered rendering (lower = drawn first / further back)
const Z_ORDER: Record<string, number> = {
  area: 0,
  park: 1,
  lake: 1,
  river: 2,
  road: 3,
  building: 4,
  label: 5,
}

// ── AABB rect type and collision helpers ──

interface AABB {
  x: number   // left
  y: number   // top
  w: number   // width
  h: number   // height
}

/** Calculate overlap area between two AABBs (0 if no overlap) */
function overlapArea(a: AABB, b: AABB): number {
  const ox = Math.max(0, Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x))
  const oy = Math.max(0, Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y))
  return ox * oy
}

/** Check if AABB is fully within map bounds */
function isInsideBounds(rect: AABB, mapW: number, mapH: number, margin = 2): boolean {
  return (
    rect.x >= margin &&
    rect.y >= margin &&
    rect.x + rect.w <= mapW - margin &&
    rect.y + rect.h <= mapH - margin
  )
}

/** Approximate text width in pixels for a given string and font size */
function estimateTextWidth(text: string, fontSize: number): number {
  // Wider chars (uppercase, W, M) average ~0.65, narrow chars ~0.5
  let w = 0
  for (const ch of text) {
    if (ch === ' ') w += 0.3
    else if (ch >= 'A' && ch <= 'Z') w += 0.7
    else if (ch === 'W' || ch === 'M') w += 0.85
    else if (ch === 'i' || ch === 'l' || ch === '(' || ch === ')') w += 0.35
    else w += 0.55
  }
  return w * fontSize
}

/** Build AABB for a label centered at (cx, cy) with given fontSize */
function labelAABB(cx: number, cy: number, text: string, fontSize: number, padX = 3, padY = 1.5): AABB {
  const tw = estimateTextWidth(text, fontSize)
  const th = fontSize
  return {
    x: cx - tw / 2 - padX,
    y: cy - th / 2 - padY,
    w: tw + padX * 2,
    h: th + padY * 2,
  }
}

/** Get the midpoint and tangent angle of a path defined by points */
function getPathMidpoint(points: [number, number][], scale: number): { x: number; y: number; angle: number } {
  if (points.length === 0) return { x: 0, y: 0, angle: 0 }
  if (points.length === 1) return { x: points[0][0] * scale, y: points[0][1] * scale, angle: 0 }

  // Calculate total length and find midpoint
  let totalLength = 0
  const segments: { len: number; x1: number; y1: number; x2: number; y2: number }[] = []
  for (let i = 1; i < points.length; i++) {
    const x1 = points[i - 1][0] * scale
    const y1 = points[i - 1][1] * scale
    const x2 = points[i][0] * scale
    const y2 = points[i][1] * scale
    const len = Math.sqrt((x2 - x1) ** 2 + (y2 - y1) ** 2)
    segments.push({ len, x1, y1, x2, y2 })
    totalLength += len
  }

  let walked = 0
  const halfLen = totalLength / 2
  for (const seg of segments) {
    if (walked + seg.len >= halfLen) {
      const t = (halfLen - walked) / seg.len
      const x = seg.x1 + t * (seg.x2 - seg.x1)
      const y = seg.y1 + t * (seg.y2 - seg.y1)
      const angle = Math.atan2(seg.y2 - seg.y1, seg.x2 - seg.x1) * (180 / Math.PI)
      return { x, y, angle }
    }
    walked += seg.len
  }
  // Fallback: last point
  const last = points[points.length - 1]
  return { x: last[0] * scale, y: last[1] * scale, angle: 0 }
}

/** Sample multiple candidate positions along a path at evenly-spaced t values */
function samplePathPositions(
  points: [number, number][],
  scale: number,
  count = 5,
): { x: number; y: number; angle: number }[] {
  if (points.length < 2) {
    return [getPathMidpoint(points, scale)]
  }

  let totalLength = 0
  const segments: { len: number; x1: number; y1: number; x2: number; y2: number }[] = []
  for (let i = 1; i < points.length; i++) {
    const x1 = points[i - 1][0] * scale
    const y1 = points[i - 1][1] * scale
    const x2 = points[i][0] * scale
    const y2 = points[i][1] * scale
    const len = Math.sqrt((x2 - x1) ** 2 + (y2 - y1) ** 2)
    segments.push({ len, x1, y1, x2, y2 })
    totalLength += len
  }

  const results: { x: number; y: number; angle: number }[] = []
  for (let k = 0; k < count; k++) {
    // Skip first 15% and last 15% of the path to avoid edge labels
    const t = 0.15 + (0.7 * (k / (count - 1 || 1)))
    const target = t * totalLength
    let walked = 0
    for (const seg of segments) {
      if (walked + seg.len >= target) {
        const st = (target - walked) / seg.len
        const x = seg.x1 + st * (seg.x2 - seg.x1)
        const y = seg.y1 + st * (seg.y2 - seg.y1)
        const angle = Math.atan2(seg.y2 - seg.y1, seg.x2 - seg.x1) * (180 / Math.PI)
        results.push({ x, y, angle })
        break
      }
      walked += seg.len
    }
  }
  return results
}

/** Compute the centroid of a polygon */
function polygonCentroid(points: [number, number][], scale: number): { x: number; y: number } {
  let cx = 0, cy = 0
  for (const p of points) {
    cx += p[0] * scale
    cy += p[1] * scale
  }
  return { x: cx / points.length, y: cy / points.length }
}

/**
 * Given a list of obstacles and already-placed labels, find the best position
 * for a label among candidate positions. Returns the candidate with least total overlap.
 * @param excludeObstacle — optional obstacle to skip (e.g. the building that owns this label)
 */
function findBestPosition(
  candidates: AABB[],
  obstacles: AABB[],
  placedLabels: AABB[],
  mapW: number,
  mapH: number,
  labelPadding = 2,
  excludeObstacle?: AABB,
): { index: number; overlap: number } {
  let bestIdx = 0
  let bestOverlap = Infinity

  for (let i = 0; i < candidates.length; i++) {
    const c = candidates[i]

    // Penalise out-of-bounds heavily
    if (!isInsideBounds(c, mapW, mapH, 1)) {
      const penalty = 100000
      if (penalty < bestOverlap) {
        bestOverlap = penalty
        bestIdx = i
      }
      continue
    }

    let totalOverlap = 0

    // Check against obstacles (buildings, roads, etc.)
    for (const obs of obstacles) {
      // Skip the obstacle that owns this label (e.g. don't penalise a building label for touching its own building)
      if (excludeObstacle && obs === excludeObstacle) continue
      totalOverlap += overlapArea(c, obs)
    }

    // Check against already-placed labels (with padding)
    for (const pl of placedLabels) {
      const padded: AABB = {
        x: pl.x - labelPadding,
        y: pl.y - labelPadding,
        w: pl.w + labelPadding * 2,
        h: pl.h + labelPadding * 2,
      }
      totalOverlap += overlapArea(c, padded) * 3  // Weight label-label overlap higher
    }

    if (totalOverlap < bestOverlap) {
      bestOverlap = totalOverlap
      bestIdx = i
    }

    // Perfect — no overlap at all
    if (totalOverlap === 0) break
  }

  return { index: bestIdx, overlap: bestOverlap }
}

interface LabelInfo {
  x: number
  y: number
  text: string
  fontSize: number
  fontWeight: string
  rotate?: number
  aabb: AABB            // pre-computed bounding box for collision tracking
  leaderFrom?: { x: number; y: number }  // if set, draw a leader line from this point to label
}

function renderMapToSvg(
  svgEl: SVGSVGElement,
  mapView: MapView,
  scale: number,
) {
  const svg = d3.select(svgEl)
  svg.selectAll('*').remove()

  const mapW = mapView.width * scale
  const mapH = mapView.height * scale

  // Background
  svg
    .append('rect')
    .attr('width', mapW)
    .attr('height', mapH)
    .attr('fill', '#FAFAF7')
    .attr('rx', 8)

  // Create layer groups for z-ordering
  const gAreas = svg.append('g').attr('class', 'layer-areas')
  const gNature = svg.append('g').attr('class', 'layer-nature')
  const gRivers = svg.append('g').attr('class', 'layer-rivers')
  const gRoads = svg.append('g').attr('class', 'layer-roads')
  const gBuildings = svg.append('g').attr('class', 'layer-buildings')
  const gLeaders = svg.append('g').attr('class', 'layer-leaders')
  const gLabels = svg.append('g').attr('class', 'layer-labels')

  function getLayer(type: string) {
    switch (type) {
      case 'area': return gAreas
      case 'park':
      case 'lake': return gNature
      case 'river': return gRivers
      case 'road': return gRoads
      case 'building': return gBuildings
      default: return gLabels
    }
  }

  // Responsive label font sizes
  const labelFontSize = Math.max(9, Math.round(scale * 3))
  const featureFontSize = Math.max(7, Math.round(scale * 2.2))

  // Sort features by z-order for processing
  const sortedFeatures = [...mapView.features].sort(
    (a, b) => (Z_ORDER[a.type] ?? 5) - (Z_ORDER[b.type] ?? 5)
  )

  // ── Phase 1: Collect all obstacle AABBs (geometry shapes) ──
  const obstacles: AABB[] = []
  // Map from feature index to its obstacle AABB (for buildings to exclude own obstacle)
  const featureObstacleMap = new Map<number, AABB>()

  // Pre-scan all features to build obstacle list before placing any labels
  sortedFeatures.forEach((feat: MapFeature, idx: number) => {
    if (feat.type === 'building' || feat.type === 'area') {
      const obs: AABB = {
        x: (feat.x || 0) * scale,
        y: (feat.y || 0) * scale,
        w: (feat.width || 10) * scale,
        h: (feat.height || 8) * scale,
      }
      obstacles.push(obs)
      featureObstacleMap.set(idx, obs)
    }
    if (feat.type === 'park' || feat.type === 'lake') {
      if (feat.x != null && feat.y != null && feat.width && feat.height) {
        obstacles.push({
          x: feat.x * scale,
          y: feat.y * scale,
          w: feat.width * scale,
          h: feat.height * scale,
        })
      } else if (feat.points?.length) {
        // Bounding box of polygon
        let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
        for (const p of feat.points) {
          minX = Math.min(minX, p[0] * scale)
          minY = Math.min(minY, p[1] * scale)
          maxX = Math.max(maxX, p[0] * scale)
          maxY = Math.max(maxY, p[1] * scale)
        }
        obstacles.push({ x: minX, y: minY, w: maxX - minX, h: maxY - minY })
      }
    }
    if ((feat.type === 'road' || feat.type === 'river') && feat.points?.length) {
      // Road/river buffer: approximate as thick line bounding boxes per segment
      const roadHalfWidth = feat.type === 'road'
        ? Math.max(3, (FEATURE_STYLES.road.strokeWidth * scale / 3) + 1.5) / 2
        : Math.max(3, (FEATURE_STYLES.river.strokeWidth * scale / 3)) / 2
      for (let i = 1; i < feat.points.length; i++) {
        const x1 = feat.points[i - 1][0] * scale
        const y1 = feat.points[i - 1][1] * scale
        const x2 = feat.points[i][0] * scale
        const y2 = feat.points[i][1] * scale
        obstacles.push({
          x: Math.min(x1, x2) - roadHalfWidth,
          y: Math.min(y1, y2) - roadHalfWidth,
          w: Math.abs(x2 - x1) + roadHalfWidth * 2,
          h: Math.abs(y2 - y1) + roadHalfWidth * 2,
        })
      }
    }
  })

  // ── Phase 2: Draw shapes and collect deferred labels ──
  // We collect "raw" label requests, then intelligently place them

  interface RawLabel {
    anchorX: number       // Original anchor point X (center of where label "wants" to be)
    anchorY: number       // Original anchor point Y
    text: string
    fontSize: number
    fontWeight: string
    rotate?: number
    type: 'building' | 'road' | 'river' | 'area' | 'park' | 'lake' | 'label'
    // For building labels: the building rect
    buildingRect?: AABB
    // The obstacle AABB that "owns" this label (to exclude from collision)
    ownObstacle?: AABB
    // For path labels: the raw points for multi-candidate sampling
    pathPoints?: [number, number][]
    pathAngle?: number
  }

  const rawLabels: RawLabel[] = []

  sortedFeatures.forEach((feat: MapFeature, featIdx: number) => {
    const style = FEATURE_STYLES[feat.type] || FEATURE_STYLES.building
    const layer = getLayer(feat.type)

    // ── Draw shapes ──

    if (feat.type === 'building') {
      const bx = (feat.x || 0) * scale
      const by = (feat.y || 0) * scale
      const bw = (feat.width || 10) * scale
      const bh = (feat.height || 8) * scale
      layer.append('rect')
        .attr('x', bx)
        .attr('y', by)
        .attr('width', bw)
        .attr('height', bh)
        .attr('fill', style.fill)
        .attr('stroke', style.stroke)
        .attr('stroke-width', style.strokeWidth)
        .attr('rx', 2)
        .attr('filter', 'drop-shadow(0 1px 1px rgba(0,0,0,0.1))')

      if (feat.label) {
        // Adaptive font size for long labels on small buildings
        let fs = featureFontSize
        const textW = estimateTextWidth(feat.label, fs)
        if (textW > bw * 2.5) {
          fs = Math.max(6, fs * (bw * 2.5) / textW)
        }

        rawLabels.push({
          anchorX: bx + bw / 2,
          anchorY: by + bh + fs * 0.9,
          text: feat.label,
          fontSize: fs,
          fontWeight: '400',
          type: 'building',
          buildingRect: { x: bx, y: by, w: bw, h: bh },
          ownObstacle: featureObstacleMap.get(featIdx),
        })
      }
    }

    if (feat.type === 'area') {
      const ax = (feat.x || 0) * scale
      const ay = (feat.y || 0) * scale
      const aw = (feat.width || 10) * scale
      const ah = (feat.height || 8) * scale
      layer.append('rect')
        .attr('x', ax)
        .attr('y', ay)
        .attr('width', aw)
        .attr('height', ah)
        .attr('fill', `${style.fill}30`)
        .attr('stroke', style.stroke)
        .attr('stroke-width', style.strokeWidth)
        .attr('stroke-dasharray', '4,2')
        .attr('rx', 2)

      if (feat.label) {
        rawLabels.push({
          anchorX: ax + aw / 2,
          anchorY: ay + ah / 2,
          text: feat.label,
          fontSize: featureFontSize,
          fontWeight: '500',
          type: 'area',
        })
      }
    }

    if ((feat.type === 'road') && feat.points?.length) {
      const line = d3.line<[number, number]>()
        .x(d => d[0] * scale)
        .y(d => d[1] * scale)
        .curve(d3.curveLinear)
      layer.append('path')
        .attr('d', line(feat.points))
        .attr('fill', 'none')
        .attr('stroke', '#B2BEC3')
        .attr('stroke-width', Math.max(3, style.strokeWidth * scale / 3))
        .attr('stroke-linecap', 'round')
        .attr('stroke-dasharray', 'none')
      // Road edge (darker line underneath for depth)
      layer.insert('path', ':first-child')
        .attr('d', line(feat.points))
        .attr('fill', 'none')
        .attr('stroke', style.stroke)
        .attr('stroke-width', Math.max(3, style.strokeWidth * scale / 3) + 1.5)
        .attr('stroke-linecap', 'round')

      if (feat.label) {
        const mid = getPathMidpoint(feat.points, scale)
        let angle = mid.angle
        if (angle > 90) angle -= 180
        if (angle < -90) angle += 180
        const perpOffset = featureFontSize * 0.9
        const rad = (mid.angle - 90) * (Math.PI / 180)
        rawLabels.push({
          anchorX: mid.x + Math.cos(rad) * perpOffset,
          anchorY: mid.y + Math.sin(rad) * perpOffset,
          text: feat.label,
          fontSize: featureFontSize * 0.9,
          fontWeight: '500',
          rotate: angle,
          type: 'road',
          pathPoints: feat.points,
          pathAngle: mid.angle,
        })
      }
    }

    if ((feat.type === 'river') && feat.points?.length) {
      const line = d3.line<[number, number]>()
        .x(d => d[0] * scale)
        .y(d => d[1] * scale)
        .curve(d3.curveBasis)
      layer.append('path')
        .attr('d', line(feat.points))
        .attr('fill', 'none')
        .attr('stroke', style.stroke)
        .attr('stroke-width', Math.max(3, style.strokeWidth * scale / 3))
        .attr('stroke-linecap', 'round')
        .attr('stroke-opacity', 0.8)

      if (feat.label) {
        const mid = getPathMidpoint(feat.points, scale)
        let angle = mid.angle
        if (angle > 90) angle -= 180
        if (angle < -90) angle += 180
        const perpOffset = featureFontSize * 1.2
        const rad = (mid.angle - 90) * (Math.PI / 180)
        rawLabels.push({
          anchorX: mid.x + Math.cos(rad) * perpOffset,
          anchorY: mid.y + Math.sin(rad) * perpOffset,
          text: feat.label,
          fontSize: featureFontSize * 0.9,
          fontWeight: '500',
          rotate: angle,
          type: 'river',
          pathPoints: feat.points,
          pathAngle: mid.angle,
        })
      }
    }

    // Park and lake: polygon or rect
    if (feat.type === 'park' || feat.type === 'lake') {
      if (feat.points?.length) {
        const pts = feat.points.map(p => `${p[0] * scale},${p[1] * scale}`).join(' ')
        layer.append('polygon')
          .attr('points', pts)
          .attr('fill', `${style.fill}50`)
          .attr('stroke', style.stroke)
          .attr('stroke-width', style.strokeWidth)
        if (feat.label) {
          const c = polygonCentroid(feat.points, scale)
          rawLabels.push({
            anchorX: c.x,
            anchorY: c.y,
            text: feat.label,
            fontSize: featureFontSize,
            fontWeight: '500',
            type: feat.type,
          })
        }
      } else if (feat.x != null && feat.y != null && feat.width && feat.height) {
        const rx = feat.x * scale
        const ry = feat.y * scale
        const rw = feat.width * scale
        const rh = feat.height * scale
        layer.append('rect')
          .attr('x', rx)
          .attr('y', ry)
          .attr('width', rw)
          .attr('height', rh)
          .attr('fill', `${style.fill}50`)
          .attr('stroke', style.stroke)
          .attr('stroke-width', style.strokeWidth)
          .attr('rx', feat.type === 'lake' ? rw / 3 : 4)
        if (feat.label) {
          rawLabels.push({
            anchorX: rx + rw / 2,
            anchorY: ry + rh / 2,
            text: feat.label,
            fontSize: featureFontSize,
            fontWeight: '500',
            type: feat.type,
          })
        }
      }
    }

    // Standalone label type
    if (feat.type === 'label' && feat.label) {
      rawLabels.push({
        anchorX: (feat.x || 0) * scale,
        anchorY: (feat.y || 0) * scale,
        text: feat.label,
        fontSize: labelFontSize,
        fontWeight: '600',
        type: 'label',
      })
    }
  })

  // ── Phase 3: Intelligent label placement ──
  // Process labels in priority order: standalone labels first, then area/park/lake (inside shapes),
  // then buildings, then roads/rivers

  const placedLabels: AABB[] = []
  const finalLabels: LabelInfo[] = []

  // Helper: generate 4-direction candidate AABBs for a building label
  function buildingCandidates(br: AABB, text: string, fontSize: number): { cx: number; cy: number; aabb: AABB }[] {
    const gap = fontSize * 0.4  // gap between building edge and label
    const candidates: { cx: number; cy: number; aabb: AABB }[] = []

    // Below
    const belowCx = br.x + br.w / 2
    const belowCy = br.y + br.h + gap + fontSize / 2
    candidates.push({ cx: belowCx, cy: belowCy, aabb: labelAABB(belowCx, belowCy, text, fontSize) })

    // Above
    const aboveCy = br.y - gap - fontSize / 2
    candidates.push({ cx: belowCx, cy: aboveCy, aabb: labelAABB(belowCx, aboveCy, text, fontSize) })

    // Right
    const tw = estimateTextWidth(text, fontSize)
    const rightCx = br.x + br.w + gap + tw / 2 + 3
    const rightCy = br.y + br.h / 2
    candidates.push({ cx: rightCx, cy: rightCy, aabb: labelAABB(rightCx, rightCy, text, fontSize) })

    // Left
    const leftCx = br.x - gap - tw / 2 - 3
    candidates.push({ cx: leftCx, cy: rightCy, aabb: labelAABB(leftCx, rightCy, text, fontSize) })

    return candidates
  }

  // Sort rawLabels by type priority
  const typePriority: Record<string, number> = {
    label: 0,    // Standalone labels first (title etc.)
    area: 1,     // Area labels centered — stable
    park: 2,
    lake: 2,
    building: 3, // Buildings need multi-direction
    road: 4,     // Paths last — most flexible
    river: 4,
  }
  rawLabels.sort((a, b) => (typePriority[a.type] ?? 5) - (typePriority[b.type] ?? 5))

  for (const raw of rawLabels) {
    if (raw.type === 'label' || raw.type === 'area' || raw.type === 'park' || raw.type === 'lake') {
      // These labels are placed at their natural position (centroid)
      const aabb = labelAABB(raw.anchorX, raw.anchorY, raw.text, raw.fontSize)
      placedLabels.push(aabb)
      finalLabels.push({
        x: raw.anchorX,
        y: raw.anchorY,
        text: raw.text,
        fontSize: raw.fontSize,
        fontWeight: raw.fontWeight,
        rotate: raw.rotate,
        aabb,
      })
    } else if (raw.type === 'building' && raw.buildingRect) {
      // Try 4 directions around the building
      const cands = buildingCandidates(raw.buildingRect, raw.text, raw.fontSize)
      const candAABBs = cands.map(c => c.aabb)
      const { index, overlap } = findBestPosition(candAABBs, obstacles, placedLabels, mapW, mapH, 2, raw.ownObstacle)

      const chosen = cands[index]

      // If even the best candidate has significant overlap, try leader line
      if (overlap > 50) {
        // Try offset positions further away (leader line candidates)
        const br = raw.buildingRect
        const leaderDist = Math.max(br.w, br.h) * 1.5 + raw.fontSize * 2
        const leaderCands: { cx: number; cy: number; aabb: AABB }[] = []
        const anchorCx = br.x + br.w / 2
        const anchorCy = br.y + br.h / 2

        for (let angle = 0; angle < 360; angle += 45) {
          const rad = (angle * Math.PI) / 180
          const lx = anchorCx + Math.cos(rad) * leaderDist
          const ly = anchorCy + Math.sin(rad) * leaderDist
          leaderCands.push({ cx: lx, cy: ly, aabb: labelAABB(lx, ly, raw.text, raw.fontSize) })
        }

        const leaderAABBs = leaderCands.map(c => c.aabb)
        const leaderResult = findBestPosition(leaderAABBs, obstacles, placedLabels, mapW, mapH, 2, raw.ownObstacle)

        if (leaderResult.overlap < overlap) {
          // Leader line is better
          const lc = leaderCands[leaderResult.index]
          placedLabels.push(lc.aabb)
          finalLabels.push({
            x: lc.cx,
            y: lc.cy,
            text: raw.text,
            fontSize: raw.fontSize,
            fontWeight: raw.fontWeight,
            aabb: lc.aabb,
            leaderFrom: { x: anchorCx, y: anchorCy },
          })
          continue
        }
      }

      placedLabels.push(chosen.aabb)
      finalLabels.push({
        x: chosen.cx,
        y: chosen.cy,
        text: raw.text,
        fontSize: raw.fontSize,
        fontWeight: raw.fontWeight,
        aabb: chosen.aabb,
      })
    } else if ((raw.type === 'road' || raw.type === 'river') && raw.pathPoints) {
      // Sample multiple positions along the path
      const samples = samplePathPositions(raw.pathPoints, scale, 7)
      const perpDist = raw.fontSize * 1.0

      // For each sample point, try both perpendicular sides
      const cands: { cx: number; cy: number; angle: number; aabb: AABB }[] = []
      for (const sample of samples) {
        let normalizedAngle = sample.angle
        if (normalizedAngle > 90) normalizedAngle -= 180
        if (normalizedAngle < -90) normalizedAngle += 180

        // Side 1 (perpendicular offset)
        const rad1 = (sample.angle - 90) * (Math.PI / 180)
        const cx1 = sample.x + Math.cos(rad1) * perpDist
        const cy1 = sample.y + Math.sin(rad1) * perpDist
        cands.push({
          cx: cx1,
          cy: cy1,
          angle: normalizedAngle,
          aabb: labelAABB(cx1, cy1, raw.text, raw.fontSize),
        })

        // Side 2 (opposite perpendicular)
        const rad2 = (sample.angle + 90) * (Math.PI / 180)
        const cx2 = sample.x + Math.cos(rad2) * perpDist
        const cy2 = sample.y + Math.sin(rad2) * perpDist
        cands.push({
          cx: cx2,
          cy: cy2,
          angle: normalizedAngle,
          aabb: labelAABB(cx2, cy2, raw.text, raw.fontSize),
        })
      }

      const candAABBs = cands.map(c => c.aabb)
      const { index } = findBestPosition(candAABBs, obstacles, placedLabels, mapW, mapH)
      const chosen = cands[index]

      placedLabels.push(chosen.aabb)
      finalLabels.push({
        x: chosen.cx,
        y: chosen.cy,
        text: raw.text,
        fontSize: raw.fontSize,
        fontWeight: raw.fontWeight,
        rotate: chosen.angle,
        aabb: chosen.aabb,
      })
    }
  }

  // ── Phase 4: Render leader lines ──
  finalLabels.forEach((lbl) => {
    if (lbl.leaderFrom) {
      gLeaders.append('line')
        .attr('x1', lbl.leaderFrom.x)
        .attr('y1', lbl.leaderFrom.y)
        .attr('x2', lbl.x)
        .attr('y2', lbl.y)
        .attr('stroke', '#636E72')
        .attr('stroke-width', 0.7)
        .attr('stroke-dasharray', '2,2')
        .attr('opacity', 0.5)

      // Small dot at anchor
      gLeaders.append('circle')
        .attr('cx', lbl.leaderFrom.x)
        .attr('cy', lbl.leaderFrom.y)
        .attr('r', 1.5)
        .attr('fill', '#636E72')
        .attr('opacity', 0.5)
    }
  })

  // ── Phase 5: Render all labels with white background halos ──
  finalLabels.forEach((lbl) => {
    const textW = estimateTextWidth(lbl.text, lbl.fontSize)
    const textH = lbl.fontSize

    const padX = 3
    const padY = 1.5
    const haloGroup = gLabels.append('g')

    if (lbl.rotate) {
      haloGroup.attr('transform', `translate(${lbl.x},${lbl.y}) rotate(${lbl.rotate})`)

      haloGroup.append('rect')
        .attr('x', -textW / 2 - padX)
        .attr('y', -textH / 2 - padY)
        .attr('width', textW + padX * 2)
        .attr('height', textH + padY * 2)
        .attr('fill', 'rgba(255,255,255,0.85)')
        .attr('rx', 2)
        .attr('stroke', 'none')

      haloGroup.append('text')
        .attr('x', 0)
        .attr('y', 0)
        .attr('text-anchor', 'middle')
        .attr('dominant-baseline', 'central')
        .attr('font-size', lbl.fontSize)
        .attr('fill', '#2D3436')
        .attr('font-weight', lbl.fontWeight)
        .attr('font-family', '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif')
        .text(lbl.text)
    } else {
      haloGroup.append('rect')
        .attr('x', lbl.x - textW / 2 - padX)
        .attr('y', lbl.y - textH / 2 - padY)
        .attr('width', textW + padX * 2)
        .attr('height', textH + padY * 2)
        .attr('fill', 'rgba(255,255,255,0.85)')
        .attr('rx', 2)
        .attr('stroke', 'none')

      haloGroup.append('text')
        .attr('x', lbl.x)
        .attr('y', lbl.y)
        .attr('text-anchor', 'middle')
        .attr('dominant-baseline', 'central')
        .attr('font-size', lbl.fontSize)
        .attr('fill', '#2D3436')
        .attr('font-weight', lbl.fontWeight)
        .attr('font-family', '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif')
        .text(lbl.text)
    }
  })
}

export function D3MapRenderer({ chartData }: { chartData: ChartData }) {
  const svg1Ref = useRef<SVGSVGElement>(null)
  const svg2Ref = useRef<SVGSVGElement>(null)
  const wrapperRef = useRef<HTMLDivElement>(null)
  const [containerWidth, setContainerWidth] = useState(800)

  const maps = chartData.maps as MapView[] | undefined

  useEffect(() => {
    if (!wrapperRef.current) return
    const ro = new ResizeObserver((entries) => {
      const w = entries[0]?.contentRect?.width
      if (w) setContainerWidth(w)
    })
    ro.observe(wrapperRef.current)
    setContainerWidth(wrapperRef.current.clientWidth)
    return () => ro.disconnect()
  }, [])

  useEffect(() => {
    if (!maps || maps.length < 2) return

    // Dynamic scale: fit each map to half the container (side by side) or full width (stacked)
    const useSideBySide = containerWidth > 520
    const availableWidth = useSideBySide ? (containerWidth - 32) / 2 : containerWidth - 16
    const mapGridWidth = maps[0].width || 100
    const scale = Math.max(2, availableWidth / mapGridWidth)

    if (svg1Ref.current) renderMapToSvg(svg1Ref.current, maps[0], scale)
    if (svg2Ref.current) renderMapToSvg(svg2Ref.current, maps[1], scale)
  }, [maps, containerWidth])

  if (!maps || maps.length < 2) {
    return (
      <div className="mt-4 p-4 bg-[#F7F6F2] rounded-xl text-center">
        <p className="text-[11px] text-[#636E72]">Map data not available</p>
      </div>
    )
  }

  const useSideBySide = containerWidth > 520
  const availableWidth = useSideBySide ? (containerWidth - 32) / 2 : containerWidth - 16
  const mapGridWidth = maps[0].width || 100
  const mapGridHeight = maps[0].height || 100
  const scale = Math.max(2, availableWidth / mapGridWidth)
  const mapW = mapGridWidth * scale
  const mapH = mapGridHeight * scale

  return (
    <div className="mt-4" ref={wrapperRef}>
      {chartData.title && (
        <p className="text-xs text-[#636E72] mb-3 text-center font-medium">{chartData.title}</p>
      )}
      <div className={`flex ${useSideBySide ? 'flex-row' : 'flex-col'} gap-4 justify-center`}>
        {/* Map 1 */}
        <div className="flex flex-col items-center flex-1 min-w-0">
          <p className="text-[11px] font-semibold text-[#2D3436] mb-1.5">{maps[0].label}</p>
          <div className="border border-[#DFE6E9]/50 rounded-xl overflow-hidden bg-[#FAFAF7]">
            <svg
              ref={svg1Ref}
              viewBox={`0 0 ${mapW} ${mapH}`}
              className="w-full"
              style={{ maxHeight: useSideBySide ? '400px' : '350px' }}
            />
          </div>
        </div>
        {/* Map 2 */}
        <div className="flex flex-col items-center flex-1 min-w-0">
          <p className="text-[11px] font-semibold text-[#2D3436] mb-1.5">{maps[1].label}</p>
          <div className="border border-[#DFE6E9]/50 rounded-xl overflow-hidden bg-[#FAFAF7]">
            <svg
              ref={svg2Ref}
              viewBox={`0 0 ${mapW} ${mapH}`}
              className="w-full"
              style={{ maxHeight: useSideBySide ? '400px' : '350px' }}
            />
          </div>
        </div>
      </div>
    </div>
  )
}
