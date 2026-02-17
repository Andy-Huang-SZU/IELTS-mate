from __future__ import annotations

import time

import httpx

from app.services.llm.base import BaseLLMClient, LLMConnectionTestResult


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
            async with httpx.AsyncClient(timeout=12.0) as client:
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
