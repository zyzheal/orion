# Orion Federation Service

多云联邦 (Federation/Multi-Cloud)

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
docker build -t orion-federation-svc .
docker run -p 3017:3017 orion-federation-svc
```

## Environment Variables

See `.env.example` for required variables.

## Port

`3017`
