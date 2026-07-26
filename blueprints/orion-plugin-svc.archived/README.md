# Orion Plugin Service

插件系统 (Plugin SPI/Management/Marketplace)

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
docker build -t orion-plugin-svc .
docker run -p 3011:3011 orion-plugin-svc
```

## Environment Variables

See `.env.example` for required variables.

## Port

`3011`
