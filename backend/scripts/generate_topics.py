#!/usr/bin/env python3
"""
Topic Generation Script — Developer tool for generating IELTS writing topics.

Usage examples:
    # Reindex existing topic IDs to canonical readable IDs
    python generate_topics.py --reindex-bank

    # Generate the recommended first validation batch (20 topics)
    python generate_topics.py --profile starter-20

    # Generate 2 Task 1 bar-chart topics
    python generate_topics.py --task part_a --chart-type bar --count 2

    # Generate all Task 2 types based on the distribution plan
    python generate_topics.py --task part_b --all-types

    # Generate the full bank target
    python generate_topics.py --full-bank

Required: Either provide --api-key or set DEEPSEEK_API_KEY / TOPICGEN_API_KEY.
"""

from __future__ import annotations

import argparse
import asyncio
import logging
import os
import sys
import time
from pathlib import Path

from openai import AsyncOpenAI

# Add backend to path
backend_dir = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(backend_dir))

from app.services.llm.base import BaseLLMClient, ChatResult, LLMConnectionTestResult, TokenUsage
from app.services.topic_bank_service import TopicBankService
from app.services.topic_gen_service import TOPIC_THEMES, estimate_tokens, generate_topic

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
logger = logging.getLogger(__name__)

# Default distribution plan (150 topics total)
TASK1_DISTRIBUTION = {
    "bar": 22,
    "line": 18,
    "pie": 12,
    "table": 12,
    "map": 10,
    "mixed": 12,
    "process": 9,
}

TASK2_DISTRIBUTION = {
    "opinion": 18,
    "discussion": 14,
    "problem_solution": 8,
    "two_part": 7,
    "advantage_disadvantage": 8,
}

STARTER_BATCH_20 = [
    ("part_a", "bar", None, 2),
    ("part_a", "line", None, 2),
    ("part_a", "pie", None, 1),
    ("part_a", "table", None, 1),
    ("part_a", "map", None, 1),
    ("part_a", "mixed", None, 2),
    ("part_a", "process", None, 1),
    ("part_b", None, "opinion", 2),
    ("part_b", None, "discussion", 2),
    ("part_b", None, "problem_solution", 2),
    ("part_b", None, "two_part", 2),
    ("part_b", None, "advantage_disadvantage", 2),
]


class OpenAISDKTopicGenClient(BaseLLMClient):
    """Use the official OpenAI SDK against DeepSeek/OpenAI-compatible endpoints."""

    def __init__(self, api_key: str, base_url: str, model: str):
        self.api_key = api_key
        self.base_url = base_url.rstrip("/")
        self.model = model
        self._client = AsyncOpenAI(api_key=api_key, base_url=self.base_url)

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
            await self._client.models.list()
            latency_ms = int((time.perf_counter() - started_at) * 1000)
            return LLMConnectionTestResult(
                connected=True,
                latency_ms=latency_ms,
                model_info=self.model,
                message="ok",
            )
        except Exception as error:  # pragma: no cover - network path
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
        response = await self._client.chat.completions.create(
            model=self.model,
            messages=messages,
            temperature=temperature,
            max_tokens=max_tokens,
            stream=False,
        )
        content = response.choices[0].message.content or ""
        usage = None
        if response.usage:
            usage = TokenUsage(
                prompt_tokens=response.usage.prompt_tokens or 0,
                completion_tokens=response.usage.completion_tokens or 0,
                total_tokens=response.usage.total_tokens or 0,
            )
        return ChatResult(content=content, usage=usage)


async def generate_batch(
    llm: BaseLLMClient,
    bank: TopicBankService,
    task_type: str,
    chart_type: str | None,
    question_type: str | None,
    count: int,
    batch_size: int,
) -> dict:
    """Generate a batch of topics and save to bank."""
    import random

    themes = list(TOPIC_THEMES)
    random.shuffle(themes)

    success = 0
    failed = 0
    total_usage = {"prompt_tokens": 0, "completion_tokens": 0, "total_tokens": 0}

    sub_type = chart_type or question_type or "unknown"
    logger.info("Generating %s topics: task=%s, type=%s", count, task_type, sub_type)

    chunk_success = 0
    chunk_failed = 0
    chunk_ids: list[str] = []
    chunk_index = 0

    for i in range(count):
        theme = themes[i % len(themes)]
        try:
            topic_dict, result = await generate_topic(
                llm=llm,
                task_type=task_type,
                chart_type=chart_type,
                question_type=question_type,
                theme=theme,
            )
            stored_topic = bank.add_topic(topic_dict)
            success += 1
            chunk_success += 1
            chunk_ids.append(stored_topic.get("id", "?"))

            if result.usage:
                total_usage["prompt_tokens"] += result.usage.prompt_tokens
                total_usage["completion_tokens"] += result.usage.completion_tokens
                total_usage["total_tokens"] += result.usage.total_tokens

            logger.info(
                "  [%s/%s] Generated: %s (theme=%s, tokens=%s)",
                success + failed,
                count,
                stored_topic.get("id", "?"),
                theme,
                result.usage.total_tokens if result.usage else "?",
            )

            if i < count - 1:
                await asyncio.sleep(0.5)

        except Exception as e:  # pragma: no cover - network path
            failed += 1
            chunk_failed += 1
            logger.error("  [%s/%s] Failed: %s", success + failed, count, e)

        chunk_done = chunk_success + chunk_failed
        if chunk_done >= batch_size or i == count - 1:
            chunk_index += 1
            id_range = f"{chunk_ids[0]} ~ {chunk_ids[-1]}" if chunk_ids else "(none)"
            logger.info(
                "  Batch %s summary [%s/%s]: success=%s failed=%s ids=%s bank_total=%s",
                chunk_index,
                success + failed,
                count,
                chunk_success,
                chunk_failed,
                id_range,
                bank.total_count,
            )
            chunk_success = 0
            chunk_failed = 0
            chunk_ids = []

    return {
        "task_type": task_type,
        "sub_type": sub_type,
        "requested": count,
        "success": success,
        "failed": failed,
        "total_usage": total_usage,
    }


def build_plan(args: argparse.Namespace) -> list[tuple[str, str | None, str | None, int]]:
    """Build the generation plan based on CLI arguments."""
    plan: list[tuple[str, str | None, str | None, int]] = []

    if args.profile == "starter-20":
        return STARTER_BATCH_20.copy()

    if args.full_bank:
        for ct, n in TASK1_DISTRIBUTION.items():
            plan.append(("part_a", ct, None, n))
        for qt, n in TASK2_DISTRIBUTION.items():
            plan.append(("part_b", None, qt, n))
        return plan

    if args.all_types:
        if args.task == "part_a":
            for ct, n in TASK1_DISTRIBUTION.items():
                plan.append(("part_a", ct, None, n))
            return plan
        if args.task == "part_b":
            for qt, n in TASK2_DISTRIBUTION.items():
                plan.append(("part_b", None, qt, n))
            return plan
        raise ValueError("--all-types requires --task part_a or --task part_b")

    if args.task:
        return [(args.task, args.chart_type, args.question_type, args.count)]

    return plan


async def main():
    parser = argparse.ArgumentParser(description="Generate IELTS writing topics using OpenAI SDK + DeepSeek")
    parser.add_argument("--task", choices=["part_a", "part_b"], help="Task type")
    parser.add_argument("--chart-type", choices=["bar", "line", "pie", "table", "map", "mixed", "process"])
    parser.add_argument("--question-type", choices=["opinion", "discussion", "problem_solution", "two_part", "advantage_disadvantage"])
    parser.add_argument("--count", type=int, default=1, help="Number of topics to generate (default: 1)")
    parser.add_argument("--batch-size", type=int, default=5, help="How many attempts to group into one progress batch summary")
    parser.add_argument("--all-types", action="store_true", help="Generate all sub-types for the given task")
    parser.add_argument("--full-bank", action="store_true", help="Generate full 150-topic bank")
    parser.add_argument("--profile", choices=["starter-20"], help="Run a predefined staged generation profile")
    parser.add_argument("--reindex-bank", action="store_true", help="Canonicalise existing topic IDs before doing anything else")
    parser.add_argument("--api-key", default=os.getenv("DEEPSEEK_API_KEY") or os.getenv("TOPICGEN_API_KEY", ""), help="LLM API key")
    parser.add_argument("--base-url", default=os.getenv("DEEPSEEK_BASE_URL") or os.getenv("TOPICGEN_BASE_URL", "https://api.deepseek.com"), help="LLM base URL")
    parser.add_argument("--model", default=os.getenv("TOPICGEN_MODEL", "deepseek-chat"), help="LLM model name")
    parser.add_argument("--bank-path", default=None, help="Path to topic bank JSON file")
    parser.add_argument("--dry-run", action="store_true", help="Only show token estimates, don't generate")

    args = parser.parse_args()

    bank_path = Path(args.bank_path) if args.bank_path else (backend_dir / "data" / "writing_topics.json")
    bank = TopicBankService(bank_path)
    bank.load()

    logger.info("Topic bank: %s (%s existing topics)", bank_path, bank.total_count)

    if args.reindex_bank:
        summary = bank.normalize_bank()
        logger.info(
            "Reindexed topic bank: total=%s changed=%s",
            summary["total"],
            summary["changed"],
        )
        for key, value in sorted(summary["breakdown"].items()):
            logger.info("  %s -> %s", key, value)

    plan = build_plan(args)
    if not plan:
        if args.reindex_bank:
            logger.info("Only reindex requested. Done.")
            return
        logger.error("No generation action provided. Use --profile, --task, --all-types, or --full-bank.")
        sys.exit(1)

    if not args.api_key and not args.dry_run:
        logger.error("API key required. Use --api-key or set DEEPSEEK_API_KEY / TOPICGEN_API_KEY.")
        sys.exit(1)

    total_est = {"prompt_tokens": 0, "completion_tokens": 0, "total_tokens": 0}
    logger.info("\n📊 Generation Plan:")
    logger.info("-" * 60)
    for task_type, ct, qt, count in plan:
        est = estimate_tokens(task_type, ct, qt, count)
        total_est["prompt_tokens"] += est["prompt_tokens"]
        total_est["completion_tokens"] += est["completion_tokens"]
        total_est["total_tokens"] += est["total_tokens"]
        sub = ct or qt or "any"
        logger.info("  %s/%s: %s topics → ~%s tokens", task_type, sub, count, f"{est['total_tokens']:,}")

    logger.info("-" * 60)
    logger.info(
        "  TOTAL: %s topics → ~%s tokens (prompt: %s, completion: %s)",
        sum(c for _, _, _, c in plan),
        f"{total_est['total_tokens']:,}",
        f"{total_est['prompt_tokens']:,}",
        f"{total_est['completion_tokens']:,}",
    )

    if args.dry_run:
        logger.info("\n🔍 Dry run complete. No topics generated.")
        return

    llm = OpenAISDKTopicGenClient(
        api_key=args.api_key,
        base_url=args.base_url,
        model=args.model,
    )

    logger.info("\n🚀 Starting generation with model: %s", args.model)
    logger.info("   Base URL: %s", args.base_url)
    logger.info("   SDK: openai.AsyncOpenAI\n")

    all_results = []
    for task_type, ct, qt, count in plan:
        result = await generate_batch(
            llm=llm,
            bank=bank,
            task_type=task_type,
            chart_type=ct,
            question_type=qt,
            count=count,
            batch_size=max(args.batch_size, 1),
        )
        all_results.append(result)

    logger.info("\n" + "=" * 60)
    logger.info("📋 Generation Summary:")
    total_success = 0
    total_failed = 0
    actual_usage = {"prompt_tokens": 0, "completion_tokens": 0, "total_tokens": 0}

    for r in all_results:
        total_success += r["success"]
        total_failed += r["failed"]
        for k in actual_usage:
            actual_usage[k] += r["total_usage"][k]
        logger.info("  %s/%s: %s/%s success", r["task_type"], r["sub_type"], r["success"], r["requested"])

    logger.info("\n  Total: %s success, %s failed", total_success, total_failed)
    logger.info("  Actual tokens used: %s", f"{actual_usage['total_tokens']:,}")
    logger.info("  Topic bank now has %s topics", bank.total_count)
    logger.info("  Current bank breakdown:")
    for key, value in sorted(bank.get_stats()["breakdown"].items()):
        logger.info("    %s -> %s", key, value)
    logger.info("=" * 60)


if __name__ == "__main__":
    asyncio.run(main())
