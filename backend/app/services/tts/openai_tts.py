from __future__ import annotations

import ssl
import time

import httpx

from app.services.tts.base import BaseTTSClient, TTSResult

# Use a proper SSL context to avoid compatibility issues with some third-party
# API gateways (e.g. AiHubMix) where the default httpx SSL handling may fail
# with "WRONG_VERSION_NUMBER" errors.
_SSL_CTX = ssl.create_default_context()


class OpenAITTSClient(BaseTTSClient):
    """OpenAI TTS API (and compatible) implementation."""

    def __init__(
        self,
        api_key: str,
        base_url: str = "https://api.openai.com/v1",
        model: str = "tts-1",
        voice: str = "alloy",
    ):
        self.api_key = api_key
        self.base_url = base_url.rstrip("/")
        self.model = model
        self.default_voice = voice

    async def synthesize(self, text: str, voice: str = "") -> TTSResult:
        effective_voice = voice or self.default_voice

        async with httpx.AsyncClient(timeout=60.0, verify=_SSL_CTX) as client:
            response = await client.post(
                f"{self.base_url}/audio/speech",
                headers={
                    "Authorization": f"Bearer {self.api_key}",
                    "Content-Type": "application/json",
                },
                json={
                    "model": self.model,
                    "input": text,
                    "voice": effective_voice,
                    "response_format": "mp3",
                },
            )
            response.raise_for_status()

            return TTSResult(
                audio_data=response.content,
                format="mp3",
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
