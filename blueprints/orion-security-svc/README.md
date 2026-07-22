# Orion Security Service

安全合规 (Risk/SBOM/Supply Chain/Policy/Quality Gate)

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
docker build -t orion-security-svc .
docker run -p 3013:3013 orion-security-svc
```

## Environment Variables

See `.env.example` for required variables.

## Port

`3013`
