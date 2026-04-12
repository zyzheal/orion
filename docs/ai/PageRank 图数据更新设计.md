# PageRank 根因定位的图数据更新机制设计

## 1. 概述

本设计文档定义服务调用图的数据采集、更新、存储及 PageRank 计算机制，确保故障根因定位的准确性和时效性。

---

## 2. 服务调用图数据源

### 2.1 数据采集架构

```
┌─────────────────────────────────────────────────────────────────┐
│                      数据采集层                                  │
├─────────────────┬─────────────────┬─────────────────────────────┤
│   Jaeger/Zipkin │   Prometheus    │      手动注册 API           │
│   (Trace 数据)   │   (指标数据)    │    (静态依赖配置)           │
└────────┬────────┴────────┬────────┴──────────────┬──────────────┘
         │                 │                       │
         ▼                 ▼                       ▼
┌─────────────────────────────────────────────────────────────────┐
│                    数据融合层                                    │
│   • Trace 解析 → 服务调用边 (Edge)                               │
│   • 指标关联 → 边权重 (成功率、延迟、QPS)                         │
│   • 手动注册 → 补充静态依赖/隐藏调用                             │
└─────────────────────────────────────────────────────────────────┘
```

### 2.2 数据源说明

| 数据源 | 采集内容 | 采集频率 | 用途 |
|--------|----------|----------|------|
| Jaeger/Zipkin | Span 调用链 | 实时流 | 服务调用关系发现 |
| Prometheus | 服务指标 | 15s/30s | 边权重计算 |
| 手动注册 | 静态依赖 | 按需 | 补充自动发现盲区 |

### 2.3 自动发现机制

```python
# Trace 数据解析示例
def parse_trace_to_edges(trace_data: dict) -> List[Edge]:
    edges = []
    for span in trace_data['spans']:
        caller = span['tags'].get('service.name', 'unknown')
        callee = span['references'][0].get('service.name') if span['references'] else None
        if callee:
            edges.append(Edge(
                src=caller,
                dst=callee,
                weight=1.0,
                metrics={
                    'latency_p99': span['duration'],
                    'status': span['tags'].get('status', 'OK')
                }
            ))
    return edges
```

---

## 3. 图更新机制

### 3.1 更新策略对比

| 策略 | 优点 | 缺点 | 适用场景 |
|------|------|------|----------|
| **全量更新** | 数据一致性好，实现简单 | 资源消耗大，延迟高 | 初始构建、图规模小 (<1000 节点) |
| **增量更新** | 资源消耗低，实时性好 | 实现复杂，需版本管理 | 生产环境持续更新 |

### 3.2 混合更新策略

```
┌──────────────────────────────────────────────────────────────┐
│                    更新调度器                                 │
├──────────────────────────────────────────────────────────────┤
│  • 每 5 分钟：增量更新 (Trace 新增/变更)                        │
│  • 每 30 分钟：全量校验 (一致性检查)                            │
│  • 故障时：触发立即更新                                        │
└──────────────────────────────────────────────────────────────┘
```

### 3.3 更新流程图

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│  定时触发   │────▶│ 采集 Trace   │────▶│ 数据清洗    │
└─────────────┘     └─────────────┘     └──────┬──────┘
                                               │
                  ┌────────────────────────────┘
                  ▼
         ┌─────────────────┐
         │   图版本检查     │
         │  (当前版本号 Vn) │
         └────────┬────────┘
                  │
        ┌─────────┴─────────┐
        │                   │
        ▼                   ▼
┌───────────────┐   ┌───────────────┐
│  增量更新模式  │   │  全量更新模式  │
│  (边变更 <10%)│   │  (边变更 ≥10%) │
└───────┬───────┘   └───────┬───────┘
        │                   │
        └─────────┬─────────┘
                  ▼
         ┌─────────────────┐
         │   生成新版本图   │
         │     (版本号 Vn+1)│
         └────────┬────────┘
                  │
                  ▼
         ┌─────────────────┐
         │   原子切换指针   │
         │   old → new     │
         └────────┬────────┘
                  │
                  ▼
         ┌─────────────────┐
         │   旧版本回收     │
         │   (保留最近 3 个)  │
         └─────────────────┘
```

### 3.4 图版本管理

```python
class GraphVersionManager:
    MAX_RETAINED_VERSIONS = 3
    
    def __init__(self):
        self.versions: Dict[str, Graph] = {}
        self.version_queue: Deque[str] = deque()
    
    def register_version(self, version_id: str, graph: Graph):
        """注册新版本图"""
        self.versions[version_id] = graph
        self.version_queue.append(version_id)
        
        # 回收旧版本
        while len(self.version_queue) > self.MAX_RETAINED_VERSIONS:
            old_version = self.version_queue.popleft()
            del self.versions[old_version]
    
    def get_version(self, version_id: str) -> Optional[Graph]:
        return self.versions.get(version_id)
    
    def get_current_version(self) -> str:
        return self.version_queue[-1] if self.version_queue else ""
```

---

## 4. 图存储方案

### 4.1 存储选型

| 方案 | 优点 | 缺点 | 推荐度 |
|------|------|------|--------|
| **Memgraph** | 内存图、兼容 Neo4j、高性能 | 需额外部署 | ⭐⭐⭐⭐ |
| **Neo4j** | 成熟稳定、生态完善 | 磁盘 IO 瓶颈 | ⭐⭐⭐ |
| **纯内存图** | 极致性能、简单 | 重启丢失、需持久化 | ⭐⭐⭐⭐ |

**推荐方案**: 纯内存图 + Redis 持久化 (故障定位场景要求低延迟，图规模可控)

### 4.2 图数据 Schema 定义

```
// 节点 (服务)
Node: Service {
    id: string           // 服务唯一标识，如 "order-service"
    name: string         // 服务显示名
    version: string      // 服务版本
    team: string         // 负责 teams
    health_score: float  // 健康分数 (0-1)
    last_updated: int64  // 最后更新时间戳
    tags: Map<string>    // 元数据标签
}

// 边 (服务调用)
Edge: CALLS {
    src: string          // 调用方服务 ID
    dst: string          // 被调用方服务 ID
    weight: float        // 调用权重 (基于 QPS)
    success_rate: float  // 成功率 (0-1)
    latency_p50: float   // P50 延迟 (ms)
    latency_p99: float   // P99 延迟 (ms)
    qps: float           // 每秒请求数
    error_rate: float    // 错误率
    last_updated: int64  // 最后更新时间戳
    protocol: string     // 调用协议 (HTTP/gRPC/...)
}
```

### 4.3 内存图数据结构

```python
@dataclass
class ServiceNode:
    id: str
    name: str
    version: str
    health_score: float = 1.0
    last_updated: int = 0
    tags: Dict[str, str] = field(default_factory=dict)
    
    # PageRank 相关
    pagerank_score: float = 0.0
    out_degree: int = 0
    in_degree: int = 0


@dataclass
class CallEdge:
    src: str
    dst: str
    weight: float = 1.0
    success_rate: float = 1.0
    latency_p99: float = 0.0
    qps: float = 0.0
    last_updated: int = 0
    protocol: str = "HTTP"


class ServiceGraph:
    def __init__(self, version: str):
        self.version = version
        self.nodes: Dict[str, ServiceNode] = {}
        self.adjacency: Dict[str, List[CallEdge]] = defaultdict(list)
        self.reverse_adjacency: Dict[str, List[str]] = defaultdict(list)
        self.created_at: int = int(time.time())
    
    def add_node(self, node: ServiceNode):
        self.nodes[node.id] = node
    
    def add_edge(self, edge: CallEdge):
        self.adjacency[edge.src].append(edge)
        self.reverse_adjacency[edge.dst].append(edge.src)
        
        # 更新节点度
        if edge.src in self.nodes:
            self.nodes[edge.src].out_degree += 1
        if edge.dst in self.nodes:
            self.nodes[edge.dst].in_degree += 1
    
    def get_neighbors(self, node_id: str) -> List[str]:
        return [edge.dst for edge in self.adjacency.get(node_id, [])]
    
    def get_incoming(self, node_id: str) -> List[str]:
        return self.reverse_adjacency.get(node_id, [])
```

### 4.4 索引优化

```python
class GraphIndex:
    def __init__(self):
        # 按健康分数索引 (快速定位不健康服务)
        self.health_index: SortedSet = SortedSet()  # (health_score, service_id)
        
        # 按 PageRank 分数索引 (快速排序)
        self.pagerank_index: SortedSet = SortedSet()  # (pagerank_score, service_id)
        
        # 按 QPS 索引 (快速定位高流量服务)
        self.qps_index: Dict[str, float] = {}  # service_id -> qps
    
    def update_health(self, service_id: str, health_score: float):
        if (health_score, service_id) in self.health_index:
            self.health_index.remove((health_score, service_id))
        self.health_index.add((health_score, service_id))
    
    def get_unhealthy_services(self, threshold: float = 0.7) -> List[str]:
        return [sid for score, sid in self.health_index if score < threshold]
```

---

## 5. PageRank 计算优化

### 5.1 增量 PageRank 算法

传统 PageRank 需全图迭代，增量 PageRank 只更新受影响节点:

```python
class IncrementalPageRank:
    def __init__(self, damping_factor: float = 0.85, max_iterations: int = 100, 
                 tolerance: float = 1e-6):
        self.d = damping_factor
        self.max_iter = max_iterations
        self.tol = tolerance
    
    def compute(self, graph: ServiceGraph) -> Dict[str, float]:
        """计算全量 PageRank"""
        n = len(graph.nodes)
        if n == 0:
            return {}
        
        # 初始化
        pagerank = {node_id: 1.0 / n for node_id in graph.nodes}
        
        for iteration in range(self.max_iter):
            new_pr = {}
            diff = 0.0
            
            for node_id in graph.nodes:
                # 从入边累加
                incoming_sum = 0.0
                for src_id in graph.get_incoming(node_id):
                    src_node = graph.nodes.get(src_id)
                    if src_node and src_node.out_degree > 0:
                        incoming_sum += pagerank[src_id] / src_node.out_degree
                
                # PageRank 公式
                new_pr[node_id] = (1 - self.d) / n + self.d * incoming_sum
                diff += abs(new_pr[node_id] - pagerank[node_id])
            
            pagerank = new_pr
            
            if diff < self.tol:
                break
        
        # 更新节点分数
        for node_id, score in pagerank.items():
            if node_id in graph.nodes:
                graph.nodes[node_id].pagerank_score = score
        
        return pagerank
    
    def compute_incremental(self, graph: ServiceGraph, 
                           changed_nodes: Set[str]) -> Dict[str, float]:
        """增量 PageRank - 只更新受影响节点"""
        # 找出受影响的节点 (变更节点及其邻居)
        affected = set(changed_nodes)
        for node_id in changed_nodes:
            affected.update(graph.get_neighbors(node_id))
            affected.update(graph.get_incoming(node_id))
        
        # 只对受影响子图进行迭代
        return self._compute_subgraph(graph, affected)
```

### 5.2 计算频率与缓存

```
┌─────────────────────────────────────────────────────────────┐
│                  PageRank 计算调度                           │
├─────────────────────────────────────────────────────────────┤
│  • 全量计算：每 15 分钟 (与图全量更新同步)                      │
│  • 增量计算：图更新后立即触发 (变更边 >5% 时)                 │
│  • 缓存层：Redis 缓存最近 3 次结果 (TTL: 30 分钟)               │
│  • 故障时：立即触发计算，跳过缓存                            │
└─────────────────────────────────────────────────────────────┘
```

### 5.3 PageRank 计算代码框架

```python
class PageRankService:
    def __init__(self, graph_store: GraphStore, cache: RedisCache):
        self.graph_store = graph_store
        self.cache = cache
        self.calculator = IncrementalPageRank()
        self.computation_lock = threading.Lock()
    
    def get_pagerank(self, force_recompute: bool = False) -> Dict[str, float]:
        """获取 PageRank 结果"""
        if not force_recompute:
            cached = self.cache.get("pagerank:latest")
            if cached:
                return cached
        
        with self.computation_lock:
            graph = self.graph_store.get_current_graph()
            pagerank = self.calculator.compute(graph)
            
            # 缓存结果
            self.cache.set("pagerank:latest", pagerank, ttl=1800)
            self.cache.set(f"pagerank:{graph.version}", pagerank, ttl=3600)
            
            return pagerank
    
    def get_root_cause_ranking(self, incident_services: List[str]) -> List[dict]:
        """故障根因排序 - 结合 PageRank 和健康度"""
        pagerank = self.get_pagerank()
        graph = self.graph_store.get_current_graph()
        
        candidates = []
        for service_id in incident_services:
            node = graph.nodes.get(service_id)
            if node:
                # 综合评分 = PageRank × (1 - 健康分数)
                # PageRank 高且不健康的服务更可能是根因
                combined_score = pagerank.get(service_id, 0) * (1 - node.health_score)
                candidates.append({
                    'service_id': service_id,
                    'pagerank': pagerank.get(service_id, 0),
                    'health_score': node.health_score,
                    'combined_score': combined_score,
                    'in_degree': node.in_degree,
                    'out_degree': node.out_degree
                })
        
        # 按综合分数降序排序
        candidates.sort(key=lambda x: x['combined_score'], reverse=True)
        return candidates
```

---

## 6. 故障场景处理

### 6.1 图数据过期检测

```python
class GraphFreshnessChecker:
    MAX_AGE_SECONDS = 600  # 10 分钟
    WARNING_AGE_SECONDS = 300  # 5 分钟
    
    def check(self, graph: ServiceGraph) -> Tuple[bool, str]:
        """检查图数据新鲜度"""
        current_time = int(time.time())
        graph_age = current_time - graph.created_at
        
        if graph_age > self.MAX_AGE_SECONDS:
            return False, f"图数据已过期 ({graph_age}s > {self.MAX_AGE_SECONDS}s)"
        elif graph_age > self.WARNING_AGE_SECONDS:
            return True, f"图数据即将过期 ({graph_age}s > {self.WARNING_AGE_SECONDS}s)"
        else:
            return True, "图数据新鲜"
    
    def check_trace_freshness(self, last_trace_time: int) -> bool:
        """检查 Trace 数据是否持续流入"""
        current_time = int(time.time())
        return (current_time - last_trace_time) < 300  # 5 分钟
```

### 6.2 降级策略

```
┌─────────────────────────────────────────────────────────────┐
│                    降级策略层次                               │
├─────────────────────────────────────────────────────────────┤
│  Level 0 (正常):  使用最新图数据 + 实时 PageRank              │
│  Level 1 (警告):  使用缓存 PageRank + 标记数据可能过期        │
│  Level 2 (降级):  使用历史最佳结果 + 明确提示用户            │
│  Level 3 (熔断):  返回空结果 + 建议人工排查                  │
└─────────────────────────────────────────────────────────────┘
```

```python
class DegradationHandler:
    def __init__(self):
        self.level = 0  # 0=normal, 1=warning, 2=degraded, 3=circuit_break
        self.last_valid_result: Optional[Dict] = None
    
    def get_with_degradation(self, compute_fn: Callable) -> dict:
        try:
            result = compute_fn()
            self.level = 0
            self.last_valid_result = result
            return {'data': result, 'degradation_level': 'normal'}
        except GraphExpiredError:
            self.level = 1
            if self.last_valid_result:
                return {
                    'data': self.last_valid_result,
                    'degradation_level': 'warning',
                    'message': '使用缓存结果，图数据可能过期'
                }
        except Exception as e:
            self.level = 3
            return {
                'data': None,
                'degradation_level': 'circuit_break',
                'message': f'服务不可用：{str(e)}'
            }
```

### 6.3 数据一致性保证

| 场景 | 保证机制 |
|------|----------|
| 更新中查询 | 双图切换，查询始终有可用图 |
| 版本回滚 | 保留最近 3 个版本，支持快速回滚 |
| 计算失败 | 使用缓存结果，记录告警 |
| 数据冲突 | 以版本号为准，高版本覆盖 |

---

## 7. 监控与告警

### 7.1 关键指标

| 指标名称 | 阈值 | 告警级别 |
|----------|------|----------|
| graph_freshness_seconds | > 600 | Warning |
| pagerank_computation_duration_seconds | > 60 | Warning |
| graph_update_failure_count | > 3/5min | Critical |
| cache_hit_ratio | < 0.5 | Info |

### 7.2 告警规则

```yaml
alerts:
  - name: GraphDataStale
    condition: graph_freshness_seconds > 600
    severity: warning
    message: "图数据超过 10 分钟未更新"
  
  - name: PageRankComputationSlow
    condition: pagerank_computation_duration_seconds > 60
    severity: warning
    message: "PageRank 计算耗时超过 60 秒"
  
  - name: GraphUpdateFailed
    condition: rate(graph_update_failures[5m]) > 0.6
    severity: critical
    message: "图更新连续失败"
```

---

## 8. 总结

本设计通过以下机制确保 PageRank 根因定位的准确性:

1. **多源数据采集**: Jaeger/Zipkin + Prometheus + 手动注册
2. **混合更新策略**: 5 分钟增量 + 30 分钟全量校验
3. **内存图存储**: 低延迟访问，支持版本管理
4. **增量 PageRank**: 降低计算开销，提升响应速度
5. **多级降级**: 确保故障时仍有可用结果
