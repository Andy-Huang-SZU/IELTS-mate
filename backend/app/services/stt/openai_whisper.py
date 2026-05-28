from __future__ import annotations

import io
import ssl
import time

import httpx

from app.services.stt.base import BaseSTTClient, STTResult

# Use a proper SSL context to avoid compatibility issues with some third-party
# API gateways (e.g. AiHubMix) where the default httpx SSL handling may fail
# with "WRONG_VERSION_NUMBER" errors.
_SSL_CTX = ssl.create_default_context()


class OpenAIWhisperSTTClient(BaseSTTClient):
    """OpenAI Whisper API (and compatible) STT implementation."""

    def __init__(self, api_key: str, base_url: str = "https://api.openai.com/v1", model: str = "whisper-1"):
        self.api_key = api_key
        self.base_url = base_url.rstrip("/")
        self.model = model

    async def transcribe(self, audio_data: bytes, format: str = "webm") -> STTResult:
        ext = format.split("/")[-1] if "/" in format else format
        filename = f"audio.{ext}"

        async with httpx.AsyncClient(timeout=60.0, verify=_SSL_CTX) as client:
            response = await client.post(
                f"{self.base_url}/audio/transcriptions",
                headers={"Authorization": f"Bearer {self.api_key}"},
                files={"file": (filename, io.BytesIO(audio_data), f"audio/{ext}")},
                data={
                    "model": self.model,
                    "response_format": "json",
                    "language": "en",
                },
            )
            response.raise_for_status()
            data = response.json()

            return STTResult(
                text=data.get("text", "").strip(),
                language=data.get("language", "en"),
                duration_seconds=data.get("duration", 0.0),
            )

    async def test_connection(self) -> dict:
        if not self.api_key.strip():
            return {"connected": False, "latency_ms": 0, "message": "API key is empty"}

        started_at = time.perf_counter()
        try:
            async with httpx.AsyncClient(timeout=12.0, verify=_SSL_CTX) as client:
                response = await client.get(
                    f"{self.base_url}/models",
                    headers={"Authorization": f"Bearer {self.api_key}"},
                )
                latency_ms = int((time.perf_counter() - started_at) * 1000)
                if response.is_success:
                    return {"connected": True, "latency_ms": latency_ms, "message": "ok"}
                return {"connected": False, "latency_ms": latency_ms, "message": f"HTTP {response.status_code}"}
        except Exception as error:
            latency_ms = int((time.perf_counter() - started_at) * 1000)
            return {"connected": False, "latency_ms": latency_ms, "message": str(error)}
