# Integration Capability Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement integration capabilities from v1.6 design: API Marketplace, Webhook Platform, Connector Framework, and Multi-language SDKs.

**Architecture:** 4 independent subsystems with clear boundaries - each can be developed and tested separately.

**Tech Stack:** TypeScript (orion-platform-service), Python (orion-ai-service), PostgreSQL + ClickHouse

---

## File Structure Overview

```
orion-platform-service/src/
├── api/
│   ├── api-market-routes.ts         # NEW - API Marketplace endpoints
│   ├── integration-routes.ts        # NEW - Third-party integration endpoints
│   └── webhook-routes.ts            # EXISTING - Enhanced with retry/subscription
├── services/
│   ├── api-market/                  # NEW - API Marketplace service
│   │   ├── ApiMarketRepository.ts
│   │   ├── ApiMarketService.ts
│   │   └── index.ts
│   ├── integration/                 # NEW - Connector framework
│   │   ├── ConnectorRegistry.ts
│   │   ├── connectors/
│   │   │   ├── GitLabConnector.ts
│   │   │   ├── JiraConnector.ts
│   │   │   └── index.ts
│   │   └── index.ts
│   ├── webhook/                     # EXISTING - Enhanced
│   │   ├── WebhookRepository.ts     # ADD: subscriptions, deliveries
│   │   ├── WebhookService.ts        # ADD: dispatcher, retry queue
│   │   └── index.ts
│   └── sdk/                         # NEW - SDK generators
│       ├── typescript/
│       ├── python/
│       └── index.ts
├── repositories/
│   └── ApiMarketRepository.ts       # NEW - If using Repository pattern
└── db/migrations/
    └── 052_integration_capability.sql  # NEW - DB schema

orion-sdk/
├── typescript/                      # NEW - @orion/sdk npm package
├── python/                          # NEW - orion-sdk-py pip package
├── go/                              # NEW - Go SDK
└── java/                            # NEW - Java SDK
```

---

## Task 1: API Marketplace Backend

**Files:**
- Create: `orion-platform-service/src/api/api-market-routes.ts`
- Create: `orion-platform-service/src/services/api-market/ApiMarketRepository.ts`
- Create: `orion-platform-service/src/services/api-market/ApiMarketService.ts`
- Create: `orion-platform-service/src/services/api-market/index.ts`
- Create: `orion-platform-service/src/db/migrations/052_api_market.sql`
- Create: `orion-platform-service/src/api/controllers/api-market/ApiMarketController.ts`
- Test: `orion-platform-service/src/services/api-market/__tests__/ApiMarketService.test.ts`

- [ ] **Step 1: Write the database migration**

```sql
-- orion-platform-service/src/db/migrations/052_api_market.sql

-- API Products
CREATE TABLE api_products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(100) NOT NULL,
  slug VARCHAR(50) UNIQUE NOT NULL,
  description TEXT,
  owner_id UUID REFERENCES users(id),
  status VARCHAR(20) DEFAULT 'draft',
  version VARCHAR(20),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- API Definitions
CREATE TABLE api_definitions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID REFERENCES api_products(id) ON DELETE CASCADE,
  version VARCHAR(20) NOT NULL,
  openapi_spec JSONB NOT NULL,
  changelog TEXT,
  published_at TIMESTAMPTZ,
  is_current BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(product_id, version)
);

-- Developer Apps
CREATE TABLE developer_apps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  developer_id UUID REFERENCES users(id),
  name VARCHAR(100) NOT NULL,
  description TEXT,
  redirect_uris TEXT[],
  status VARCHAR(20) DEFAULT 'active',
  created_at TIMESTAMPTZ DEFAULT now()
);

-- API Credentials
CREATE TABLE api_credentials (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  app_id UUID REFERENCES developer_apps(id) ON DELETE CASCADE,
  client_id VARCHAR(64) UNIQUE NOT NULL,
  client_secret_hash VARCHAR(256) NOT NULL,
  scopes TEXT[],
  rate_limit_per_min INTEGER DEFAULT 100,
  expires_at TIMESTAMPTZ,
  last_used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- API Subscriptions
CREATE TABLE api_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  app_id UUID REFERENCES developer_apps(id) ON DELETE CASCADE,
  product_id UUID REFERENCES api_products(id) ON DELETE CASCADE,
  plan VARCHAR(20),
  status VARCHAR(20) DEFAULT 'active',
  quota_per_day INTEGER,
  used_today INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(app_id, product_id)
);

-- Indexes
CREATE INDEX idx_api_products_slug ON api_products(slug);
CREATE INDEX idx_api_products_status ON api_products(status);
CREATE INDEX idx_developer_apps_dev ON developer_apps(developer_id);
CREATE INDEX idx_api_credentials_app ON api_credentials(app_id);
CREATE INDEX idx_api_subscriptions_app ON api_subscriptions(app_id);
```

- [ ] **Step 2: Create repository**

```typescript
// orion-platform-service/src/services/api-market/ApiMarketRepository.ts

import { DatabasePool, QueryResult } from '../database';

export interface ApiProduct {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  owner_id: string;
  status: 'draft' | 'published' | 'deprecated';
  version: string | null;
  created_at: Date;
  updated_at: Date;
}

export interface ApiDefinition {
  id: string;
  product_id: string;
  version: string;
  openapi_spec: Record<string, unknown>;
  changelog: string | null;
  published_at: Date | null;
  is_current: boolean;
  created_at: Date;
}

export interface DeveloperApp {
  id: string;
  developer_id: string;
  name: string;
  description: string | null;
  redirect_uris: string[];
  status: 'active' | 'inactive';
  created_at: Date;
}

export interface ApiCredential {
  id: string;
  app_id: string;
  client_id: string;
  scopes: string[];
  rate_limit_per_min: number;
  expires_at: Date | null;
  last_used_at: Date | null;
  created_at: Date;
}

export class ApiMarketRepository {
  constructor(private pool: DatabasePool) {}

  // Products
  async createProduct(data: Omit<ApiProduct, 'id' | 'created_at' | 'updated_at'>): Promise<ApiProduct> {
    const result = await this.pool.query(
      `INSERT INTO api_products (name, slug, description, owner_id, status, version)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [data.name, data.slug, data.description, data.owner_id, data.status, data.version]
    );
    return result.rows[0];
  }

  async findProductById(id: string): Promise<ApiProduct | null> {
    const result = await this.pool.query('SELECT * FROM api_products WHERE id = $1', [id]);
    return result.rows[0] || null;
  }

  async findProductBySlug(slug: string): Promise<ApiProduct | null> {
    const result = await this.pool.query('SELECT * FROM api_products WHERE slug = $1', [slug]);
    return result.rows[0] || null;
  }

  async listProducts(status?: string): Promise<ApiProduct[]> {
    const query = status
      ? 'SELECT * FROM api_products WHERE status = $1 ORDER BY created_at DESC'
      : 'SELECT * FROM api_products ORDER BY created_at DESC';
    const result = await this.pool.query(query, status ? [status] : []);
    return result.rows;
  }

  async updateProduct(id: string, data: Partial<ApiProduct>): Promise<ApiProduct> {
    const fields = Object.keys(data).map((k, i) => `${k} = $${i + 2}`).join(', ');
    const values = Object.values(data);
    const result = await this.pool.query(
      `UPDATE api_products SET ${fields}, updated_at = now() WHERE id = $1 RETURNING *`,
      [id, ...values]
    );
    return result.rows[0];
  }

  async deleteProduct(id: string): Promise<boolean> {
    const result = await this.pool.query('DELETE FROM api_products WHERE id = $1', [id]);
    return (result.rowCount ?? 0) > 0;
  }

  // Developer Apps
  async createApp(data: Omit<DeveloperApp, 'id' | 'created_at'>): Promise<DeveloperApp> {
    const result = await this.pool.query(
      `INSERT INTO developer_apps (developer_id, name, description, redirect_uris, status)
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [data.developer_id, data.name, data.description, data.redirect_uris, data.status]
    );
    return result.rows[0];
  }

  async listAppsByDeveloper(developerId: string): Promise<DeveloperApp[]> {
    const result = await this.pool.query(
      'SELECT * FROM developer_apps WHERE developer_id = $1 ORDER BY created_at DESC',
      [developerId]
    );
    return result.rows;
  }

  // Credentials
  async createCredential(data: Omit<ApiCredential, 'id' | 'created_at'>): Promise<ApiCredential> {
    const result = await this.pool.query(
      `INSERT INTO api_credentials (app_id, client_id, client_secret_hash, scopes, rate_limit_per_min, expires_at)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [data.app_id, data.client_id, data.client_secret_hash, data.scopes, data.rate_limit_per_min, data.expires_at]
    );
    return result.rows[0];
  }

  async findCredentialByClientId(clientId: string): Promise<ApiCredential | null> {
    const result = await this.pool.query('SELECT * FROM api_credentials WHERE client_id = $1', [clientId]);
    return result.rows[0] || null;
  }

  async updateCredentialLastUsed(id: string): Promise<void> {
    await this.pool.query('UPDATE api_credentials SET last_used_at = now() WHERE id = $1', [id]);
  }
}
```

- [ ] **Step 3: Run migration to verify it works**

Run: `cd orion-platform-service && npm run db:migrate`
Expected: Migration 052_api_market runs successfully

- [ ] **Step 4: Create service layer**

```typescript
// orion-platform-service/src/services/api-market/ApiMarketService.ts

import { ApiMarketRepository, ApiProduct, DeveloperApp, ApiCredential } from './ApiMarketRepository';
import { randomUUID } from 'crypto';
import * as crypto from 'crypto';

export class ApiMarketServiceError extends Error {
  constructor(message: string, public code: string) {
    super(`${message} (${code})`);
    this.name = 'ApiMarketServiceError';
  }
}

export class ApiMarketService {
  constructor(private repository: ApiMarketRepository) {}

  async createProduct(tenantId: string, data: {
    name: string;
    description?: string;
    version?: string;
  }): Promise<ApiProduct> {
    const slug = data.name.toLowerCase().replace(/[^a-z0-9]+/g, '-');
    const existing = await this.repository.findProductBySlug(slug);
    if (existing) {
      throw new ApiMarketServiceError(`Product with slug ${slug} already exists`, 'SLUG_EXISTS');
    }
    return this.repository.createProduct({
      name: data.name,
      slug,
      description: data.description || null,
      owner_id: tenantId,
      status: 'draft',
      version: data.version || '1.0.0',
    });
  }

  async publishProduct(id: string): Promise<ApiProduct> {
    const product = await this.repository.findProductById(id);
    if (!product) {
      throw new ApiMarketServiceError('Product not found', 'NOT_FOUND');
    }
    return this.repository.updateProduct(id, { status: 'published' });
  }

  async listProducts(status?: string): Promise<ApiProduct[]> {
    return this.repository.listProducts(status);
  }

  async createDeveloperApp(developerId: string, data: {
    name: string;
    description?: string;
    redirectUris?: string[];
  }): Promise<DeveloperApp> {
    return this.repository.createApp({
      developer_id: developerId,
      name: data.name,
      description: data.description || null,
      redirect_uris: data.redirectUris || [],
      status: 'active',
    });
  }

  async generateApiKey(appId: string, scopes: string[], expiresInDays?: number): Promise<{ credential: ApiCredential; clientSecret: string }> {
    const clientId = `orion_${randomUUID().replace(/-/g, '')}`;
    const clientSecret = randomUUID() + randomUUID();
    const secretHash = crypto.createHash('sha256').update(clientSecret).digest('hex');

    const expiresAt = expiresInDays
      ? new Date(Date.now() + expiresInDays * 24 * 60 * 60 * 1000)
      : null;

    const credential = await this.repository.createCredential({
      app_id: appId,
      client_id: clientId,
      client_secret_hash: secretHash,
      scopes,
      rate_limit_per_min: 100,
      expires_at: expiresAt,
      last_used_at: null,
    });

    return { credential, clientSecret };
  }

  async validateApiKey(clientId: string, clientSecret: string): Promise<ApiCredential | null> {
    const credential = await this.repository.findCredentialByClientId(clientId);
    if (!credential) return null;

    const secretHash = crypto.createHash('sha256').update(clientSecret).digest('hex');
    if (credential.client_secret_hash !== secretHash) return null;

    if (credential.expires_at && new Date() > credential.expires_at) {
      return null;
    }

    await this.repository.updateCredentialLastUsed(credential.id);
    return credential;
  }
}
```

- [ ] **Step 5: Create service index export**

```typescript
// orion-platform-service/src/services/api-market/index.ts

export { ApiMarketRepository } from './ApiMarketRepository';
export { ApiMarketService, ApiMarketServiceError } from './ApiMarketService';
export type { ApiProduct, ApiDefinition, DeveloperApp, ApiCredential } from './ApiMarketRepository';
```

- [ ] **Step 6: Create routes**

```typescript
// orion-platform-service/src/api/api-market-routes.ts

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { DatabasePool } from '../services/database';
import { ApiMarketRepository } from '../services/api-market/ApiMarketRepository';
import { ApiMarketService } from '../services/api-market/ApiMarketService';
import { authenticateUser } from '../middleware/authMiddleware';
import { requirePermission } from '../middleware/requirePermission';

interface ApiMarketRoutesOptions {
  database?: DatabasePool;
}

export default async function apiMarketRoutes(
  app: FastifyInstance,
  options: ApiMarketRoutesOptions
): Promise<void> {
  if (!options.database) {
    console.warn('[ApiMarketRoutes] No database pool provided');
    return;
  }

  const repository = new ApiMarketRepository(options.database);
  const service = new ApiMarketService(repository);

  // ==================== Products ====================

  // POST /api/v1/market/products - Create API product
  app.post('/market/products', {
    onRequest: [authenticateUser, requirePermission({ resource: 'api_market', action: 'write' })],
  }, async (request: FastifyRequest<{ Body: { name: string; description?: string; version?: string } }>, reply: FastifyReply) => {
    try {
      const userId = (request as any).user.id;
      const product = await service.createProduct(userId, request.body);
      return reply.code(201).send(product);
    } catch (error: any) {
      return reply.code(400).send({ error: error.message, code: error.code });
    }
  });

  // GET /api/v1/market/products - List products
  app.get('/market/products', {
    onRequest: [authenticateUser],
  }, async (request: FastifyRequest<{ Querystring: { status?: string } }>, reply: FastifyReply) => {
    const products = await service.listProducts(request.query.status);
    return reply.send(products);
  });

  // GET /api/v1/market/products/:id - Get product
  app.get('/market/products/:id', {
    onRequest: [authenticateUser],
  }, async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
    const product = await service.repository.findProductById(request.params.id);
    if (!product) {
      return reply.code(404).send({ error: 'Not found' });
    }
    return reply.send(product);
  });

  // POST /api/v1/market/products/:id/publish - Publish product
  app.post('/market/products/:id/publish', {
    onRequest: [authenticateUser, requirePermission({ resource: 'api_market', action: 'write' })],
  }, async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
    try {
      const product = await service.publishProduct(request.params.id);
      return reply.send(product);
    } catch (error: any) {
      return reply.code(404).send({ error: error.message });
    }
  });

  // ==================== Developer Apps ====================

  // POST /api/v1/market/apps - Create developer app
  app.post('/market/apps', {
    onRequest: [authenticateUser],
  }, async (request: FastifyRequest<{ Body: { name: string; description?: string; redirectUris?: string[] } }>, reply: FastifyReply) => {
    try {
      const userId = (request as any).user.id;
      const app = await service.createDeveloperApp(userId, request.body);
      return reply.code(201).send(app);
    } catch (error: any) {
      return reply.code(400).send({ error: error.message });
    }
  });

  // GET /api/v1/market/apps - List my apps
  app.get('/market/apps', {
    onRequest: [authenticateUser],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const userId = (request as any).user.id;
    const apps = await service.repository.listAppsByDeveloper(userId);
    return reply.send(apps);
  });

  // POST /api/v1/market/apps/:appId/keys - Generate API key
  app.post('/market/apps/:appId/keys', {
    onRequest: [authenticateUser],
  }, async (request: FastifyRequest<{ Params: { appId: string }; Body: { scopes?: string[]; expiresInDays?: number } }>, reply: FastifyReply) => {
    try {
      const { credential, clientSecret } = await service.generateApiKey(
        request.params.appId,
        request.body.scopes || [],
        request.body.expiresInDays
      );
      return reply.code(201).send({
        ...credential,
        client_secret: clientSecret, // Only returned once!
      });
    } catch (error: any) {
      return reply.code(400).send({ error: error.message });
    }
  });

  // ==================== Authentication ====================

  // POST /api/v1/market/auth/token - Validate API key
  app.post('/market/auth/token', async (request: FastifyRequest<{ Body: { client_id: string; client_secret: string } }>, reply: FastifyReply) => {
    const { client_id, client_secret } = request.body;
    const credential = await service.validateApiKey(client_id, client_secret);
    if (!credential) {
      return reply.code(401).send({ error: 'Invalid credentials' });
    }
    return reply.send({
      valid: true,
      scopes: credential.scopes,
      rate_limit: credential.rate_limit_per_min,
    });
  });
}
```

- [ ] **Step 7: Register routes in routes.ts**

Add to `orion-platform-service/src/api/routes.ts`:
```typescript
import apiMarketRoutes from './api-market-routes';

// In the routes array:
apiMarketRoutes,
```

- [ ] **Step 8: Write unit test**

```typescript
// orion-platform-service/src/services/api-market/__tests__/ApiMarketService.test.ts

import { ApiMarketService } from '../ApiMarketService';
import { ApiMarketRepository } from '../ApiMarketRepository';

describe('ApiMarketService', () => {
  let service: ApiMarketService;
  let mockRepo: jest.Mocked<ApiMarketRepository>;

  beforeEach(() => {
    mockRepo = {
      createProduct: jest.fn(),
      findProductBySlug: jest.fn(),
      findProductById: jest.fn(),
      listProducts: jest.fn(),
      updateProduct: jest.fn(),
      createApp: jest.fn(),
      listAppsByDeveloper: jest.fn(),
      createCredential: jest.fn(),
      findCredentialByClientId: jest.fn(),
      updateCredentialLastUsed: jest.fn(),
    } as any;
    service = new ApiMarketService(mockRepo);
  });

  describe('createProduct', () => {
    it('should create product with generated slug', async () => {
      mockRepo.findProductBySlug.mockResolvedValue(null);
      mockRepo.createProduct.mockResolvedValue({
        id: '123',
        name: 'Test API',
        slug: 'test-api',
        description: 'Test',
        owner_id: 'tenant-1',
        status: 'draft',
        version: '1.0.0',
        created_at: new Date(),
        updated_at: new Date(),
      });

      const result = await service.createProduct('tenant-1', {
        name: 'Test API',
        description: 'Test',
      });

      expect(result.slug).toBe('test-api');
      expect(mockRepo.createProduct).toHaveBeenCalled();
    });

    it('should reject duplicate slug', async () => {
      mockRepo.findProductBySlug.mockResolvedValue({ id: '123' } as any);

      await expect(service.createProduct('tenant-1', { name: 'Test API' }))
        .rejects.toThrow('already exists');
    });
  });

  describe('validateApiKey', () => {
    it('should return null for invalid client_id', async () => {
      mockRepo.findCredentialByClientId.mockResolvedValue(null);

      const result = await service.validateApiKey('invalid', 'secret');
      expect(result).toBeNull();
    });
  });
});
```

- [ ] **Step 9: Run test to verify it passes**

Run: `cd orion-platform-service && npx jest src/services/api-market/__tests__/ApiMarketService.test.ts -v`
Expected: PASS

- [ ] **Step 10: Commit**

```bash
cd orion-platform-service
git add src/api/api-market-routes.ts src/services/api-market/ src/db/migrations/052_api_market.sql
git commit -m "feat(api-market): implement API marketplace backend

- Add database migration for api_products, developer_apps, api_credentials
- Implement ApiMarketRepository with PostgreSQL
- Implement ApiMarketService with CRUD and API key generation
- Add REST API routes for products, apps, and authentication
- Add unit tests"
```

---

## Task 2: Webhook Platform Enhancement (Subscription + Dispatcher)

**Files:**
- Modify: `orion-platform-service/src/services/webhook/WebhookRepository.ts` - Add subscriptions/deliveries
- Modify: `orion-platform-service/src/services/webhook/WebhookService.ts` - Add dispatcher
- Create: `orion-platform-service/src/db/migrations/053_webhook_enhanced.sql`
- Test: `orion-platform-service/src/services/webhook/__tests__/WebhookEnhanced.test.ts`

- [ ] **Step 1: Write migration for subscriptions**

```sql
-- orion-platform-service/src/db/migrations/053_webhook_enhanced.sql

-- Webhook Endpoints (more detailed than existing webhooks table)
CREATE TABLE IF NOT EXISTS webhook_endpoints (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(100) NOT NULL,
  url VARCHAR(500) NOT NULL,
  secret VARCHAR(256),
  auth_type VARCHAR(20) DEFAULT 'none',
  auth_config JSONB,
  status VARCHAR(20) DEFAULT 'active',
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Webhook Subscriptions
CREATE TABLE IF NOT EXISTS webhook_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  endpoint_id UUID REFERENCES webhook_endpoints(id) ON DELETE CASCADE,
  event_type VARCHAR(100) NOT NULL,
  filters JSONB,
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Webhook Deliveries
CREATE TABLE IF NOT EXISTS webhook_deliveries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subscription_id UUID REFERENCES webhook_subscriptions(id) ON DELETE CASCADE,
  event_id UUID NOT NULL,
  payload JSONB NOT NULL,
  status VARCHAR(20) DEFAULT 'pending',
  attempt INTEGER DEFAULT 0,
  max_attempts INTEGER DEFAULT 5,
  next_retry_at TIMESTAMPTZ,
  response_status INTEGER,
  response_body TEXT,
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  delivered_at TIMESTAMPTZ
);

-- Indexes
CREATE INDEX idx_webhook_endpoints_status ON webhook_endpoints(status);
CREATE INDEX idx_webhook_subscriptions_event ON webhook_subscriptions(event_type, active) WHERE active = true;
CREATE INDEX idx_webhook_deliveries_status ON webhook_deliveries(status, next_retry_at) WHERE status IN ('pending', 'retrying');
CREATE INDEX idx_webhook_deliveries_subscription ON webhook_deliveries(subscription_id);
```

- [ ] **Step 2: Update repository**

Add to `orion-platform-service/src/services/webhook/WebhookRepository.ts`:

```typescript
// Add new interfaces
export interface WebhookEndpoint {
  id: string;
  name: string;
  url: string;
  secret: string | null;
  auth_type: 'none' | 'basic' | 'bearer' | 'hmac';
  auth_config: Record<string, unknown> | null;
  status: 'active' | 'inactive';
  created_by: string;
  created_at: Date;
}

export interface WebhookSubscription {
  id: string;
  endpoint_id: string;
  event_type: string;
  filters: Record<string, unknown> | null;
  active: boolean;
  created_at: Date;
}

export interface WebhookDelivery {
  id: string;
  subscription_id: string;
  event_id: string;
  payload: Record<string, unknown>;
  status: 'pending' | 'delivered' | 'failed' | 'retrying';
  attempt: number;
  max_attempts: number;
  next_retry_at: Date | null;
  response_status: number | null;
  response_body: string | null;
  error_message: string | null;
  created_at: Date;
  delivered_at: Date | null;
}

// Add new methods to WebhookRepository class
async createEndpoint(data: Omit<WebhookEndpoint, 'id' | 'created_at'>): Promise<WebhookEndpoint> {
  const result = await this.pool.query(
    `INSERT INTO webhook_endpoints (name, url, secret, auth_type, auth_config, status, created_by)
     VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
    [data.name, data.url, data.secret, data.auth_type, JSON.stringify(data.auth_config), data.status, data.created_by]
  );
  return result.rows[0];
}

async findEndpointById(id: string): Promise<WebhookEndpoint | null> {
  const result = await this.pool.query('SELECT * FROM webhook_endpoints WHERE id = $1', [id]);
  return result.rows[0] || null;
}

async listEndpoints(tenantId: string): Promise<WebhookEndpoint[]> {
  // Join with users to filter by tenant
  const result = await this.pool.query(
    `SELECT e.* FROM webhook_endpoints e
     JOIN users u ON e.created_by = u.id
     WHERE u.tenant_id = $1
     ORDER BY e.created_at DESC`,
    [tenantId]
  );
  return result.rows;
}

async createSubscription(data: Omit<WebhookSubscription, 'id' | 'created_at'>): Promise<WebhookSubscription> {
  const result = await this.pool.query(
    `INSERT INTO webhook_subscriptions (endpoint_id, event_type, filters, active)
     VALUES ($1, $2, $3, $4) RETURNING *`,
    [data.endpoint_id, data.event_type, JSON.stringify(data.filters), data.active]
  );
  return result.rows[0];
}

async findSubscriptionsByEvent(eventType: string): Promise<WebhookSubscription[]> {
  const result = await this.pool.query(
    `SELECT * FROM webhook_subscriptions
     WHERE event_type = $1 AND active = true`,
    [eventType]
  );
  return result.rows;
}

async recordDelivery(data: Omit<WebhookDelivery, 'id' | 'created_at'>): Promise<WebhookDelivery> {
  const result = await this.pool.query(
    `INSERT INTO webhook_deliveries (subscription_id, event_id, payload, status, attempt, max_attempts, next_retry_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
    [data.subscription_id, data.event_id, JSON.stringify(data.payload), data.status, data.attempt, data.max_attempts, data.next_retry_at]
  );
  return result.rows[0];
}

async updateDelivery(id: string, data: Partial<WebhookDelivery>): Promise<WebhookDelivery> {
  const fields = Object.keys(data).map((k, i) => `${k} = $${i + 2}`).join(', ');
  const values = Object.values(data).map(v => {
    if (typeof v === 'object') return JSON.stringify(v);
    return v;
  });
  const result = await this.pool.query(
    `UPDATE webhook_deliveries SET ${fields} WHERE id = $1 RETURNING *`,
    [id, ...values]
  );
  return result.rows[0];
}

async findPendingDeliveries(limit: number = 100): Promise<WebhookDelivery[]> {
  const result = await this.pool.query(
    `SELECT * FROM webhook_deliveries
     WHERE status IN ('pending', 'retrying')
     AND (next_retry_at IS NULL OR next_retry_at <= now())
     ORDER BY created_at ASC
     LIMIT $1`,
    [limit]
  );
  return result.rows;
}
```

- [ ] **Step 3: Update service with dispatcher logic**

Update `orion-platform-service/src/services/webhook/WebhookService.ts` to add:

```typescript
import * as crypto from 'crypto';

interface WebhookEvent {
  type: string;
  payload: Record<string, unknown>;
  metadata: {
    tenantId: string;
    userId?: string;
    timestamp: Date;
    eventId: string;
  };
}

export class WebhookService {
  // ... existing methods ...

  // NEW: Dispatch event to all matching subscriptions
  async dispatch(event: WebhookEvent): Promise<number> {
    const subscriptions = await this.repository.findSubscriptionsByEvent(event.type);
    let deliveredCount = 0;

    for (const subscription of subscriptions) {
      try {
        const endpoint = await this.repository.findEndpointById(subscription.endpoint_id);
        if (!endpoint || endpoint.status !== 'active') continue;

        // Apply filters
        if (subscription.filters && !this.matchesFilters(event, subscription.filters)) {
          continue;
        }

        // Record delivery
        const delivery = await this.repository.recordDelivery({
          subscription_id: subscription.id,
          event_id: event.metadata.eventId,
          payload: event,
          status: 'pending',
          attempt: 0,
          max_attempts: 5,
          next_retry_at: null,
        });

        // Process delivery
        await this.processDelivery(delivery, endpoint);
        deliveredCount++;
      } catch (error) {
        console.error(`Failed to deliver to subscription ${subscription.id}:`, error);
      }
    }

    return deliveredCount;
  }

  private matchesFilters(event: WebhookEvent, filters: Record<string, unknown>): boolean {
    for (const [key, value] of Object.entries(filters)) {
      const eventValue = this.getNestedValue(event, key);
      if (eventValue !== value) return false;
    }
    return true;
  }

  private getNestedValue(obj: any, path: string): any {
    return path.split('.').reduce((o, k) => o?.[k], obj);
  }

  private async processDelivery(delivery: WebhookDelivery, endpoint: WebhookEndpoint): Promise<void> {
    const payload = delivery.payload as unknown as WebhookEvent;
    let attempt = delivery.attempt;
    let lastError: Error | null = null;

    while (attempt < delivery.max_attempts) {
      try {
        // Compute signature
        const signature = endpoint.secret
          ? crypto.createHmac('sha256', endpoint.secret).update(JSON.stringify(payload)).digest('hex')
          : '';

        // Build headers
        const headers: Record<string, string> = {
          'Content-Type': 'application/json',
          'X-Webhook-Event-ID': payload.metadata.eventId,
          'X-Webhook-Event-Type': payload.type,
          'X-Webhook-Delivery-ID': delivery.id,
        };
        if (signature) {
          headers['X-Webhook-Signature'] = signature;
        }

        // Add auth headers
        if (endpoint.auth_type === 'bearer' && endpoint.auth_config) {
          headers['Authorization'] = `Bearer ${endpoint.auth_config.token}`;
        } else if (endpoint.auth_type === 'basic' && endpoint.auth_config) {
          const auth = Buffer.from(`${endpoint.auth_config.username}:${endpoint.auth_config.password}`).toString('base64');
          headers['Authorization'] = `Basic ${auth}`;
        }

        // Make request
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 10000);

        try {
          const response = await fetch(endpoint.url, {
            method: 'POST',
            headers,
            body: JSON.stringify(payload),
            signal: controller.signal,
          });
          clearTimeout(timeout);

          const responseBody = await response.text();

          await this.repository.updateDelivery(delivery.id, {
            status: response.ok ? 'delivered' : 'failed',
            response_status: response.status,
            response_body: responseBody,
            attempt: attempt + 1,
            delivered_at: response.ok ? new Date() : null,
          });

          return;
        } catch (err) {
          clearTimeout(timeout);
          throw err;
        }
      } catch (error: any) {
        lastError = error;
        attempt++;

        if (attempt < delivery.max_attempts) {
          // Exponential backoff: 1s, 2s, 4s, 8s, 16s (max 1 hour)
          const delay = Math.min(1000 * Math.pow(2, attempt - 1), 3600000);
          await this.repository.updateDelivery(delivery.id, {
            status: 'retrying',
            attempt,
            next_retry_at: new Date(Date.now() + delay),
            error_message: error.message,
          });
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }

    // All retries failed
    await this.repository.updateDelivery(delivery.id, {
      status: 'failed',
      attempt,
      error_message: lastError?.message || 'Unknown error',
    });
  }

  // NEW: Get delivery status
  async getDeliveryStatus(deliveryId: string): Promise<WebhookDelivery | null> {
    // Need to add findDeliveryById to repository
    const deliveries = await this.repository.findPendingDeliveries(1000);
    return deliveries.find(d => d.id === deliveryId) || null;
  }

  // NEW: Retry failed delivery
  async retryDelivery(deliveryId: string): Promise<void> {
    // Implementation: reset status and re-process
  }
}
```

- [ ] **Step 4: Write test**

```typescript
// orion-platform-service/src/services/webhook/__tests__/WebhookEnhanced.test.ts

import { WebhookService } from '../WebhookService';
import { WebhookRepository } from '../WebhookRepository';

describe('WebhookService Enhanced', () => {
  let service: WebhookService;
  let mockRepo: jest.Mocked<WebhookRepository>;

  beforeEach(() => {
    mockRepo = {
      findSubscriptionsByEvent: jest.fn(),
      findEndpointById: jest.fn(),
      recordDelivery: jest.fn(),
      updateDelivery: jest.fn(),
      findPendingDeliveries: jest.fn(),
    } as any;
    service = new WebhookService(mockRepo);
  });

  describe('dispatch', () => {
    it('should dispatch to matching subscriptions', async () => {
      const mockSubscription = {
        id: 'sub-1',
        endpoint_id: 'ep-1',
        event_type: 'pipeline.completed',
        filters: null,
        active: true,
        created_at: new Date(),
      };

      const mockEndpoint = {
        id: 'ep-1',
        name: 'Test Endpoint',
        url: 'https://example.com/webhook',
        secret: 'test-secret',
        auth_type: 'hmac',
        auth_config: null,
        status: 'active',
        created_by: 'user-1',
        created_at: new Date(),
      };

      const mockDelivery = {
        id: 'del-1',
        subscription_id: 'sub-1',
        event_id: 'event-1',
        payload: {},
        status: 'pending',
        attempt: 0,
        max_attempts: 5,
        next_retry_at: null,
        created_at: new Date(),
      };

      mockRepo.findSubscriptionsByEvent.mockResolvedValue([mockSubscription]);
      mockRepo.findEndpointById.mockResolvedValue(mockEndpoint);
      mockRepo.recordDelivery.mockResolvedValue(mockDelivery);
      mockRepo.updateDelivery.mockResolvedValue({ ...mockDelivery, status: 'delivered' });

      const event = {
        type: 'pipeline.completed',
        payload: { pipelineId: '123' },
        metadata: {
          tenantId: 'tenant-1',
          timestamp: new Date(),
          eventId: 'event-1',
        },
      };

      const result = await service.dispatch(event);

      expect(result).toBe(1);
      expect(mockRepo.recordDelivery).toHaveBeenCalled();
    });

    it('should filter based on subscription filters', async () => {
      const mockSubscription = {
        id: 'sub-1',
        endpoint_id: 'ep-1',
        event_type: 'pipeline.completed',
        filters: { 'payload.environment': 'prod' }, // Only prod
        active: true,
        created_at: new Date(),
      };

      mockRepo.findSubscriptionsByEvent.mockResolvedValue([mockSubscription]);
      mockRepo.findEndpointById.mockResolvedValue(null); // Won't be called due to filter

      const event = {
        type: 'pipeline.completed',
        payload: { pipelineId: '123', environment: 'staging' }, // staging, not prod
        metadata: {
          tenantId: 'tenant-1',
          timestamp: new Date(),
          eventId: 'event-1',
        },
      };

      // Should not dispatch because filter doesn't match
      const result = await service.dispatch(event);
      expect(result).toBe(0);
    });
  });
});
```

- [ ] **Step 5: Run test**

Run: `cd orion-platform-service && npx jest src/services/webhook/__tests__/WebhookEnhanced.test.ts -v`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add src/services/webhook/WebhookRepository.ts src/services/webhook/WebhookService.ts src/db/migrations/053_webhook_enhanced.sql
git commit -m "feat(webhook): enhance with subscription model and dispatcher

- Add webhook_endpoints, webhook_subscriptions, webhook_deliveries tables
- Implement event dispatch with filtering
- Add exponential backoff retry (max 1 hour)
- Add HMAC signature support
- Add unit tests"
```

---

## Task 3: Connector Framework for Third-party Integrations

**Files:**
- Create: `orion-platform-service/src/services/integration/ConnectorRegistry.ts`
- Create: `orion-platform-service/src/services/integration/connectors/GitLabConnector.ts`
- Create: `orion-platform-service/src/services/integration/connectors/JiraConnector.ts`
- Create: `orion-platform-service/src/services/integration/index.ts`
- Create: `orion-platform-service/src/db/migrations/054_integration_connectors.sql`
- Test: `orion-platform-service/src/services/integration/__tests__/ConnectorRegistry.test.ts`

- [ ] **Step 1: Write migration**

```sql
-- orion-platform-service/src/db/migrations/054_integration_connectors.sql

-- Integration configurations
CREATE TABLE integrations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  provider VARCHAR(50) NOT NULL,
  name VARCHAR(100) NOT NULL,
  config JSONB NOT NULL, -- Encrypted sensitive data
  status VARCHAR(20) DEFAULT 'inactive',
  last_sync_at TIMESTAMPTZ,
  sync_status VARCHAR(20),
  error_message TEXT,
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Integration resource mappings
CREATE TABLE integration_mappings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  integration_id UUID REFERENCES integrations(id) ON DELETE CASCADE,
  resource_type VARCHAR(50),
  resource_id UUID NOT NULL,
  external_id VARCHAR(255),
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Integration sync logs
CREATE TABLE integration_sync_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  integration_id UUID REFERENCES integrations(id) ON DELETE CASCADE,
  sync_type VARCHAR(50),
  status VARCHAR(20),
  records_processed INTEGER,
  records_failed INTEGER,
  error_message TEXT,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ
);

-- Indexes
CREATE INDEX idx_integrations_tenant ON integrations(tenant_id, provider);
CREATE INDEX idx_integrations_status ON integrations(status);
CREATE INDEX idx_integration_mappings_resource ON integration_mappings(resource_type, resource_id);
CREATE INDEX idx_integration_mappings_external ON integration_mappings(external_id);
CREATE INDEX idx_integration_sync_logs_integration ON integration_sync_logs(integration_id, started_at);
```

- [ ] **Step 2: Create Connector interface**

```typescript
// orion-platform-service/src/services/integration/ConnectorRegistry.ts

export enum ConnectorCapability {
  SourceControl = 'source:control',
  SourceRead = 'source:read',
  IssueTracker = 'issue:tracker',
  CICD = 'ci:cd',
  Notification = 'notification',
  Monitoring = 'monitoring',
  ArtifactRegistry = 'artifact:registry',
  CloudProvider = 'cloud:provider',
  SecurityScan = 'security:scan',
}

export interface ConnectorConfig {
  host?: string;
  token?: string;
  username?: string;
  password?: string;
  organization?: string;
  project?: string;
  [key: string]: unknown;
}

export interface Connector {
  name: string;
  version: string;
  capabilities: ConnectorCapability[];

  initialize(config: ConnectorConfig): Promise<void>;
  validateConfig(config: ConnectorConfig): Promise<boolean>;
  testConnection(config: ConnectorConfig): Promise<boolean>;

  execute(action: string, params: Record<string, unknown>): Promise<unknown>;
  transformEvent?(rawEvent: unknown): IntegrationEvent;
}

export interface IntegrationEvent {
  type: string;
  source: string;
  payload: Record<string, unknown>;
  timestamp: Date;
  externalId?: string;
}

export class ConnectorRegistry {
  private connectors: Map<string, Connector> = new Map();

  register(connector: Connector): void {
    if (this.connectors.has(connector.name)) {
      console.warn(`Connector ${connector.name} already registered, overwriting`);
    }
    this.connectors.set(connector.name, connector);
  }

  get(name: string): Connector | undefined {
    return this.connectors.get(name);
  }

  getByCapability(capability: ConnectorCapability): Connector[] {
    return Array.from(this.connectors.values()).filter(c =>
      c.capabilities.includes(capability)
    );
  }

  listAll(): { name: string; version: string; capabilities: ConnectorCapability[] }[] {
    return Array.from(this.connectors.values()).map(c => ({
      name: c.name,
      version: c.version,
      capabilities: c.capabilities,
    }));
  }

  has(name: string): boolean {
    return this.connectors.has(name);
  }
}

// Global registry instance
export const globalConnectorRegistry = new ConnectorRegistry();
```

- [ ] **Step 3: Create GitLab Connector**

```typescript
// orion-platform-service/src/services/integration/connectors/GitLabConnector.ts

import { Connector, ConnectorConfig, ConnectorCapability, IntegrationEvent } from '../ConnectorRegistry';

interface GitLabConfig extends ConnectorConfig {
  host: string;
  token: string;
  projectId?: string;
}

export class GitLabConnector implements Connector {
  name = 'gitlab';
  version = '1.0.0';
  capabilities: ConnectorCapability[] = [
    ConnectorCapability.SourceControl,
    ConnectorCapability.SourceRead,
    ConnectorCapability.CICD,
  ];

  private client: any = null;

  async initialize(config: ConnectorConfig): Promise<void> {
    const gitlabConfig = config as GitLabConfig;
    // Dynamic import to avoid bundling if not installed
    const Gitlab = (await import('gitlab')).Gitlab;
    this.client = new Gitlab({
      host: gitlabConfig.host,
      token: gitlabConfig.token,
    });
  }

  async validateConfig(config: ConnectorConfig): Promise<boolean> {
    const gitlabConfig = config as GitLabConfig;
    return !!(gitlabConfig.host && gitlabConfig.token);
  }

  async testConnection(config: ConnectorConfig): Promise<boolean> {
    await this.initialize(config);
    try {
      await this.client.Version.all();
      return true;
    } catch (error) {
      console.error('GitLab connection test failed:', error);
      return false;
    }
  }

  async execute(action: string, params: Record<string, unknown>): Promise<unknown> {
    if (!this.client) {
      throw new Error('Connector not initialized. Call initialize() first.');
    }

    switch (action) {
      case 'listProjects':
        return this.client.Projects.all({
          membership: true,
          ...params,
        });

      case 'getProject':
        return this.client.Projects.show(params.projectId as string);

      case 'listBranches':
        return this.client.Branches.all(params.projectId as string);

      case 'getCommit':
        return this.client.Commits.show(params.projectId as string, params.sha as string);

      case 'listCommits':
        return this.client.Commits.all(params.projectId as string, params as any);

      case 'createMergeRequest':
        return this.client.MergeRequests.create(params as any);

      case 'listMergeRequests':
        return this.client.MergeRequests.all(params.projectId as string, params as any);

      case 'triggerPipeline':
        return this.client.PipelineTriggers.trigger(
          params.projectId as string,
          params.ref as string,
          { variables: params.variables }
        );

      case 'getPipelineStatus':
        const pipeline = await this.client.Pipelines.show(
          params.projectId as string,
          params.pipelineId as number
        );
        return { status: pipeline.status, id: pipeline.id };

      default:
        throw new Error(`Unknown GitLab action: ${action}`);
    }
  }

  transformEvent(rawEvent: unknown): IntegrationEvent {
    const event = rawEvent as any;
    const eventType = event.object_kind || 'unknown';

    return {
      type: `gitlab.${eventType}`,
      source: 'gitlab',
      payload: event,
      timestamp: new Date(event.created_at || Date.now()),
      externalId: event.object_attributes?.id?.toString(),
    };
  }
}
```

- [ ] **Step 4: Create Jira Connector**

```typescript
// orion-platform-service/src/services/integration/connectors/JiraConnector.ts

import { Connector, ConnectorConfig, ConnectorCapability, IntegrationEvent } from '../ConnectorRegistry';

interface JiraConfig extends ConnectorConfig {
  host: string;
  username: string;
  token: string;
  projectKey?: string;
}

export class JiraConnector implements Connector {
  name = 'jira';
  version = '1.0.0';
  capabilities: ConnectorCapability[] = [
    ConnectorCapability.IssueTracker,
    ConnectorCapability.Notification,
  ];

  private client: any = null;

  async initialize(config: ConnectorConfig): Promise<void> {
    const jiraConfig = config as JiraConfig;
    const JiraApi = (await import('jira-client')).JiraApi;
    this.client = new JiraApi({
      protocol: 'https',
      host: jiraConfig.host.replace(/^https?:\/\//, ''),
      username: jiraConfig.username,
      password: jiraConfig.token,
      apiVersion: '3',
    });
  }

  async validateConfig(config: ConnectorConfig): Promise<boolean> {
    const jiraConfig = config as JiraConfig;
    return !!(jiraConfig.host && jiraConfig.username && jiraConfig.token);
  }

  async testConnection(config: ConnectorConfig): Promise<boolean> {
    await this.initialize(config);
    try {
      await this.client.getMyPermissions();
      return true;
    } catch (error) {
      console.error('Jira connection test failed:', error);
      return false;
    }
  }

  async execute(action: string, params: Record<string, unknown>): Promise<unknown> {
    if (!this.client) {
      throw new Error('Connector not initialized. Call initialize() first.');
    }

    switch (action) {
      case 'getProjects':
        return this.client.listProjects();

      case 'getProject':
        return this.client.getProject(params.projectKey as string);

      case 'createIssue':
        return this.client.createIssue(params.projectKey as string, params.summary as string, params.description as string, {
          issuetype: params.issueType as string || 'Task',
          ...params.fields,
        });

      case 'updateIssue':
        return this.client.updateIssue(params.issueKey as string, params.fields as any);

      case 'getIssue':
        return this.client.getIssue(params.issueKey as string);

      case 'searchIssues':
        return this.client.searchJira(params.jql as string, params as any);

      case 'transitionIssue':
        return this.client.transitionIssue(params.issueKey as string, params.transitionId as string);

      case 'addComment':
        return this.client.addComment(params.issueKey as string, params.body as string);

      case 'getTransitions':
        return this.client.listTransitions(params.issueKey as string);

      default:
        throw new Error(`Unknown Jira action: ${action}`);
    }
  }

  transformEvent(rawEvent: unknown): IntegrationEvent {
    const event = rawEvent as any;
    const webhookEvent = event.webhookEvent || 'unknown';

    return {
      type: `jira.${webhookEvent}`,
      source: 'jira',
      payload: event,
      timestamp: new Date(event.timestamp || Date.now()),
      externalId: event.issue?.key || event.issueKey,
    };
  }
}
```

- [ ] **Step 5: Create index with auto-registration**

```typescript
// orion-platform-service/src/services/integration/connectors/index.ts

export { GitLabConnector } from './GitLabConnector';
export { JiraConnector } from './JiraConnector';
```

```typescript
// orion-platform-service/src/services/integration/index.ts

export { ConnectorRegistry, globalConnectorRegistry, Connector, ConnectorConfig, ConnectorCapability, IntegrationEvent } from './ConnectorRegistry';
export * from './connectors';

// Auto-register built-in connectors
import { globalConnectorRegistry } from './ConnectorRegistry';
import { GitLabConnector } from './connectors/GitLabConnector';
import { JiraConnector } from './connectors/JiraConnector';

// Register on first import
globalConnectorRegistry.register(new GitLabConnector());
globalConnectorRegistry.register(new JiraConnector());

// Service wrapper for REST API
import { DatabasePool } from '../database';

export class IntegrationService {
  constructor(private pool: DatabasePool) {}

  async createIntegration(tenantId: string, userId: string, data: {
    provider: string;
    name: string;
    config: Record<string, unknown>;
  }) {
    const result = await this.pool.query(
      `INSERT INTO integrations (tenant_id, provider, name, config, status, created_by)
       VALUES ($1, $2, $3, $4, 'inactive', $5) RETURNING *`,
      [tenantId, data.provider, data.name, JSON.stringify(data.config), userId]
    );
    return result.rows[0];
  }

  async testConnection(integrationId: string): Promise<{ success: boolean; message: string }> {
    const result = await this.pool.query('SELECT * FROM integrations WHERE id = $1', [integrationId]);
    const integration = result.rows[0];

    if (!integration) {
      return { success: false, message: 'Integration not found' };
    }

    const connector = globalConnectorRegistry.get(integration.provider);
    if (!connector) {
      return { success: false, message: `Connector ${integration.provider} not found` };
    }

    try {
      await connector.initialize(integration.config);
      const connected = await connector.testConnection(integration.config);
      return {
        success: connected,
        message: connected ? 'Connection successful' : 'Connection failed',
      };
    } catch (error: any) {
      return { success: false, message: error.message };
    }
  }

  async listIntegrations(tenantId: string) {
    const result = await this.pool.query(
      'SELECT * FROM integrations WHERE tenant_id = $1 ORDER BY created_at DESC',
      [tenantId]
    );
    return result.rows;
  }
}
```

- [ ] **Step 6: Write test**

```typescript
// orion-platform-service/src/services/integration/__tests__/ConnectorRegistry.test.ts

import { ConnectorRegistry, ConnectorCapability } from '../ConnectorRegistry';

class MockConnector {
  name = 'mock';
  version = '1.0.0';
  capabilities = [ConnectorCapability.SourceControl];

  async initialize() {}
  async validateConfig() { return true; }
  async testConnection() { return true; }
  async execute() { return { success: true }; }
}

describe('ConnectorRegistry', () => {
  let registry: ConnectorRegistry;

  beforeEach(() => {
    registry = new ConnectorRegistry();
  });

  it('should register and retrieve connector', () => {
    const connector = new MockConnector();
    registry.register(connector);

    expect(registry.get('mock')).toBe(connector);
    expect(registry.has('mock')).toBe(true);
  });

  it('should find connectors by capability', () => {
    registry.register(new MockConnector());

    const results = registry.getByCapability(ConnectorCapability.SourceControl);
    expect(results).toHaveLength(1);
    expect(results[0].name).toBe('mock');

    const notFound = registry.getByCapability(ConnectorCapability.IssueTracker);
    expect(notFound).toHaveLength(0);
  });

  it('should list all connectors', () => {
    registry.register(new MockConnector());

    const list = registry.listAll();
    expect(list).toEqual([{ name: 'mock', version: '1.0.0', capabilities: [ConnectorCapability.SourceControl] }]);
  });
});
```

- [ ] **Step 7: Run test**

Run: `cd orion-platform-service && npx jest src/services/integration/__tests__/ConnectorRegistry.test.ts -v`
Expected: PASS

- [ ] **Step 8: Commit**

```bash
git add src/services/integration/ src/db/migrations/054_integration_connectors.sql
git commit -m "feat(integration): add connector framework for third-party integrations

- Add ConnectorRegistry with capability-based lookup
- Implement GitLab connector (source control, CI/CD)
- Implement Jira connector (issue tracking)
- Add integrations table for configuration management
- Auto-register built-in connectors on import"
```

---

## Task 4: TypeScript SDK

**Files:**
- Create: `orion-sdk/typescript/package.json`
- Create: `orion-sdk/typescript/src/client.ts`
- Create: `orion-sdk/typescript/src/agents.ts`
- Create: `orion-sdk/typescript/src/pipelines.ts`
- Create: `orion-sdk/typescript/src/diagnostics.ts`
- Create: `orion-sdk/typescript/src/index.ts`

- [ ] **Step 1: Create package.json**

```json
{
  "name": "@orion/sdk",
  "version": "1.0.0",
  "description": "Orion Platform TypeScript SDK",
  "main": "dist/index.js",
  "types": "dist/index.d.ts",
  "scripts": {
    "build": "tsc",
    "test": "jest"
  },
  "dependencies": {
    "axios": "^1.6.0"
  },
  "devDependencies": {
    "@types/node": "^20.0.0",
    "typescript": "^5.0.0",
    "jest": "^29.0.0",
    "ts-jest": "^29.0.0"
  },
  "publishConfig": {
    "access": "public"
  }
}
```

- [ ] **Step 2: Create client.ts**

```typescript
// orion-sdk/typescript/src/client.ts

import axios, { AxiosInstance, AxiosError } from 'axios';

export interface OrionConfig {
  baseUrl: string;
  apiKey?: string;
  token?: string;
  timeout?: number;
  retries?: number;
}

export interface ApiResponse<T> {
  data: T;
  error?: string;
}

export class OrionClient {
  public agents: AgentAPI;
  public pipelines: PipelineAPI;
  public diagnostics: DiagnosticAPI;
  public integrations: IntegrationAPI;

  private http: AxiosInstance;
  private retries: number;

  constructor(config: OrionConfig) {
    this.retries = config.retries ?? 3;

    this.http = axios.create({
      baseURL: config.baseUrl,
      timeout: config.timeout ?? 30000,
      headers: {
        'Content-Type': 'application/json',
        ...(config.apiKey && { 'X-API-Key': config.apiKey }),
        ...(config.token && { 'Authorization': `Bearer ${config.token}` }),
      },
    });

    // Response interceptor for retries
    this.http.interceptors.response.use(
      response => response,
      async (error: AxiosError) => {
        const config = error.config;
        if (!config) return Promise.reject(error);

        // Only retry on 5xx errors
        if (error.response?.status && error.response.status >= 500) {
          const retryCount = (config as any).__retryCount || 0;
          if (retryCount < this.retries) {
            await new Promise(resolve => setTimeout(resolve, 1000 * (retryCount + 1)));
            (config as any).__retryCount = retryCount + 1;
            return this.http.request(config);
          }
        }

        return Promise.reject(error);
      }
    );

    this.agents = new AgentAPI(this.http);
    this.pipelines = new PipelineAPI(this.http);
    this.diagnostics = new DiagnosticAPI(this.http);
    this.integrations = new IntegrationAPI(this.http);
  }
}

// API Base class
abstract class ApiBase {
  constructor(protected http: AxiosInstance) {}

  protected async get<T>(path: string, params?: Record<string, unknown>): Promise<T> {
    const response = await this.http.get<T>(path, { params });
    return response.data;
  }

  protected async post<T>(path: string, data?: unknown): Promise<T> {
    const response = await this.http.post<T>(path, data);
    return response.data;
  }

  protected async put<T>(path: string, data?: unknown): Promise<T> {
    const response = await this.http.put<T>(path, data);
    return response.data;
  }

  protected async delete<T>(path: string): Promise<T> {
    const response = await this.http.delete<T>(path);
    return response.data;
  }
}
```

- [ ] **Step 3: Create agents.ts**

```typescript
// orion-sdk/typescript/src/agents.ts

import { ApiBase } from './client';

export interface AgentRunRequest {
  agentId: string;
  prompt: string;
  context?: Record<string, unknown>;
  waitForCompletion?: boolean;
}

export interface AgentRunResponse {
  runId: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  output?: string;
  error?: string;
  createdAt: string;
}

export interface AgentStatusResponse {
  runId: string;
  status: string;
  output?: string;
  error?: string;
  logs?: string[];
}

export class AgentAPI extends ApiBase {
  async run(request: AgentRunRequest): Promise<AgentRunResponse> {
    return this.post<AgentRunResponse>('/api/v1/agents/execute', {
      agent_id: request.agentId,
      input: request.prompt,
      context: request.context,
      wait: request.waitForCompletion ?? true,
    });
  }

  async getStatus(runId: string): Promise<AgentStatusResponse> {
    return this.get<AgentStatusResponse>(`/api/v1/agents/runs/${runId}`);
  }

  async listAgents(): Promise<{ id: string; name: string; description: string }[]> {
    return this.get<any[]>('/api/v1/agents');
  }

  async cancelRun(runId: string): Promise<void> {
    await this.post(`/api/v1/agents/runs/${runId}/cancel`);
  }

  async getLogs(runId: string): Promise<string[]> {
    const response = await this.get<{ logs: string[] }>(`/api/v1/agents/runs/${runId}/logs`);
    return response.logs;
  }
}
```

- [ ] **Step 4: Create pipelines.ts**

```typescript
// orion-sdk/typescript/src/pipelines.ts

import { ApiBase } from './client';

export interface PipelineExecuteRequest {
  pipelineId: string;
  params?: Record<string, string>;
  wait?: boolean;
}

export interface PipelineRunResponse {
  runId: string;
  pipelineId: string;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';
  startTime?: string;
  endTime?: string;
}

export interface PipelineLogResponse {
  runId: string;
  logs: string[];
  hasMore: boolean;
}

export class PipelineAPI extends ApiBase {
  async execute(request: PipelineExecuteRequest): Promise<PipelineRunResponse> {
    return this.post<PipelineRunResponse>('/api/v1/pipelines/execute', {
      pipeline_id: request.pipelineId,
      params: request.params,
      wait: request.wait ?? false,
    });
  }

  async getStatus(runId: string): Promise<PipelineRunResponse> {
    return this.get<PipelineRunResponse>(`/api/v1/pipelines/runs/${runId}`);
  }

  async listPipelines(): Promise<{ id: string; name: string; description: string }[]> {
    return this.get<any[]>('/api/v1/pipelines');
  }

  async getLogs(runId: string, offset?: number): Promise<PipelineLogResponse> {
    return this.get<PipelineLogResponse>(`/api/v1/pipelines/runs/${runId}/logs`, { offset });
  }

  async cancelRun(runId: string): Promise<void> {
    await this.post(`/api/v1/pipelines/runs/${runId}/cancel`);
  }
}
```

- [ ] **Step 5: Create diagnostics.ts**

```typescript
// orion-sdk/typescript/src/diagnostics.ts

import { ApiBase } from './client';

export interface DiagnosticRunRequest {
  targetType: 'service' | 'pipeline' | 'deployment' | 'tenant';
  targetId: string;
  diagnosticTypes?: string[];
}

export interface DiagnosticRunResponse {
  diagnosticId: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  results?: DiagnosticResult[];
}

export interface DiagnosticResult {
  type: string;
  severity: 'info' | 'warning' | 'error';
  message: string;
  recommendations?: string[];
}

export class DiagnosticAPI extends ApiBase {
  async run(request: DiagnosticRunRequest): Promise<DiagnosticRunResponse> {
    return this.post<DiagnosticRunResponse>('/api/v1/diagnostics/run', {
      target_type: request.targetType,
      target_id: request.targetId,
      diagnostic_types: request.diagnosticTypes,
    });
  }

  async getStatus(diagnosticId: string): Promise<DiagnosticRunResponse> {
    return this.get<DiagnosticRunResponse>(`/api/v1/diagnostics/${diagnosticId}`);
  }

  async listTypes(): Promise<{ type: string; description: string }[]> {
    return this.get<any[]>('/api/v1/diagnostics/types');
  }
}
```

- [ ] **Step 6: Create integrations.ts**

```typescript
// orion-sdk/typescript/src/integrations.ts

import { ApiBase } from './client';

export interface IntegrationRequest {
  provider: string;
  name: string;
  config: Record<string, unknown>;
}

export interface IntegrationResponse {
  id: string;
  provider: string;
  name: string;
  status: 'active' | 'inactive' | 'error';
}

export class IntegrationAPI extends ApiBase {
  async create(request: IntegrationRequest): Promise<IntegrationResponse> {
    return this.post<IntegrationResponse>('/api/v1/integrations', request);
  }

  async list(): Promise<IntegrationResponse[]> {
    return this.get<IntegrationResponse[]>('/api/v1/integrations');
  }

  async get(id: string): Promise<IntegrationResponse> {
    return this.get<IntegrationResponse>(`/api/v1/integrations/${id}`);
  }

  async update(id: string, data: Partial<IntegrationRequest>): Promise<IntegrationResponse> {
    return this.put<IntegrationResponse>(`/api/v1/integrations/${id}`, data);
  }

  async delete(id: string): Promise<void> {
    await this.delete(`/api/v1/integrations/${id}`);
  }

  async testConnection(id: string): Promise<{ success: boolean; message: string }> {
    return this.post<any>(`/api/v1/integrations/${id}/test`);
  }

  async sync(id: string): Promise<void> {
    await this.post(`/api/v1/integrations/${id}/sync`);
  }
}
```

- [ ] **Step 7: Create index.ts**

```typescript
// orion-sdk/typescript/src/index.ts

export { OrionClient, OrionConfig } from './client';
export { AgentAPI, AgentRunRequest, AgentRunResponse, AgentStatusResponse } from './agents';
export { PipelineAPI, PipelineExecuteRequest, PipelineRunResponse, PipelineLogResponse } from './pipelines';
export { DiagnosticAPI, DiagnosticRunRequest, DiagnosticRunResponse, DiagnosticResult } from './diagnostics';
export { IntegrationAPI, IntegrationRequest, IntegrationResponse } from './integrations';
```

- [ ] **Step 8: Create tsconfig.json**

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "commonjs",
    "lib": ["ES2020"],
    "outDir": "./dist",
    "rootDir": "./src",
    "declaration": true,
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist"]
}
```

- [ ] **Step 9: Commit**

```bash
mkdir -p orion-sdk/typescript/src
git add orion-sdk/typescript/
git commit -m "feat(sdk): add TypeScript SDK (@orion/sdk)

- Implement OrionClient with axios and automatic retry
- Add AgentAPI for agent execution and status
- Add PipelineAPI for pipeline management
- Add DiagnosticAPI for system diagnostics
- Add IntegrationAPI for third-party integrations
- TypeScript with full type definitions"
```

---

## Task 5: Python SDK

**Files:**
- Create: `orion-sdk/python/setup.py`
- Create: `orion-sdk/python/orion/client.py`
- Create: `orion-sdk/python/orion/agents.py`
- Create: `orion-sdk/python/orion/pipelines.py`
- Create: `orion-sdk/python/orion/__init__.py`

- [ ] **Step 1: Create setup.py**

```python
# orion-sdk/python/setup.py

from setuptools import setup, find_packages

setup(
    name="orion-sdk-py",
    version="1.0.0",
    description="Orion Platform Python SDK",
    author="Orion Team",
    packages=find_packages(),
    install_requires=[
        "requests>=2.28.0",
        "httpx>=0.24.0",
    ],
    python_requires=">=3.8",
    classifiers=[
        "Development Status :: 4 - Beta",
        "Intended Audience :: Developers",
        "Programming Language :: Python :: 3.8",
        "Programming Language :: Python :: 3.9",
        "Programming Language :: Python :: 3.10",
    ],
)
```

- [ ] **Step 2: Create client.py**

```python
# orion-sdk/python/orion/client.py

import httpx
from dataclasses import dataclass
from typing import Optional, Dict, Any
import time

@dataclass
class OrionConfig:
    base_url: str
    api_key: Optional[str] = None
    token: Optional[str] = None
    timeout: float = 30.0
    retries: int = 3

class OrionClient:
    def __init__(self, config: OrionConfig):
        self.config = config
        self.base_url = config.base_url.rstrip('/')
        
        headers = {"Content-Type": "application/json"}
        if config.api_key:
            headers["X-API-Key"] = config.api_key
        if config.token:
            headers["Authorization"] = f"Bearer {config.token}"
        
        self._client = httpx.Client(
            base_url=self.base_url,
            headers=headers,
            timeout=config.timeout,
        )
        
        # Sub-apis
        from .agents import AgentAPI
        from .pipelines import PipelineAPI
        
        self.agents = AgentAPI(self)
        self.pipelines = PipelineAPI(self)
    
    def _request(self, method: str, path: str, **kwargs) -> Dict[str, Any]:
        url = f"{self.base_url}{path}"
        
        for attempt in range(self.config.retries + 1):
            try:
                response = self._client.request(method, url, **kwargs)
                response.raise_for_status()
                return response.json()
            except httpx.HTTPStatusError as e:
                if e.response.status_code >= 500 and attempt < self.config.retries:
                    time.sleep(1 * (attempt + 1))
                    continue
                raise
    
    def get(self, path: str, params=None) -> Dict[str, Any]:
        return self._request("GET", path, params=params)
    
    def post(self, path: str, json=None) -> Dict[str, Any]:
        return self._request("POST", path, json=json)
    
    def put(self, path: str, json=None) -> Dict[str, Any]:
        return self._request("PUT", path, json=json)
    
    def delete(self, path: str) -> Dict[str, Any]:
        return self._request("DELETE", path)
    
    def close(self):
        self._client.close()
    
    def __enter__(self):
        return self
    
    def __exit__(self, exc_type, exc_val, exc_tb):
        self.close()
```

- [ ] **Step 3: Create agents.py**

```python
# orion-sdk/python/orion/agents.py

from typing import Dict, Any, Optional
from .client import OrionClient

class AgentAPI:
    def __init__(self, client: OrionClient):
        self.client = client
    
    def run(self, agent_id: str, prompt: str, context: Optional[Dict] = None, wait: bool = True) -> Dict[str, Any]:
        return self.client.post("/api/v1/agents/execute", json={
            "agent_id": agent_id,
            "input": prompt,
            "context": context,
            "wait": wait,
        })
    
    def get_status(self, run_id: str) -> Dict[str, Any]:
        return self.client.get(f"/api/v1/agents/runs/{run_id}")
    
    def list_agents(self) -> list:
        return self.client.get("/api/v1/agents")
    
    def cancel_run(self, run_id: str) -> None:
        self.client.post(f"/api/v1/agents/runs/{run_id}/cancel")
    
    def get_logs(self, run_id: str) -> list:
        response = self.client.get(f"/api/v1/agents/runs/{run_id}/logs")
        return response.get("logs", [])
```

- [ ] **Step 4: Create pipelines.py**

```python
# orion-sdk/python/orion/pipelines.py

from typing import Dict, Any, Optional
from .client import OrionClient

class PipelineAPI:
    def __init__(self, client: OrionClient):
        self.client = client
    
    def execute(self, pipeline_id: str, params: Optional[Dict] = None, wait: bool = False) -> Dict[str, Any]:
        return self.client.post("/api/v1/pipelines/execute", json={
            "pipeline_id": pipeline_id,
            "params": params or {},
            "wait": wait,
        })
    
    def get_status(self, run_id: str) -> Dict[str, Any]:
        return self.client.get(f"/api/v1/pipelines/runs/{run_id}")
    
    def list_pipelines(self) -> list:
        return self.client.get("/api/v1/pipelines")
    
    def get_logs(self, run_id: str, offset: Optional[int] = None) -> Dict[str, Any]:
        params = {"offset": offset} if offset else {}
        return self.client.get(f"/api/v1/pipelines/runs/{run_id}/logs", params=params)
    
    def cancel_run(self, run_id: str) -> None:
        self.client.post(f"/api/v1/pipelines/runs/{run_id}/cancel")
```

- [ ] **Step 5: Create __init__.py**

```python
# orion-sdk/python/orion/__init__.py

from .client import OrionClient, OrionConfig
from .agents import AgentAPI
from .pipelines import PipelineAPI

__version__ = "1.0.0"

__all__ = ["OrionClient", "OrionConfig", "AgentAPI", "PipelineAPI"]
```

- [ ] **Step 6: Commit**

```bash
mkdir -p orion-sdk/python/orion
git add orion-sdk/python/
git commit -m "feat(sdk): add Python SDK (orion-sdk-py)

- Implement OrionClient with httpx and automatic retry
- Add AgentAPI for agent execution
- Add PipelineAPI for pipeline management
- Support context manager for resource cleanup"
```

---

## Execution Options

**Plan complete and saved to `docs/superpowers/plans/2026-05-19-integration-capability-implementation.md`. Two execution options:**

**1. Subagent-Driven (recommended)** - I dispatch a fresh subagent per task, review between tasks, fast iteration

**2. Inline Execution** - Execute tasks in this session using executing-plans, batch execution with checkpoints

**Which approach?**