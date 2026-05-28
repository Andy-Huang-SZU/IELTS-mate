"""
Speaking State Machine Engine

Manages the state transitions for Mock Test mode:
  part1_intro → part1_qa → part2_prep → part2_speak → part3_discussion → report_generating → completed

Also supports Chat mode (single 'chat' state).
"""

from __future__ import annotations

import asyncio
import json
import logging
from typing import Any, Callable, Coroutine

from app.schemas.speaking import (
    SpeakingMode,
    SpeakingPhase,
    StateChangePayload,
    TimerPayload,
    TopicCardPayload,
)
from app.services.speaking_memory import SpeakingMemory

logger = logging.getLogger(__name__)

# Part 2 timing constants (seconds)
PART2_PREP_DURATION = 60
PART2_SPEAK_DURATION = 130  # Hard cap
PART2_WARNING_YELLOW = 90
PART2_WARNING_ORANGE = 110
PART2_WARNING_RED = 120


class SpeakingStateMachine:
    """State machine for a single speaking session."""

    def __init__(
        self,
        mode: SpeakingMode,
        memory: SpeakingMemory,
        send_json: Callable[[dict], Coroutine],
    ):
        self.mode = mode
        self.memory = memory
        self._send_json = send_json

        # State
        if mode == SpeakingMode.CHAT:
            self.phase = SpeakingPhase.IDLE
        else:
            self.phase = SpeakingPhase.PART1_INTRO

        self.topic_card: TopicCardPayload | None = None
        self._timer_task: asyncio.Task | None = None
        self._timer_elapsed: int = 0
        self._timer_total: int = 0
        self._part1_turn_count: int = 0

    @property
    def is_active(self) -> bool:
        return self.phase not in (SpeakingPhase.COMPLETED, SpeakingPhase.REPORT_GENERATING)

    @property
    def current_phase_str(self) -> str:
        return self.phase.value

    def can_accept_audio(self) -> bool:
        """Check if the current phase accepts user audio input."""
        if self.mode == SpeakingMode.CHAT:
            return self.phase != SpeakingPhase.COMPLETED
        return self.phase in (
            SpeakingPhase.PART1_INTRO,
            SpeakingPhase.PART1_QA,
            SpeakingPhase.PART2_SPEAK,
            SpeakingPhase.PART3_DISCUSSION,
        )

    async def handle_ai_response(self, ai_text: str) -> SpeakingPhase | None:
        """Process AI response text and check for state transition markers.

        Returns the new phase if a transition occurred, None otherwise.
        """
        if self.mode == SpeakingMode.CHAT:
            return None

        # Check for transition markers in AI text
        if "[PART1_COMPLETE]" in ai_text:
            return await self.transition_to(SpeakingPhase.PART2_PREP)

        if "[PART2_COMPLETE]" in ai_text:
            return await self.transition_to(SpeakingPhase.PART3_DISCUSSION)

        if "[PART3_COMPLETE]" in ai_text:
            return await self.transition_to(SpeakingPhase.REPORT_GENERATING)

        # Track Part 1 turn count
        if self.phase == SpeakingPhase.PART1_INTRO:
            self._part1_turn_count += 1
            if self._part1_turn_count >= 2:
                await self.transition_to(SpeakingPhase.PART1_QA)

        return None

    async def transition_to(self, new_phase: SpeakingPhase) -> SpeakingPhase:
        """Execute a state transition."""
        old_phase = self.phase
        self.phase = new_phase
        logger.info("State transition: %s → %s", old_phase.value, new_phase.value)

        # Cancel any running timer
        self._cancel_timer()

        # Send state change notification
        await self._send_json({
            "type": "state_change",
            "phase": new_phase.value,
            "message": self._get_transition_message(new_phase),
        })

        # Handle phase-specific setup
        if new_phase == SpeakingPhase.PART2_PREP:
            self._start_timer(PART2_PREP_DURATION, self._on_prep_timer_end)

        elif new_phase == SpeakingPhase.PART2_SPEAK:
            self._start_timer(PART2_SPEAK_DURATION, self._on_speak_timer_end)

        return new_phase

    async def start_mock_test(self) -> None:
        """Initialize and start a mock test session."""
        self.phase = SpeakingPhase.PART1_INTRO
        await self._send_json({
            "type": "state_change",
            "phase": SpeakingPhase.PART1_INTRO.value,
            "message": "Starting Part 1: Introduction & Interview",
        })

    async def set_topic_card(self, topic_card: TopicCardPayload) -> None:
        """Set and broadcast the Part 2 topic card."""
        self.topic_card = topic_card
        await self._send_json({
            "type": "topic_card",
            "topic": topic_card.topic,
            "bullet_points": topic_card.bullet_points,
            "follow_up": topic_card.follow_up,
        })

    def _start_timer(self, total_seconds: int, on_end: Callable) -> None:
        """Start an async countdown timer."""
        self._timer_elapsed = 0
        self._timer_total = total_seconds
        self._timer_task = asyncio.create_task(self._run_timer(total_seconds, on_end))

    def _cancel_timer(self) -> None:
        """Cancel the running timer if any."""
        if self._timer_task and not self._timer_task.done():
            self._timer_task.cancel()
            self._timer_task = None

    async def _run_timer(self, total: int, on_end: Callable) -> None:
        """Timer coroutine that sends tick updates every second."""
        for elapsed in range(1, total + 1):
            await asyncio.sleep(1)
            self._timer_elapsed = elapsed

            # Determine warning level for Part 2 speak
            warning = "none"
            if self.phase == SpeakingPhase.PART2_SPEAK:
                if elapsed >= PART2_WARNING_RED:
                    warning = "red"
                elif elapsed >= PART2_WARNING_ORANGE:
                    warning = "orange"
                elif elapsed >= PART2_WARNING_YELLOW:
                    warning = "yellow"

            await self._send_json({
                "type": "timer",
                "elapsed": elapsed,
                "total": total,
                "warning_level": warning,
            })

        # Timer complete
        await on_end()

    async def _on_prep_timer_end(self) -> None:
        """Called when Part 2 preparation time is up."""
        await self.transition_to(SpeakingPhase.PART2_SPEAK)

    async def _on_speak_timer_end(self) -> None:
        """Called when Part 2 speaking time is up (130s hard cap)."""
        await self._send_json({
            "type": "timer",
            "elapsed": PART2_SPEAK_DURATION,
            "total": PART2_SPEAK_DURATION,
            "warning_level": "expired",
        })
        # Force transition to Part 3 rounding-off / discussion
        await self.transition_to(SpeakingPhase.PART3_DISCUSSION)

    def cleanup(self) -> None:
        """Clean up resources when session ends."""
        self._cancel_timer()

    @staticmethod
    def _get_transition_message(phase: SpeakingPhase) -> str:
        messages = {
            SpeakingPhase.PART1_INTRO: "Starting Part 1: Introduction & Interview",
            SpeakingPhase.PART1_QA: "Part 1: Questions & Answers",
            SpeakingPhase.PART2_PREP: "Part 2: You have 1 minute to prepare",
            SpeakingPhase.PART2_SPEAK: "Part 2: Please begin speaking",
            SpeakingPhase.PART3_DISCUSSION: "Part 3: Two-way Discussion",
            SpeakingPhase.REPORT_GENERATING: "Generating your report...",
            SpeakingPhase.COMPLETED: "Test completed",
        }
        return messages.get(phase, "")

    def strip_markers(self, text: str) -> str:
        """Remove state transition markers from AI response text."""
        markers = ["[PART1_COMPLETE]", "[PART2_COMPLETE]", "[PART3_COMPLETE]",
                    "[PART2_PREP_START]"]
        result = text
        for marker in markers:
            result = result.replace(marker, "")
        return result.strip()
