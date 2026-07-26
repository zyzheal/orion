# Orion Audit Service

审计与合规服务 (Audit Log/Compliance)

## Quick Start

```bash
npm install
npm run dev          # Start with hot reload
npm run build        # Build for production
npm run start        # Run production build
```

## Port

`3027`

## Database

`audit_db` (PostgreSQL)

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | /api/v1/audit | Audit log list |
| GET | /api/v1/audit/:id | Audit log detail |
| GET | /api/v1/compliance | Compliance reports |
