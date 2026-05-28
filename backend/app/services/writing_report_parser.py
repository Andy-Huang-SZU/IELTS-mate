"""
Writing Report Parser — Extract structured sections from Chief Examiner Markdown.

Parses report_markdown + agent_reports into a stable structured payload
so the frontend can consume ready-made sections (summary, model answer,
rewrite suggestions) without duplicating brittle regex-based parsing.
"""

from __future__ import annotations

import re
from dataclasses import dataclass, field

from app.schemas.writing import AgentReport


# ── Helpers ──

_HEADING_RE = re.compile(r"^(#{1,6})\s+(.+?)\s*$", re.MULTILINE)
_BULLET_RE = re.compile(r"^(?:[-*•]|\d+[.)])\s+(.*)$")


def _normalise(text: str) -> str:
    return text.replace("\r\n", "\n").replace("\r", "\n").strip()


def _normalise_key(text: str) -> str:
    text = re.sub(r"\*\*(.*?)\*\*", r"\1", text)
    text = re.sub(r"`([^`]+)`", r"\1", text)
    text = re.sub(r"[>#*_]", " ", text)
    text = re.sub(r"[()[\]{}:]", " ", text)
    return re.sub(r"\s+", " ", text).strip().lower()


def _clean_inline(text: str) -> str:
    text = text.strip()
    text = re.sub(r"^>+\s?", "", text)
    text = re.sub(r"\*\*(.*?)\*\*", r"\1", text)
    text = re.sub(r"__(.*?)__", r"\1", text)
    text = re.sub(r"\*(.*?)\*", r"\1", text)
    text = re.sub(r"_(.*?)_", r"\1", text)
    text = re.sub(r"`([^`]+)`", r"\1", text)
    text = re.sub(r"\[(.*?)\]\((.*?)\)", r"\1", text)
    return re.sub(r"\s+", " ", text).strip()


# ── Section detection ──

def _is_model_answer(title: str) -> bool:
    key = _normalise_key(title)
    return bool(re.search(
        r"(model answer|sample answer|high band answer|band 8 answer|band 9 answer|improved answer|范文|示范答案|参考答案)",
        key,
    ))


def _is_rewrite(title: str) -> bool:
    key = _normalise_key(title)
    return bool(re.search(
        r"(rewrite suggest|revision suggest|improvement suggest|how to improve|rewrite advice|重写建议|改写建议|提升建议)",
        key,
    ))


def _is_dimension(title: str) -> bool:
    key = _normalise_key(title)
    return bool(re.search(
        r"(task response|task achievement|coherence|cohesion|lexical|grammar|grammatical|\btr\b|\bcc\b|\blr\b|\bgra\b)",
        key,
    ))


def _is_overall(title: str) -> bool:
    key = _normalise_key(title)
    return bool(re.search(
        r"(overall|summary|assessment|band score|general feedback|chief examiner|总评|总体评价|综合评价)",
        key,
    ))


# ── Markdown splitting ──

@dataclass
class _Section:
    level: int
    title: str
    content: str


def _split_sections(markdown: str) -> tuple[str, list[_Section]]:
    lines = _normalise(markdown).split("\n")
    sections: list[_Section] = []
    preamble: list[str] = []
    current: _Section | None = None

    for line in lines:
        m = _HEADING_RE.match(line)
        if m:
            if current is not None:
                current.content = current.content.strip()
                sections.append(current)
            current = _Section(level=len(m.group(1)), title=_clean_inline(m.group(2)), content="")
            continue
        if current is not None:
            current.content += ("\n" if current.content else "") + line
        else:
            preamble.append(line)

    if current is not None:
        current.content = current.content.strip()
        sections.append(current)

    return "\n".join(preamble).strip(), sections


def _content_to_paragraphs(content: str) -> list[str]:
    blocks = re.split(r"\n\s*\n+", _normalise(content))
    result: list[str] = []
    for block in blocks:
        lines = [
            ln.strip()
            for ln in block.split("\n")
            if ln.strip() and not _BULLET_RE.match(ln.strip()) and not _HEADING_RE.match(ln.strip())
        ]
        text = _clean_inline(" ".join(lines))
        if text:
            result.append(text)
    return result


def _content_to_list_items(content: str) -> list[str]:
    items: list[str] = []
    current = ""
    for raw_line in _normalise(content).split("\n"):
        line = raw_line.strip()
        bm = _BULLET_RE.match(line)
        if bm:
            if current:
                items.append(_clean_inline(current))
            current = bm.group(1)
            continue
        if not line:
            if current:
                items.append(_clean_inline(current))
                current = ""
            continue
        if current:
            current += " " + line
    if current:
        items.append(_clean_inline(current))
    items = [i for i in items if i]
    return items if items else _content_to_paragraphs(content)


# ── Public parse result ──

@dataclass
class StructuredReport:
    summary_title: str = "Chief Examiner Summary"
    summary_paragraphs: list[str] = field(default_factory=list)
    model_answer_title: str = "Model Answer"
    model_answer_paragraphs: list[str] = field(default_factory=list)
    rewrite_title: str = "Rewrite Suggestions"
    rewrite_suggestions: list[dict] = field(default_factory=list)  # [{text, source, dimension?}]
    has_model_answer: bool = False
    has_rewrite_suggestions: bool = False

    def to_dict(self) -> dict:
        return {
            "summary_title": self.summary_title,
            "summary_paragraphs": self.summary_paragraphs,
            "model_answer_title": self.model_answer_title,
            "model_answer_paragraphs": self.model_answer_paragraphs,
            "rewrite_title": self.rewrite_title,
            "rewrite_suggestions": self.rewrite_suggestions,
            "has_model_answer": self.has_model_answer,
            "has_rewrite_suggestions": self.has_rewrite_suggestions,
        }


DIMENSION_LABELS = {
    "tr": "Task Response",
    "cc": "Coherence & Cohesion",
    "lr": "Lexical Resource",
    "gra": "Grammatical Range & Accuracy",
}


def _build_fallback_suggestions(reports: dict[str, AgentReport]) -> list[dict]:
    seen: set[str] = set()
    suggestions: list[dict] = []
    for dim in ("tr", "cc", "lr", "gra"):
        report = reports.get(dim)
        if not report:
            continue
        label = DIMENSION_LABELS.get(dim, dim.upper())
        for s in report.suggestions or []:
            cleaned = _clean_inline(s)
            key = _normalise_key(cleaned)
            if not cleaned or not key or key in seen:
                continue
            seen.add(key)
            suggestions.append({"text": cleaned, "source": "agent", "dimension": label})
            if len(suggestions) >= 6:
                return suggestions
    return suggestions


def parse_report(
    report_markdown: str,
    agent_reports: dict[str, AgentReport],
) -> StructuredReport:
    """Parse Chief Examiner markdown into structured sections."""
    markdown = _normalise(report_markdown)
    fallback = _build_fallback_suggestions(agent_reports)

    if not markdown:
        return StructuredReport(rewrite_suggestions=fallback)

    preamble, sections = _split_sections(markdown)

    model_idx = next((i for i, s in enumerate(sections) if _is_model_answer(s.title)), -1)
    rewrite_idx = next((i for i, s in enumerate(sections) if _is_rewrite(s.title)), -1)

    cutoff_candidates = [i for i in (model_idx, rewrite_idx) if i >= 0]
    cutoff = min(cutoff_candidates) if cutoff_candidates else len(sections)

    summary_sections = [
        s for i, s in enumerate(sections)
        if i < cutoff
        and not _is_dimension(s.title)
        and not _is_model_answer(s.title)
        and not _is_rewrite(s.title)
    ]

    summary_paragraphs = [
        *_content_to_paragraphs(preamble),
        *[p for s in summary_sections for p in _content_to_paragraphs(s.content)],
    ]

    overall_section = next(
        (s for s in summary_sections if _is_overall(s.title) and s.content.strip()),
        None,
    )

    model_section = sections[model_idx] if model_idx >= 0 else None
    rewrite_section = sections[rewrite_idx] if rewrite_idx >= 0 else None

    rewrite_suggestions: list[dict]
    if rewrite_section:
        rewrite_suggestions = [
            {"text": t, "source": "chief"} for t in _content_to_list_items(rewrite_section.content)
        ]
    else:
        rewrite_suggestions = fallback

    return StructuredReport(
        summary_title=overall_section.title if overall_section else "Chief Examiner Summary",
        summary_paragraphs=[p for p in summary_paragraphs if p],
        model_answer_title=model_section.title if model_section else "Model Answer",
        model_answer_paragraphs=_content_to_paragraphs(model_section.content) if model_section else [],
        rewrite_title=rewrite_section.title if rewrite_section else "Rewrite Suggestions",
        rewrite_suggestions=rewrite_suggestions,
        has_model_answer=model_section is not None,
        has_rewrite_suggestions=rewrite_section is not None,
    )
