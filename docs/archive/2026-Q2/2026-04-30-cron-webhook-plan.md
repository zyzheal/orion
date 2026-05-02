# Sub-project C: Cron + Webhook Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace 2 mock implementations: Cron expression parser and real HTTP webhook delivery.

**Architecture:** Add `cron-parser` npm package for cron parsing. Use native `fetch()` with retry logic for webhooks.

**Tech Stack:** TypeScript, `cron-parser`, native `fetch` (Node.js 18+)

---

### Task 1: Cron Expression Parser

**Files:**
- Modify: `src/services/scheduler/CronSchedulerService.ts:355-362`
- Modify: `package.json` (add `cron-parser` dependency)

- [ ] **Step 1: Add cron-parser dependency**

```bash
cd /Users/heal/orion-design/orion-platform-service && npm install cron-parser
```

- [ ] **Step 2: Import cron-parser**

At the top of `CronSchedulerService.ts`, after L11:

```typescript
import parser from 'cron-parser';
```

- [ ] **Step 3: Replace shouldExecuteJob with real cron parsing**

Replace the `shouldExecuteJob` method (L358-362):

```typescript
private shouldExecuteJob(job: CronJob, now: Date): boolean {
  if (!job.enabled) return false;

  try {
    const interval = parser.parseExpression(job.schedule, {
      currentDate: now,
      tz: 'UTC',
    });
    const prev = interval.prev();
    const diff = now.getTime() - prev.getTime().getTime();
    // If the previous scheduled time is within the poll interval (60s), execute
    return diff < 60_000;
  } catch (error) {
    logger.error({ jobId: job.id, schedule: job.schedule, error }, 'Invalid cron expression');
    return false;
  }
}
```

- [ ] **Step 4: Fix stop() method to clear interval**

Grep for `stop()` method. If it exists and is empty/no-op, implement it:

```typescript
private intervalId?: ReturnType<typeof setInterval>;

// In startPolling() method, capture the interval:
this.intervalId = setInterval(() => this.pollTick(), 60_000);

// In stop() method:
stop(): void {
  if (this.intervalId) {
    clearInterval(this.intervalId);
    this.intervalId = undefined;
    logger.info('Cron scheduler stopped');
  }
}
```

- [ ] **Step 5: Verify compilation**

```bash
npx tsc --noEmit
```

- [ ] **Step 6: Commit**

```bash
git add src/services/scheduler/CronSchedulerService.ts package.json package-lock.json
git commit -m "feat(scheduler): implement real cron expression parsing with cron-parser"
```

---

### Task 2: Real HTTP Webhook Delivery

**Files:**
- Modify: `src/services/webhook/WebhookService.ts:46-62`

- [ ] **Step 1: Replace trigger() with real HTTP POST**

Replace the `trigger` method (L46-62):

```typescript
async trigger(webhookId: string, event: string, payload: Record<string, any>, retries: number = 3): Promise<WebhookDelivery> {
  const webhook = await this.repository.findById(webhookId);
  if (!webhook) throw new WebhookServiceError(`Webhook not found: ${webhookId}`, 'NOT_FOUND');
  if (!webhook.enabled) throw new WebhookServiceError('Webhook is disabled', 'DISABLED');

  const delivery = await this.repository.recordDelivery(webhookId, event, payload);

  let lastError: Error | null = null;
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 10_000);

      try {
        const response = await fetch(webhook.url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ event, payload, timestamp: new Date().toISOString() }),
          signal: controller.signal,
        });

        clearTimeout(timeout);

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const responseBody = await response.text();
        await this.repository.markDelivered(delivery.id, response.status, responseBody);
        return delivery;
      } catch (err) {
        clearTimeout(timeout);
        throw err;
      }
    } catch (error: any) {
      lastError = error;
      // Exponential backoff: 1s, 2s, 4s
      if (attempt < retries) {
        await new Promise(resolve => setTimeout(resolve, Math.pow(2, attempt - 1) * 1000));
      }
    }
  }

  // All retries failed
  const errorMessage = lastError?.message || 'Unknown error';
  await this.repository.markDelivered(delivery.id, 500, `Failed after ${retries} retries: ${errorMessage}`);
  return delivery;
}
```

- [ ] **Step 2: Verify compilation**

```bash
npx tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
git add src/services/webhook/WebhookService.ts
git commit -m "feat(webhook): implement real HTTP delivery with retry and exponential backoff"
```
