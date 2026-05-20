/**
 * Pipeline 种子数据脚本
 * 通过 HTTP API 插入测试数据（绕过认证中间件）
 *
 * 使用方法: npx tsx scripts/seed-pipelines.ts
 */

import http from 'http';

const BASE_URL = 'http://localhost:3001';

function apiRequest(method: string, path: string, body?: any): Promise<any> {
  return new Promise((resolve, reject) => {
    const url = new URL(path, BASE_URL);
    const data = body ? JSON.stringify(body) : undefined;

    const options: http.RequestOptions = {
      hostname: url.hostname,
      port: url.port,
      path: url.pathname + url.search,
      method,
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': data ? Buffer.byteLength(data) : 0,
      },
    };

    const req = http.request(options, (res) => {
      let responseData = '';
      res.on('data', (chunk) => (responseData += chunk));
      res.on('end', () => {
        try {
          resolve(JSON.parse(responseData));
        } catch {
          resolve(responseData);
        }
      });
    });

    req.on('error', reject);
    if (data) req.write(data);
    req.end();
  });
}

// ========================================
// Pipeline YAML Definitions
// ========================================

const ciPipelineYaml = `name: CI/CD Pipeline
version: "1.0.0"
description: Standard CI/CD pipeline for web applications
spec:
  stages:
    - name: build
      type: build
      timeout: 600
      retryCount: 1
      config:
        script: |
          npm ci
          npm run build
        dockerImage: node:20-alpine
        env:
          NODE_ENV: production

    - name: unit-test
      type: test
      timeout: 900
      retryCount: 2
      dependsOn:
        - build
      config:
        script: |
          npm run test:unit -- --coverage
        dockerImage: node:20-alpine

    - name: security-scan
      type: scan
      timeout: 600
      retryCount: 1
      dependsOn:
        - build
      config:
        script: |
          npm audit --audit-level=high
        dockerImage: node:20-alpine

    - name: deploy-staging
      type: deploy
      timeout: 1200
      retryCount: 0
      dependsOn:
        - unit-test
        - security-scan
      config:
        script: |
          kubectl apply -f k8s/staging/
        dockerImage: bitnami/kubectl:latest
        env:
          KUBE_CONTEXT: staging

    - name: notify
      type: notify
      timeout: 60
      retryCount: 0
      dependsOn:
        - deploy-staging
      config:
        script: |
          curl -X POST \$SLACK_WEBHOOK_URL -d '{"text":"Deployed to staging"}'
        dockerImage: curlimages/curl`;

const buildxYaml = `name: Multi-Arch Build
version: "2.1.0"
description: Cross-platform container image build pipeline
spec:
  stages:
    - name: checkout
      type: build
      timeout: 300
      retryCount: 1
      config:
        script: |
          git clone \$REPO_URL .
        dockerImage: alpine/git

    - name: buildx
      type: buildx
      timeout: 1800
      retryCount: 1
      dependsOn:
        - checkout
      config:
        imageName: myapp
        tag: latest
        platforms:
          - linux/amd64
          - linux/arm64
        dockerfile: Dockerfile
        push: true

    - name: integration-test
      type: test
      timeout: 600
      retryCount: 1
      dependsOn:
        - buildx
      config:
        script: |
          docker compose up -d
          npm run test:e2e
          docker compose down
        dockerImage: node:20-alpine`;

const dbMigrationYaml = `name: DB Migration Pipeline
version: "1.2.0"
description: Automated database migration with rollback support
spec:
  stages:
    - name: backup
      type: custom
      timeout: 1800
      retryCount: 0
      config:
        script: |
          pg_dump -h \$DB_HOST -U \$DB_USER \$DB_NAME > /tmp/backup.sql
        dockerImage: postgres:16-alpine
        env:
          DB_HOST: prod-db.internal
          DB_NAME: orion

    - name: migrate
      type: custom
      timeout: 900
      retryCount: 0
      dependsOn:
        - backup
      config:
        script: |
          node node_modules/.bin/knex migrate:latest
        dockerImage: node:20-alpine

    - name: verify
      type: test
      timeout: 300
      retryCount: 1
      dependsOn:
        - migrate
      config:
        script: |
          node scripts/verify-migration.js
        dockerImage: node:20-alpine

    - name: notify-success
      type: notify
      timeout: 60
      retryCount: 0
      dependsOn:
        - verify
      config:
        script: |
          curl -X POST \$SLACK_WEBHOOK_URL -d '{"text":"DB migration completed"}'
        dockerImage: curlimages/curl`;

const containerYaml = `name: Container Test Pipeline
version: "1.0.0"
description: Run containerized tests with resource limits
spec:
  stages:
    - name: performance-test
      type: container
      timeout: 1800
      retryCount: 1
      config:
        image: loadimpact/k6:latest
        command: ["k6", "run", "perf-test.js"]
        args: []
        env:
          TARGET_URL: https://staging.example.com
        resources:
          cpu: "2"
          memory: "4Gi"
          gpu: "0"
        networkMode: bridge

    - name: load-test
      type: container
      timeout: 3600
      retryCount: 0
      dependsOn:
        - performance-test
      config:
        image: loadimpact/k6:latest
        command: ["k6", "run", "--vus", "100", "--duration", "10m", "load-test.js"]
        resources:
          cpu: "4"
          memory: "8Gi"
        networkMode: host`;

const inactiveYaml = `name: Legacy Deploy Pipeline
version: "0.9.0"
description: Deprecated pipeline - replaced by CI/CD Pipeline
spec:
  stages:
    - name: old-build
      type: build
      timeout: 600
      config:
        script: npm install && npm run build`;

// ========================================
// Seed Data
// ========================================

async function seed() {
  console.log('Creating Pipeline test data...\n');

  const pipelines = [
    { name: 'CI/CD Pipeline', yaml: ciPipelineYaml, desc: 'Standard CI/CD pipeline for web applications' },
    { name: 'Multi-Arch Build', yaml: buildxYaml, desc: 'Cross-platform container image build pipeline' },
    { name: 'DB Migration Pipeline', yaml: dbMigrationYaml, desc: 'Automated database migration with rollback support' },
    { name: 'Container Test Pipeline', yaml: containerYaml, desc: 'Run containerized tests with resource limits' },
    { name: 'Legacy Deploy Pipeline', yaml: inactiveYaml, desc: 'Deprecated pipeline - replaced by CI/CD Pipeline' },
  ];

  const createdIds: string[] = [];

  for (const p of pipelines) {
    console.log(`Creating: ${p.name}...`);
    try {
      const result = await apiRequest('POST', '/api/v1/pipelines', {
        name: p.name,
        version: '1.0.0',
        description: p.desc,
        yamlDefinition: p.yaml,
      });

      const id = result?.id || result?.data?.id;
      if (id) {
        createdIds.push(id);
        console.log(`  Created: ${id}`);
      } else {
        console.log(`  Response: ${JSON.stringify(result).slice(0, 200)}`);
      }
    } catch (err: any) {
      console.log(`  Error: ${err.message}`);
    }
  }

  console.log(`\nDone! Created ${createdIds.length} pipelines.`);
  if (createdIds.length > 0) {
    console.log('Verify: curl http://localhost:3001/api/v1/pipelines');
  }
}

seed().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
