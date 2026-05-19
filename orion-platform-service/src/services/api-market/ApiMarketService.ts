/**
 * ApiMarketService - Business logic for API Marketplace operations
 */

import * as crypto from 'crypto';
import { ApiMarketRepository, ApiProduct, DeveloperApp, ApiCredential, CreateProductInput, CreateAppInput } from './ApiMarketRepository';

export class ApiMarketError extends Error {
  constructor(message: string, public code?: string) {
    super(message);
    this.name = 'ApiMarketError';
  }
}

export interface GenerateApiKeyResult {
  clientId: string;
  clientSecret: string;
}

export interface ValidateApiKeyResult {
  credentialId: string;
  appId: string;
  scopes: string[];
  rateLimitPerMin: number;
}

export class ApiMarketService {
  constructor(private repository: ApiMarketRepository) {}

  // ==================== Products ====================

  /**
   * Generate URL-friendly slug from name
   */
  private generateSlug(name: string): string {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');
  }

  /**
   * Create a new API product with auto-generated unique slug
   */
  async createProduct(input: { name: string; description?: string; ownerId?: string; version?: string }): Promise<ApiProduct> {
    if (!input.name || !input.name.trim()) {
      throw new ApiMarketError('Product name is required');
    }

    const baseSlug = this.generateSlug(input.name);
    let slug = baseSlug;
    let counter = 1;

    // Find unique slug
    while (true) {
      const existing = await this.repository.findProductBySlug(slug);
      if (!existing) break;
      slug = `${baseSlug}-${counter++}`;
    }

    const productInput: CreateProductInput = {
      name: input.name.trim(),
      slug,
      description: input.description,
      ownerId: input.ownerId,
      version: input.version || '1.0.0',
    };

    return this.repository.createProduct(productInput);
  }

  /**
   * Get product by ID
   */
  async getProduct(id: string): Promise<ApiProduct | null> {
    return this.repository.findProductById(id);
  }

  /**
   * Get product by slug
   */
  async getProductBySlug(slug: string): Promise<ApiProduct | null> {
    return this.repository.findProductBySlug(slug);
  }

  /**
   * List all products
   */
  async listProducts(): Promise<ApiProduct[]> {
    return this.repository.listProducts();
  }

  /**
   * Publish a product (change status to published)
   */
  async publishProduct(id: string): Promise<ApiProduct> {
    const product = await this.repository.findProductById(id);
    if (!product) {
      throw new ApiMarketError('Product not found', 'NOT_FOUND');
    }

    const updated = await this.repository.updateProduct(id, { status: 'published' });
    if (!updated) {
      throw new ApiMarketError('Failed to publish product');
    }

    return updated;
  }

  /**
   * Update product
   */
  async updateProduct(id: string, input: { name?: string; description?: string }): Promise<ApiProduct | null> {
    return this.repository.updateProduct(id, input);
  }

  /**
   * Delete product
   */
  async deleteProduct(id: string): Promise<boolean> {
    return this.repository.deleteProduct(id);
  }

  // ==================== Developer Apps ====================

  /**
   * Create a new developer app
   */
  async createDeveloperApp(input: { developerId: string; name: string; description?: string; redirectUris?: string[] }): Promise<DeveloperApp> {
    if (!input.name || !input.name.trim()) {
      throw new ApiMarketError('App name is required');
    }

    const appInput: CreateAppInput = {
      developerId: input.developerId,
      name: input.name.trim(),
      description: input.description,
      redirectUris: input.redirectUris,
    };

    return this.repository.createApp(appInput);
  }

  /**
   * List apps by developer
   */
  async listAppsByDeveloper(developerId: string): Promise<DeveloperApp[]> {
    return this.repository.listAppsByDeveloper(developerId);
  }

  /**
   * Get app by ID
   */
  async getApp(id: string): Promise<DeveloperApp | null> {
    return this.repository.findAppById(id);
  }

  // ==================== API Keys ====================

  /**
   * Generate a new API key for an app
   */
  async generateApiKey(appId: string, scopes: string[] = ['read']): Promise<GenerateApiKeyResult> {
    const app = await this.repository.findAppById(appId);
    if (!app) {
      throw new ApiMarketError('App not found', 'APP_NOT_FOUND');
    }

    // Generate client_id and client_secret
    const clientId = crypto.randomBytes(16).toString('hex');
    const clientSecret = crypto.randomBytes(32).toString('hex');

    // Hash the client secret
    const hash = crypto.createHash('sha256');
    const clientSecretHash = hash.update(clientSecret).digest('hex');

    await this.repository.createCredential({
      appId,
      clientId,
      clientSecretHash,
      scopes,
      rateLimitPerMin: 100,
    });

    return { clientId, clientSecret };
  }

  /**
   * Validate an API key
   */
  async validateApiKey(clientId: string, clientSecret: string): Promise<ValidateApiKeyResult | null> {
    const credential = await this.repository.findCredentialByClientId(clientId);
    if (!credential) {
      return null;
    }

    // Verify the secret
    const hash = crypto.createHash('sha256');
    const clientSecretHash = hash.update(clientSecret).digest('hex');

    if (clientSecretHash !== credential.client_secret_hash) {
      return null;
    }

    // Check expiration
    if (credential.expires_at && new Date() > credential.expires_at) {
      return null;
    }

    // Update last used timestamp
    await this.repository.updateCredentialLastUsed(credential.id);

    return {
      credentialId: credential.id,
      appId: credential.app_id,
      scopes: credential.scopes,
      rateLimitPerMin: credential.rate_limit_per_min,
    };
  }

  /**
   * List API keys for an app
   */
  async listApiKeys(appId: string): Promise<ApiCredential[]> {
    return this.repository.listCredentialsByApp(appId);
  }

  // ==================== Subscriptions ====================

  /**
   * Subscribe to an API product
   */
  async subscribe(appId: string, productId: string, plan: string, quotaPerDay?: number): Promise<void> {
    const existing = await this.repository.findSubscription(appId, productId);
    if (existing) {
      throw new ApiMarketError('Already subscribed to this product', 'ALREADY_SUBSCRIBED');
    }

    await this.repository.createSubscription(appId, productId, plan, quotaPerDay);
  }

  /**
   * Check if app has access to product
   */
  async checkSubscription(appId: string, productId: string): Promise<boolean> {
    const subscription = await this.repository.findSubscription(appId, productId);
    return subscription?.status === 'active';
  }

  /**
   * List subscriptions for an app
   */
  async listSubscriptions(appId: string): Promise<any[]> {
    return this.repository.listSubscriptionsByApp(appId);
  }
}