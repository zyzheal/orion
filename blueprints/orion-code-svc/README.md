# Orion Code Service

代码仓库与 CI/CD (Code Repository/Build/Test Reports)

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
docker build -t orion-code-svc .
docker run -p 3010:3010 orion-code-svc
```

## Environment Variables

See `.env.example` for required variables.

## Port

`3010`
