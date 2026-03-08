"""LLM client abstraction layer supporting multiple providers."""

from __future__ import annotations

import logging
import os
from abc import ABC, abstractmethod

logger = logging.getLogger(__name__)


class LLMClient(ABC):
    @abstractmethod
    async def generate(self, prompt: str, max_tokens: int = 500) -> str:
        ...


class AnthropicClient(LLMClient):
    def __init__(self, api_key: str | None = None, model: str = "claude-sonnet-4-20250514"):
        import anthropic
        self.client = anthropic.AsyncAnthropic(api_key=api_key or os.getenv("ANTHROPIC_API_KEY"))
        self.model = model

    async def generate(self, prompt: str, max_tokens: int = 500) -> str:
        response = await self.client.messages.create(
            model=self.model,
            max_tokens=max_tokens,
            messages=[{"role": "user", "content": prompt}],
            temperature=0.8,
        )
        return response.content[0].text


class OpenAIClient(LLMClient):
    def __init__(self, api_key: str | None = None, model: str = "gpt-4o-mini"):
        import openai
        self.client = openai.AsyncOpenAI(api_key=api_key or os.getenv("OPENAI_API_KEY"))
        self.model = model

    async def generate(self, prompt: str, max_tokens: int = 500) -> str:
        response = await self.client.chat.completions.create(
            model=self.model,
            max_tokens=max_tokens,
            messages=[{"role": "user", "content": prompt}],
            temperature=0.8,
        )
        return response.choices[0].message.content


class MockLLMClient(LLMClient):
    """Fallback client that generates simple responses without an API."""

    async def generate(self, prompt: str, max_tokens: int = 500) -> str:
        # Return a simple template response for testing without API keys
        return (
            "Person A: Hey, how's it going?\n"
            "Person B: Not bad, just another day in RimTown!\n"
            "Person A: Yeah, same here. Take care!\n"
            'EFFECTS: {"affinity_change_a": 2, "affinity_change_b": 1, '
            '"romantic_change_a": 0, "romantic_change_b": 0, '
            '"summary": "Had a friendly casual chat."}'
        )


def create_llm_client(provider: str | None = None) -> LLMClient:
    """Create the appropriate LLM client based on config."""
    provider = provider or os.getenv("LLM_PROVIDER", "mock")
    model = os.getenv("LLM_MODEL", "")

    if provider == "anthropic" and os.getenv("ANTHROPIC_API_KEY"):
        logger.info(f"Using Anthropic LLM client (model: {model or 'default'})")
        return AnthropicClient(model=model) if model else AnthropicClient()

    if provider == "openai" and os.getenv("OPENAI_API_KEY"):
        logger.info(f"Using OpenAI LLM client (model: {model or 'default'})")
        return OpenAIClient(model=model) if model else OpenAIClient()

    logger.info("Using Mock LLM client (no API key configured)")
    return MockLLMClient()
