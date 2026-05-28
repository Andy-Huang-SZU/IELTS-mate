"""
Topic Bank Service — Load, Random Select, ID Normalisation, Write-back

Manages the local JSON topic bank file. Topics are loaded into memory at
startup for O(1) random selection. New AI-generated topics can be appended
with stable, human-friendly IDs.
"""

from __future__ import annotations

import json
import logging
import random
import re
from pathlib import Path
from threading import Lock
from typing import Any

logger = logging.getLogger(__name__)

from app.core.config import get_data_dir

# Default topic bank path: backend/data/writing_topics.json
DEFAULT_BANK_PATH = get_data_dir() / "writing_topics.json"

_bank_lock = Lock()

TASK1_TYPE_ALIASES = {
    "combination": "mixed",
}

TASK1_TYPE_CODES = {
    "bar": "BAR",
    "line": "LINE",
    "pie": "PIE",
    "table": "TABLE",
    "map": "MAP",
    "mixed": "MIXED",
    "process": "PROCESS",
}

TASK2_TYPE_CODES = {
    "opinion": "OPINION",
    "discussion": "DISCUSSION",
    "problem_solution": "PROBLEM",
    "two_part": "DOUBLE",
    "advantage_disadvantage": "ADVANTAGES",
}

_CANONICAL_TOPIC_ID_RE = re.compile(r"^T(?P<task>[12])-(?P<code>[A-Z]+)-(?P<seq>\d{4})$")


def is_legacy_mixed_chart_data(chart_data: Any) -> bool:
    """Return True when mixed chart data still uses the legacy dual-axis shape."""
    if not isinstance(chart_data, dict):
        return False

    categories = chart_data.get("categories")
    bar_series = chart_data.get("bar_series")
    line_series = chart_data.get("line_series")
    has_categories = isinstance(categories, list) and len(categories) > 0
    has_bar = isinstance(bar_series, list) and len(bar_series) > 0
    has_line = isinstance(line_series, list) and len(line_series) > 0
    return has_categories and (has_bar or has_line)


def build_sub_charts_from_legacy_mixed(chart_data: dict[str, Any]) -> list[dict[str, Any]]:
    """Convert legacy dual-axis mixed data into the newer sub_charts structure."""
    title = str(chart_data.get("title") or "Mixed Chart")
    categories = list(chart_data.get("categories") or [])
    sub_charts: list[dict[str, Any]] = []

    bar_series = chart_data.get("bar_series") or []
    if isinstance(bar_series, list) and bar_series:
        sub_charts.append(
            {
                "chart_type": "bar",
                "chart_data": {
                    "title": f"{title} - Bar View",
                    "categories": categories,
                    "series": bar_series,
                    "unit": chart_data.get("bar_unit") or chart_data.get("unit") or "",
                },
            }
        )

    line_series = chart_data.get("line_series") or []
    if isinstance(line_series, list) and line_series:
        sub_charts.append(
            {
                "chart_type": "line",
                "chart_data": {
                    "title": f"{title} - Line View",
                    "categories": categories,
                    "series": line_series,
                    "unit": chart_data.get("line_unit") or chart_data.get("unit") or "",
                },
            }
        )

    return sub_charts


def normalise_chart_type(chart_type: str | None) -> str | None:
    """Normalise legacy Task 1 type aliases into canonical chart types."""
    if not chart_type:
        return None
    key = str(chart_type).strip().lower()
    return TASK1_TYPE_ALIASES.get(key, key)


def normalise_question_type(question_type: str | None) -> str | None:
    """Normalise Task 2 question type strings."""
    if not question_type:
        return None
    return str(question_type).strip().lower()


def get_topic_sub_type(topic: dict[str, Any]) -> str:
    """Return the canonical sub-type for a topic."""
    task_type = topic.get("task_type")
    if task_type == "part_a":
        return normalise_chart_type(topic.get("chart_type")) or "unknown"
    return normalise_question_type(topic.get("question_type")) or "unknown"


def get_topic_code(task_type: str, chart_type: str | None = None, question_type: str | None = None) -> str:
    """Return the human-friendly ID code for a topic type."""
    if task_type == "part_a":
        return TASK1_TYPE_CODES.get(normalise_chart_type(chart_type) or "", "UNKNOWN")
    return TASK2_TYPE_CODES.get(normalise_question_type(question_type) or "", "UNKNOWN")


def build_topic_id(task_type: str, chart_type: str | None, question_type: str | None, sequence: int) -> str:
    """Build canonical topic IDs such as T1-BAR-0001 or T2-OPINION-0001."""
    prefix = "T1" if task_type == "part_a" else "T2"
    code = get_topic_code(task_type, chart_type, question_type)
    return f"{prefix}-{code}-{sequence:04d}"


class TopicBankService:
    """In-memory topic bank backed by a JSON file."""

    def __init__(self, bank_path: Path | None = None):
        self.bank_path = bank_path or DEFAULT_BANK_PATH
        self._topics: list[dict[str, Any]] = []
        self._loaded = False
        self._file_mtime: float = 0.0  # track file modification time for hot-reload

    def load(self) -> None:
        """Load topics from JSON file into memory."""
        if not self.bank_path.exists():
            logger.info("Topic bank file not found at %s, starting with empty bank", self.bank_path)
            self._topics = []
            self._loaded = True
            self._file_mtime = 0.0
            return

        try:
            with open(self.bank_path, "r", encoding="utf-8") as f:
                data = json.load(f)

            raw_topics: list[dict[str, Any]]
            if isinstance(data, list):
                raw_topics = data
            elif isinstance(data, dict) and "topics" in data:
                raw_topics = data["topics"]
            else:
                logger.warning("Unexpected topic bank format, using empty bank")
                raw_topics = []

            self._topics = [self._normalise_topic(topic) for topic in raw_topics]
            self._loaded = True
            self._file_mtime = self.bank_path.stat().st_mtime
            logger.info("Loaded %d topics from %s", len(self._topics), self.bank_path)

        except (json.JSONDecodeError, IOError) as e:
            logger.error("Failed to load topic bank: %s", e)
            self._topics = []
            self._loaded = True

    def _ensure_loaded(self) -> None:
        """Ensure topics are loaded; auto-reload if the JSON file has been modified."""
        if not self._loaded:
            self.load()
            return
        # Hot-reload: check if the file has been modified since last load
        try:
            if self.bank_path.exists():
                current_mtime = self.bank_path.stat().st_mtime
                if current_mtime > self._file_mtime:
                    logger.info("Topic bank file changed, reloading...")
                    self.load()
        except OSError:
            pass

    @staticmethod
    def _normalise_topic(topic: dict[str, Any]) -> dict[str, Any]:
        """Normalise legacy topic fields in-place and return the same object."""
        if not isinstance(topic, dict):
            return topic

        topic["chart_type"] = normalise_chart_type(topic.get("chart_type"))
        topic["question_type"] = normalise_question_type(topic.get("question_type"))

        if not isinstance(topic.get("topic_tags"), list):
            topic["topic_tags"] = []

        difficulty = topic.get("difficulty")
        topic["difficulty"] = str(difficulty).lower() if difficulty else "medium"
        topic["source"] = topic.get("source") or "generated"

        chart_data = topic.get("chart_data")
        if topic.get("chart_type") == "mixed" and is_legacy_mixed_chart_data(chart_data):
            chart_data = dict(chart_data)
            chart_data.setdefault("sub_charts", build_sub_charts_from_legacy_mixed(chart_data))
            topic["chart_data"] = chart_data

        legacy_id = topic.get("legacy_id")
        if legacy_id is not None and not isinstance(legacy_id, str):
            topic["legacy_id"] = str(legacy_id)

        return topic

    @staticmethod
    def _topic_sort_key(topic: dict[str, Any]) -> tuple[str, str, str, str]:
        """Stable sort key used when renumbering the whole bank."""
        prompt = " ".join(str(topic.get("prompt") or "").split()).lower()
        original_id = str(topic.get("id") or topic.get("legacy_id") or "")
        return (
            str(topic.get("task_type") or ""),
            get_topic_sub_type(topic),
            prompt,
            original_id,
        )

    @staticmethod
    def _extract_canonical_sequence(topic: dict[str, Any]) -> int | None:
        """Return canonical sequence number if topic.id already matches the new format."""
        topic_id = topic.get("id")
        if not isinstance(topic_id, str):
            return None

        match = _CANONICAL_TOPIC_ID_RE.match(topic_id)
        if not match:
            return None

        expected_task = "1" if topic.get("task_type") == "part_a" else "2"
        expected_code = get_topic_code(
            str(topic.get("task_type") or ""),
            str(topic.get("chart_type") or "") or None,
            str(topic.get("question_type") or "") or None,
        )
        if match.group("task") != expected_task or match.group("code") != expected_code:
            return None

        return int(match.group("seq"))

    def _build_next_sequence_map(self) -> dict[tuple[str, str], int]:
        """Build the current next-sequence cursor for each topic subtype."""
        counters: dict[tuple[str, str], int] = {}
        canonical_max: dict[tuple[str, str], int] = {}

        for topic in self._topics:
            self._normalise_topic(topic)
            key = (str(topic.get("task_type") or ""), get_topic_sub_type(topic))
            counters[key] = counters.get(key, 0) + 1
            canonical_seq = self._extract_canonical_sequence(topic)
            if canonical_seq is not None:
                canonical_max[key] = max(canonical_max.get(key, 0), canonical_seq)

        keys = set(counters) | set(canonical_max)
        return {key: max(counters.get(key, 0), canonical_max.get(key, 0)) for key in keys}

    @property
    def total_count(self) -> int:
        self._ensure_loaded()
        return len(self._topics)

    def get_stats(self) -> dict[str, Any]:
        """Return topic counts by task_type and sub-type."""
        self._ensure_loaded()
        stats: dict[str, int] = {}
        for topic in self._topics:
            self._normalise_topic(topic)
            task = topic.get("task_type", "unknown")
            sub = get_topic_sub_type(topic)
            key = f"{task}/{sub}"
            stats[key] = stats.get(key, 0) + 1
        return {"total": len(self._topics), "breakdown": stats}

    def random_topic(
        self,
        task_type: str | None = None,
        chart_type: str | None = None,
        question_type: str | None = None,
    ) -> dict[str, Any] | None:
        """Randomly select one topic matching filters. Returns None if no match."""
        self._ensure_loaded()

        chart_type = normalise_chart_type(chart_type)
        question_type = normalise_question_type(question_type)

        candidates = self._topics
        if task_type:
            candidates = [t for t in candidates if t.get("task_type") == task_type]
        if chart_type:
            candidates = [t for t in candidates if normalise_chart_type(t.get("chart_type")) == chart_type]
        if question_type:
            candidates = [t for t in candidates if normalise_question_type(t.get("question_type")) == question_type]

        if not candidates:
            return None

        return random.choice(candidates)

    def add_topic(self, topic: dict[str, Any]) -> dict[str, Any]:
        """Add a topic to the in-memory bank, assign canonical ID, and persist to file."""
        return self.add_topics([topic])[0]

    def add_topics(self, topics: list[dict[str, Any]]) -> list[dict[str, Any]]:
        """Add multiple topics, assign canonical IDs, and persist."""
        self._ensure_loaded()

        with _bank_lock:
            next_sequence = self._build_next_sequence_map()
            prepared_topics: list[dict[str, Any]] = []

            for topic in topics:
                self._normalise_topic(topic)
                key = (str(topic.get("task_type") or ""), get_topic_sub_type(topic))
                next_sequence[key] = next_sequence.get(key, 0) + 1
                new_id = build_topic_id(
                    str(topic.get("task_type") or ""),
                    topic.get("chart_type"),
                    topic.get("question_type"),
                    next_sequence[key],
                )

                old_id = topic.get("id")
                if old_id and old_id != new_id and not topic.get("legacy_id"):
                    topic["legacy_id"] = old_id
                topic["id"] = new_id
                prepared_topics.append(topic)

            self._topics.extend(prepared_topics)
            self._save()
            return prepared_topics

    def normalize_bank(self) -> dict[str, Any]:
        """Canonicalise topic types and reassign readable IDs for the entire bank."""
        self._ensure_loaded()

        with _bank_lock:
            normalised_topics = [self._normalise_topic(topic) for topic in self._topics]
            normalised_topics.sort(key=self._topic_sort_key)

            counters: dict[tuple[str, str], int] = {}
            changed = 0

            for topic in normalised_topics:
                key = (str(topic.get("task_type") or ""), get_topic_sub_type(topic))
                counters[key] = counters.get(key, 0) + 1
                new_id = build_topic_id(
                    str(topic.get("task_type") or ""),
                    topic.get("chart_type"),
                    topic.get("question_type"),
                    counters[key],
                )
                old_id = topic.get("id")
                if old_id and old_id != new_id and not topic.get("legacy_id"):
                    topic["legacy_id"] = old_id
                topic["id"] = new_id
                if old_id != new_id:
                    changed += 1

            self._topics = normalised_topics
            self._save()

        return {
            "total": len(self._topics),
            "changed": changed,
            "breakdown": self.get_stats()["breakdown"],
        }

    def _save(self) -> None:
        """Write topics to JSON file."""
        try:
            self.bank_path.parent.mkdir(parents=True, exist_ok=True)
            with open(self.bank_path, "w", encoding="utf-8") as f:
                json.dump(
                    {"topics": self._topics},
                    f,
                    ensure_ascii=False,
                    indent=2,
                )
            logger.info("Saved %d topics to %s", len(self._topics), self.bank_path)
            self._file_mtime = self.bank_path.stat().st_mtime
        except IOError as e:
            logger.error("Failed to save topic bank: %s", e)

    def get_all_topics(self) -> list[dict[str, Any]]:
        """Return all topics."""
        self._ensure_loaded()
        return list(self._topics)


# Module-level singleton
_topic_bank: TopicBankService | None = None


def get_topic_bank() -> TopicBankService:
    """Get the global TopicBankService singleton."""
    global _topic_bank
    if _topic_bank is None:
        _topic_bank = TopicBankService()
        _topic_bank.load()
    return _topic_bank
