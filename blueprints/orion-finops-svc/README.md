# Orion FinOps Service

FinOps 成本管理 (FinOps/Cost/ROI/Budget)

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
docker build -t orion-finops-svc .
docker run -p 3009:3009 orion-finops-svc
```

## Environment Variables

See `.env.example` for required variables.

## Port

`3009`
