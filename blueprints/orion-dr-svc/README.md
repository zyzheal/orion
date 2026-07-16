# Orion DR Service

灾备管理 (Backup/Disaster Recovery)

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
docker build -t orion-dr-svc .
docker run -p 3016:3016 orion-dr-svc
```

## Environment Variables

See `.env.example` for required variables.

## Port

`3016`
