# Orion Approval Service

审批管理服务 (Approval/Confirmation/Emergency/Multi-Level)

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
docker build -t orion-approval-svc .
docker run -p 3023:3023 orion-approval-svc
```

## Environment Variables

See `.env.example` for required variables.

## Port

`3023`
