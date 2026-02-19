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
