/**
 * Artifact constants - shared type maps, label maps, and utility functions
 * Extracted from index.tsx, ArtifactTable.tsx, and ArtifactDetail.tsx
 * to eliminate duplication.
 */
import type { ArtifactStage, ArtifactStatus } from '@/api/artifacts';

// ---- Stage color & label maps ----

export const stageColorMap: Record<ArtifactStage, string> = {
  snapshot: 'default',
  release_candidate: 'blue',
  stable: 'green',
  production: 'gold',
  archived: 'orange',
};

export const stageLabelMap: Record<ArtifactStage, string> = {
  snapshot: 'Snapshot',
  release_candidate: 'RC',
  stable: 'Stable',
  production: 'Production',
  archived: 'Archived',
};

// ---- Status color map ----

export const statusColorMap: Record<ArtifactStatus, string> = {
  uploading: 'processing',
  available: 'success',
  deprecated: 'default',
  quarantined: 'error',
  deleted: 'default',
};

// ---- Type label map ----

export const typeLabelMap: Record<string, string> = {
  container_image: '容器镜像',
  base_image: '基础镜像',
  builder_image: '构建镜像',
  jar_artifact: 'JAR',
  war_artifact: 'WAR',
  npm_package: 'NPM',
  python_wheel: 'Python',
  go_module: 'Go',
  rust_crate: 'Rust',
  helm_chart: 'Helm Chart',
  terraform_module: 'Terraform',
  k8s_manifest: 'K8s Manifest',
  docker_compose: 'Docker Compose',
  test_report: '测试报告',
  coverage_report: '覆盖率报告',
  performance_report: '性能报告',
  sbom: 'SBOM',
  signature: '签名',
  security_scan_report: '安全扫描',
  api_doc: 'API 文档',
  changelog: '变更日志',
  release_notes: '发布说明',
};

// ---- Promotion stage order ----

export const promotionStageOrder: ArtifactStage[] = [
  'snapshot',
  'release_candidate',
  'stable',
  'production',
];

// ---- Utility: format byte size to human-readable string ----

export function formatSize(bytes: number): string {
  if (bytes >= 1073741824) return `${(bytes / 1073741824).toFixed(1)} GB`;
  if (bytes >= 1048576) return `${(bytes / 1048576).toFixed(1)} MB`;
  if (bytes >= 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${bytes} B`;
}
