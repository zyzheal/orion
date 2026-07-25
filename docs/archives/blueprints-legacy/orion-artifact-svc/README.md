# Orion Artifact Service

制品管理 (Artifacts/Artifact Ops/Versions)

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
docker build -t orion-artifact-svc .
docker run -p 3014:3014 orion-artifact-svc
```

## Environment Variables

See `.env.example` for required variables.

## Port

`3014`
