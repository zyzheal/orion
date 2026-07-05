# Orion Service Helm Chart

通用 Go 微服务 Helm Chart，适用于所有 `orion-*-svc-go` 服务。

## 使用方法

```bash
# 部署单个服务
helm install orion-pipeline-svc-go ./infrastructure/helm/orion-service \
  -f ./infrastructure/helm/charts/orion-pipeline-svc-go/values.yaml \
  --namespace orion --create-namespace
```

## 覆盖 values

```bash
helm upgrade --install orion-pipeline-svc-go ./infrastructure/helm/orion-service \
  -f ./infrastructure/helm/charts/orion-pipeline-svc-go/values.yaml \
  --set replicaCount=3 \
  --set image.tag=v1.0.0 \
  --namespace orion
```

## 服务清单

`infrastructure/helm/charts/` 下包含 58 个服务的 values 文件，覆盖端口、镜像、资源等配置。

## 配置项

| Key | 说明 | 默认值 |
|-----|------|--------|
| nameOverride | 服务名称 | - |
| fullnameOverride | K8s 资源名称 | - |
| replicaCount | 副本数 | 2 |
| image.repository | 镜像仓库 | orion |
| image.tag | 镜像标签 | latest |
| service.port | Service 端口 | 从 values 文件 |
| autoscaling.enabled | 启用 HPA | true |
| nats.enabled | 注入 NATS 环境变量 | true |
| database.url | PostgreSQL URL | 服务专属 DB |
| health.path | 健康检查路径 | /healthz |
