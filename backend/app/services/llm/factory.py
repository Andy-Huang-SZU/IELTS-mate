from __future__ import annotations

from app.schemas.settings import SettingsPayload
from app.services.llm.base import BaseLLMClient
from app.services.llm.openai_compatible import OpenAICompatibleLLMClient


def create_llm_client(payload: SettingsPayload) -> BaseLLMClient:
    if payload.llm_provider == "openai_compatible":
        return OpenAICompatibleLLMClient(
            api_key=payload.llm_api_key,
            base_url=payload.llm_base_url,
            model=payload.llm_model,
        )

    # Fallback keeps the system usable before adding more providers.
    return OpenAICompatibleLLMClient(
        api_key=payload.llm_api_key,
        base_url=payload.llm_base_url,
        model=payload.llm_model,
    )
