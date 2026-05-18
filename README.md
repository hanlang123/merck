# Enterprise AI Agent Framework

Enterprise-grade AI Agent development framework in **TypeScript**, covering:

| Capability | Details |
|---|---|
| Multi-Agent | Orchestrator → Executor → Validator + in-process event bus |
| LLM Abstraction | OpenAI & Anthropic adapters, model router, versioned prompt templates |
| Memory | Short-term window, long-term vector store, structured entity store |
| Tools | Pluggable tool registry with typed schemas |
| Security | Prompt-injection guard, PII redaction, permission control, audit log |
| Observability | Structured Pino logging, OpenTelemetry tracing, Prometheus metrics |
| State | FSM (Pending → Running → Paused → Done / Failed) + checkpoint/resume |
| RAG | Chunker, vector retriever, cross-encoder reranker |
| Cost | Per-token tracker, semantic cache (Redis), model-routing by budget |
| Tenant | Multi-tenant isolation (data, config, model quota) |
| Human-in-the-loop | Risk-based approval gate, clarification requests |
| Feedback | 👍/👎 collector, golden-dataset builder |

## Quick Start

```bash
npm install
cp .env.example .env   # fill in your keys
npm run build
npm test
```

## Project Structure

```
src/
  config/          Settings & env validation (Zod)
  agents/          Base, Orchestrator, Executor, Validator
  llm/             LLM adapters, router, prompt templates
  memory/          Short-term, long-term (vector), structured (KV)
  tools/           Tool registry & base class
  security/        Guardrails, permissions, audit log
  observability/   Logger, tracer, metrics
  state/           Task state machine + checkpointing
  rag/             Chunker, retriever, reranker
  cost/            Token tracker, semantic cache, model router
  tenant/          Multi-tenant manager
  human-loop/      Human-in-the-loop interface
  feedback/        Feedback collector & golden dataset
tests/             Jest unit tests
```

## Architecture

```
User Request
    │
    ▼
[Security Guardrails] ──────── Block / Redact
    │
    ▼
[Orchestrator Agent]  ──────── Plan tasks
    │
    ├──► [Executor Agent] ──── Tool calls  ──► [Tool Registry]
    │                                              │
    │                                              ▼
    │                                         [Security Sandbox]
    │
    ├──► [Validator Agent] ─── Quality check
    │
    ▼
[LLM Router] ─────────────── OpenAI │ Anthropic │ Local
    │
    ▼
[Memory Layer] ──────────────Short-term │ Vector │ Structured
```

## Configuration

All settings are read from environment variables (see `.env.example`).

| Variable | Default | Description |
|---|---|---|
| `OPENAI_API_KEY` | - | OpenAI API key |
| `ANTHROPIC_API_KEY` | - | Anthropic API key |
| `DEFAULT_LLM_PROVIDER` | `openai` | Default LLM provider |
| `DEFAULT_MODEL` | `gpt-4o-mini` | Default model |
| `MAX_STEPS` | `30` | Max agent reasoning steps |
| `REDIS_URL` | `redis://localhost:6379` | Redis for semantic cache |
| `OTLP_ENDPOINT` | `http://localhost:4317` | OpenTelemetry collector |
| `LOG_LEVEL` | `info` | Log level |
