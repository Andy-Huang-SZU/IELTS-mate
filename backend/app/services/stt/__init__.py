from app.services.stt.base import BaseSTTClient, STTResult
from app.services.stt.openai_whisper import OpenAIWhisperSTTClient

__all__ = ["BaseSTTClient", "STTResult", "OpenAIWhisperSTTClient", "create_stt_client"]


def create_stt_client(
    provider: str = "openai_whisper",
    api_key: str = "",
    base_url: str = "https://api.openai.com/v1",
    model: str = "whisper-1",
) -> BaseSTTClient:
    """Factory function to create an STT client based on provider."""
    if provider in ("openai_whisper", "openai_compatible"):
        return OpenAIWhisperSTTClient(api_key=api_key, base_url=base_url, model=model)

    # Default fallback
    return OpenAIWhisperSTTClient(api_key=api_key, base_url=base_url, model=model)
