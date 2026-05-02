# Auto Weekly Report Design

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task.

## Goal

Build a comprehensive weekly report generator that combines DORA metrics, ticketing analysis, incident summaries, and an executive summary into a single Markdown + JSON report.

## Architecture

Single `WeeklyReportService` under `src/services/efficiency/`. Directly calls existing services:
- `DoraMetricsService` — Deployment frequency, lead time, failure rate, recovery time
- `TicketService` — SLA compliance, resolution stats, backlog analysis, trend report
- `TicketWorkflowService` — Status counts, SLA tracking
- `AlertDeduplicationService` / alert module — Alert volume and severity

No new abstractions. Each report section is a private method returning a typed data object + Markdown fragment.

## Data Sources (All Exist)

| Data | Source | Method |
|------|--------|--------|
| DORA metrics | `DoraMetricsService` | `getDeploymentFrequency()`, `getLeadTimeForChanges()`, `getChangeFailureRate()`, `getMeanTimeToRecovery()` |
| SLA compliance | `TicketService` | `getSLACompliance()` |
| Resolution stats | `TicketService` | `getResolutionStats()` |
| Backlog analysis | `TicketService` | `getBacklogAnalysis()` |
| Trend report | `TicketService` | `getTrendReport({ days: 7 })` |
| Status counts | `TicketWorkflowService` | `getCountsByStatus()` |
| Ticket list | `TicketService` | `listTickets({ status, priority })` |

## Output

- **Markdown**: Human-readable, paste-able to Feishu/Slack/email
- **JSON**: Machine-readable for API response and frontend rendering
- **Persisted**: `weekly_reports` table in PostgreSQL

## API Endpoints

```
GET    /api/v1/reports/weekly?week_start=2026-04-21   — Get or generate report
POST   /api/v1/reports/weekly/generate                 — Force generate
GET    /api/v1/reports/weekly/history                  — List past reports
```

## Sections

### 1. Executive Summary
- Total deployments this week (vs last week)
- Change failure rate (vs last week)
- Tickets created / resolved / overdue
- Critical incidents
- Overall health score (green/yellow/red)

### 2. DORA Metrics
- Deployment Frequency: count, per-day rate, DORA level
- Lead Time for Changes: median, P90, P99, DORA level
- Change Failure Rate: percentage, DORA level
- Mean Time to Recovery: median, DORA level

### 3. Ticketing Analysis
- Tickets by status (open/assigned/in-progress/resolved/closed)
- SLA compliance: target vs actual, breached count
- Resolution stats: average resolution time, by priority
- Backlog: age distribution, overdue items

### 4. System Health
- Alert volume by severity
- On-call escalation summary
- Major incidents (if any from TicketService priority=critical)

## File Plan

| File | Action | Responsibility |
|------|--------|----------------|
| `src/services/efficiency/WeeklyReportService.ts` | **Create** | Core report generation logic |
| `src/services/efficiency/__tests__/WeeklyReportService.test.ts` | **Create** | Unit tests |
| `src/api/reports-routes.ts` | **Create** | HTTP routes |
| `src/api/routes.ts` | **Modify** | Add reports-routes import and registration |
| `src/db/migrations/051_create_weekly_reports.sql` | **Create** | Table schema |
| `src/db/migrations/051_rollback_create_weekly_reports.sql` | **Create** | Rollback |

## Migration

```sql
CREATE TABLE weekly_reports (
  id VARCHAR(64) PRIMARY KEY,
  team_id VARCHAR(64) NOT NULL DEFAULT 'default',
  week_start TIMESTAMPTZ NOT NULL,
  week_end TIMESTAMPTZ NOT NULL,
  report_data JSONB NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_weekly_reports_week ON weekly_reports (week_start);
CREATE INDEX idx_weekly_reports_team ON weekly_reports (team_id);
```
