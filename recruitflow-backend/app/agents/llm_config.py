"""Shared LLM provider configuration for all six agents.

We don't have a paid OpenAI key, so every agent talks to an OpenRouter model
(``google/gemini-2.0-flash-exp:free`` by default) through OpenRouter's
OpenAI-compatible endpoint.

Three things make the OpenAI Agents SDK use OpenRouter instead of OpenAI:

  1. ``set_default_openai_client`` points the SDK at an ``AsyncOpenAI`` client
     configured with OpenRouter's ``base_url`` + key.
  2. ``set_default_openai_api("chat_completions")`` switches the SDK off its
     default Responses API (which OpenRouter does not implement) and onto the
     Chat Completions API that OpenRouter does support.
  3. Agents take their ``model`` from :func:`get_agent_model`, which returns an
     ``OpenAIChatCompletionsModel`` bound to our client. This is essential:
     OpenRouter model ids contain a ``/`` (e.g. ``google/gemini-2.0-flash-exp``)
     and if passed as a bare string the SDK's ``MultiProvider`` mis-reads the
     part before the ``/`` as a provider prefix and raises "Unknown prefix".
     Wrapping the id in an explicit model object bypasses that routing entirely.

Import this module once, early — calling :func:`configure_llm` wires the SDK
process-wide. The model name is read from ``AGENT_MODEL`` so we can swap models
without code changes.
"""
import os

from agents import (
    OpenAIChatCompletionsModel,
    set_default_openai_api,
    set_default_openai_client,
    set_tracing_disabled,
)
from openai import AsyncOpenAI

OPENROUTER_BASE_URL = "https://openrouter.ai/api/v1"

# The model every agent runs on unless overridden. ``openai/gpt-4o-mini`` is a
# paid OpenRouter model with reliable tool/function-calling — which the whole
# agent pipeline depends on. (Free-tier models such as
# ``openai/gpt-oss-20b:free`` do NOT reliably emit tool calls / handoffs, which
# silently stalled the parse+score pipeline.) Override per-deploy with the
# ``AGENT_MODEL`` env var.
AGENT_MODEL = os.environ.get("AGENT_MODEL", "openai/gpt-4o-mini")

_configured = False
_client: AsyncOpenAI | None = None


def configure_llm() -> AsyncOpenAI:
    """Point the OpenAI Agents SDK at OpenRouter (idempotent).

    Returns the shared ``AsyncOpenAI`` client. Raises ``RuntimeError`` if
    ``OPENROUTER_API_KEY`` is missing so a misconfiguration fails loudly here
    rather than deep inside an agent run.
    """
    global _configured, _client
    if _configured and _client is not None:
        return _client

    api_key = os.environ.get("OPENROUTER_API_KEY")
    if not api_key:
        raise RuntimeError(
            "OPENROUTER_API_KEY is not set — agents cannot reach the LLM. "
            "Add it to the backend .env."
        )

    _client = AsyncOpenAI(base_url=OPENROUTER_BASE_URL, api_key=api_key)
    set_default_openai_client(_client)
    set_default_openai_api("chat_completions")
    # The SDK's default tracing uploads telemetry to OpenAI's platform, which
    # needs a real OpenAI key we don't have — it just emits harmless but noisy
    # "Tracing client error 401" lines. We run on OpenRouter, so disable it.
    set_tracing_disabled(True)
    _configured = True
    return _client


def get_agent_model() -> OpenAIChatCompletionsModel:
    """Return the shared LLM model object every agent should use as ``model=``.

    Binds :data:`AGENT_MODEL` to the OpenRouter client so the slash-containing
    model id never touches the SDK's provider-prefix routing.
    """
    client = configure_llm()
    return OpenAIChatCompletionsModel(model=AGENT_MODEL, openai_client=client)
