// orion-platform-service/src/services/auth/K8sSecretKeyStorage.ts
import { KubeConfig, CoreV1Api } from '@kubernetes/client-node';
import pino from 'pino';
import type { JwtKey } from './JwtKeyRotationService';

const logger = pino({ level: process.env.LOG_LEVEL || 'info' });

export interface K8sSecretConfig {
  namespace: string;
  secretName: string;
}

const DEFAULT_CONFIG: K8sSecretConfig = {
  namespace: process.env.K8S_NAMESPACE || 'default',
  secretName: process.env.JWT_SECRET_NAME || 'orion-jwt-keys',
};

export class K8sSecretKeyStorage {
  private config: K8sSecretConfig = DEFAULT_CONFIG;
  private k8sApi: CoreV1Api | null = null;
  private kubeConfig: KubeConfig | null = null;
  private available: boolean = false;

  constructor(config: Partial<K8sSecretConfig> = {}) {
    // Disable K8s storage in development (no K8s cluster)
    if (process.env.NODE_ENV === 'development' && !process.env.K8S_ENABLED) {
      logger.debug('[K8sSecretStorage] Disabled in development mode');
      this.available = false;
      return;
    }
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.initializeK8sClient();
  }

  private initializeK8sClient(): void {
    try {
      this.kubeConfig = new KubeConfig();
      this.kubeConfig.loadFromDefault();

      this.k8sApi = this.kubeConfig.makeApiClient(CoreV1Api);
      this.available = true;

      logger.info(`[K8sSecretStorage] Initialized for namespace: ${this.config.namespace}, secret: ${this.config.secretName}`);
    } catch (error) {
      logger.warn(`[K8sSecretStorage] K8s client initialization failed: ${error}. Falling back to database storage.`);
      this.available = false;
    }
  }

  /**
   * Check if K8s API is available
   */
  isAvailable(): boolean {
    return this.available;
  }

  /**
   * Load keys from Kubernetes Secret
   */
  async loadKeys(): Promise<JwtKey[]> {
    if (!this.available || !this.k8sApi) {
      return [];
    }

    try {
      const response = await this.k8sApi.readNamespacedSecret({
        name: this.config.secretName,
        namespace: this.config.namespace,
      } as any) as any;

      const secretData = response.data || {};
      const keys: JwtKey[] = [];

      // Parse keys from secret data
      // Expected format: key_id=key_hash,status,created_at,activated_at,expires_at
      for (const [keyId, encodedValue] of Object.entries(secretData)) {
        if (keyId.startsWith('jwt_key_')) {
          try {
            const value = Buffer.from((encodedValue as string) || '', 'base64').toString('utf-8');
            const parts = value.split(',');

            if (parts.length >= 4) {
              keys.push({
                keyId,
                keyHash: parts[0],
                keyStrength: parts[1] || '256-bit',
                status: parts[2] as JwtKey['status'],
                createdAt: new Date(parts[3]),
                activatedAt: parts[4] ? new Date(parts[4]) : undefined,
                expiresAt: parts[5] ? new Date(parts[5]) : undefined,
              });
            }
          } catch (parseError) {
            logger.warn(`[K8sSecretStorage] Failed to parse key: ${keyId}`);
          }
        }
      }

      logger.info(`[K8sSecretStorage] Loaded ${keys.length} keys from K8s Secret`);
      return keys;
    } catch (error: any) {
      if (error.statusCode === 404) {
        logger.info(`[K8sSecretStorage] Secret not found. Will create on first key generation.`);
        return [];
      }
      logger.error(`[K8sSecretStorage] Failed to load keys: ${error}`);
      return [];
    }
  }

  /**
   * Store key in Kubernetes Secret
   */
  async storeKey(key: JwtKey): Promise<void> {
    if (!this.available || !this.k8sApi) {
      logger.warn('[K8sSecretStorage] K8s not available, skipping secret storage');
      return;
    }

    try {
      // Check if secret exists
      const existingSecret = await this.k8sApi.readNamespacedSecret({
        name: this.config.secretName,
        namespace: this.config.namespace,
      } as any).catch((e: any) => e.statusCode === 404 ? null : Promise.reject(e)) as any;

      const keyData = this.encodeKeyData(key);

      if (existingSecret) {
        // Update existing secret
        const updatedData = {
          ...existingSecret.data,
          [key.keyId]: keyData,
        };

        await this.k8sApi.replaceNamespacedSecret({
          name: this.config.secretName,
          namespace: this.config.namespace,
          body: {
            ...existingSecret,
            data: updatedData,
          },
        } as any);
      } else {
        // Create new secret
        await this.k8sApi.createNamespacedSecret({
          namespace: this.config.namespace,
          body: {
            apiVersion: 'v1',
            kind: 'Secret',
            metadata: {
              name: this.config.secretName,
              labels: {
                app: 'orion',
                component: 'jwt-keys',
              },
            },
            type: 'Opaque',
            data: {
              [key.keyId]: keyData,
            },
          }
        } as any);
      }

      logger.info(`[K8sSecretStorage] Stored key ${key.keyId} in K8s Secret`);
    } catch (error) {
      logger.error(`[K8sSecretStorage] Failed to store key: ${error}`);
      throw error;
    }
  }

  /**
   * Update key status in Kubernetes Secret
   */
  async updateKey(key: JwtKey): Promise<void> {
    if (!this.available || !this.k8sApi) {
      return;
    }

    try {
      const response = await this.k8sApi.readNamespacedSecret({
        name: this.config.secretName,
        namespace: this.config.namespace,
      } as any) as any;

      const keyData = this.encodeKeyData(key);

      await this.k8sApi.replaceNamespacedSecret({
        name: this.config.secretName,
        namespace: this.config.namespace,
        body: {
          ...response,
          data: {
            ...response.data,
            [key.keyId]: keyData,
          },
        },
      } as any);

      logger.info(`[K8sSecretStorage] Updated key ${key.keyId} in K8s Secret`);
    } catch (error) {
      logger.error(`[K8sSecretStorage] Failed to update key: ${error}`);
      throw error;
    }
  }

  /**
   * Delete expired key from Kubernetes Secret
   */
  async deleteKey(keyId: string): Promise<void> {
    if (!this.available || !this.k8sApi) {
      return;
    }

    try {
      const response = await this.k8sApi.readNamespacedSecret({
        name: this.config.secretName,
        namespace: this.config.namespace,
      } as any) as any;

      const updatedData = { ...response.data };
      delete updatedData[keyId];

      await this.k8sApi.replaceNamespacedSecret({
        name: this.config.secretName,
        namespace: this.config.namespace,
        body: {
          ...response,
          data: updatedData,
        },
      } as any);

      logger.info(`[K8sSecretStorage] Deleted key ${keyId} from K8s Secret`);
    } catch (error) {
      logger.error(`[K8sSecretStorage] Failed to delete key: ${error}`);
    }
  }

  /**
   * Encode key data for K8s Secret (base64)
   */
  private encodeKeyData(key: JwtKey): string {
    const parts = [
      key.keyHash,
      key.keyStrength,
      key.status,
      key.createdAt.toISOString(),
      key.activatedAt?.toISOString() || '',
      key.expiresAt?.toISOString() || '',
    ];
    return Buffer.from(parts.join(',')).toString('base64');
  }

  /**
   * Get environment variables for deployment injection
   */
  getSecretEnvVars(): { name: string; valueFrom: { secretKeyRef: { name: string; key: string } } }[] {
    return [
      {
        name: 'JWT_CURRENT_KEY_ID',
        valueFrom: {
          secretKeyRef: {
            name: this.config.secretName,
            key: 'current_key_id',
          },
        },
      },
      {
        name: 'JWT_CURRENT_KEY_HASH',
        valueFrom: {
          secretKeyRef: {
            name: this.config.secretName,
            key: 'current_key_hash',
          },
        },
      },
    ];
  }
}

// Export singleton for convenience
export const k8sSecretStorage = new K8sSecretKeyStorage();