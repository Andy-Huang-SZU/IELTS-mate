"""
Topic Generation Service — Prompt Engineering + Validation + Retry

Supports all Task 1 chart types (bar, line, pie, table, map, mixed, process)
and all Task 2 question types (opinion, discussion, problem_solution, two_part, advantage_disadvantage).
"""

from __future__ import annotations

import asyncio
import json
import logging
import re
import subprocess
import uuid
from pathlib import Path
from typing import Any

from app.services.llm.base import BaseLLMClient, ChatResult

logger = logging.getLogger(__name__)

MAX_RETRIES = 3

# Resolve the mermaid validator script path
MERMAID_VALIDATOR = Path(__file__).resolve().parent.parent.parent / "scripts" / "validate_mermaid.mjs"


def _strip_json_fence(text: str) -> str:
    """Remove ```json ... ``` fences from LLM output."""
    text = text.strip()
    text = re.sub(r"^```(?:json)?\s*\n?", "", text)
    text = re.sub(r"\n?```\s*$", "", text)
    return text.strip()


def _generate_topic_id(task_type: str, chart_type: str | None, question_type: str | None) -> str:
    """Generate a unique topic ID like t1_bar_a3f2 or t2_opinion_b1c4."""
    suffix = uuid.uuid4().hex[:4]
    if task_type == "part_a":
        return f"t1_{chart_type or 'unknown'}_{suffix}"
    return f"t2_{question_type or 'unknown'}_{suffix}"


# ─────────────────────────────────────────────
# Topic Themes / Categories
# ─────────────────────────────────────────────

TOPIC_THEMES = [
    "education", "technology", "environment", "health", "society",
    "government", "work & employment", "culture", "transport",
    "science & innovation", "media", "urbanisation", "crime & law",
    "economics", "food & agriculture",
]


# ─────────────────────────────────────────────
# Task 1 Prompts
# ─────────────────────────────────────────────

_TASK1_BAR_PROMPT = """You are an IELTS examiner creating a realistic Academic Writing Task 1 question with a BAR CHART.

Requirements:
- The data must be realistic, varied, and based on a plausible real-world scenario
- Include 4-8 categories on the x-axis
- Include 1-3 data series for comparison
- Values should be realistic numbers (not round hundreds)
- The prompt must ask candidates to "summarise the information by selecting and reporting the main features, and make comparisons where relevant"

Return ONLY valid JSON (no markdown fences) with this exact structure:
{{
  "task_type": "part_a",
  "prompt": "<full IELTS Task 1 question text describing what the bar chart shows>",
  "chart_type": "bar",
  "chart_data": {{
    "title": "<descriptive chart title>",
    "categories": ["cat1", "cat2", ...],
    "series": [{{"name": "Series1", "data": [num1, num2, ...]}}, ...],
    "unit": "<%|million|thousand|...>"
  }},
  "question_type": null,
  "topic_tags": ["<theme1>", "<theme2>"],
  "difficulty": "<easy|medium|hard>"
}}

Theme to focus on: {theme}"""

_TASK1_LINE_PROMPT = """You are an IELTS examiner creating a realistic Academic Writing Task 1 question with a LINE GRAPH.

Requirements:
- Show trends over time (years, months, or decades)
- Include 5-10 time points on the x-axis
- Include 2-4 data series showing different trends
- Data should show clear trends (increases, decreases, fluctuations)
- The prompt must ask candidates to "summarise the information by selecting and reporting the main features, and make comparisons where relevant"

Return ONLY valid JSON (no markdown fences) with this exact structure:
{{
  "task_type": "part_a",
  "prompt": "<full IELTS Task 1 question text describing what the line graph shows>",
  "chart_type": "line",
  "chart_data": {{
    "title": "<descriptive chart title>",
    "categories": ["2000", "2005", ...],
    "series": [{{"name": "Series1", "data": [num1, num2, ...]}}, ...],
    "unit": "<%|million|...>"
  }},
  "question_type": null,
  "topic_tags": ["<theme1>", "<theme2>"],
  "difficulty": "<easy|medium|hard>"
}}

Theme to focus on: {theme}"""

_TASK1_PIE_PROMPT = """You are an IELTS examiner creating a realistic Academic Writing Task 1 question with PIE CHART(s).

Requirements:
- Include 4-7 segments that sum to 100%
- Optionally include 2 pie charts for comparison (e.g. two different years or countries)
- Data should show meaningful proportional differences
- The prompt must ask candidates to "summarise the information by selecting and reporting the main features, and make comparisons where relevant"

Return ONLY valid JSON (no markdown fences) with this exact structure:
{{
  "task_type": "part_a",
  "prompt": "<full IELTS Task 1 question text describing what the pie chart(s) show>",
  "chart_type": "pie",
  "chart_data": {{
    "title": "<descriptive chart title>",
    "categories": ["segment1", "segment2", ...],
    "series": [{{"name": "Year/Country1", "data": [25, 30, 15, ...]}}, ...],
    "unit": "%"
  }},
  "question_type": null,
  "topic_tags": ["<theme1>", "<theme2>"],
  "difficulty": "<easy|medium|hard>"
}}

Theme to focus on: {theme}"""

_TASK1_TABLE_PROMPT = """You are an IELTS examiner creating a realistic Academic Writing Task 1 question with a TABLE.

Requirements:
- Create a data table with 4-6 rows and 3-5 columns
- Row headers represent categories, column headers represent different dimensions/years
- Data should contain realistic numbers that show interesting patterns
- The prompt must ask candidates to "summarise the information by selecting and reporting the main features, and make comparisons where relevant"

Return ONLY valid JSON (no markdown fences) with this exact structure:
{{
  "task_type": "part_a",
  "prompt": "<full IELTS Task 1 question text describing what the table shows>",
  "chart_type": "table",
  "chart_data": {{
    "title": "<descriptive table title>",
    "columns": ["Category", "Column1", "Column2", ...],
    "rows": [
      ["Row1 Label", 100, 200, ...],
      ["Row2 Label", 150, 180, ...],
      ...
    ],
    "unit": "<%|million|thousand|...>"
  }},
  "question_type": null,
  "topic_tags": ["<theme1>", "<theme2>"],
  "difficulty": "<easy|medium|hard>"
}}

Theme to focus on: {theme}"""

_TASK1_MAP_PROMPT = """You are an IELTS examiner creating a realistic Academic Writing Task 1 question with TWO MAPS showing changes to an area over time.

Requirements:
- Create two maps of the SAME location at different time points (e.g., "in 2005" and "in 2025")
- The maps should show clear development/changes (new buildings, roads, demolished structures, land use changes)
- Include 8-15 features per map with a mix of types: buildings, roads, rivers, parks, lakes, areas
- All coordinates use a normalised 0-100 grid system
- Buildings use x/y/width/height (rectangles), roads/rivers use "points" (array of [x,y] path coordinates)
- Parks and lakes use "points" for polygon shapes OR x/y/width/height for rectangles
- The prompt must follow the official format: "The two maps below show..." + "Summarise the information by selecting and reporting the main features, and make comparisons where relevant."
- The second map should show realistic changes: some features remain, some are new, some are modified or removed

LAYOUT CONSTRAINTS (very important for clear rendering):
- Minimum gap between adjacent buildings: at least 5 coordinate units (edge-to-edge)
- Buildings must NOT overlap with roads or rivers (keep at least 3 units away from path coordinates)
- Keep all features within the 5-95 coordinate range (leave margins from map edges)
- Feature labels should be short: maximum 15 characters (e.g., "School" not "Old Primary School Building")
- Small buildings (width or height < 10) should have especially short labels (≤ 10 chars)
- Roads should have at least 8 coordinate units of clear space on each side for buildings
- Rivers should flow clearly with spacing from buildings (at least 5 units)
- Avoid clustering more than 3 buildings in the same 20×20 coordinate area

Return ONLY valid JSON (no markdown fences) with this exact structure:
{{
  "task_type": "part_a",
  "prompt": "<full IELTS Task 1 question text describing what the two maps show>",
  "chart_type": "map",
  "chart_data": {{
    "title": "<descriptive title>",
    "maps": [
      {{
        "label": "<time label, e.g. 2005>",
        "width": 100,
        "height": 100,
        "features": [
          {{"type": "building", "id": "b1", "label": "Hospital", "x": 20, "y": 30, "width": 15, "height": 10}},
          {{"type": "road", "id": "r1", "label": "Main Road", "points": [[0, 50], [100, 50]]}},
          {{"type": "river", "id": "rv1", "label": "River Exe", "points": [[50, 0], [55, 30], [50, 60], [52, 100]]}},
          {{"type": "park", "id": "p1", "label": "Central Park", "points": [[60, 20], [80, 20], [80, 40], [60, 40]]}},
          {{"type": "lake", "id": "lk1", "label": "Duck Pond", "points": [[70, 60], [80, 55], [85, 65], [75, 70]]}},
          {{"type": "area", "id": "a1", "label": "Farmland", "x": 5, "y": 5, "width": 30, "height": 25}},
          {{"type": "label", "id": "lb1", "label": "North", "x": 50, "y": 2}}
        ]
      }},
      {{
        "label": "<time label, e.g. 2025>",
        "width": 100,
        "height": 100,
        "features": [
          // Similar structure with changes reflecting development
        ]
      }}
    ]
  }},
  "question_type": null,
  "topic_tags": ["<theme1>", "<theme2>"],
  "difficulty": "<easy|medium|hard>"
}}

Theme to focus on: {theme}"""

_TASK1_MIXED_PROMPT = """You are an IELTS examiner creating a realistic Academic Writing Task 1 question with TWO SEPARATE CHARTS presented together (a mixed/combination question).

Requirements:
- Create exactly TWO independent charts that are thematically related but show different aspects of the same topic
- Common real-exam combinations: bar+pie, bar+table, line+table, pie+pie, bar+bar, line+bar
- Each sub-chart has its own independent chart_type and chart_data
- The prompt must describe BOTH charts: "The bar chart below shows... The pie chart below shows..." or "The charts below show..."
- End with: "Summarise the information by selecting and reporting the main features, and make comparisons where relevant."
- Data should be realistic and thematically connected (e.g., a bar chart showing total visitors and a pie chart showing their nationalities)
- Each sub-chart must use the standard ChartData structure for its type

Choose ONE of these combinations randomly: bar+pie, bar+table, line+table, line+bar, pie+pie, bar+bar

Return ONLY valid JSON (no markdown fences) with this exact structure:
{{
  "task_type": "part_a",
  "prompt": "<full IELTS Task 1 question text describing both charts>",
  "chart_type": "mixed",
  "chart_data": {{
    "title": "<overall descriptive title>",
    "sub_charts": [
      {{
        "chart_type": "<bar|line|pie|table>",
        "chart_data": {{
          "title": "<sub-chart 1 title>",
          "categories": [...],
          "series": [{{"name": "...", "data": [...]}}],
          "unit": "..."
        }}
      }},
      {{
        "chart_type": "<bar|line|pie|table>",
        "chart_data": {{
          "title": "<sub-chart 2 title>",
          "categories": [...],
          "series": [{{"name": "...", "data": [...]}}],
          "unit": "..."
        }}
      }}
    ]
  }},
  "question_type": null,
  "topic_tags": ["<theme1>", "<theme2>"],
  "difficulty": "<easy|medium|hard>"
}}

Note: For table sub-charts, use "columns" and "rows" fields instead of "categories" and "series".

Theme to focus on: {theme}"""

_TASK1_PROCESS_PROMPT = """You are an IELTS examiner creating a realistic Academic Writing Task 1 question with a PROCESS DIAGRAM.

Requirements:
- Describe a natural or man-made process with 6-12 steps
- The process should be realistic (e.g., water treatment, manufacturing, life cycle, recycling)
- Each step should be a clear, concise description (one sentence, under 80 characters)
- Steps should follow a logical sequence from start to finish
- The prompt must ask candidates to "summarise the information by selecting and reporting the main features, and make comparisons where relevant"

Return ONLY valid JSON (no markdown fences) with this exact structure:
{{
  "task_type": "part_a",
  "prompt": "<full IELTS Task 1 question text describing the process>",
  "chart_type": "process",
  "chart_data": {{
    "title": "<process title>",
    "steps": ["Step 1 description", "Step 2 description", ...]
  }},
  "question_type": null,
  "topic_tags": ["<theme1>", "<theme2>"],
  "difficulty": "<easy|medium|hard>"
}}

Theme to focus on: {theme}"""

# ─────────────────────────────────────────────
# Task 2 Prompts
# ─────────────────────────────────────────────

_TASK2_OPINION_PROMPT = """You are an IELTS examiner creating a Writing Task 2 question of type: OPINION / AGREE OR DISAGREE.

Requirements:
- Present a clear statement that candidates can agree or disagree with
- The topic should be debatable with valid points on both sides
- End with: "To what extent do you agree or disagree?"
- Topic should be accessible to international test-takers

Return ONLY valid JSON (no markdown fences) with this exact structure:
{{
  "task_type": "part_b",
  "prompt": "<full IELTS Task 2 question>",
  "chart_type": null,
  "chart_data": null,
  "question_type": "opinion",
  "topic_tags": ["<theme1>", "<theme2>"],
  "difficulty": "<easy|medium|hard>"
}}

Theme to focus on: {theme}"""

_TASK2_DISCUSSION_PROMPT = """You are an IELTS examiner creating a Writing Task 2 question of type: DISCUSSION (Both Views).

Requirements:
- Present two contrasting viewpoints on an issue
- Ask candidates to "discuss both views and give your own opinion"
- Both views should be reasonable and defensible
- Topic should be accessible to international test-takers

Return ONLY valid JSON (no markdown fences) with this exact structure:
{{
  "task_type": "part_b",
  "prompt": "<full IELTS Task 2 question>",
  "chart_type": null,
  "chart_data": null,
  "question_type": "discussion",
  "topic_tags": ["<theme1>", "<theme2>"],
  "difficulty": "<easy|medium|hard>"
}}

Theme to focus on: {theme}"""

_TASK2_PROBLEM_SOLUTION_PROMPT = """You are an IELTS examiner creating a Writing Task 2 question of type: PROBLEM & SOLUTION.

Requirements:
- Describe a societal or environmental problem
- Ask candidates to discuss the causes/problems and suggest solutions
- The problem should be well-known and have multiple possible solutions
- Topic should be accessible to international test-takers

Return ONLY valid JSON (no markdown fences) with this exact structure:
{{
  "task_type": "part_b",
  "prompt": "<full IELTS Task 2 question>",
  "chart_type": null,
  "chart_data": null,
  "question_type": "problem_solution",
  "topic_tags": ["<theme1>", "<theme2>"],
  "difficulty": "<easy|medium|hard>"
}}

Theme to focus on: {theme}"""

_TASK2_TWO_PART_PROMPT = """You are an IELTS examiner creating a Writing Task 2 question of type: TWO-PART QUESTION.

Requirements:
- Present a topic and ask TWO distinct but related questions about it
- The two questions should require different angles of analysis
- Often structured as "Why does X happen?" and "What can be done about it?" or "Is it positive or negative?"
- Topic should be accessible to international test-takers

Return ONLY valid JSON (no markdown fences) with this exact structure:
{{
  "task_type": "part_b",
  "prompt": "<full IELTS Task 2 question with two questions>",
  "chart_type": null,
  "chart_data": null,
  "question_type": "two_part",
  "topic_tags": ["<theme1>", "<theme2>"],
  "difficulty": "<easy|medium|hard>"
}}

Theme to focus on: {theme}"""

_TASK2_ADVANTAGE_DISADVANTAGE_PROMPT = """You are an IELTS examiner creating a Writing Task 2 question of type: ADVANTAGES vs DISADVANTAGES.

Requirements:
- Present a trend, development, or proposal
- Ask candidates to discuss both advantages and disadvantages
- May optionally ask whether the advantages outweigh the disadvantages
- Topic should be accessible to international test-takers

Return ONLY valid JSON (no markdown fences) with this exact structure:
{{
  "task_type": "part_b",
  "prompt": "<full IELTS Task 2 question>",
  "chart_type": null,
  "chart_data": null,
  "question_type": "advantage_disadvantage",
  "topic_tags": ["<theme1>", "<theme2>"],
  "difficulty": "<easy|medium|hard>"
}}

Theme to focus on: {theme}"""

# ─────────────────────────────────────────────
# Prompt Registry
# ─────────────────────────────────────────────

TASK1_PROMPTS: dict[str, str] = {
    "bar": _TASK1_BAR_PROMPT,
    "line": _TASK1_LINE_PROMPT,
    "pie": _TASK1_PIE_PROMPT,
    "table": _TASK1_TABLE_PROMPT,
    "map": _TASK1_MAP_PROMPT,
    "mixed": _TASK1_MIXED_PROMPT,
    "process": _TASK1_PROCESS_PROMPT,
}

TASK2_PROMPTS: dict[str, str] = {
    "opinion": _TASK2_OPINION_PROMPT,
    "discussion": _TASK2_DISCUSSION_PROMPT,
    "problem_solution": _TASK2_PROBLEM_SOLUTION_PROMPT,
    "two_part": _TASK2_TWO_PART_PROMPT,
    "advantage_disadvantage": _TASK2_ADVANTAGE_DISADVANTAGE_PROMPT,
}


# ─────────────────────────────────────────────
# Token Estimation (returns token counts, NOT cost)
# ─────────────────────────────────────────────

# Pre-set estimated output token counts per topic type
TOKEN_ESTIMATES: dict[str, dict[str, int]] = {
    # Task 1
    "bar": {"prompt_tokens": 400, "completion_tokens": 750},
    "line": {"prompt_tokens": 400, "completion_tokens": 750},
    "pie": {"prompt_tokens": 400, "completion_tokens": 700},
    "table": {"prompt_tokens": 400, "completion_tokens": 800},
    "map": {"prompt_tokens": 500, "completion_tokens": 1200},
    "mixed": {"prompt_tokens": 500, "completion_tokens": 1000},
    "process": {"prompt_tokens": 450, "completion_tokens": 700},
    # Task 2
    "opinion": {"prompt_tokens": 250, "completion_tokens": 350},
    "discussion": {"prompt_tokens": 250, "completion_tokens": 350},
    "problem_solution": {"prompt_tokens": 250, "completion_tokens": 350},
    "two_part": {"prompt_tokens": 250, "completion_tokens": 350},
    "advantage_disadvantage": {"prompt_tokens": 250, "completion_tokens": 350},
}


def estimate_tokens(
    task_type: str,
    chart_type: str | None = None,
    question_type: str | None = None,
    count: int = 1,
) -> dict[str, int]:
    """Return estimated token consumption for generating topics.

    Returns dict with prompt_tokens, completion_tokens, total_tokens.
    This is a pure token count estimate, NOT a cost estimate.
    """
    key = chart_type if task_type == "part_a" else question_type
    est = TOKEN_ESTIMATES.get(key or "", {"prompt_tokens": 350, "completion_tokens": 500})
    prompt_tokens = est["prompt_tokens"] * count
    completion_tokens = est["completion_tokens"] * count
    return {
        "prompt_tokens": prompt_tokens,
        "completion_tokens": completion_tokens,
        "total_tokens": prompt_tokens + completion_tokens,
    }


# ─────────────────────────────────────────────
# Mermaid Validation
# ─────────────────────────────────────────────

def validate_mermaid(code: str) -> bool:
    """Validate Mermaid syntax using external Node.js script.

    Returns True if valid, False otherwise.
    If the validator script is missing, returns True (skip validation).
    """
    if not MERMAID_VALIDATOR.exists():
        logger.warning("Mermaid validator script not found at %s, skipping validation", MERMAID_VALIDATOR)
        return True

    try:
        result = subprocess.run(
            ["node", str(MERMAID_VALIDATOR)],
            input=code,
            capture_output=True,
            text=True,
            timeout=10,
        )
        if result.returncode == 0:
            return True
        logger.warning("Mermaid validation failed: %s", result.stderr.strip())
        return False
    except Exception as e:
        logger.warning("Mermaid validation error: %s", e)
        return True  # fail-open: don't block on validator issues


# ─────────────────────────────────────────────
# Core Generation Function
# ─────────────────────────────────────────────

async def generate_topic(
    llm: BaseLLMClient,
    task_type: str,
    chart_type: str | None = None,
    question_type: str | None = None,
    theme: str | None = None,
) -> tuple[dict[str, Any], ChatResult]:
    """Generate a single topic using LLM.

    Args:
        llm: LLM client instance
        task_type: "part_a" or "part_b"
        chart_type: For Task 1: bar/line/pie/table/map/mixed/process
        question_type: For Task 2: opinion/discussion/problem_solution/two_part/advantage_disadvantage
        theme: Topic theme/category. If None, a random theme is used.

    Returns:
        Tuple of (topic_dict, ChatResult with usage info)

    Raises:
        ValueError: If generation fails after all retries
    """
    import random

    # Backward compat: treat "combination" as "mixed"
    if chart_type == "combination":
        chart_type = "mixed"

    if theme is None:
        theme = random.choice(TOPIC_THEMES)

    # Select the right prompt template
    if task_type == "part_a":
        template = TASK1_PROMPTS.get(chart_type or "bar", _TASK1_BAR_PROMPT)
    else:
        template = TASK2_PROMPTS.get(question_type or "opinion", _TASK2_OPINION_PROMPT)

    prompt_text = template.format(theme=theme)

    last_error: Exception | None = None
    last_result: ChatResult | None = None

    for attempt in range(1, MAX_RETRIES + 1):
        try:
            result = await llm.chat(
                messages=[{"role": "user", "content": prompt_text}],
                temperature=0.9,
                max_tokens=2048,
            )
            last_result = result

            cleaned = _strip_json_fence(result.content)
            data = json.loads(cleaned)

            # Validate required fields
            if "task_type" not in data or "prompt" not in data:
                raise ValueError("Missing required fields: task_type, prompt")

            # For process diagrams, validate steps array
            if chart_type == "process":
                steps = data.get("chart_data", {}).get("steps", [])
                if not isinstance(steps, list) or len(steps) < 3:
                    raise ValueError(f"Process topic must have at least 3 steps, got {len(steps) if isinstance(steps, list) else 'non-list'}")

            # For map topics, validate maps structure
            if chart_type == "map":
                maps = data.get("chart_data", {}).get("maps", [])
                if not isinstance(maps, list) or len(maps) != 2:
                    raise ValueError(f"Map topic must have exactly 2 maps, got {len(maps) if isinstance(maps, list) else 'non-list'}")
                for mi, m in enumerate(maps):
                    features = m.get("features", [])
                    if not isinstance(features, list) or len(features) < 3:
                        raise ValueError(f"Map {mi} must have at least 3 features, got {len(features) if isinstance(features, list) else 'non-list'}")

            # For mixed topics, validate sub_charts structure
            if chart_type == "mixed":
                sub_charts = data.get("chart_data", {}).get("sub_charts", [])
                if not isinstance(sub_charts, list) or len(sub_charts) != 2:
                    raise ValueError(f"Mixed topic must have exactly 2 sub_charts, got {len(sub_charts) if isinstance(sub_charts, list) else 'non-list'}")
                for si, sc in enumerate(sub_charts):
                    if "chart_type" not in sc or "chart_data" not in sc:
                        raise ValueError(f"sub_chart[{si}] missing chart_type or chart_data")

            data["source"] = "generated"

            # Ensure chart_type / question_type are set
            if task_type == "part_a" and chart_type:
                data["chart_type"] = chart_type
            if task_type == "part_b" and question_type:
                data["question_type"] = question_type

            logger.info(
                "Topic generated successfully: task=%s type=%s/%s (attempt %d, tokens: %s)",
                task_type,
                chart_type or "-",
                question_type or "-",
                attempt,
                result.usage,
            )
            return data, result

        except (json.JSONDecodeError, KeyError, TypeError, ValueError) as e:
            last_error = e
            logger.warning(
                "Topic generation attempt %d/%d failed: %s", attempt, MAX_RETRIES, e
            )
            if attempt < MAX_RETRIES:
                await asyncio.sleep(1)

    raise ValueError(
        f"Topic generation failed after {MAX_RETRIES} attempts: {last_error}"
    )
