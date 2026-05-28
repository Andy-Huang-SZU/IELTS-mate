from __future__ import annotations

from dataclasses import dataclass


@dataclass
class LLMConnectionTestResult:
    connected: bool
    latency_ms: int
    model_info: str
    message: str = ""


@dataclass
class TokenUsage:
    prompt_tokens: int = 0
    completion_tokens: int = 0
    total_tokens: int = 0


@dataclass
class ChatResult:
    content: str
    usage: TokenUsage | None = None


class BaseLLMClient:
    async def test_connection(self) -> LLMConnectionTestResult:
        raise NotImplementedError

    async def chat(
        self,
        messages: list[dict[str, str]],
        temperature: float = 0.7,
        max_tokens: int = 4096,
    ) -> ChatResult:
        """Send a chat completion request and return ChatResult with content and token usage."""
        raise NotImplementedError
