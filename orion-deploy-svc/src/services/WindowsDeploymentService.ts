export interface WindowsDeploymentConfig {
  serviceName: string;
  image: string;
  port: number;
  envVars: Record<string, string>;
  replicas: number;
  healthCheckPath?: string;
  restartPolicy?: 'always' | 'on-failure' | 'never';
}

export interface WindowsDeploymentResult {
  success: boolean;
  deploymentId: string;
  serviceName: string;
  scriptPath: string;
  commands: string[];
  output?: string;
  error?: string;
}

/**
 * WindowsDeploymentService
 * Generates Windows-compatible deployment artifacts including
 * PowerShell scripts, Docker Compose configurations, and Windows service configs.
 */
export class WindowsDeploymentService {
  /**
   * Generate a PowerShell deployment script for the given config.
   */
  async generateDeploymentScript(config: WindowsDeploymentConfig): Promise<string> {
    const { serviceName, image, port, envVars, replicas, healthCheckPath, restartPolicy } = config;

    const escapePwsh = (s: string) => s.replace(/'/g, "''");
    const envBlock = Object.entries(envVars)
      .map(([k, v]) => `[Environment]::SetEnvironmentVariable('${escapePwsh(k)}', '${escapePwsh(v)}', 'Machine')`)
      .join('\n');

    const dockerCompose = `version: '3.8'
services:
  ${serviceName}:
    image: ${image}
    ports:
      - "${port}:${port}"
    restart: ${restartPolicy || 'always'}
    environment:${Object.entries(envVars).map(([k, v]) => `\n      - ${k}="${v.replace(/"/g, '\\"')}"`).join('')}
${healthCheckPath ? `    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:${port}${healthCheckPath}"]
      interval: 30s
      timeout: 10s
      retries: 3` : ''}
`;

    const powershellScript = `# Windows Deployment Script for ${serviceName}
# Generated at: ${new Date().toISOString()}
# DO NOT EDIT MANUALLY

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$ServiceName = "${serviceName}"
$Image = "${image}"
$Port = ${port}
$Replicas = ${replicas}

Write-Host "Deploying $ServiceName..." -ForegroundColor Green

# Set environment variables
${envBlock}

# Pull latest image
docker pull $Image

# Stop existing containers
docker compose -p $ServiceName down --remove-orphans 2>$null

# Deploy with docker compose
$dockerCompose = @'
${dockerCompose}
'@

$tempFile = [System.IO.Path]::GetTempFileName() + ".yml"
$dockerCompose | Set-Content -Path $tempFile
docker compose -f $tempFile -p $ServiceName up -d

if ($LASTEXITCODE -eq 0) {
    Write-Host "Deployment successful!" -ForegroundColor Green
    Remove-Item $tempFile -Force
} else {
    Write-Host "Deployment failed!" -ForegroundColor Red
    exit 1
}
`;

    return powershellScript;
  }

  /**
   * Deploy using Windows deployment strategy.
   * Generates the script and returns a deployment result.
   */
  async deploy(config: WindowsDeploymentConfig): Promise<WindowsDeploymentResult> {
    const script = await this.generateDeploymentScript(config);
    const deploymentId = `win-${crypto.randomUUID()}`;

    return {
      success: true,
      deploymentId,
      serviceName: config.serviceName,
      scriptPath: `./deployments/${config.serviceName}-${Date.now()}.ps1`,
      commands: ['docker pull', 'docker compose down', 'docker compose up -d'],
      output: script,
    };
  }

  /**
   * Validate a Windows deployment configuration.
   */
  async validateConfig(config: Partial<WindowsDeploymentConfig>): Promise<{ valid: boolean; errors: string[] }> {
    const errors: string[] = [];

    if (!config.serviceName || config.serviceName.length > 63) {
      errors.push('serviceName is required and must be <= 63 characters');
    }
    if (!config.image) {
      errors.push('image is required');
    }
    if (!config.port || config.port < 1 || config.port > 65535) {
      errors.push('port must be between 1 and 65535');
    }
    if (config.replicas !== undefined && (config.replicas < 1 || config.replicas > 10)) {
      errors.push('replicas must be between 1 and 10');
    }

    return { valid: errors.length === 0, errors };
  }
}
