"""LLM client abstraction layer supporting multiple providers."""

from __future__ import annotations

import logging
import os
from abc import ABC, abstractmethod

logger = logging.getLogger(__name__)


class LLMClient(ABC):
    """Base class for all LLM providers."""

    provider_name: str = "unknown"

    @abstractmethod
    async def generate(self, prompt: str, max_tokens: int = 500) -> str:
        ...


class AnthropicClient(LLMClient):
    """Anthropic Claude API (claude-sonnet, claude-opus, claude-haiku)."""

    provider_name = "anthropic"

    def __init__(self, api_key: str | None = None, model: str = "claude-sonnet-4-20250514"):
        import anthropic
        self.client = anthropic.AsyncAnthropic(api_key=api_key or os.getenv("ANTHROPIC_API_KEY"))
        self.model = model
        self.temperature = float(os.getenv("LLM_TEMPERATURE", "0.8"))

    async def generate(self, prompt: str, max_tokens: int = 500) -> str:
        response = await self.client.messages.create(
            model=self.model,
            max_tokens=max_tokens,
            messages=[{"role": "user", "content": prompt}],
            temperature=self.temperature,
        )
        return response.content[0].text


class OpenAIClient(LLMClient):
    """OpenAI API (gpt-4o, gpt-4o-mini, o1, etc.)."""

    provider_name = "openai"

    def __init__(self, api_key: str | None = None, model: str = "gpt-4o-mini"):
        import openai
        self.client = openai.AsyncOpenAI(api_key=api_key or os.getenv("OPENAI_API_KEY"))
        self.model = model
        self.temperature = float(os.getenv("LLM_TEMPERATURE", "0.8"))

    async def generate(self, prompt: str, max_tokens: int = 500) -> str:
        response = await self.client.chat.completions.create(
            model=self.model,
            max_tokens=max_tokens,
            messages=[{"role": "user", "content": prompt}],
            temperature=self.temperature,
        )
        return response.choices[0].message.content


class OpenAICompatibleClient(LLMClient):
    """Any OpenAI-compatible API (DeepSeek, Groq, Together AI, Mistral, etc.)."""

    provider_name = "openai_compatible"

    def __init__(
        self,
        api_key: str | None = None,
        model: str = "deepseek-chat",
        base_url: str | None = None,
    ):
        import openai
        self.client = openai.AsyncOpenAI(
            api_key=api_key or os.getenv("OPENAI_COMPATIBLE_API_KEY"),
            base_url=base_url or os.getenv("OPENAI_COMPATIBLE_BASE_URL"),
        )
        self.model = model
        self.temperature = float(os.getenv("LLM_TEMPERATURE", "0.8"))

    async def generate(self, prompt: str, max_tokens: int = 500) -> str:
        response = await self.client.chat.completions.create(
            model=self.model,
            max_tokens=max_tokens,
            messages=[{"role": "user", "content": prompt}],
            temperature=self.temperature,
        )
        return response.choices[0].message.content


class GeminiClient(LLMClient):
    """Google Gemini API."""

    provider_name = "gemini"

    def __init__(self, api_key: str | None = None, model: str = "gemini-2.0-flash"):
        from google import genai
        self._genai = genai
        self.client = genai.Client(api_key=api_key or os.getenv("GOOGLE_API_KEY"))
        self.model = model
        self.temperature = float(os.getenv("LLM_TEMPERATURE", "0.8"))

    async def generate(self, prompt: str, max_tokens: int = 500) -> str:
        response = await self.client.aio.models.generate_content(
            model=self.model,
            contents=prompt,
            config=self._genai.types.GenerateContentConfig(
                max_output_tokens=max_tokens,
                temperature=self.temperature,
            ),
        )
        return response.text


class OllamaClient(LLMClient):
    """Ollama local models (llama3, mistral, qwen, etc.)."""

    provider_name = "ollama"

    def __init__(self, model: str = "llama3.2", base_url: str | None = None):
        import openai
        self.client = openai.AsyncOpenAI(
            api_key="ollama",  # Ollama doesn't need a real key
            base_url=base_url or os.getenv("OLLAMA_BASE_URL", "http://localhost:11434/v1"),
        )
        self.model = model
        self.temperature = float(os.getenv("LLM_TEMPERATURE", "0.8"))

    async def generate(self, prompt: str, max_tokens: int = 500) -> str:
        response = await self.client.chat.completions.create(
            model=self.model,
            max_tokens=max_tokens,
            messages=[{"role": "user", "content": prompt}],
            temperature=self.temperature,
        )
        return response.choices[0].message.content


class MockLLMClient(LLMClient):
    """Fallback client that generates simple responses without an API."""

    provider_name = "mock"

    async def generate(self, prompt: str, max_tokens: int = 500) -> str:
        return (
            "Person A: Hey, how's it going?\n"
            "Person B: Not bad, just another day in RimTown!\n"
            "Person A: Yeah, same here. Take care!\n"
            'EFFECTS: {"affinity_change_a": 2, "affinity_change_b": 1, '
            '"romantic_change_a": 0, "romantic_change_b": 0, '
            '"summary": "Had a friendly casual chat."}'
        )


# Provider registry: name -> (ClientClass, env_key_for_api_key, default_model)
PROVIDERS = {
    "anthropic":        (AnthropicClient,        "ANTHROPIC_API_KEY",          "claude-sonnet-4-20250514"),
    "openai":           (OpenAIClient,           "OPENAI_API_KEY",             "gpt-4o-mini"),
    "gemini":           (GeminiClient,           "GOOGLE_API_KEY",             "gemini-2.0-flash"),
    "google":           (GeminiClient,           "GOOGLE_API_KEY",             "gemini-2.0-flash"),
    "ollama":           (OllamaClient,           None,                         "llama3.2"),
    "openai_compatible": (OpenAICompatibleClient, "OPENAI_COMPATIBLE_API_KEY", "deepseek-chat"),
    "deepseek":         (OpenAICompatibleClient, "DEEPSEEK_API_KEY",           "deepseek-chat"),
    "groq":             (OpenAICompatibleClient, "GROQ_API_KEY",              "llama-3.3-70b-versatile"),
    "together":         (OpenAICompatibleClient, "TOGETHER_API_KEY",          "meta-llama/Meta-Llama-3.1-8B-Instruct-Turbo"),
}

# Base URLs for known OpenAI-compatible providers
COMPATIBLE_BASE_URLS = {
    "deepseek":  "https://api.deepseek.com/v1",
    "groq":      "https://api.groq.com/openai/v1",
    "together":  "https://api.together.xyz/v1",
}


def create_llm_client(provider: str | None = None) -> LLMClient:
    """Create the appropriate LLM client based on environment config.

    Resolution order:
    1. Explicit LLM_PROVIDER env var
    2. Auto-detect from available API keys
    3. Fall back to MockLLMClient
    """
    provider = provider or os.getenv("LLM_PROVIDER", "").strip().lower()
    model = os.getenv("LLM_MODEL", "").strip()

    # If provider is explicitly set, try to create it
    if provider and provider != "mock":
        client = _create_provider(provider, model)
        if client:
            return client
        logger.warning(f"Provider '{provider}' configured but missing API key, trying auto-detect...")

    # Auto-detect: try each provider in priority order
    if not provider or provider == "auto":
        for name in ["anthropic", "openai", "gemini", "deepseek", "groq", "together"]:
            info = PROVIDERS[name]
            env_key = info[1]
            if env_key and os.getenv(env_key):
                client = _create_provider(name, model)
                if client:
                    logger.info(f"Auto-detected provider: {name}")
                    return client

        # Check for Ollama (no key needed, just check if configured)
        if os.getenv("OLLAMA_BASE_URL") or os.getenv("LLM_PROVIDER") == "ollama":
            client = _create_provider("ollama", model)
            if client:
                return client

    logger.info("No API key found - using Mock LLM client (set keys in .env)")
    return MockLLMClient()


def _create_provider(name: str, model: str = "") -> LLMClient | None:
    """Create a specific provider client."""
    if name not in PROVIDERS:
        logger.error(f"Unknown provider: {name}")
        return None

    client_cls, env_key, default_model = PROVIDERS[name]
    use_model = model or default_model

    try:
        if client_cls == OllamaClient:
            client = OllamaClient(model=use_model)
        elif client_cls == OpenAICompatibleClient:
            # Resolve API key and base URL for compatible providers
            api_key = os.getenv(env_key) if env_key else None
            # Also check generic key
            if not api_key:
                api_key = os.getenv("OPENAI_COMPATIBLE_API_KEY")
            base_url = COMPATIBLE_BASE_URLS.get(name) or os.getenv("OPENAI_COMPATIBLE_BASE_URL")
            if not api_key:
                return None
            client = OpenAICompatibleClient(api_key=api_key, model=use_model, base_url=base_url)
        else:
            api_key = os.getenv(env_key) if env_key else None
            if env_key and not api_key:
                return None
            client = client_cls(api_key=api_key, model=use_model)

        logger.info(f"LLM provider: {name} | model: {use_model}")
        return client
    except ImportError as e:
        logger.error(f"Missing dependency for {name}: {e}")
        logger.error(f"  Install with: pip install {_pip_hint(name)}")
        return None
    except Exception as e:
        logger.error(f"Failed to initialize {name}: {e}")
        return None


def _pip_hint(provider: str) -> str:
    """Return pip install hint for a provider."""
    hints = {
        "anthropic": "anthropic",
        "openai": "openai",
        "gemini": "google-genai",
        "google": "google-genai",
        "ollama": "openai",
        "openai_compatible": "openai",
        "deepseek": "openai",
        "groq": "openai",
        "together": "openai",
    }
    return hints.get(provider, provider)


def list_available_providers() -> list[dict]:
    """List all providers and whether they're configured."""
    result = []
    for name, (cls, env_key, default_model) in PROVIDERS.items():
        has_key = bool(os.getenv(env_key)) if env_key else (name == "ollama")
        result.append({
            "name": name,
            "configured": has_key,
            "default_model": default_model,
            "env_key": env_key or "(none)",
        })
    return result
