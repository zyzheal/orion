/**
 * AWS Provider Client
 *
 * Real AWS SDK v3 integration for EC2, S3, and STS operations.
 * Uses @aws-sdk/client-ec2, @aws-sdk/client-s3, @aws-sdk/client-sts.
 */

import {
  CloudProviderClient,
  ProviderResource,
  ProviderSyncResult,
  ProviderHealthStatus,
  ProviderCostEntry,
  CredentialValidationResult,
  DEFAULT_RETRY_CONFIG,
} from './CloudProviderClient';
import { createLogger } from '../../utils/logger';
import { STSClient, GetCallerIdentityCommand } from '@aws-sdk/client-sts';
import { EC2Client, DescribeInstancesCommand, DescribeInstancesCommandOutput } from '@aws-sdk/client-ec2';
import { S3Client, ListBucketsCommand, ListObjectsV2Command } from '@aws-sdk/client-s3';

const logger = createLogger('aws-provider-client');

/**
 * Retry with exponential backoff
 */
async function retryWithBackoff<T>(
  operation: () => Promise<T>,
  config = DEFAULT_RETRY_CONFIG
): Promise<T> {
  let lastError: Error | null = null;

  for (let attempt = 0; attempt < config.maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error: any) {
      lastError = error;

      // Check if error is retryable (throttling, 500, network errors)
      const retryable =
        error.name === 'ThrottlingException' ||
        error.name === 'TooManyRequestsException' ||
        error.$metadata?.httpStatusCode === 500 ||
        error.$metadata?.httpStatusCode === 503 ||
        error.name === 'NetworkError' ||
        error.name === 'TimeoutError';

      if (!retryable || attempt === config.maxRetries - 1) {
        throw error;
      }

      const delay = Math.min(
        config.baseDelayMs * Math.pow(config.backoffMultiplier, attempt),
        config.maxDelayMs
      );

      logger.warn(
        { attempt: attempt + 1, delayMs: delay, error: error.message },
        '[AwsProviderClient] Retrying after error'
      );

      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }

  throw lastError ?? new Error('Unknown error in retryWithBackoff');
}

export class AwsProviderClient implements CloudProviderClient {
  readonly provider = 'aws';
  private stsClient: STSClient | null = null;
  private ec2Client: EC2Client | null = null;
  private s3Client: S3Client | null = null;
  private region: string = '';
  private credentials: Record<string, string> = {};

  async initialize(credentials: Record<string, string>, region: string): Promise<void> {
    this.credentials = credentials;
    this.region = region;

    const clientConfig: any = { region };

    // Use provided credentials or fall back to environment/default chain
    if (credentials.accessKeyId && credentials.secretAccessKey) {
      clientConfig.credentials = {
        accessKeyId: credentials.accessKeyId,
        secretAccessKey: credentials.secretAccessKey,
        ...(credentials.sessionToken && { sessionToken: credentials.sessionToken }),
      };
    }

    this.stsClient = new STSClient(clientConfig);
    this.ec2Client = new EC2Client(clientConfig);
    this.s3Client = new S3Client(clientConfig);
  }

  async validateCredentials(): Promise<CredentialValidationResult> {
    if (!this.stsClient) {
      return {
        valid: false,
        message: 'Client not initialized - call initialize() first',
      };
    }

    try {
      const result = await retryWithBackoff(async () => {
        const command = new GetCallerIdentityCommand({});
        return await this.stsClient!.send(command);
      });

      return {
        valid: true,
        accountId: result.Account ?? undefined,
        message: 'Credentials are valid',
        details: {
          account: result.Account,
          userId: result.UserId,
          arn: result.Arn,
        },
      };
    } catch (error: any) {
      logger.error({ error: error.message }, '[AwsProviderClient] Credential validation failed');
      return {
        valid: false,
        message: `Credential validation failed: ${error.message}`,
        details: { code: error.name, message: error.message },
      };
    }
  }

  async checkHealth(): Promise<ProviderHealthStatus> {
    const startTime = Date.now();

    try {
      const validation = await this.validateCredentials();
      const latencyMs = Date.now() - startTime;

      return {
        healthy: validation.valid,
        latencyMs,
        apiVersion: 'AWS SDK v3',
        details: {
          accountId: validation.accountId,
          message: validation.message,
        },
      };
    } catch (error: any) {
      return {
        healthy: false,
        latencyMs: Date.now() - startTime,
        apiVersion: 'AWS SDK v3',
        details: { error: error.message },
      };
    }
  }

  async discoverResources(resourceTypes?: string[]): Promise<ProviderResource[]> {
    if (!this.ec2Client || !this.s3Client) {
      throw new Error('Client not initialized - call initialize() first');
    }

    const resources: ProviderResource[] = [];
    const typesToDiscover = resourceTypes ?? ['ec2', 's3', 'rds', 'lambda'];

    // Discover EC2 instances
    if (typesToDiscover.includes('ec2')) {
      try {
        const ec2Resources = await retryWithBackoff(async () => {
          const command = new DescribeInstancesCommand({});
          const result: DescribeInstancesCommandOutput = await this.ec2Client!.send(command);

          const instances: ProviderResource[] = [];
          for (const reservation of result.Reservations ?? []) {
            for (const instance of reservation.Instances ?? []) {
              instances.push({
                id: instance.InstanceId ?? `unknown-${Date.now()}`,
                name: instance.Tags?.find(t => t.Key === 'Name')?.Value ?? instance.InstanceId ?? 'unnamed',
                type: 'ec2',
                region: instance.Placement?.AvailabilityZone ?? this.region,
                status: instance.State?.Name ?? 'unknown',
                tags: (instance.Tags ?? []).reduce((acc, t) => ({ ...acc, [t.Key]: t.Value }), {}),
                spec: {
                  instanceType: instance.InstanceType,
                  imageId: instance.ImageId,
                  launchTime: instance.LaunchTime,
                  privateIpAddress: instance.PrivateIpAddress,
                  publicIpAddress: instance.PublicIpAddress,
                  vpcId: instance.VpcId,
                  subnetId: instance.SubnetId,
                  architecture: instance.Architecture,
                  platformDetails: instance.PlatformDetails,
                },
                monthlyCost: 0, // Will be populated from Cost Explorer if needed
              });
            }
          }
          return instances;
        });
        resources.push(...ec2Resources);
      } catch (error: any) {
        logger.error({ error: error.message }, '[AwsProviderClient] Failed to discover EC2 instances');
      }
    }

    // Discover S3 buckets
    if (typesToDiscover.includes('s3')) {
      try {
        const s3Resources = await retryWithBackoff(async () => {
          const listBucketsCommand = new ListBucketsCommand({});
          const bucketsResult = await this.s3Client!.send(listBucketsCommand);

          const buckets: ProviderResource[] = [];
          for (const bucket of bucketsResult.Buckets ?? []) {
            if (!bucket.Name) continue;

            let objectCount = 0;
            let totalSize = 0;

            try {
              const listObjectsCommand = new ListObjectsV2Command({ Bucket: bucket.Name, MaxKeys: 1000 });
              const objectsResult = await this.s3Client!.send(listObjectsCommand);
              objectCount = objectsResult.KeyCount ?? 0;
              totalSize = objectsResult.Contents?.reduce((sum, obj) => sum + (obj.Size ?? 0), 0) ?? 0;
            } catch {
              // Skip bucket if we can't list objects (permissions)
            }

            buckets.push({
              id: bucket.Name,
              name: bucket.Name,
              type: 's3',
              region: this.region,
              status: 'active',
              tags: {},
              spec: {
                creationDate: bucket.CreationDate,
                objectCount,
                totalSizeBytes: totalSize,
              },
              monthlyCost: 0,
            });
          }
          return buckets;
        });
        resources.push(...s3Resources);
      } catch (error: any) {
        logger.error({ error: error.message }, '[AwsProviderClient] Failed to discover S3 buckets');
      }
    }

    return resources;
  }

  async getCostSummary(month?: string): Promise<{ totalCost: number; currency: string; breakdown: ProviderCostEntry[] }> {
    // Note: Cost Explorer requires separate client and permissions
    // For now, return empty breakdown - real implementation would use AWS Cost Explorer API
    const targetMonth = month ?? new Date().toISOString().slice(0, 7);

    logger.warn('[AwsProviderClient] getCostSummary not fully implemented - requires Cost Explorer API permissions');

    return {
      totalCost: 0,
      currency: 'USD',
      breakdown: [],
    };
  }

  async getResource(providerResourceId: string): Promise<ProviderResource | null> {
    if (!this.ec2Client || !this.s3Client) {
      throw new Error('Client not initialized - call initialize() first');
    }

    // Try EC2 instance lookup
    try {
      const command = new DescribeInstancesCommand({
        InstanceIds: [providerResourceId],
      });
      const result = await retryWithBackoff(async () => this.ec2Client!.send(command));

      for (const reservation of result.Reservations ?? []) {
        for (const instance of reservation.Instances ?? []) {
          if (instance.InstanceId === providerResourceId) {
            return {
              id: instance.InstanceId,
              name: instance.Tags?.find(t => t.Key === 'Name')?.Value ?? instance.InstanceId,
              type: 'ec2',
              region: instance.Placement?.AvailabilityZone ?? this.region,
              status: instance.State?.Name ?? 'unknown',
              tags: (instance.Tags ?? []).reduce((acc, t) => ({ ...acc, [t.Key]: t.Value }), {}),
              spec: {
                instanceType: instance.InstanceType,
                imageId: instance.ImageId,
                launchTime: instance.LaunchTime,
                privateIpAddress: instance.PrivateIpAddress,
                publicIpAddress: instance.PublicIpAddress,
                vpcId: instance.VpcId,
                subnetId: instance.SubnetId,
              },
            };
          }
        }
      }
    } catch {
      // Not an EC2 instance or other error
    }

    // Try S3 bucket lookup
    try {
      const command = new ListBucketsCommand({});
      const result = await retryWithBackoff(async () => this.s3Client!.send(command));

      const bucket = result.Buckets?.find(b => b.Name === providerResourceId);
      if (bucket) {
        return {
          id: bucket.Name,
          name: bucket.Name,
          type: 's3',
          region: this.region,
          status: 'active',
          tags: {},
          spec: {
            creationDate: bucket.CreationDate,
          },
        };
      }
    } catch {
      // Not S3 or other error
    }

    return null;
  }
}
