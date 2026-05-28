from __future__ import annotations

from pydantic import BaseModel, ConfigDict, Field


class SettingsPayload(BaseModel):
    llm_provider: str = Field(default="openai_compatible")
    llm_api_key: str = Field(default="")
    llm_base_url: str = Field(default="https://api.openai.com/v1")
    llm_model: str = Field(default="gpt-4o-mini")
    stt_provider: str = Field(default="openai_whisper")
    stt_api_key: str = Field(default="")
    stt_base_url: str = Field(default="https://api.openai.com/v1")
    stt_model: str = Field(default="whisper-1")
    tts_provider: str = Field(default="openai_tts")
    tts_api_key: str = Field(default="")
    tts_base_url: str = Field(default="https://api.openai.com/v1")
    tts_model: str = Field(default="tts-1")
    tts_voice: str = Field(default="alloy")

    # Topic generation LLM — can share the evaluation LLM or use independent config
    topicgen_use_same_llm: bool = Field(default=True)
    topicgen_provider: str = Field(default="openai_compatible")
    topicgen_api_key: str = Field(default="")
    topicgen_base_url: str = Field(default="https://api.openai.com/v1")
    topicgen_model: str = Field(default="deepseek-chat")

    # Token pricing — $/million tokens for cost estimation display
    token_price_input: float = Field(default=0.0, description="Input token price in $/million tokens")
    token_price_output: float = Field(default=0.0, description="Output token price in $/million tokens")

    model_config = ConfigDict(extra="forbid")


class SettingsResponse(BaseModel):
    success: bool
    data: SettingsPayload
    message: str = "ok"


class SettingsUpdateRequest(BaseModel):
    llm_provider: str | None = None
    llm_api_key: str | None = None
    llm_base_url: str | None = None
    llm_model: str | None = None
    stt_provider: str | None = None
    stt_api_key: str | None = None
    stt_base_url: str | None = None
    stt_model: str | None = None
    tts_provider: str | None = None
    tts_api_key: str | None = None
    tts_base_url: str | None = None
    tts_model: str | None = None
    tts_voice: str | None = None
    topicgen_use_same_llm: bool | None = None
    topicgen_provider: str | None = None
    topicgen_api_key: str | None = None
    topicgen_base_url: str | None = None
    topicgen_model: str | None = None
    token_price_input: float | None = None
    token_price_output: float | None = None

    model_config = ConfigDict(extra="forbid")


class TestConnectionRequest(BaseModel):
    service_type: str = Field(default="llm")
    api_key: str = Field(default="")
    base_url: str = Field(default="https://api.openai.com/v1")
    model: str = Field(default="gpt-4o-mini")
    provider: str = Field(default="openai_compatible")

    model_config = ConfigDict(extra="forbid")


class TestConnectionData(BaseModel):
    connected: bool
    latency_ms: int
    model_info: str
    message: str = "ok"


class TestConnectionResponse(BaseModel):
    success: bool
    data: TestConnectionData
    message: str = "ok"
