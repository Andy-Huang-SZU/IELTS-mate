from __future__ import annotations

from datetime import datetime
from enum import Enum

from pydantic import BaseModel, ConfigDict, Field


# ── Enums ──

class SpeakingMode(str, Enum):
    CHAT = "chat"
    MOCK_TEST = "mock_test"


class SpeakingPhase(str, Enum):
    IDLE = "idle"
    PART1_INTRO = "part1_intro"
    PART1_QA = "part1_qa"
    PART2_PREP = "part2_prep"
    PART2_SPEAK = "part2_speak"
    PART3_DISCUSSION = "part3_discussion"
    REPORT_GENERATING = "report_generating"
    COMPLETED = "completed"


class InputMode(str, Enum):
    PTT = "ptt"
    VAD = "vad"


# ── WebSocket Message Types ──

class WSMessageType(str, Enum):
    # Client → Server
    START_SESSION = "start_session"
    AUDIO_CHUNK = "audio_chunk"
    END_TURN = "end_turn"
    STOP_SESSION = "stop_session"
    PING = "ping"

    # Server → Client
    CONNECTED = "connected"
    PONG = "pong"
    TRANSCRIPTION = "transcription"
    AI_TEXT = "ai_text"
    AI_AUDIO = "ai_audio"
    STATE_CHANGE = "state_change"
    TIMER = "timer"
    TOPIC_CARD = "topic_card"
    ERROR = "error"
    SESSION_ENDED = "session_ended"


# ── WebSocket Payloads ──

class StartSessionPayload(BaseModel):
    mode: SpeakingMode = SpeakingMode.CHAT
    input_mode: InputMode = InputMode.PTT


class AudioChunkPayload(BaseModel):
    data: str = Field(description="Base64-encoded audio data")
    format: str = Field(default="webm", description="Audio format: webm, wav, mp3")


class TranscriptionPayload(BaseModel):
    text: str
    is_final: bool = True


class AITextPayload(BaseModel):
    text: str
    phase: str = ""


class AIAudioPayload(BaseModel):
    data: str = Field(description="Base64-encoded audio data")
    format: str = "mp3"


class StateChangePayload(BaseModel):
    phase: str
    message: str = ""


class TimerPayload(BaseModel):
    elapsed: int
    total: int
    warning_level: str = "none"  # none | yellow | orange | red


class TopicCardPayload(BaseModel):
    topic: str
    bullet_points: list[str] = []
    follow_up: str = ""


class ErrorPayload(BaseModel):
    message: str
    recoverable: bool = True


# ── Scores (Speaking-specific) ──

class SpeakingScores(BaseModel):
    fc: float = 0  # Fluency & Coherence
    lr: float = 0  # Lexical Resource
    gra: float = 0  # Grammatical Range & Accuracy
    pronunciation: float = 0  # Pronunciation
    overall: float = 0


class SpeakingAgentReport(BaseModel):
    criterion: str = ""
    score: float = 0
    strengths: list[str] = []
    weaknesses: list[str] = []
    suggestions: list[str] = []


# ── REST API Schemas ──

class SessionListItem(BaseModel):
    id: int
    mode: str
    status: str
    topic_summary: str | None = None
    overall_score: float | None = None
    scores: SpeakingScores | None = None
    duration_seconds: int = 0
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class SessionListData(BaseModel):
    total: int
    sessions: list[SessionListItem]


class SessionListResponse(BaseModel):
    success: bool = True
    data: SessionListData
    message: str = "ok"


class TranscriptEntry(BaseModel):
    role: str  # examiner | candidate
    content: str
    phase: str = ""
    created_at: datetime | None = None


class SessionDetailData(BaseModel):
    session_id: int
    mode: str
    status: str
    topic_card: TopicCardPayload | None = None
    topic_summary: str | None = None
    overall_score: float | None = None
    scores: SpeakingScores | None = None
    agent_reports: dict[str, SpeakingAgentReport] = {}
    report_markdown: str = ""
    transcript: list[TranscriptEntry] = []
    duration_seconds: int = 0
    created_at: datetime


class SessionDetailResponse(BaseModel):
    success: bool = True
    data: SessionDetailData
    message: str = "ok"
