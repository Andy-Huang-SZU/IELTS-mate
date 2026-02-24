from __future__ import annotations

from dataclasses import dataclass


@dataclass
class LLMConnectionTestResult:
    connected: bool
    latency_ms: int
    model_info: str
    message: str = ""


class BaseLLMClient:
    async def test_connection(self) -> LLMConnectionTestResult:
        raise NotImplementedError

    async def chat(
        self,
        messages: list[dict[str, str]],
        temperature: float = 0.7,
        max_tokens: int = 4096,
    ) -> str:
        """Send a chat completion request and return the assistant message text."""
        raise NotImplementedError
