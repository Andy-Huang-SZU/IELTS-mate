from __future__ import annotations

from dataclasses import dataclass


@dataclass
class STTResult:
    text: str
    language: str = ""
    duration_seconds: float = 0.0


class BaseSTTClient:
    """Abstract base class for Speech-to-Text providers."""

    async def transcribe(self, audio_data: bytes, format: str = "webm") -> STTResult:
        """Transcribe audio bytes into text.

        Args:
            audio_data: Raw audio bytes.
            format: Audio format (webm, wav, mp3, etc.).

        Returns:
            STTResult with transcribed text.
        """
        raise NotImplementedError

    async def test_connection(self) -> dict:
        """Quick connectivity check. Returns {connected, latency_ms, message}."""
        raise NotImplementedError
