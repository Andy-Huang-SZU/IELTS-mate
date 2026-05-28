from app.services.tts.base import BaseTTSClient, TTSResult
from app.services.tts.openai_tts import OpenAITTSClient

__all__ = ["BaseTTSClient", "TTSResult", "OpenAITTSClient", "create_tts_client"]


def create_tts_client(
    provider: str = "openai_tts",
    api_key: str = "",
    base_url: str = "https://api.openai.com/v1",
    model: str = "tts-1",
    voice: str = "alloy",
) -> BaseTTSClient:
    """Factory function to create a TTS client based on provider."""
    if provider in ("openai_tts", "openai_compatible"):
        return OpenAITTSClient(api_key=api_key, base_url=base_url, model=model, voice=voice)

    # Default fallback
    return OpenAITTSClient(api_key=api_key, base_url=base_url, model=model, voice=voice)
