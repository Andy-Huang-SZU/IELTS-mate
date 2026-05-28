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


def create_topicgen_llm_client(payload: SettingsPayload) -> BaseLLMClient:
    """Create LLM client for topic generation.

    When topicgen_use_same_llm is True, reuse evaluation LLM config but allow
    a different model name (topicgen_model). Otherwise use fully independent config.
    """
    if payload.topicgen_use_same_llm:
        # Reuse eval LLM's provider/base_url/api_key, but allow separate model
        model = payload.topicgen_model if payload.topicgen_model else payload.llm_model
        return OpenAICompatibleLLMClient(
            api_key=payload.llm_api_key,
            base_url=payload.llm_base_url,
            model=model,
        )

    # Fully independent config
    return OpenAICompatibleLLMClient(
        api_key=payload.topicgen_api_key,
        base_url=payload.topicgen_base_url,
        model=payload.topicgen_model,
    )
