/**
 * SSO/OIDC Integration Service
 *
 * Provides OpenID Connect authentication as a secondary auth method
 * alongside the existing local username/password + JWT system.
 *
 * Uses openid-client v6 API (oauth4webapi-based).
 *
 * Configuration via environment variables:
 *   SSO_ISSUER_URL      - OIDC issuer URL (e.g., https://accounts.google.com)
 *   SSO_CLIENT_ID       - OAuth2 client ID
 *   SSO_CLIENT_SECRET   - OAuth2 client secret
 *   SSO_REDIRECT_URI    - Callback URL (defaults to /api/v1/auth/sso/callback)
 *   SSO_SCOPES          - Comma-separated scopes (defaults to openid,email,profile)
 *   SSO_ENABLED         - Set to "true" to enable SSO
 */

import {
  discovery,
  Configuration,
  buildAuthorizationUrl,
  authorizationCodeGrant,
  randomNonce,
  randomState,
  ClientSecretPost,
  type TokenEndpointResponseHelpers,
} from 'openid-client';
import pino from 'pino';

const logger = pino({ level: process.env.LOG_LEVEL || 'info' });

const STATE_TTL_SECONDS = 600; // 10 minutes

/**
 * Minimal Redis-compatible interface to avoid importing RedisCache directly
 * (avoids circular dependency)
 */
export interface SsoStateStore {
  set(key: string, value: string, ttl: number): Promise<void>;
  get(key: string): Promise<string | null>;
  del(key: string): Promise<void>;
}

export interface SsoConfig {
  issuerUrl: string;
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  scopes?: string[];
  enabled: boolean;
}

export interface SsoUserProfile {
  sub: string;          // OIDC subject ID
  email: string;
  name: string;
  groups?: string[];
  roles?: string[];
}

/**
 * In-memory fallback for when Redis is not available.
 * Not suitable for multi-instance deployments.
 */
class InMemorySsoStateStore implements SsoStateStore {
  private states: Map<string, string> = new Map();
  async set(key: string, value: string, _ttl: number): Promise<void> {
    this.states.set(key, value);
    setTimeout(() => this.states.delete(key), STATE_TTL_SECONDS * 1000);
  }
  async get(key: string): Promise<string | null> {
    return this.states.get(key) ?? null;
  }
  async del(key: string): Promise<void> {
    this.states.delete(key);
  }
}

/**
 * Internal state stored per-authorization request.
 * Stored as JSON string in the state store.
 */
interface AuthState {
  nonce: string;
  state: string;
}

export class SsoService {
  private config: SsoConfig | null = null;
  private oidcConfig: Configuration | null = null;
  private stateStore: SsoStateStore;

  /**
   * @param stateStore — Redis-backed state store for multi-instance support.
   *   If not provided, falls back to in-memory (not recommended for production).
   */
  constructor(stateStore?: SsoStateStore) {
    this.stateStore = stateStore || new InMemorySsoStateStore();
  }

  /**
   * Initialize SSO from configuration.
   * Discovers the OIDC issuer and creates the OAuth2 client configuration.
   */
  async initialize(config: SsoConfig): Promise<void> {
    if (!config.enabled) {
      logger.info('[SsoService] SSO is disabled');
      return;
    }

    if (!config.issuerUrl || !config.clientId || !config.clientSecret) {
      logger.warn('[SsoService] SSO enabled but missing required config');
      return;
    }

    this.config = config;

    try {
      const serverUrl = new URL(config.issuerUrl);
      const clientAuth = ClientSecretPost(config.clientSecret);

      this.oidcConfig = await discovery(
        serverUrl,
        config.clientId,
        undefined,       // client metadata (uses defaults)
        clientAuth,
      );

      logger.info(`[SsoService] SSO initialized with issuer: ${config.issuerUrl}`);
    } catch (error) {
      logger.error(error, '[SsoService] Failed to initialize SSO');
      // Don't throw — allow the platform to start even if SSO is misconfigured
      this.oidcConfig = null;
    }
  }

  /**
   * Build the authorization URL for redirecting the user to the SSO provider.
   * Generates and stores nonce + state for CSRF/replay protection.
   * Returns both the URL and the state key for later validation.
   */
  async getAuthorizationUrl(): Promise<{ url: string; stateKey: string }> {
    if (!this.oidcConfig || !this.config) {
      throw new Error('SSO_NOT_CONFIGURED');
    }

    const nonce = randomNonce();
    const state = randomState();
    const scopes = (this.config.scopes || ['openid', 'email', 'profile']).join(' ');

    const url = buildAuthorizationUrl(this.oidcConfig, {
      nonce,
      state,
      scope: scopes,
      redirect_uri: this.config.redirectUri,
    });

    // Store state in Redis (or fallback) with TTL for callback validation
    const authState: AuthState = { nonce, state };
    await this.stateStore.set(`sso:state:${state}`, JSON.stringify(authState), STATE_TTL_SECONDS);

    return { url: url.toString(), stateKey: state };
  }

  /**
   * Handle the callback from the SSO provider.
   * Exchanges the authorization code for tokens and extracts the user profile.
   */
  async handleCallback(currentUrl: URL, stateKey: string): Promise<SsoUserProfile> {
    if (!this.oidcConfig || !this.config) {
      throw new Error('SSO_NOT_CONFIGURED');
    }

    const storedStateRaw = await this.stateStore.get(`sso:state:${stateKey}`);
    if (!storedStateRaw) {
      throw new Error('SSO_STATE_MISMATCH: No matching state found');
    }

    // Clean up the state entry
    await this.stateStore.del(`sso:state:${stateKey}`);

    const storedState: AuthState = JSON.parse(storedStateRaw);

    try {
      // Exchange authorization code for tokens
      const tokens: TokenEndpointResponseHelpers = await authorizationCodeGrant(
        this.oidcConfig,
        currentUrl,
        {
          expectedNonce: storedState.nonce,
          expectedState: storedState.state,
        },
      );

      // Extract claims from the ID token
      const claims = tokens.claims();

      if (!claims || !claims.sub) {
        throw new Error('SSO_NO_CLAIMS: No subject claim found in ID token');
      }

      return {
        sub: claims.sub,
        email: (claims as any).email || (claims as any).preferred_username || claims.sub,
        name: (claims as any).name || (claims as any).email || claims.sub,
        groups: (claims as any).groups,
        roles: (claims as any).roles,
      };
    } catch (error) {
      logger.error(error, '[SsoService] Authorization code grant failed');
      throw error;
    }
  }

  /**
   * Get SSO login URL for redirect from the login page.
   */
  async getLoginUrl(): Promise<string> {
    const { url } = await this.getAuthorizationUrl();
    return url;
  }

  /**
   * Check if SSO is configured and ready.
   */
  isConfigured(): boolean {
    return this.oidcConfig !== null && this.config?.enabled === true;
  }

  /**
   * Get current SSO config (for admin UI).
   * Does NOT expose the client secret.
   */
  getConfig(): Omit<SsoConfig, 'clientSecret'> | null {
    if (!this.config) return null;
    const { clientSecret, ...safeConfig } = this.config;
    return safeConfig;
  }
}
