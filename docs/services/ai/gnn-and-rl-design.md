# GNN 与强化学习在 Orion 平台的应用设计

> 版本：v1.0  
> 创建日期：2026-04-10  
> 负责人：算法团队  
> 适用范围：根因分析、异常检测、自愈决策、部署策略优化

---

## 一、概述

### 1.1 设计目的

本文档定义 Orion 平台中图神经网络 (GNN) 和强化学习 (RL) 技术的应用场景、模型架构、训练策略及与现有 PageRank 算法的集成方案。

### 1.2 核心应用场景

| 场景 | 技术 | 目标 | 预期收益 |
|------|------|------|---------|
| 根因分析 | GNN | 在服务依赖图上定位故障源头 | MTTR 降低 40% |
| 异常检测 | GNN | 学习系统指标的正常模式 | 误报率降低 50% |
| 自愈决策 | RL | 学习最优的故障响应动作 | 自动恢复率 70%+ |
| 部署策略 | RL | 学习最佳部署时机和灰度参数 | 发布故障降低 60% |

### 1.3 与现有系统集成关系

```
┌─────────────────────────────────────────────────────────────────┐
│                        Orion AI 架构                             │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌─────────────┐     ┌─────────────┐     ┌─────────────┐       │
│  │  数据采集层  │     │  特征工程层  │     │  模型服务层  │       │
│  │             │     │             │     │             │       │
│  │  • Jaeger   │────▶│  • 图特征   │────▶│  • GNN      │       │
│  │  • Prometheus│    │  • 时序特征  │     │  • RL Agent │       │
│  │  • Trace    │     │  • 统计特征  │     │  • PageRank │       │
│  └─────────────┘     └─────────────┘     └──────┬──────┘       │
│                                                  │              │
│                     ┌────────────────────────────┘              │
│                     ▼                                           │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │                    决策输出层                            │   │
│  │  • 根因服务排序  • 异常告警  • 自愈动作  • 部署建议       │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## 二、GNN 用于根因分析

### 2.1 问题建模

将服务调用图建模为有向加权图 $G = (V, E)$：
- **节点 $v \in V$**：服务实例，包含特征向量 $x_v$（延迟、错误率、QPS 等）
- **边 $e \in E$**：服务调用关系，包含权重（调用频次、成功率等）
- **目标**：学习节点嵌入 $h_v$，预测每个节点是根因的概率

### 2.2 模型架构

采用 **GraphSAGE** 架构（支持动态图、可归纳学习）：

```python
import torch
import torch.nn as nn
import torch.nn.functional as F
from torch_geometric.nn import SAGEConv

class RootCauseGNN(nn.Module):
    """
    基于 GraphSAGE 的根因分析模型
    """
    def __init__(self, node_feat_dim: int, edge_feat_dim: int, 
                 hidden_dim: int = 128, num_layers: int = 3):
        super().__init__()
        
        # 边特征编码器
        self.edge_encoder = nn.Sequential(
            nn.Linear(edge_feat_dim, hidden_dim),
            nn.ReLU(),
            nn.Linear(hidden_dim, hidden_dim)
        )
        
        # GraphSAGE 卷积层
        self.conv_layers = nn.ModuleList()
        for i in range(num_layers):
            in_dim = hidden_dim if i > 0 else node_feat_dim
            self.conv_layers.append(SAGEConv(in_dim, hidden_dim))
        
        # 分类头
        self.classifier = nn.Sequential(
            nn.Linear(hidden_dim, hidden_dim // 2),
            nn.ReLU(),
            nn.Dropout(0.3),
            nn.Linear(hidden_dim // 2, 1),
            nn.Sigmoid()
        )
    
    def forward(self, x, edge_index, edge_attr, batch=None):
        """
        Args:
            x: 节点特征 [N, node_feat_dim]
            edge_index: 边索引 [2, E]
            edge_attr: 边特征 [E, edge_feat_dim]
            batch: 批处理索引 (多图输入时使用)
        """
        # 边特征编码
        edge_emb = self.edge_encoder(edge_attr)
        
        # 消息传递
        h = x
        for conv in self.conv_layers:
            h = conv(h, edge_index)
            h = F.relu(h)
            h = F.dropout(h, p=0.2, training=self.training)
        
        # 输出根因概率
        out = self.classifier(h)
        return out
```

### 2.3 节点与边特征定义

```python
# 节点特征 (服务级别)
NODE_FEATURES = {
    # 健康度指标
    'health_score': 'float',          # 健康分数 0-1
    'error_rate': 'float',            # 错误率
    'latency_p99': 'float',           # P99 延迟
    'latency_p50': 'float',           # P50 延迟
    'qps': 'float',                   # 每秒请求数
    'saturation': 'float',            # 资源饱和度 (CPU/Memory)
    
    # 拓扑特征
    'in_degree': 'int',               # 入度 (被多少服务调用)
    'out_degree': 'int',              # 出度 (调用多少服务)
    'pagerank_score': 'float',        # PageRank 中心性
    'betweenness': 'float',           # 介数中心性
    
    # 变更特征
    'recent_deploy': 'bool',          # 24h 内是否部署
    'config_changed': 'bool',         # 配置是否变更
    'dependency_changed': 'bool',     # 依赖是否变更
    
    # 历史特征
    'failure_count_7d': 'int',        # 近 7 天故障次数
    'mtbf_days': 'float',             # 平均故障间隔
}

# 边特征 (调用关系)
EDGE_FEATURES = {
    'success_rate': 'float',          # 调用成功率
    'latency_p99': 'float',           # 调用 P99 延迟
    'qps': 'float',                   # 调用 QPS
    'error_count_5m': 'int',          # 5 分钟内错误数
    'timeout_rate': 'float',          # 超时率
    'protocol_type': 'embedding',     # 协议类型 (HTTP/gRPC/...)
}
```

### 2.4 训练数据构建

```python
class RootCauseDataset:
    """
    根因分析训练数据集
    从历史故障工单中构建 (服务图快照 + 标注的根因节点)
    """
    
    def __init__(self, incident_db: IncidentDatabase):
        self.incidents = incident_db.get_all_incidents()
    
    def build_training_sample(self, incident: Incident) -> GraphData:
        """
        构建单个训练样本
        """
        # 获取故障时刻的服务图快照
        graph_snapshot = self._get_graph_at_time(
            incident.service_graph_id, 
            incident.start_time
        )
        
        # 构建 PyTorch Geometric 图数据
        data = Data(
            x=self._extract_node_features(graph_snapshot),
            edge_index=self._extract_edges(graph_snapshot),
            edge_attr=self._extract_edge_features(graph_snapshot),
            y=self._build_labels(graph_snapshot, incident.root_cause_services)
        )
        
        return data
    
    def _build_labels(self, graph: ServiceGraph, 
                      root_causes: List[str]) -> torch.Tensor:
        """
        构建二分类标签：根因服务=1，其他=0
        """
        labels = torch.zeros(len(graph.nodes))
        for node_id, idx in graph.node_to_idx.items():
            if node_id in root_causes:
                labels[idx] = 1.0
        return labels
```

### 2.5 损失函数与训练

```python
class RootCauseLoss(nn.Module):
    """
    根因分析损失函数
    处理正负样本不均衡问题
    """
    def __init__(self, pos_weight: float = 5.0):
        super().__init__()
        self.pos_weight = pos_weight
    
    def forward(self, pred: torch.Tensor, target: torch.Tensor) -> torch.Tensor:
        # 加权 BCE Loss (根因样本权重更高)
        weight = torch.where(target > 0.5, 
                            torch.tensor(self.pos_weight),
                            torch.tensor(1.0))
        loss = F.binary_cross_entropy(pred, target, reduction='none')
        return (loss * weight).mean()


# 训练配置
TRAIN_CONFIG = {
    'batch_size': 32,
    'learning_rate': 1e-3,
    'weight_decay': 1e-5,
    'epochs': 100,
    'early_stopping_patience': 10,
    'pos_weight': 5.0,  # 根因样本权重
}
```

---

## 三、GNN 用于异常检测

### 3.1 问题建模

学习系统指标的"正常模式"，检测偏离正常模式的异常：
- **输入**：时序图数据（每个时间片的图快照）
- **输出**：异常分数（每个节点和整体图）
- **方法**：图自编码器 + 时序建模

### 3.2 模型架构

```python
import torch
from torch_geometric.nn import GCNConv
from torch_geometric.temporal import DCRNN

class GraphAnomalyDetector(nn.Module):
    """
    基于时空图神经网络的异常检测模型
    结合 GCN (空间) + GRU (时序)
    """
    def __init__(self, node_feat_dim: int, hidden_dim: int = 64,
                 num_nodes: int = None, window_size: int = 12):
        super().__init__()
        
        self.hidden_dim = hidden_dim
        self.window_size = window_size
        
        # 空间编码器 (GCN)
        self.gcn_encoder = nn.Sequential(
            GCNConv(node_feat_dim, hidden_dim),
            nn.ReLU(),
            GCNConv(hidden_dim, hidden_dim),
        )
        
        # 时序建模 (GRU)
        self.temporal_encoder = nn.GRU(
            input_size=hidden_dim,
            hidden_size=hidden_dim,
            num_layers=2,
            batch_first=True
        )
        
        # 解码器 (重构输入)
        self.decoder = nn.Sequential(
            nn.Linear(hidden_dim, hidden_dim),
            nn.ReLU(),
            nn.Linear(hidden_dim, node_feat_dim)
        )
        
        # 异常分数头
        self.anomaly_head = nn.Sequential(
            nn.Linear(hidden_dim, 32),
            nn.ReLU(),
            nn.Linear(32, 1),
            nn.Sigmoid()
        )
    
    def forward(self, x_seq: torch.Tensor, edge_index: torch.Tensor):
        """
        Args:
            x_seq: 节点特征序列 [B, T, N, F] (B=批, T=时间步, N=节点数, F=特征)
            edge_index: 图结构 [2, E]
        Returns:
            anomaly_scores: 异常分数 [B, N]
            reconstruction_error: 重构误差 [B, N, F]
        """
        B, T, N, F = x_seq.shape
        
        # 空间编码 (每个时间步独立)
        x_seq = x_seq.view(B * T, N, F)
        edge_idx_batch = self._batch_edge_index(edge_index, B, T)
        
        h = self.gcn_encoder(x_seq, edge_idx_batch)  # [B*T, N, hidden]
        h = h.view(B, T, N, self.hidden_dim)
        
        # 时序编码
        h_temporal, _ = self.temporal_encoder(h)  # [B, T, N, hidden]
        
        # 使用最后时间步的隐藏状态
        h_final = h_temporal[:, -1, :, :]  # [B, N, hidden]
        
        # 异常分数
        anomaly_scores = self.anomaly_head(h_final).squeeze(-1)
        
        # 重构误差 (用于自监督训练)
        reconstructed = self.decoder(h_final)
        reconstruction_error = F.mse_loss(reconstructed, x_seq[:, -1, :, :], 
                                          reduction='none')
        
        return anomaly_scores, reconstruction_error
```

### 3.3 异常检测流程

```
┌─────────────────────────────────────────────────────────────────┐
│                    异常检测流程                                  │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐      │
│  │  指标采集     │    │  图构建       │    │  模型推理     │      │
│  │              │    │              │    │              │      │
│  │  Prometheus  │───▶│  构建图快照   │───▶│  GNN 推理     │      │
│  │  (15s/30s)   │    │  (N 个节点)   │    │  异常分数     │      │
│  └──────────────┘    └──────────────┘    └──────┬───────┘      │
│                                                  │              │
│                     ┌────────────────────────────┘              │
│                     ▼                                           │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │                    异常判定                              │   │
│  │  • 动态阈值 (基于历史分位数)                              │   │
│  │  • 持续时间过滤 (>3 个时间窗口)                            │   │
│  │  • 关联聚合 (同服务多实例异常 → 服务级异常)                │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### 3.4 动态阈值计算

```python
class AdaptiveThreshold:
    """
    自适应阈值计算
    基于滑动窗口的历史分位数
    """
    def __init__(self, window_hours: int = 24, percentile: float = 99.0):
        self.window_hours = window_hours
        self.percentile = percentile
        self.history: Dict[str, Deque[float]] = defaultdict(
            lambda: deque(maxlen=window_hours * 4)  # 15s 间隔
        )
    
    def update(self, service_id: str, score: float):
        self.history[service_id].append(score)
    
    def get_threshold(self, service_id: str) -> Optional[float]:
        scores = self.history[service_id]
        if len(scores) < 100:  # 至少需要 100 个样本
            return None
        return np.percentile(scores, self.percentile)
    
    def is_anomaly(self, service_id: str, score: float, 
                   min_duration: int = 3) -> bool:
        """
        判定异常：连续超过阈值
        """
        threshold = self.get_threshold(service_id)
        if threshold is None:
            return False
        
        recent = list(self.history[service_id])[-min_duration:]
        return all(s > threshold for s in recent)
```

---

## 四、强化学习用于自愈决策

### 4.1 问题建模

将故障自愈建模为 MDP (马尔可夫决策过程)：
- **状态 $s_t$**：当前系统状态（服务健康度、告警、资源使用）
- **动作 $a_t$**：可执行的自愈动作
- **奖励 $r_t$**：基于 MTTR、恢复成功率、副作用计算

### 4.2 动作空间定义

```python
from enum import Enum
from dataclasses import dataclass

class HealActionType(Enum):
    RESTART_POD = "restart_pod"
    ROLLBACK_DEPLOY = "rollback_deploy"
    SCALE_UP = "scale_up"
    TRAFFIC_SHIFT = "traffic_shift"
    CIRCUIT_BREAK = "circuit_break"
    CACHE_FLUSH = "cache_flush"
    DB_FAILOVER = "db_failover"
    CONFIG_RELOAD = "config_reload"


@dataclass
class HealAction:
    action_type: HealActionType
    target_service: str
    parameters: Dict[str, Any]
    estimated_risk: float  # 0-1, 动作风险
    estimated_success: float  # 0-1, 预估成功率


# 动作空间
ACTION_SPACE = {
    HealActionType.RESTART_POD: {
        'description': '重启故障 Pod',
        'risk': 0.2,
        'success_rate': 0.85,
        'mttr_impact': -300,  # 预期减少 MTTR 秒数
        'applicable_scenarios': ['oom', 'deadlock', 'stuck']
    },
    HealActionType.ROLLBACK_DEPLOY: {
        'description': '回滚到上一版本',
        'risk': 0.4,
        'success_rate': 0.75,
        'mttr_impact': -600,
        'applicable_scenarios': ['deploy_failure', 'regression']
    },
    HealActionType.SCALE_UP: {
        'description': '扩容实例',
        'risk': 0.1,
        'success_rate': 0.80,
        'mttr_impact': -180,
        'applicable_scenarios': ['overload', 'high_latency']
    },
    HealActionType.TRAFFIC_SHIFT: {
        'description': '流量切到备用',
        'risk': 0.3,
        'success_rate': 0.90,
        'mttr_impact': -120,
        'applicable_scenarios': ['instance_failure', 'zone_failure']
    },
    HealActionType.CIRCUIT_BREAK: {
        'description': '熔断下游依赖',
        'risk': 0.3,
        'success_rate': 0.70,
        'mttr_impact': -240,
        'applicable_scenarios': ['cascade_failure', 'dependency_timeout']
    },
}
```

### 4.3 RL 模型架构 (PPO)

```python
import torch.nn as nn
from torch.distributions import Categorical

class PPOHealingAgent(nn.Module):
    """
    基于 PPO 的自愈决策 Agent
    """
    def __init__(self, state_dim: int, action_dim: int, 
                 hidden_dim: int = 256):
        super().__init__()
        
        # Actor 网络 (策略)
        self.actor = nn.Sequential(
            nn.Linear(state_dim, hidden_dim),
            nn.ReLU(),
            nn.Linear(hidden_dim, hidden_dim),
            nn.ReLU(),
            nn.Linear(hidden_dim, action_dim),
            nn.Softmax(dim=-1)
        )
        
        # Critic 网络 (价值)
        self.critic = nn.Sequential(
            nn.Linear(state_dim, hidden_dim),
            nn.ReLU(),
            nn.Linear(hidden_dim, hidden_dim),
            nn.ReLU(),
            nn.Linear(hidden_dim, 1)
        )
    
    def select_action(self, state: torch.Tensor, 
                      mask: torch.Tensor = None) -> tuple:
        """
        选择动作
        Args:
            state: 当前状态 [state_dim]
            mask: 动作掩码 (不可用动作=0, 可用=1)
        Returns:
            action: 选择的动作索引
            log_prob: 对数概率
            value: 状态价值
        """
        action_probs = self.actor(state)
        
        # 应用动作掩码 (某些场景下某些动作不可用)
        if mask is not None:
            action_probs = action_probs * mask
            action_probs = action_probs / action_probs.sum()
        
        dist = Categorical(action_probs)
        action = dist.sample()
        
        return action.item(), dist.log_prob(action), self.critic(state)
    
    def evaluate_actions(self, state: torch.Tensor, 
                         actions: torch.Tensor) -> tuple:
        """评估已有动作 (用于 PPO 更新)"""
        action_probs = self.actor(state)
        dist = Categorical(action_probs)
        
        return (
            dist.log_prob(actions),
            dist.entropy().mean(),
            self.critic(state)
        )
```

### 4.4 状态表示

```python
@dataclass
class HealState:
    """
    自愈决策状态
    """
    # 服务健康度 (每个服务 0-1)
    service_health: Dict[str, float]
    
    # 告警信息
    active_alerts: List[Alert]
    
    # 资源使用
    resource_usage: Dict[str, ResourceMetrics]
    
    # 近期动作历史
    recent_actions: List[HealAction]
    
    # 故障持续时间
    incident_duration_seconds: int
    
    def to_tensor(self) -> torch.Tensor:
        """
        将状态转换为模型输入张量
        """
        features = []
        
        # 服务健康度特征
        for service_id in self.known_services:
            health = self.service_health.get(service_id, 1.0)
            features.append(health)
        
        # 告警计数
        features.append(len(self.active_alerts))
        
        # 告警严重程度分布
        severity_dist = [0, 0, 0, 0]  # P0-P3
        for alert in self.active_alerts:
            severity_dist[alert.severity] += 1
        features.extend(severity_dist)
        
        # 资源使用
        for service_id in self.known_services:
            metrics = self.resource_usage.get(service_id)
            if metrics:
                features.append(metrics.cpu_usage)
                features.append(metrics.memory_usage)
            else:
                features.extend([0.5, 0.5])
        
        # 故障持续时间 (归一化)
        features.append(min(self.incident_duration_seconds / 3600, 1.0))
        
        # 近期动作编码
        recent_action_types = [0] * len(HealActionType)
        for action in self.recent_actions[-5:]:
            recent_action_types[action.action_type.value] = 1
        features.extend(recent_action_types)
        
        return torch.tensor(features, dtype=torch.float32)
```

### 4.5 奖励函数设计

```python
class HealingReward:
    """
    自愈奖励函数
    """
    def __init__(self):
        # 奖励权重
        self.w_recovery = 100.0      # 恢复奖励
        self.w_time = -0.1           # 时间惩罚 (每秒)
        self.w_side_effect = -50.0   # 副作用惩罚
        self.w_action_cost = -5.0    # 动作执行成本
        self.w_recurrence = -100.0   # 复发惩罚
    
    def compute_reward(self, 
                       before_state: HealState,
                       after_state: HealState,
                       action: HealAction,
                       action_duration: float,
                       side_effects: List[str],
                       recurrence: bool) -> float:
        """
        计算单次动作的奖励
        
        Args:
            before_state: 动作前状态
            after_state: 动作后状态
            action: 执行的动作
            action_duration: 动作执行时长 (秒)
            side_effects: 副作用列表
            recurrence: 是否在 1 小时内复发
        """
        reward = 0.0
        
        # 恢复奖励：健康度提升
        health_improvement = (
            sum(after_state.service_health.values()) - 
            sum(before_state.service_health.values())
        ) / len(before_state.service_health)
        reward += self.w_recovery * max(0, health_improvement)
        
        # 时间惩罚
        reward += self.w_time * action_duration
        
        # 动作成本
        reward += self.w_action_cost * action.estimated_risk
        
        # 副作用惩罚
        reward += self.w_side_effect * len(side_effects)
        
        # 复发惩罚
        if recurrence:
            reward += self.w_recurrence
        
        # 完全恢复额外奖励
        if all(h > 0.95 for h in after_state.service_health.values()):
            reward += 50.0
        
        return reward
```

### 4.6 训练环境

```python
class HealingEnv:
    """
    自愈决策训练环境
    """
    def __init__(self, incident_scenarios: List[IncidentScenario]):
        self.scenarios = incident_scenarios
        self.current_scenario = None
        self.step_count = 0
        self.max_steps = 50
        
    def reset(self) -> HealState:
        """重置环境"""
        self.current_scenario = random.choice(self.scenarios)
        self.step_count = 0
        return self.current_scenario.initial_state
    
    def step(self, action: HealAction) -> Tuple[HealState, float, bool, dict]:
        """
        执行动作，返回新状态、奖励、是否结束、额外信息
        """
        self.step_count += 1
        
        # 模拟动作执行
        next_state, outcome = self._simulate_action(action)
        
        # 计算奖励
        reward = self._compute_step_reward(action, outcome)
        
        # 检查是否结束
        done = (
            outcome.success or 
            outcome.catastrophic or
            self.step_count >= self.max_steps
        )
        
        info = {
            'outcome': outcome,
            'steps_taken': self.step_count
        }
        
        return next_state, reward, done, info
    
    def _simulate_action(self, action: HealAction) -> Tuple[HealState, Outcome]:
        """
        模拟动作执行 (基于历史数据统计模型)
        """
        # 从历史数据中查找相似场景的成功率
        base_success = ACTION_SPACE[action.action_type]['success_rate']
        
        # 根据当前状态调整成功率
        context_factor = self._compute_context_factor(action)
        adjusted_success = base_success * context_factor
        
        # 随机判定结果
        success = random.random() < adjusted_success
        
        return self._apply_action_outcome(action, success)
```

---

## 五、强化学习用于部署策略

### 5.1 问题建模

学习最优的部署时机和灰度发布参数：
- **状态**：系统负载、变更风险评分、时间特征
- **动作**：部署时机、灰度比例、观察时长
- **奖励**：发布成功率、故障率、用户影响

### 5.2 动作空间

```python
@dataclass
class DeployAction:
    """部署动作"""
    # 部署时机
    deploy_time: datetime  # 何时部署
    
    # 灰度参数
    initial_percentage: float  # 初始灰度比例 (0.01-0.1)
    step_percentage: float     # 每次提升比例
    step_interval_minutes: int # 每步间隔分钟
    observe_metrics: List[str] # 观察的指标
    
    # 回滚条件
    auto_rollback: bool        # 是否自动回滚
    rollback_threshold: float  # 回滚阈值


# 离散化的动作选项
DEPLOY_ACTIONS = {
    'conservative': {
        'initial_percentage': 0.01,
        'step_percentage': 0.05,
        'step_interval_minutes': 30,
        'observe_metrics': ['error_rate', 'latency_p99', 'success_rate'],
        'auto_rollback': True,
        'rollback_threshold': 0.01
    },
    'balanced': {
        'initial_percentage': 0.05,
        'step_percentage': 0.15,
        'step_interval_minutes': 15,
        'observe_metrics': ['error_rate', 'latency_p95'],
        'auto_rollback': True,
        'rollback_threshold': 0.05
    },
    'aggressive': {
        'initial_percentage': 0.1,
        'step_percentage': 0.3,
        'step_interval_minutes': 10,
        'observe_metrics': ['error_rate'],
        'auto_rollback': True,
        'rollback_threshold': 0.1
    }
}
```

### 5.3 状态特征

```python
@dataclass
class DeployState:
    """部署决策状态"""
    
    # 变更特征
    change_risk_score: float      # XGBoost 风险评分
    affected_services: int        # 影响服务数
    has_db_migration: bool        # 是否有 DB 变更
    has_breaking_change: bool     # 是否有破坏性变更
    
    # 系统负载
    system_load: float            # 整体负载 (0-1)
    error_rate_baseline: float    # 当前错误率基线
    traffic_level: float          # 流量水平 (0-1)
    
    # 时间特征
    hour_of_day: int              # 当前小时
    day_of_week: int              # 星期几
    is_holiday_period: bool       # 是否节假日
    
    # 历史表现
    team_success_rate: float      # 团队历史成功率
    recent_failures: int          # 近期失败次数
```

### 5.4 奖励函数

```python
class DeployReward:
    """部署奖励函数"""
    
    def compute_reward(self, outcome: DeployOutcome) -> float:
        reward = 0.0
        
        if outcome.success:
            # 成功部署奖励
            reward += 100.0
            
            # 部署时长奖励 (越快越好)
            duration_bonus = max(0, 60 - outcome.duration_minutes) / 60
            reward += 20.0 * duration_bonus
            
            # 灰度效率奖励
            if outcome.granularity_score > 0.8:
                reward += 10.0
        else:
            # 失败惩罚
            reward -= 200.0
            
            # 影响用户数惩罚
            reward -= outcome.affected_users / 1000
            
            # 回滚时间惩罚
            reward -= outcome.rollback_duration_minutes * 0.5
        
        return reward
```

---

## 六、与现有 PageRank 算法集成

### 6.1 集成架构

```
┌─────────────────────────────────────────────────────────────────┐
│              PageRank + GNN 融合架构                             │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌─────────────────┐              ┌─────────────────┐          │
│  │   PageRank      │              │     GNN         │          │
│  │   (结构重要性)   │              │   (特征学习)     │          │
│  │                 │              │                 │          │
│  │  • 全局拓扑     │              │  • 节点特征     │          │
│  │  • 影响力传播   │              │  • 边权重       │          │
│  │  • 静态分数     │              │  • 动态模式     │          │
│  └────────┬────────┘              └────────┬────────┘          │
│           │                                │                    │
│           │         ┌──────────────────────┤                    │
│           │         │                      │                    │
│           ▼         ▼                      ▼                    │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │                   融合层                                 │   │
│  │   combined_score = α * pagerank + β * gnnscore          │   │
│  │   + γ * health + δ * recency                            │   │
│  └─────────────────────────────────────────────────────────┘   │
│           │                                                     │
│           ▼                                                     │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │                   根因排序输出                           │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### 6.2 融合算法

```python
class RootCauseRanker:
    """
    PageRank + GNN 融合根因排序器
    """
    def __init__(self, 
                 pagerank_weight: float = 0.3,
                 gnn_weight: float = 0.4,
                 health_weight: float = 0.2,
                 recency_weight: float = 0.1):
        self.alpha = pagerank_weight
        self.beta = gnn_weight
        self.gamma = health_weight
        self.delta = recency_weight
        
        self.pagerank_service = PageRankService()
        self.gnn_model = RootCauseGNN(...)
    
    def rank(self, graph: ServiceGraph, 
             incident_services: List[str]) -> List[dict]:
        """
        融合排序
        
        Returns:
            排序后的根因候选列表
        """
        # 1. 获取 PageRank 分数
        pagerank = self.pagerank_service.get_pagerank()
        
        # 2. GNN 推理获取根因概率
        gnnscores = self._run_gnn_inference(graph)
        
        # 3. 计算综合分数
        candidates = []
        for service_id in incident_services:
            node = graph.nodes.get(service_id)
            if not node:
                continue
            
            pr_score = pagerank.get(service_id, 0)
            gnn_score = gnnscores.get(service_id, 0)
            health = node.health_score
            
            # 归一化
            pr_norm = self._normalize(pr_score)
            gnn_norm = self._normalize(gnn_score)
            health_norm = 1 - health  # 健康度越低越可疑
            
            # 综合分数
            combined = (
                self.alpha * pr_norm +
                self.beta * gnn_norm +
                self.gamma * health_norm +
                self.delta * self._recency_score(service_id)
            )
            
            candidates.append({
                'service_id': service_id,
                'pagerank': pr_score,
                'gnn_score': gnn_score,
                'health_score': health,
                'combined_score': combined
            })
        
        # 按综合分数降序排序
        candidates.sort(key=lambda x: x['combined_score'], reverse=True)
        return candidates
```

### 6.3 权重学习

```python
def learn_optimal_weights(historical_incidents: List[Incident]) -> dict:
    """
    从历史数据中学习最优融合权重
    """
    from scipy.optimize import minimize
    
    def objective(weights):
        alpha, beta, gamma, delta = weights
        # 约束：权重和为 1
        if abs(alpha + beta + gamma + delta - 1.0) > 0.01:
            return float('inf')
        
        # 计算历史准确率
        correct = 0
        for incident in historical_incidents:
            ranker = RootCauseRanker(alpha, beta, gamma, delta)
            ranking = ranker.rank(incident.graph, incident.services)
            
            # Top-1 准确率
            if ranking[0]['service_id'] in incident.root_causes:
                correct += 1
            # Top-3 准确率
            elif any(c['service_id'] in incident.root_causes 
                     for c in ranking[:3]):
                correct += 0.5
        
        return -correct / len(historical_incidents)  # 最大化准确率
    
    # 优化
    result = minimize(
        objective,
        x0=[0.25, 0.25, 0.25, 0.25],
        bounds=[(0, 1)] * 4
    )
    
    return {
        'pagerank_weight': result.x[0],
        'gnn_weight': result.x[1],
        'health_weight': result.x[2],
        'recency_weight': result.x[3]
    }
```

---

## 七、训练数据要求与特征工程

### 7.1 训练数据规模

| 模型 | 最小样本量 | 推荐样本量 | 数据来源 |
|------|-----------|-----------|---------|
| GNN-根因分析 | 500 个故障案例 | 2000+ | 历史工单 + 人工标注 |
| GNN-异常检测 | 1000 小时指标 | 5000+ 小时 | Prometheus 历史 |
| RL-自愈决策 | 100 个场景 | 500+ 场景 | 仿真 + 历史 |
| RL-部署策略 | 200 次发布 | 1000+ 次 | 发布系统 |

### 7.2 数据标注要求

```python
@dataclass
class RootCauseAnnotation:
    """根因标注数据格式"""
    incident_id: str
    start_time: datetime
    end_time: datetime
    affected_services: List[str]
    
    # 根因标注 (必须有至少一个)
    root_causes: List[RootCauseLabel]
    
    # 标注元数据
    annotator: str           # 标注人
    confidence: float        # 置信度 0-1
    annotation_date: datetime


@dataclass
class RootCauseLabel:
    service_id: str
    cause_type: str          # 如：memory_leak, deadlock, config_error
    description: str
    evidence: List[str]      # 证据日志/指标
```

### 7.3 特征工程管道

```python
class FeaturePipeline:
    """
    特征工程管道
    """
    def __init__(self):
        self.feature_stores = {
            'node_features': RedisFeatureStore('gnn:node_features'),
            'edge_features': RedisFeatureStore('gnn:edge_features'),
            'aggregated': ClickHouseFeatureStore()
        }
    
    def extract_features(self, graph: ServiceGraph, 
                         time_window: timedelta) -> GraphData:
        """
        从原始数据提取图特征
        """
        # 1. 节点特征
        node_features = self._extract_node_features(graph, time_window)
        
        # 2. 边特征
        edge_features = self._extract_edge_features(graph, time_window)
        
        # 3. 图级特征
        graph_features = self._extract_graph_features(graph)
        
        return GraphData(
            x=node_features,
            edge_attr=edge_features,
            graph_feat=graph_features
        )
    
    def _extract_node_features(self, graph: ServiceGraph, 
                                window: timedelta) -> torch.Tensor:
        """
        从 Prometheus + Trace 提取节点特征
        """
        features = []
        for node_id in graph.nodes:
            # 指标特征
            metrics = self.prometheus.query_range(
                f'{{service="{node_id}"}}',
                start=datetime.now() - window,
                end=datetime.now()
            )
            
            # Trace 特征
            trace_stats = self.jaeger.get_service_stats(
                node_id, 
                window
            )
            
            # PageRank 特征
            pr_score = self.pagerank_service.get_score(node_id)
            
            features.append(self._combine_features(metrics, trace_stats, pr_score))
        
        return torch.stack(features)
```

### 7.4 特征预处理

```python
class FeaturePreprocessor:
    """特征预处理"""
    
    def __init__(self):
        self.scalers: Dict[str, StandardScaler] = {}
        self.encoders: Dict[str, LabelEncoder] = {}
    
    def fit(self, feature_dict: Dict[str, np.ndarray]):
        """拟合并存储预处理参数"""
        for feat_name, feat_data in feature_dict.items():
            if feat_data.dtype.kind == 'f':  # 连续特征
                scaler = StandardScaler()
                scaler.fit(feat_data.reshape(-1, 1))
                self.scalers[feat_name] = scaler
            else:  # 离散特征
                encoder = LabelEncoder()
                encoder.fit(feat_data)
                self.encoders[feat_name] = encoder
    
    def transform(self, feature_dict: Dict[str, np.ndarray]) -> Dict[str, np.ndarray]:
        """转换特征"""
        result = {}
        for feat_name, feat_data in feature_dict.items():
            if feat_name in self.scalers:
                result[feat_name] = self.scalers[feat_name].transform(
                    feat_data.reshape(-1, 1)
                ).flatten()
            elif feat_name in self.encoders:
                result[feat_name] = self.encoders[feat_name].transform(feat_data)
            else:
                result[feat_name] = feat_data
        return result
```

---

## 八、模型架构与超参数

### 8.1 超参数配置

```yaml
# GNN-RootCause 超参数
gnn_rootcause:
  model: GraphSAGE
  hidden_dim: 128
  num_layers: 3
  dropout: 0.2
  learning_rate: 0.001
  batch_size: 32
  epochs: 100
  weight_decay: 0.00001
  early_stopping_patience: 10
  pos_weight: 5.0

# GNN-Anomaly 超参数
gnn_anomaly:
  model: GCN_GRU
  hidden_dim: 64
  window_size: 12  # 3 小时 (15 分钟间隔)
  reconstruction_threshold: 0.95
  learning_rate: 0.0005

# RL-Healing 超参数
rl_healing:
  algorithm: PPO
  hidden_dim: 256
  lr_actor: 0.0003
  lr_critic: 0.001
  gamma: 0.99
  epsilon_clip: 0.2
  entropy_coef: 0.01
  value_loss_coef: 0.5
  max_grad_norm: 0.5
  num_epochs: 10
  batch_size: 64

# RL-Deploy 超参数
rl_deploy:
  algorithm: PPO
  hidden_dim: 128
  lr_actor: 0.0001
  lr_critic: 0.0005
  gamma: 0.95
```

### 8.2 模型保存格式

```python
class ModelCheckpoint:
    """模型检查点管理"""
    
    def save(self, model: nn.Module, optimizer: optim.Optimizer,
             epoch: int, metrics: dict, path: str):
        torch.save({
            'epoch': epoch,
            'model_state_dict': model.state_dict(),
            'optimizer_state_dict': optimizer.state_dict(),
            'metrics': metrics,
            'config': self._get_model_config(model),
            'timestamp': datetime.now().isoformat()
        }, path)
    
    def load(self, path: str) -> dict:
        return torch.load(path, map_location='cpu')
```

---

## 九、评估指标与验证方法

### 9.1 评估指标

| 模型 | 主要指标 | 次要指标 | 业务指标 |
|------|---------|---------|---------|
| GNN-根因分析 | Top-1 Accuracy | Top-3 Accuracy, MRR | MTTR 降低率 |
| GNN-异常检测 | Precision, Recall, F1 | AUC-ROC, AUC-PR | 误报率降低 |
| RL-自愈决策 | 恢复成功率 | 平均恢复时间 | 自动化率 |
| RL-部署策略 | 发布成功率 | 回滚率 | 发布故障率 |

### 9.2 验证方法

```python
class ModelEvaluator:
    """模型评估器"""
    
    def __init__(self):
        self.metrics = {
            'accuracy': Accuracy(),
            'precision': Precision(),
            'recall': Recall(),
            'f1': F1Score(),
            'auc': AUCROC(),
            'mrr': MRR(),
            'top_k_accuracy': TopKAccuracy()
        }
    
    def evaluate_rootcause_gnn(self, model: RootCauseGNN,
                                test_data: List[GraphData]) -> dict:
        """评估根因分析模型"""
        predictions = []
        targets = []
        
        with torch.no_grad():
            for data in test_data:
                pred = model(data.x, data.edge_index, data.edge_attr)
                predictions.append(pred)
                targets.append(data.y)
        
        # 计算指标
        return {
            'top1_accuracy': self.metrics['top_k_accuracy'](predictions, targets, k=1),
            'top3_accuracy': self.metrics['top_k_accuracy'](predictions, targets, k=3),
            'mrr': self.metrics['mrr'](predictions, targets),
            'precision': self.metrics['precision'](predictions, targets),
            'recall': self.metrics['recall'](predictions, targets),
            'f1': self.metrics['f1'](predictions, targets)
        }
    
    def evaluate_anomaly_gnn(self, model: GraphAnomalyDetector,
                              test_data: TimeSeriesGraphData) -> dict:
        """评估异常检测模型"""
        # ... 类似实现
        pass
```

### 9.3 交叉验证策略

```python
from sklearn.model_selection import TimeSeriesSplit

def cross_validate_gnn(model_class, data: List[GraphData], 
                       n_splits: int = 5) -> dict:
    """
    时间序列交叉验证 (避免数据泄露)
    """
    tscv = TimeSeriesSplit(n_splits=n_splits)
    
    fold_metrics = []
    for train_idx, test_idx in tscv.split(data):
        train_data = [data[i] for i in train_idx]
        test_data = [data[i] for i in test_idx]
        
        # 训练
        model = model_class()
        train_model(model, train_data)
        
        # 评估
        metrics = evaluate_model(model, test_data)
        fold_metrics.append(metrics)
    
    # 汇总
    return {
        metric: {
            'mean': np.mean([m[metric] for m in fold_metrics]),
            'std': np.std([m[metric] for m in fold_metrics])
        }
        for metric in fold_metrics[0].keys()
    }
```

### 9.4 A/B 测试框架

```python
class ABTestFramework:
    """
    模型 A/B 测试框架
    """
    def __init__(self):
        self.experiments: Dict[str, Experiment] = {}
    
    def create_experiment(self, name: str, 
                          control_model: nn.Module,
                          treatment_model: nn.Module,
                          traffic_split: float = 0.5):
        """创建 A/B 测试实验"""
        self.experiments[name] = Experiment(
            name=name,
            control=control_model,
            treatment=treatment_model,
            traffic_split=traffic_split
        )
    
    def get_model_for_request(self, experiment_name: str) -> nn.Module:
        """根据流量分配返回模型"""
        exp = self.experiments[experiment_name]
        if random.random() < exp.traffic_split:
            return exp.treatment
        return exp.control
    
    def analyze_results(self, experiment_name: str) -> dict:
        """分析实验结果"""
        exp = self.experiments[experiment_name]
        return {
            'control_metrics': exp.control_metrics,
            'treatment_metrics': exp.treatment_metrics,
            'improvement': self._calculate_improvement(exp),
            'statistical_significance': self._t_test(exp)
        }
```

---

## 十、实施路线图

### 10.1 阶段划分

| 阶段 | 时间 | 目标 | 交付物 |
|------|------|------|--------|
| Phase 1 | M1-M2 | GNN 根因分析 MVP | 可训练模型 + 数据集 |
| Phase 2 | M2-M3 | GNN 异常检测 | 异常检测服务 |
| Phase 3 | M3-M4 | RL 自愈决策 (仿真) | 仿真环境 + 训练 Agent |
| Phase 4 | M4-M6 | 生产集成 + A/B 测试 | 生产环境部署 |

### 10.2 依赖关系

```
┌─────────────────────────────────────────────────────────────────┐
│                     实施依赖图                                   │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  [数据采集] ────▶ [特征平台] ────▶ [模型训练]                    │
│       ▲                │                │                        │
│       │                ▼                ▼                        │
│  [服务拓扑] ◀─── [PageRank 服务] ──▶ [GNN 集成]                  │
│                               │                │                 │
│                               ▼                ▼                 │
│                          [RL 仿真] ─────▶ [生产部署]              │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## 十一、风险与缓解

| 风险 | 影响 | 概率 | 缓解措施 |
|------|------|------|---------|
| 训练数据不足 | 模型效果差 | 中 | 数据增强 + 迁移学习 |
| 模型解释性差 | 运维不信任 | 高 | SHAP 解释 + 可视化 |
| 推理延迟高 | 影响实时性 | 中 | 模型蒸馏 + 缓存 |
| 模型漂移 | 效果退化 | 高 | 持续监控 + 定期重训 |
| RL 探索风险 | 生产事故 | 中 | 仿真训练 + 保守策略 |

---

## 十二、总结

本设计定义了 Orion 平台中 GNN 和 RL 技术的完整应用方案：

1. **GNN 根因分析**：结合 PageRank 与图神经网络，提升定位准确率
2. **GNN 异常检测**：学习时空模式，实现自适应异常发现
3. **RL 自愈决策**：从历史经验中学习最优响应策略
4. **RL 部署策略**：优化发布参数，降低变更风险

核心优势：
- 与现有 PageRank 算法无缝集成
- 利用服务拓扑作为强归纳偏置
- 端到端可训练，支持持续优化
- 提供可解释的决策依据

下一步行动：
1. 构建标注数据集（历史故障工单清洗）
2. 实现 GNN 基线模型
3. 搭建 RL 仿真环境
4. 设计 A/B 测试框架
