"""
Speaking Service — Core Business Layer

Handles:
- WebSocket message processing (audio → STT → LLM → TTS → response)
- Session lifecycle (create, update, finalize)
- Report generation (4-Agent parallel evaluation)
- Coordination between STT, TTS, LLM, state machine, and memory
"""

from __future__ import annotations

import asyncio
import base64
import json
import logging
import re
import time
from typing import Any

from fastapi import WebSocket, WebSocketDisconnect
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import AsyncSessionLocal
from app.models.speaking import SpeakingMessage, SpeakingSession
from app.schemas.speaking import (
    SpeakingAgentReport,
    SpeakingMode,
    SpeakingPhase,
    SpeakingScores,
    SessionDetailData,
    SessionListItem,
    TopicCardPayload,
    TranscriptEntry,
)
from app.services.llm.base import BaseLLMClient
from app.services.speaking_memory import SpeakingMemory
from app.services.speaking_prompts import (
    CHAT_SYSTEM_PROMPT,
    CHAT_SYSTEM_WITH_SUMMARY,
    FC_BAND_DESCRIPTORS,
    GRA_BAND_DESCRIPTORS,
    LR_BAND_DESCRIPTORS,
    PART1_INTRO_PROMPT,
    PART1_QA_PROMPT,
    PART2_FOLLOWUP_PROMPT,
    PART2_TOPIC_GENERATION_PROMPT,
    PART2_TRANSITION_PROMPT,
    PART3_SYSTEM_PROMPT,
    PRONUNCIATION_BAND_DESCRIPTORS,
    SPEAKING_AGENT_SYSTEM_TEMPLATE,
    SPEAKING_AGENT_USER_TEMPLATE,
    SPEAKING_CHIEF_SYSTEM,
    SPEAKING_CHIEF_USER_TEMPLATE,
)
from app.services.speaking_state_machine import SpeakingStateMachine
from app.services.stt import BaseSTTClient
from app.services.tts import BaseTTSClient

logger = logging.getLogger(__name__)

MAX_RETRIES = 3


# ─────────────────────────────────────────────
# Utility
# ─────────────────────────────────────────────

def _strip_json_fence(text: str) -> str:
    text = text.strip()
    text = re.sub(r"^```(?:json)?\s*\n?", "", text)
    text = re.sub(r"\n?```\s*$", "", text)
    return text.strip()


def _round_to_half(score: float) -> float:
    return round(score * 2) / 2


# ─────────────────────────────────────────────
# WebSocket Session Handler
# ─────────────────────────────────────────────

class SpeakingSessionHandler:
    """Handles a single WebSocket speaking session."""

    def __init__(
        self,
        websocket: WebSocket,
        llm: BaseLLMClient,
        stt: BaseSTTClient,
        tts: BaseTTSClient,
    ):
        self.ws = websocket
        self.llm = llm
        self.stt = stt
        self.tts = tts
        self.memory = SpeakingMemory()
        self.state_machine: SpeakingStateMachine | None = None
        self.session_id: int | None = None
        self.mode: SpeakingMode = SpeakingMode.CHAT
        self._audio_buffer: list[bytes] = []
        self._start_time: float = 0
        self._is_processing = False

    async def send_json(self, data: dict) -> None:
        """Send JSON message to client."""
        await self.ws.send_json(data)

    async def run(self) -> None:
        """Main message loop."""
        await self.ws.accept()
        await self.send_json({"type": "connected", "message": "ws_ready"})

        try:
            while True:
                raw = await self.ws.receive_text()
                payload = json.loads(raw)
                msg_type = payload.get("type", "")

                # Front-end wraps data inside a nested "payload" key.
                # Unwrap it so handlers can access fields directly.
                inner = payload.get("payload", payload)
                if isinstance(inner, dict):
                    inner = {**inner}
                else:
                    inner = payload

                if msg_type == "ping":
                    await self.send_json({"type": "pong", "message": "ws_ok"})
                elif msg_type == "start_session":
                    await self._handle_start_session(inner)
                elif msg_type == "audio_chunk":
                    await self._handle_audio_chunk(inner)
                elif msg_type == "end_turn":
                    await self._handle_end_turn(inner)
                elif msg_type == "stop_session":
                    await self._handle_stop_session()
                    break
                else:
                    await self.send_json({"type": "error", "message": f"Unknown message type: {msg_type}", "recoverable": True})

        except WebSocketDisconnect:
            logger.info("WebSocket disconnected for session %s", self.session_id)
        except Exception as e:
            logger.error("WebSocket error: %s", e, exc_info=True)
            await self.send_json({"type": "error", "message": str(e), "recoverable": False})
        finally:
            await self._cleanup()

    # ── Session Lifecycle ──

    async def _handle_start_session(self, payload: dict) -> None:
        """Initialize a new speaking session."""
        mode_str = payload.get("mode", "chat")
        self.mode = SpeakingMode(mode_str)
        self._start_time = time.time()

        # Create DB session
        async with AsyncSessionLocal() as db:
            session_row = SpeakingSession(
                mode=self.mode.value,
                status="active",
            )
            db.add(session_row)
            await db.commit()
            await db.refresh(session_row)
            self.session_id = session_row.id

        # Initialize state machine
        self.state_machine = SpeakingStateMachine(
            mode=self.mode,
            memory=self.memory,
            send_json=self.send_json,
        )

        logger.info("Started speaking session %d in %s mode", self.session_id, self.mode.value)

        # For mock test, start with examiner's opening
        if self.mode == SpeakingMode.MOCK_TEST:
            await self.state_machine.start_mock_test()
            await self._generate_examiner_response(is_opening=True)
        else:
            # Chat mode — send initial greeting
            await self._generate_examiner_response(is_opening=True)

    async def _handle_audio_chunk(self, payload: dict) -> None:
        """Buffer incoming audio chunks."""
        if not self.state_machine:
            await self.send_json({"type": "error", "message": "Session not started", "recoverable": True})
            return

        audio_b64 = payload.get("data", "")
        if audio_b64:
            audio_bytes = base64.b64decode(audio_b64)
            self._audio_buffer.append(audio_bytes)

    async def _handle_end_turn(self, payload: dict) -> None:
        """Process accumulated audio: STT → LLM → TTS."""
        if not self.state_machine or self._is_processing:
            return

        if not self.state_machine.can_accept_audio():
            await self.send_json({"type": "error", "message": "Cannot accept audio in current phase", "recoverable": True})
            return

        if not self._audio_buffer:
            await self.send_json({"type": "error", "message": "No audio data received", "recoverable": True})
            return

        self._is_processing = True

        try:
            # Combine audio chunks
            audio_data = b"".join(self._audio_buffer)
            self._audio_buffer.clear()
            audio_format = payload.get("format", "webm")

            # STT
            stt_result = await self.stt.transcribe(audio_data, format=audio_format)
            user_text = stt_result.text.strip()

            if not user_text:
                await self.send_json({"type": "transcription", "text": "", "is_final": True})
                self._is_processing = False
                return

            # Send transcription to client
            await self.send_json({"type": "transcription", "text": user_text, "is_final": True})

            # Add to memory
            phase_str = self.state_machine.current_phase_str if self.state_machine else "chat"
            self.memory.add_message("candidate", user_text, phase=phase_str)

            # Save to DB
            await self._save_message("candidate", user_text, phase_str)

            # Generate AI response
            await self._generate_examiner_response()

        except Exception as e:
            logger.error("Error processing turn: %s", e, exc_info=True)
            await self.send_json({"type": "error", "message": f"Processing error: {str(e)}", "recoverable": True})
        finally:
            self._is_processing = False

    async def _handle_stop_session(self) -> None:
        """End the session and optionally generate report."""
        if not self.state_machine:
            return

        if self.mode == SpeakingMode.MOCK_TEST and self.state_machine.phase != SpeakingPhase.COMPLETED:
            # Generate report for mock test
            await self.state_machine.transition_to(SpeakingPhase.REPORT_GENERATING)
            await self._generate_report()
        else:
            # Chat mode — just finalize
            await self._finalize_session()

        await self.send_json({"type": "session_ended", "session_id": self.session_id})

    # ── AI Response Generation ──

    async def _generate_examiner_response(self, is_opening: bool = False) -> None:
        """Generate and send AI examiner response (text + audio)."""
        system_prompt = self._get_system_prompt()
        messages = self.memory.build_messages_for_llm(system_prompt)

        # For opening, add a user placeholder to trigger the greeting
        if is_opening and len(messages) <= 1:
            messages.append({"role": "user", "content": "(The test is starting. Please begin.)"})

        # LLM call
        result = await self.llm.chat(
            messages=messages,
            temperature=0.7,
            max_tokens=500,
        )
        ai_text = result.content.strip()

        # Check for state transitions (mock test)
        if self.state_machine:
            new_phase = await self.state_machine.handle_ai_response(ai_text)
            clean_text = self.state_machine.strip_markers(ai_text)

            # Handle Part 2 transition (need to generate topic card)
            if new_phase == SpeakingPhase.PART2_PREP:
                await self._handle_part2_transition()
                return

            # Handle report generation
            if new_phase == SpeakingPhase.REPORT_GENERATING:
                await self._generate_report()
                return
        else:
            clean_text = ai_text

        if not clean_text:
            return

        # Send text to client
        await self.send_json({"type": "ai_text", "text": clean_text, "phase": self.state_machine.current_phase_str if self.state_machine else "chat"})

        # Add to memory
        phase_str = self.state_machine.current_phase_str if self.state_machine else "chat"
        self.memory.add_message("examiner", clean_text, phase=phase_str)
        await self._save_message("examiner", clean_text, phase_str)

        # TTS
        await self._synthesize_and_send(clean_text)

    async def _handle_part2_transition(self) -> None:
        """Handle the transition to Part 2: generate topic card, send it, start prep timer."""
        # Generate Part 1 summary for later use
        await self.memory.generate_part1_summary(self.llm)

        # Generate topic card
        topic_card = await self._generate_topic_card()
        if not topic_card:
            logger.error("Failed to generate topic card")
            await self.send_json({"type": "error", "message": "Failed to generate topic card", "recoverable": False})
            return

        # Set topic card in state machine
        await self.state_machine.set_topic_card(topic_card)

        # Generate and send transition speech
        bullet_text = "\n".join(f"- {bp}" for bp in topic_card.bullet_points)
        transition_text = f"Now, I'm going to give you a topic. I'd like you to talk about it for one to two minutes. Before you talk, you'll have one minute to think about what you're going to say. Here's your topic: {topic_card.topic}"

        await self.send_json({"type": "ai_text", "text": transition_text, "phase": "part2_prep"})
        self.memory.add_message("examiner", transition_text, phase="part2_prep")
        await self._save_message("examiner", transition_text, "part2_prep")
        await self._synthesize_and_send(transition_text)

        # Save topic card to session
        async with AsyncSessionLocal() as db:
            result = await db.execute(
                select(SpeakingSession).where(SpeakingSession.id == self.session_id)
            )
            row = result.scalar_one_or_none()
            if row:
                row.topic_card = json.dumps(topic_card.model_dump(), ensure_ascii=False)
                row.topic_summary = topic_card.topic[:200]
                await db.commit()

    async def _generate_topic_card(self) -> TopicCardPayload | None:
        """Generate a Part 2 topic card using LLM."""
        for attempt in range(MAX_RETRIES):
            result = await self.llm.chat(
                messages=[{"role": "user", "content": PART2_TOPIC_GENERATION_PROMPT}],
                temperature=0.8,
                max_tokens=500,
            )
            try:
                data = json.loads(_strip_json_fence(result.content))
                return TopicCardPayload(
                    topic=data.get("topic", ""),
                    bullet_points=data.get("bullet_points", []),
                    follow_up=data.get("follow_up", ""),
                )
            except (json.JSONDecodeError, KeyError) as e:
                logger.warning("Topic card generation attempt %d failed: %s", attempt + 1, e)
                if attempt < MAX_RETRIES - 1:
                    await asyncio.sleep(0.5)
        return None

    async def _synthesize_and_send(self, text: str) -> None:
        """TTS synthesis and send audio to client."""
        try:
            tts_result = await self.tts.synthesize(text)
            audio_b64 = base64.b64encode(tts_result.audio_data).decode("utf-8")
            await self.send_json({
                "type": "ai_audio",
                "data": audio_b64,
                "format": tts_result.format,
            })
        except Exception as e:
            logger.warning("TTS synthesis failed: %s", e)
            await self.send_json({"type": "error", "message": f"TTS error: {str(e)}", "recoverable": True})

    # ── System Prompt Selection ──

    def _get_system_prompt(self) -> str:
        """Select the appropriate system prompt based on current mode and phase."""
        if self.mode == SpeakingMode.CHAT:
            summary = self.memory.get_summary_injection()
            if summary:
                return CHAT_SYSTEM_WITH_SUMMARY.format(summary=summary)
            return CHAT_SYSTEM_PROMPT

        if not self.state_machine:
            return CHAT_SYSTEM_PROMPT

        phase = self.state_machine.phase
        summary_injection = self.memory.get_summary_injection()

        if phase in (SpeakingPhase.PART1_INTRO,):
            return PART1_INTRO_PROMPT

        if phase == SpeakingPhase.PART1_QA:
            return PART1_QA_PROMPT.format(summary_injection=summary_injection)

        if phase == SpeakingPhase.PART2_SPEAK:
            topic = self.state_machine.topic_card.topic if self.state_machine.topic_card else "the given topic"
            return PART2_FOLLOWUP_PROMPT.format(topic=topic)

        if phase == SpeakingPhase.PART3_DISCUSSION:
            topic = self.state_machine.topic_card.topic if self.state_machine.topic_card else "the given topic"
            return PART3_SYSTEM_PROMPT.format(
                topic=topic,
                summary_injection=summary_injection,
            )

        return CHAT_SYSTEM_PROMPT

    # ── Report Generation ──

    async def _generate_report(self) -> None:
        """Generate speaking assessment report using 4-Agent parallel evaluation."""
        transcript = self.memory.get_full_transcript()
        duration = self.memory.get_duration_estimate()
        mode_label = "Mock Test" if self.mode == SpeakingMode.MOCK_TEST else "Free Chat"

        agent_configs = [
            ("fc", "Fluency and Coherence", FC_BAND_DESCRIPTORS),
            ("lr", "Lexical Resource", LR_BAND_DESCRIPTORS),
            ("gra", "Grammatical Range and Accuracy", GRA_BAND_DESCRIPTORS),
            ("pronunciation", "Pronunciation", PRONUNCIATION_BAND_DESCRIPTORS),
        ]

        # Run 4 agents in parallel
        agent_tasks = []
        agent_keys = []
        for key, criterion, descriptors in agent_configs:
            system_msg = SPEAKING_AGENT_SYSTEM_TEMPLATE.format(
                criterion_name=criterion,
                band_descriptors=descriptors,
            )
            user_msg = SPEAKING_AGENT_USER_TEMPLATE.format(
                mode_label=mode_label,
                duration=duration,
                transcript=transcript,
                criterion_name=criterion,
            )
            messages = [
                {"role": "system", "content": system_msg},
                {"role": "user", "content": user_msg},
            ]
            agent_tasks.append(self._run_agent_with_retry(messages, criterion))
            agent_keys.append(key)

        logger.info("Starting 4 speaking scoring agents in parallel...")
        results = await asyncio.gather(*agent_tasks)
        logger.info("All 4 scoring agents completed.")

        agent_reports: dict[str, SpeakingAgentReport] = {}
        agent_raw: dict[str, dict] = {}
        scores_dict: dict[str, float] = {}

        for key, result in zip(agent_keys, results):
            agent_reports[key] = SpeakingAgentReport(**result)
            agent_raw[key] = result
            scores_dict[key] = float(result.get("score", 0))

        # Run Chief Examiner
        chief_user = SPEAKING_CHIEF_USER_TEMPLATE.format(
            mode_label=mode_label,
            duration=duration,
            fc_score=scores_dict.get("fc", 0),
            fc_report=self._format_agent_for_chief(agent_raw.get("fc", {})),
            lr_score=scores_dict.get("lr", 0),
            lr_report=self._format_agent_for_chief(agent_raw.get("lr", {})),
            gra_score=scores_dict.get("gra", 0),
            gra_report=self._format_agent_for_chief(agent_raw.get("gra", {})),
            pronunciation_score=scores_dict.get("pronunciation", 0),
            pronunciation_report=self._format_agent_for_chief(agent_raw.get("pronunciation", {})),
            transcript=transcript,
        )

        chief_messages = [
            {"role": "system", "content": SPEAKING_CHIEF_SYSTEM},
            {"role": "user", "content": chief_user},
        ]

        logger.info("Starting Speaking Chief Examiner...")
        chief_result = await self._run_agent_with_retry(chief_messages, "Chief Examiner")
        logger.info("Chief Examiner completed.")

        chief_overall = float(chief_result.get("overall_score", 0) or 0)
        computed_mean = _round_to_half(sum(scores_dict.values()) / max(len(scores_dict), 1))
        overall = chief_overall if chief_overall > 0 else computed_mean

        scores = SpeakingScores(
            fc=scores_dict.get("fc", 0),
            lr=scores_dict.get("lr", 0),
            gra=scores_dict.get("gra", 0),
            pronunciation=scores_dict.get("pronunciation", 0),
            overall=overall,
        )

        report_md = chief_result.get("report_markdown", "")

        # Persist to DB
        duration_secs = int(time.time() - self._start_time) if self._start_time else 0
        async with AsyncSessionLocal() as db:
            result = await db.execute(
                select(SpeakingSession).where(SpeakingSession.id == self.session_id)
            )
            row = result.scalar_one_or_none()
            if row:
                row.status = "completed"
                row.overall_score = scores.overall
                row.scores = json.dumps(scores.model_dump(), ensure_ascii=False)
                row.agent_reports = json.dumps(
                    {k: v.model_dump() for k, v in agent_reports.items()},
                    ensure_ascii=False,
                )
                row.report_markdown = report_md
                row.duration_seconds = duration_secs
                row.part1_summary = self.memory.part1_summary
                await db.commit()

        # Notify state machine
        if self.state_machine:
            await self.state_machine.transition_to(SpeakingPhase.COMPLETED)

        # Send report to client
        await self.send_json({
            "type": "session_ended",
            "session_id": self.session_id,
            "scores": scores.model_dump(),
            "report_markdown": report_md,
        })

    async def _run_agent_with_retry(
        self,
        messages: list[dict[str, str]],
        agent_name: str,
    ) -> dict[str, Any]:
        """Run an agent with retry on JSON parse failure."""
        last_error: Exception | None = None
        for attempt in range(1, MAX_RETRIES + 1):
            try:
                result = await self.llm.chat(messages=messages, temperature=0.3, max_tokens=3000)
                cleaned = _strip_json_fence(result.content)
                data = json.loads(cleaned)
                logger.info("Agent [%s] succeeded on attempt %d", agent_name, attempt)
                return data
            except (json.JSONDecodeError, KeyError, TypeError) as e:
                last_error = e
                logger.warning("Agent [%s] attempt %d/%d failed: %s", agent_name, attempt, MAX_RETRIES, e)
                if attempt < MAX_RETRIES:
                    await asyncio.sleep(0.5)

        logger.error("Agent [%s] all retries exhausted: %s", agent_name, last_error)
        return {
            "criterion": agent_name,
            "score": 0,
            "strengths": [],
            "weaknesses": [f"Evaluation failed: {str(last_error)}"],
            "suggestions": ["Please retry the evaluation."],
        }

    @staticmethod
    def _format_agent_for_chief(report: dict) -> str:
        lines = []
        if report.get("strengths"):
            lines.append("**Strengths**: " + "; ".join(report["strengths"]))
        if report.get("weaknesses"):
            lines.append("**Weaknesses**: " + "; ".join(report["weaknesses"]))
        if report.get("suggestions"):
            lines.append("**Suggestions**: " + "; ".join(report["suggestions"]))
        return "\n".join(lines) if lines else "(No detailed report available)"

    # ── Persistence ──

    async def _save_message(self, role: str, content: str, phase: str) -> None:
        """Save a message to the database."""
        if not self.session_id:
            return
        async with AsyncSessionLocal() as db:
            msg = SpeakingMessage(
                session_id=self.session_id,
                role=role,
                content=content,
                phase=phase,
            )
            db.add(msg)
            await db.commit()

    async def _finalize_session(self) -> None:
        """Mark session as completed."""
        if not self.session_id:
            return
        duration_secs = int(time.time() - self._start_time) if self._start_time else 0
        async with AsyncSessionLocal() as db:
            result = await db.execute(
                select(SpeakingSession).where(SpeakingSession.id == self.session_id)
            )
            row = result.scalar_one_or_none()
            if row:
                row.status = "completed"
                row.duration_seconds = duration_secs
                row.topic_summary = self._generate_topic_summary()
                await db.commit()

    def _generate_topic_summary(self) -> str:
        """Generate a brief topic summary from conversation history."""
        if self.state_machine and self.state_machine.topic_card:
            return self.state_machine.topic_card.topic
        # For chat mode, use first few messages
        messages = self.memory.full_history[:3]
        if messages:
            return messages[0].get("content", "")[:200]
        return "Speaking practice session"

    async def _cleanup(self) -> None:
        """Clean up resources."""
        if self.state_machine:
            self.state_machine.cleanup()
        # Finalize session if not already done
        if self.session_id:
            async with AsyncSessionLocal() as db:
                result = await db.execute(
                    select(SpeakingSession).where(SpeakingSession.id == self.session_id)
                )
                row = result.scalar_one_or_none()
                if row and row.status == "active":
                    row.status = "abandoned"
                    row.duration_seconds = int(time.time() - self._start_time) if self._start_time else 0
                    await db.commit()


# ─────────────────────────────────────────────
# Session Query Functions (for REST API)
# ─────────────────────────────────────────────

def _safe_json_loads(value: str | None) -> Any | None:
    if not value:
        return None
    try:
        return json.loads(value)
    except json.JSONDecodeError:
        return None


async def get_speaking_sessions(
    session: AsyncSession,
    mode: str = "all",
    page: int = 1,
    page_size: int = 20,
) -> tuple[int, list[SessionListItem]]:
    """Query speaking sessions with filtering and pagination."""
    base = select(SpeakingSession)
    count_q = select(func.count(SpeakingSession.id))

    if mode != "all":
        base = base.where(SpeakingSession.mode == mode)
        count_q = count_q.where(SpeakingSession.mode == mode)

    # Only show completed sessions
    base = base.where(SpeakingSession.status == "completed")
    count_q = count_q.where(SpeakingSession.status == "completed")

    total_result = await session.execute(count_q)
    total = total_result.scalar() or 0

    q = (
        base.order_by(SpeakingSession.created_at.desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
    )
    result = await session.execute(q)
    rows = result.scalars().all()

    items: list[SessionListItem] = []
    for row in rows:
        scores_raw = _safe_json_loads(row.scores)
        scores = SpeakingScores(**scores_raw) if isinstance(scores_raw, dict) else None
        items.append(SessionListItem(
            id=row.id,
            mode=row.mode,
            status=row.status,
            topic_summary=row.topic_summary,
            overall_score=row.overall_score,
            scores=scores,
            duration_seconds=row.duration_seconds,
            created_at=row.created_at,
        ))
    return total, items


async def get_speaking_session_detail(
    session: AsyncSession,
    session_id: int,
) -> SessionDetailData | None:
    """Get full detail of a speaking session including transcript."""
    result = await session.execute(
        select(SpeakingSession).where(SpeakingSession.id == session_id)
    )
    row = result.scalar_one_or_none()
    if not row:
        return None

    scores_raw = _safe_json_loads(row.scores)
    scores = SpeakingScores(**scores_raw) if isinstance(scores_raw, dict) else None

    agent_reports = {}
    raw_reports = _safe_json_loads(row.agent_reports)
    if isinstance(raw_reports, dict):
        agent_reports = {k: SpeakingAgentReport(**v) for k, v in raw_reports.items()}

    topic_card_data = _safe_json_loads(row.topic_card)
    topic_card = TopicCardPayload(**topic_card_data) if isinstance(topic_card_data, dict) else None

    # Fetch messages
    msg_result = await session.execute(
        select(SpeakingMessage)
        .where(SpeakingMessage.session_id == session_id)
        .order_by(SpeakingMessage.created_at.asc())
    )
    messages = msg_result.scalars().all()
    transcript = [
        TranscriptEntry(
            role=msg.role,
            content=msg.content,
            phase=msg.phase,
            created_at=msg.created_at,
        )
        for msg in messages
    ]

    return SessionDetailData(
        session_id=row.id,
        mode=row.mode,
        status=row.status,
        topic_card=topic_card,
        topic_summary=row.topic_summary,
        overall_score=row.overall_score,
        scores=scores,
        agent_reports=agent_reports,
        report_markdown=row.report_markdown or "",
        transcript=transcript,
        duration_seconds=row.duration_seconds,
        created_at=row.created_at,
    )
