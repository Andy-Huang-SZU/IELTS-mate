import { NavLink, useLocation } from 'react-router-dom'
import { useCallback, useEffect, useRef, useState } from 'react'
import './Dock.css'

import iconHome from '@renderer/assets/icons/icon_home_attr1_subject.png'
import iconVocab from '@renderer/assets/icons/icon_vocab_attr1_subject.png'
import iconWriting from '@renderer/assets/icons/icon_writing_attr1_subject.png'
import iconSpeaking from '@renderer/assets/icons/icon_speaking_attr1_subject.png'
import iconSettings from '@renderer/assets/icons/icon_settings_attr1_subject.png'

interface DockItem {
  to: string
  icon: string
  label: string
}

const dockItems: DockItem[] = [
  { to: '/', icon: iconHome, label: 'Home' },
  { to: '/vocabulary', icon: iconVocab, label: 'Vocab' },
  { to: '/writing', icon: iconWriting, label: 'Writing' },
  { to: '/speaking', icon: iconSpeaking, label: 'Speaking' },
  { to: '/settings', icon: iconSettings, label: 'Settings' },
]

export function Dock(): JSX.Element {
  const [open, setOpen] = useState(false)
  const location = useLocation()
  const containerRef = useRef<HTMLDivElement>(null)
  const closeTimer = useRef<ReturnType<typeof setTimeout>>()

  useEffect(() => { setOpen(false) }, [location.pathname])

  useEffect(() => {
    if (!open) return
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  const onEnter = useCallback(() => {
    if (closeTimer.current) clearTimeout(closeTimer.current)
    setOpen(true)
  }, [])

  const onLeave = useCallback(() => {
    closeTimer.current = setTimeout(() => setOpen(false), 400)
  }, [])

  const isActive = (path: string) =>
    path === '/' ? location.pathname === '/' : location.pathname.startsWith(path)

  return (
    <div
      ref={containerRef}
      className="dock-zone"
      onMouseEnter={onEnter}
      onMouseLeave={onLeave}
    >
      {/* 图标行 — 水平居中排列，整体从下方滑入 */}
      <div className={`dock-bar ${open ? 'dock-bar-open' : ''}`}>
        {dockItems.map((item) => {
          const active = isActive(item.to)
          return (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === '/'}
              className="dock-item"
              title={item.label}
            >
              <div className={`dock-icon ${active ? 'dock-icon-active' : ''}`}>
                <img src={item.icon} alt={item.label} className="dock-icon-img" draggable={false} />
              </div>
              <span className="dock-label">{item.label}</span>
            </NavLink>
          )
        })}
      </div>
    </div>
  )
}
