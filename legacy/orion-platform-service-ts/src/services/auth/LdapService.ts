/**
 * LDAP Authentication Service
 *
 * Provides LDAP authentication for orion-platform-service.
 * Migrated from orion-dba-service to unify authentication.
 *
 * Configuration via environment variables:
 *   LDAP_ENABLED      - Set to "true" to enable LDAP authentication
 *   LDAP_URL          - LDAP server URL (e.g., ldap://ldap.example.com:389)
 *   LDAP_BIND_DN      - Bind DN for searching (e.g., cn=admin,dc=example,dc=com)
 *   LDAP_BIND_PASSWORD - Bind password
 *   LDAP_BASE_DN      - Base DN for user searches (e.g., ou=users,dc=example,dc=com)
 *   LDAP_USER_FILTER  - User search filter (default: (uid={username}))
 *   LDAP_GROUP_FILTER - Group search filter (default: (member={userdn}))
 */

import { createClient, type Client } from 'ldapjs';
import { createLogger } from '../../utils/logger';
import { getCurrentTraceId } from '../../db/tenant-context-storage';

const logger = createLogger('ldap-auth');

/**
 * Escape special characters in LDAP filter strings.
 * RFC 4515: \, *, (, ), NUL must be escaped with backslash
 */
function escapeFilter(input: string): string {
  return input.replace(/[\\*()\0]/g, '\\$&');
}

export interface LdapConfig {
  enabled: boolean;
  url: string;
  bindDn: string;
  bindPassword: string;
  baseDn: string;
  userFilter?: string;
  groupFilter?: string;
  tls?: {
    rejectUnauthorized?: boolean;
  };
}

export interface LdapUserProfile {
  username: string;
  email: string;
  name: string;
  uid?: string;
  cn?: string;
  groups?: string[];
}

/**
 * LDAP Service for user authentication
 */
export class LdapService {
  private config: LdapConfig;
  private client: Client | null = null;
  private connected: boolean = false;

  constructor(config: LdapConfig) {
    this.config = config;
  }

  /**
   * Initialize LDAP connection
   */
  async connect(): Promise<void> {
    if (!this.config.enabled) {
      logger.info('[LdapService] LDAP is disabled');
      return;
    }

    if (!this.config.url || !this.config.bindDn || !this.config.bindPassword) {
      logger.warn({ traceId: getCurrentTraceId() }, '[LdapService] LDAP enabled but missing required config');
      return;
    }

    try {
      this.client = createClient({
        url: this.config.url,
        tlsOptions: this.config.tls,
      });

      this.client.on('error', (err: Error) => {
        logger.error('[LdapService] LDAP connection error:', err);
        this.connected = false;
      });

      this.client.on('close', () => {
        logger.info('[LdapService] LDAP connection closed');
        this.connected = false;
      });

      // Bind with service account
      await (this.client as any).bind(this.config.bindDn, this.config.bindPassword);
      this.connected = true;

      logger.info('[LdapService] LDAP connection established');
    } catch (error: any) {
      logger.error('[LdapService] Failed to connect to LDAP:', error);
      this.client = null;
      this.connected = false;
      throw error;
    }
  }

  /**
   * Check if LDAP is connected
   */
  isConnected(): boolean {
    return this.connected && this.client !== null;
  }

  /**
   * Check if LDAP is enabled in config
   */
  isEnabled(): boolean {
    return this.config.enabled;
  }

  /**
   * Authenticate user against LDAP
   * @param username - Username to authenticate
   * @param password - User's password
   * @returns User profile if authentication succeeds, null otherwise
   */
  async authenticate(username: string, password: string): Promise<LdapUserProfile | null> {
    if (!this.connected || !this.client) {
      logger.warn({ traceId: getCurrentTraceId() }, '[LdapService] LDAP not connected');
      return null;
    }

    if (!username || !password) {
      return null;
    }

    const userFilter = this.config.userFilter || '(uid={username})';
    const searchFilter = userFilter.replace('{username}', escapeFilter(username));

    try {
      // First, bind with the provided credentials to verify password
      // Use a temporary client for this authentication
      const authClient = createClient({
        url: this.config.url,
        tlsOptions: this.config.tls,
      });

      try {
        // Search for the user first
        const searchResult = await this.searchUser(username, searchFilter);
        if (!searchResult) {
          logger.info(`[LdapService] User not found: ${username}`);
          return null;
        }

        // Bind with user's DN and provided password
        await (authClient as any).bind(searchResult.dn, password);

        // Authentication successful, return user profile
        const profile: LdapUserProfile = {
          username: searchResult.attributes.uid?.[0] || username,
          email: searchResult.attributes.mail?.[0] || '',
          name: searchResult.attributes.cn?.[0] || searchResult.attributes.uid?.[0] || username,
          uid: searchResult.attributes.uid?.[0],
          cn: searchResult.attributes.cn?.[0],
          groups: searchResult.attributes.memberOf || [],
        };

        logger.info(`[LdapService] LDAP authentication successful for: ${username}`);
        return profile;
      } finally {
        authClient.unbind();
      }
    } catch (error: any) {
      if (error.name === 'InvalidCredentialsError') {
        logger.info(`[LdapService] Invalid credentials for user: ${username}`);
        return null;
      }
      logger.error('[LdapService] LDAP authentication error:', error);
      return null;
    }
  }

  /**
   * Search for a user in LDAP
   */
  private async searchUser(username: string, searchFilter: string): Promise<any> {
    if (!this.client) {
      return null;
    }

    return new Promise<any>((resolve, reject) => {
      this.client?.search(this.config.baseDn, {
        filter: searchFilter,
        scope: 'sub',
        attributes: ['uid', 'mail', 'cn', 'memberOf', 'dn'],
      }, (err: any, res: any) => {
        if (err) {
          return reject(err);
        }

        const entries: any[] = [];
        res.on('searchEntry', (entry: any) => {
          entries.push(entry);
        });
        res.on('searchReference', (referral: any) => {
          logger.warn(`[LdapService] Search reference: ${referral.url}`);
        });
        res.on('error', (error: any) => {
          reject(error);
        });
        res.on('end', (result: any) => {
          if (result.status !== 0) {
            logger.warn(`[LdapService] Search ended with status: ${result.status}`);
            resolve(null);
          } else if (entries.length > 0) {
            // Return the first matching entry
            const entry = entries[0];
            resolve({
              dn: entry.dn,
              attributes: entry.attributes,
            });
          } else {
            resolve(null);
          }
        });
      });
    });
  }

  /**
   * Get user's groups from LDAP
   */
  async getUserGroups(username: string): Promise<string[]> {
    if (!this.connected || !this.client) {
      return [];
    }

    const groupFilter = this.config.groupFilter || '(member={userdn})';
    const searchFilter = groupFilter.replace('{userdn}', escapeFilter(username));

    try {
      const entries: any[] = [];
      return new Promise((resolve) => {
        this.client?.search(this.config.baseDn, {
          filter: searchFilter,
          scope: 'sub',
          attributes: ['cn', 'entryUUID'],
        }, (err: any, res: any) => {
          if (err) {
            logger.error('[LdapService] Group search error:', err);
            return resolve([]);
          }

          res.on('searchEntry', (entry: any) => {
            entries.push(entry);
          });
          res.on('error', () => {
            resolve([]);
          });
          res.on('end', () => {
            resolve(entries.map((e) => e.attributes.cn?.[0] || e.dn));
          });
        });
      });
    } catch (error: any) {
      logger.error('[LdapService] Failed to get user groups:', error);
      return [];
    }
  }

  /**
   * Disconnect from LDAP server
   */
  async disconnect(): Promise<void> {
    if (this.client) {
      try {
        await this.client.unbind();
      } catch (error: any) {
        logger.error('[LdapService] Failed to unbind LDAP:', error);
      }
      this.client = null;
      this.connected = false;
    }
  }

  /**
   * Test LDAP connection
   */
  async testConnection(): Promise<{ success: boolean; message?: string }> {
    try {
      if (!this.config.enabled) {
        return { success: false, message: 'LDAP is disabled' };
      }

      // Check required config
      if (!this.config.url) {
        return { success: false, message: 'LDAP_URL is required' };
      }
      if (!this.config.bindDn) {
        return { success: false, message: 'LDAP_BIND_DN is required' };
      }
      if (!this.config.bindPassword) {
        return { success: false, message: 'LDAP_BIND_PASSWORD is required' };
      }
      if (!this.config.baseDn) {
        return { success: false, message: 'LDAP_BASE_DN is required' };
      }

      // Try to bind
      const tempClient = createClient({
        url: this.config.url,
        tlsOptions: this.config.tls,
      });

      await (tempClient as any).bind(this.config.bindDn, this.config.bindPassword);
      await tempClient.unbind();

      return { success: true, message: 'LDAP connection successful' };
    } catch (error: any) {
      return { success: false, message: error.message };
    }
  }
}

// Export singleton instance for convenience
export const ldapService = new LdapService({
  enabled: process.env.LDAP_ENABLED === 'true',
  url: process.env.LDAP_URL || '',
  bindDn: process.env.LDAP_BIND_DN || '',
  bindPassword: process.env.LDAP_BIND_PASSWORD || '',
  baseDn: process.env.LDAP_BASE_DN || '',
  userFilter: process.env.LDAP_USER_FILTER,
  groupFilter: process.env.LDAP_GROUP_FILTER,
  tls: process.env.LDAP_TLS_REJECT_UNAUTHORIZED === 'false' ? { rejectUnauthorized: false } : undefined,
});
