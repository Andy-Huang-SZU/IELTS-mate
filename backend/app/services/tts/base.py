from __future__ import annotations

from dataclasses import dataclass


@dataclass
class TTSResult:
    audio_data: bytes
    format: str = "mp3"
    duration_seconds: float = 0.0


class BaseTTSClient:
    """Abstract base class for Text-to-Speech providers."""

    async def synthesize(self, text: str, voice: str = "alloy") -> TTSResult:
        """Convert text to speech audio.

        Args:
            text: Text to synthesize.
            voice: Voice identifier (provider-specific).

        Returns:
            TTSResult with audio bytes.
        """
        raise NotImplementedError

    async def test_connection(self) -> dict:
        """Quick connectivity check. Returns {connected, latency_ms, message}."""
        raise NotImplementedError
