from __future__ import annotations

import ssl
import time

import httpx

from app.services.llm.base import BaseLLMClient, ChatResult, LLMConnectionTestResult, TokenUsage

# Use a proper SSL context to avoid compatibility issues with some third-party
# API gateways (e.g. AiHubMix) where the default httpx SSL handling may fail.
_SSL_CTX = ssl.create_default_context()


class OpenAICompatibleLLMClient(BaseLLMClient):
    def __init__(self, api_key: str, base_url: str, model: str):
        self.api_key = api_key
        self.base_url = base_url.rstrip("/")
        self.model = model

    async def test_connection(self) -> LLMConnectionTestResult:
        if not self.api_key.strip():
            return LLMConnectionTestResult(
                connected=False,
                latency_ms=0,
                model_info=self.model,
                message="API key is empty",
            )

        started_at = time.perf_counter()
        try:
            async with httpx.AsyncClient(timeout=12.0, verify=_SSL_CTX) as client:
                response = await client.get(
                    f"{self.base_url}/models",
                    headers={"Authorization": f"Bearer {self.api_key}"},
                )
                latency_ms = int((time.perf_counter() - started_at) * 1000)
                if response.is_success:
                    return LLMConnectionTestResult(
                        connected=True,
                        latency_ms=latency_ms,
                        model_info=self.model,
                        message="ok",
                    )
                return LLMConnectionTestResult(
                    connected=False,
                    latency_ms=latency_ms,
                    model_info=self.model,
                    message=f"HTTP {response.status_code}",
                )
        except Exception as error:
            latency_ms = int((time.perf_counter() - started_at) * 1000)
            return LLMConnectionTestResult(
                connected=False,
                latency_ms=latency_ms,
                model_info=self.model,
                message=str(error),
            )

    async def chat(
        self,
        messages: list[dict[str, str]],
        temperature: float = 0.7,
        max_tokens: int = 4096,
    ) -> ChatResult:
        async with httpx.AsyncClient(timeout=120.0, verify=_SSL_CTX) as client:
            response = await client.post(
                f"{self.base_url}/chat/completions",
                headers={
                    "Authorization": f"Bearer {self.api_key}",
                    "Content-Type": "application/json",
                },
                json={
                    "model": self.model,
                    "messages": messages,
                    "temperature": temperature,
                    "max_tokens": max_tokens,
                },
            )
            response.raise_for_status()
            data = response.json()
            content = data["choices"][0]["message"]["content"]

            usage = None
            if "usage" in data and data["usage"]:
                u = data["usage"]
                usage = TokenUsage(
                    prompt_tokens=u.get("prompt_tokens", 0),
                    completion_tokens=u.get("completion_tokens", 0),
                    total_tokens=u.get("total_tokens", 0),
                )

            return ChatResult(content=content, usage=usage)
