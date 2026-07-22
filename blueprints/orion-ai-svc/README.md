# Orion AI Service

AI 微服务 (AI Gateway/Decision/Review/Security/Vector Store/LLM Trace)

## Quick Start

```bash
npm install
npm run dev          # Start with hot reload
npm run build        # Build for production
npm run start        # Run production build
npm run test         # Run tests
npm run typecheck    # Type check without emitting
```

## Docker

```bash
docker build -t orion-ai-svc .
docker run -p 3012:3012 orion-ai-svc
```

## Environment Variables

See `.env.example` for required variables.

## Port

`3012`
