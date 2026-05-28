"""
Cognitive Memory Manager for Speaking Module

Implements:
- Sliding window: maintains recent N turns of conversation
- Phase summary: generates a summary after Part 1 for injection into later parts
"""

from __future__ import annotations

import logging
from typing import Any

from app.services.llm.base import BaseLLMClient
from app.services.speaking_prompts import SUMMARY_GENERATION_PROMPT

logger = logging.getLogger(__name__)

DEFAULT_WINDOW_SIZE = 8  # Keep last 8 turns (4 exchanges)
MAX_SUMMARY_TOKENS = 250


class SpeakingMemory:
    """Manages conversation context with sliding window and phase summaries."""

    def __init__(self, window_size: int = DEFAULT_WINDOW_SIZE):
        self.window_size = window_size
        self.full_history: list[dict[str, str]] = []  # All messages for transcript
        self.part1_summary: str = ""
        self.session_summary: str = ""

    def add_message(self, role: str, content: str, phase: str = "") -> None:
        """Add a message to conversation history."""
        self.full_history.append({
            "role": role,
            "content": content,
            "phase": phase,
        })

    def get_recent_messages(self) -> list[dict[str, str]]:
        """Get recent messages within the sliding window for LLM context."""
        recent = self.full_history[-self.window_size:]
        return [
            {"role": self._map_role(msg["role"]), "content": msg["content"]}
            for msg in recent
        ]

    def get_full_transcript(self) -> str:
        """Get formatted full conversation transcript for report generation."""
        lines = []
        for msg in self.full_history:
            role_label = "Examiner" if msg["role"] in ("examiner", "assistant") else "Candidate"
            phase_tag = f" [{msg.get('phase', '')}]" if msg.get("phase") else ""
            lines.append(f"**{role_label}**{phase_tag}: {msg['content']}")
        return "\n\n".join(lines)

    def get_message_count(self) -> int:
        """Get total number of messages."""
        return len(self.full_history)

    def get_duration_estimate(self) -> int:
        """Estimate conversation duration in minutes based on message count."""
        # Rough estimate: ~30 seconds per message exchange
        return max(1, len(self.full_history) // 4)

    async def generate_part1_summary(self, llm: BaseLLMClient) -> str:
        """Generate a summary of Part 1 conversation for injection into later parts."""
        if self.part1_summary:
            return self.part1_summary

        # Collect Part 1 messages
        part1_messages = [
            msg for msg in self.full_history
            if msg.get("phase", "") in ("part1_intro", "part1_qa", "")
        ]

        if not part1_messages:
            return ""

        conversation_text = "\n".join(
            f"{'Examiner' if m['role'] in ('examiner', 'assistant') else 'Candidate'}: {m['content']}"
            for m in part1_messages[-12:]  # Last 12 messages max
        )

        prompt = SUMMARY_GENERATION_PROMPT.format(conversation=conversation_text)

        result = await llm.chat(
            messages=[{"role": "user", "content": prompt}],
            temperature=0.3,
            max_tokens=MAX_SUMMARY_TOKENS,
        )

        self.part1_summary = result.content.strip()
        logger.info("Generated Part 1 summary: %s", self.part1_summary[:100])
        return self.part1_summary

    def get_summary_injection(self) -> str:
        """Get summary text suitable for injection into system prompts."""
        if self.part1_summary:
            return f"\n\nContext from earlier in the test:\n{self.part1_summary}\n"
        return ""

    def build_messages_for_llm(
        self,
        system_prompt: str,
    ) -> list[dict[str, str]]:
        """Build complete message list for LLM call with system prompt + recent history."""
        messages = [{"role": "system", "content": system_prompt}]
        messages.extend(self.get_recent_messages())
        return messages

    @staticmethod
    def _map_role(role: str) -> str:
        """Map internal role names to LLM message roles."""
        if role in ("examiner", "assistant", "system"):
            return "assistant"
        return "user"  # candidate → user
