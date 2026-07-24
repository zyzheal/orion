# Orion 平台 MLOps 与 ML 框架设计

> 版本：v1.0  
> 创建日期：2026-04-10  
> 负责人：算法团队 + 平台架构组  
> 优先级：P0  
> 状态：设计完成

---

## 一、概述

### 1.1 设计背景

Orion 平台已集成多种机器学习算法和 AI 模型，包括：

| 模型/算法 | 用途 | 当前状态 |
|----------|------|---------|
| XGBoost | 风险评估与分类 | 生产运行 |
| PageRank | 根因定位 | 生产运行 |
| Prophet | 流量预测 | 生产运行 |
| Thompson Sampling | 灰度发布优化 | 生产运行 |
| DBSCAN | 告警聚类 | 生产运行 |
| 动态基线检测 | 异常检测 | 生产运行 |

随着模型数量增长，面临以下挑战：

1. **训练分散**：各模型训练脚本独立，缺乏统一框架
2. **实验难追踪**：超参数、指标、 artifact 分散存储
3. **部署手工**：模型上线依赖人工操作，易出错
4. **监控缺失**：模型性能衰减、特征漂移难及时发现
5. **版本混乱**：模型版本、数据版本、代码版本不一致

### 1.2 设计目标

本设计建立统一的 MLOps 体系，实现：

1. **标准化训练**：统一 PyTorch/TensorFlow/XGBoost 训练框架
2. **实验可追踪**：MLflow 实现实验、模型、指标全链路追踪
3. **自动化部署**：Kubeflow 实现训练 - 验证-部署流水线
4. **持续监控**：模型性能、特征漂移、数据质量实时监控
5. **版本一致性**：模型、数据、代码三位一体版本管理

### 1.3 适用范围

| 场景 | 适用性 |
|------|--------|
| 传统 ML 模型 (XGBoost, sklearn) | ✅ 完全支持 |
| 深度学习模型 (PyTorch, TensorFlow) | ✅ 完全支持 |
| 时间序列模型 (Prophet, ARIMA) | ✅ 完全支持 |
| 图算法 (PageRank, GraphSAGE) | ✅ 完全支持 |
| LLM 推理与微调 | ⚠️ 部分支持（需额外配置） |
| 在线学习/增量学习 | ⚠️ 部分支持（需定制开发） |

---

## 二、整体架构

### 2.1 MLOps 架构总览

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         Orion MLOps 平台                                 │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │                      开发层 (Development)                        │   │
│  │  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐        │   │
│  │  │ Jupyter  │  │  VSCode  │  │  MLflow  │  │  Git     │        │   │
│  │  │  Lab     │  │          │  │  UI      │  │  Repo    │        │   │
│  │  └──────────┘  └──────────┘  └──────────┘  └──────────┘        │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│                                    │                                    │
│                                    ▼                                    │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │                      训练层 (Training)                           │   │
│  │  ┌──────────────────────────────────────────────────────────┐   │   │
│  │  │              Kubeflow Pipelines                           │   │   │
│  │  │  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐  │   │   │
│  │  │  │ 数据准备  │  │ 特征工程  │  │ 模型训练  │  │ 模型评估  │  │   │   │
│  │  │  └──────────┘  └──────────┘  └──────────┘  └──────────┘  │   │   │
│  │  └──────────────────────────────────────────────────────────┘   │   │
│  │  ┌──────────┐  ┌──────────┐  ┌──────────┐                      │   │
│  │  │ PyTorch  │  │TensorFlow│  │ XGBoost  │  ┌──────────┐        │   │
│  │  │          │  │          │  │          │  │ Prophet  │        │   │
│  │  │          │  │          │  │          │  │  Custom  │        │   │
│  │  └──────────┘  └──────────┘  └──────────┘  └──────────┘        │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│                                    │                                    │
│                                    ▼                                    │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │                      管理层 (Management)                         │   │
│  │  ┌──────────────────────────────────────────────────────────┐   │   │
│  │  │                   MLflow Platform                         │   │   │
│  │  │  ┌──────────┐  ┌──────────┐  ┌──────────┐                │   │   │
│  │  │  │ Tracking │  │ Registry │  │ Serving  │                │   │   │
│  │  │  │ Server   │  │          │  │          │                │   │   │
│  │  │  └──────────┘  └──────────┘  └──────────┘                │   │   │
│  │  └──────────────────────────────────────────────────────────┘   │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│                                    │                                    │
│                                    ▼                                    │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │                      部署层 (Deployment)                         │   │
│  │  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐        │   │
│  │  │ 蓝绿部署  │  │ 金丝雀   │  │ A/B 测试  │  │ 影子模式  │        │   │
│  │  └──────────┘  └──────────┘  └──────────┘  └──────────┘        │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│                                    │                                    │
│                                    ▼                                    │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │                      监控层 (Monitoring)                         │   │
│  │  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐        │   │
│  │  │ Prometheus│  │ Grafana  │  │ 告警规则  │  │ 日志收集  │        │   │
│  │  └──────────┘  └──────────┘  └──────────┘  └──────────┘        │   │
│  │  ┌──────────┐  ┌──────────┐  ┌──────────┐                      │   │
│  │  │ 性能监控  │  │ 漂移检测  │  │ 质量监控  │                      │   │
│  │  └──────────┘  └──────────┘  └──────────┘                      │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

### 2.2 技术栈选型

| 组件 | 技术选型 | 选型理由 |
|------|---------|---------|
| **训练框架** | PyTorch, TensorFlow, XGBoost | 业界标准，团队熟悉 |
| **实验追踪** | MLflow Tracking | 轻量级，与框架无关 |
| **模型注册** | MLflow Registry | 版本管理，阶段流转 |
| **模型服务** | MLflow Serving + KServe | 统一 API，支持多框架 |
| **流水线** | Kubeflow Pipelines | Kubernetes 原生，可视化 |
| **特征存储** | Feast (可选) | 特征复用，离线/在线一致 |
| **监控** | Prometheus + Grafana | 云原生标准 |
| **日志** | EFK Stack | 集中式日志分析 |

### 2.3 与 Orion AI Service 集成

```
┌─────────────────────────────────────────────────────────────────┐
│                     Orion AI Service                            │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌───────────────┐     ┌───────────────┐     ┌───────────────┐ │
│  │   AI Gateway  │────▶│  Model Router  │────▶│  Skill Engine  │ │
│  └───────────────┘     └───────────────┘     └───────────────┘ │
│         │                     │                     │           │
│         ▼                     ▼                     ▼           │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │              MLOps Platform Integration                  │   │
│  │  ┌──────────┐  ┌──────────┐  ┌──────────┐              │   │
│  │  │ MLflow   │  │ Kubeflow │  │ Monitor  │              │   │
│  │  │ Client   │  │ Client   │  │ Client   │              │   │
│  │  └──────────┘  └──────────┘  └──────────┘              │   │
│  └─────────────────────────────────────────────────────────┘   │
│         │                     │                     │           │
│         ▼                     ▼                     ▼           │
│  ┌───────────────┐     ┌───────────────┐     ┌───────────────┐ │
│  │ 模型推理 API   │     │ 训练流水线     │     │ 监控指标上报   │ │
│  └───────────────┘     └───────────────┘     └───────────────┘ │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## 三、训练框架设计

### 3.1 框架选型与使用场景

| 框架 | 适用场景 | Orion 中的使用 |
|------|---------|---------------|
| **PyTorch** | 深度学习、自定义网络、研究探索 | 根因诊断 Embedding、日志异常检测 |
| **TensorFlow** | 生产级深度学习、TFX 流水线 | 预留（如后续引入推荐系统） |
| **XGBoost** | 表格数据、分类回归、排序 | 风险评估、故障预测 |
| **scikit-learn** | 传统 ML、预处理、特征工程 | 数据预处理、基线模型 |
| **Prophet** | 时间序列预测 | 流量预测、容量规划 |
| **Custom** | 图算法、强化学习 | PageRank、Thompson Sampling |

### 3.2 统一训练接口设计

```python
from abc import ABC, abstractmethod
from typing import Any, Dict, Optional
from dataclasses import dataclass
import mlflow


@dataclass
class TrainingConfig:
    """训练配置基类"""
    experiment_name: str
    model_name: str
    data_path: str
    artifact_path: str = "model"
    
    # MLflow 配置
    tracking_uri: str = "http://mlflow:5000"
    registry_uri: str = "sqlite:///mlflow.db"
    
    # 训练超参数（子类扩展）
    hyperparams: Dict[str, Any] = None


class BaseTrainer(ABC):
    """训练器抽象基类"""
    
    def __init__(self, config: TrainingConfig):
        self.config = config
        mlflow.set_tracking_uri(config.tracking_uri)
        mlflow.set_experiment(config.experiment_name)
    
    @abstractmethod
    def prepare_data(self) -> Any:
        """数据准备与预处理"""
        pass
    
    @abstractmethod
    def build_model(self, **kwargs) -> Any:
        """构建模型"""
        pass
    
    @abstractmethod
    def train(self, model: Any, data: Any) -> Any:
        """执行训练"""
        pass
    
    @abstractmethod
    def evaluate(self, model: Any, data: Any) -> Dict[str, float]:
        """模型评估"""
        pass
    
    def log_params(self, params: Dict[str, Any]):
        """记录超参数到 MLflow"""
        mlflow.log_params(params)
    
    def log_metrics(self, metrics: Dict[str, float], step: int = None):
        """记录指标到 MLflow"""
        mlflow.log_metrics(metrics, step=step)
    
    def log_artifact(self, path: str, artifact_path: str = None):
        """记录 artifact 到 MLflow"""
        mlflow.log_artifact(path, artifact_path)
    
    def register_model(self, model_uri: str, model_name: str = None) -> str:
        """注册模型到 MLflow Registry"""
        model_name = model_name or self.config.model_name
        return mlflow.register_model(
            model_uri=model_uri,
            name=model_name
        )
    
    def run(self) -> Dict[str, Any]:
        """完整训练流程"""
        with mlflow.start_run():
            # 1. 数据准备
            data = self.prepare_data()
            self.log_artifact(self.config.data_path, "data")
            
            # 2. 构建模型
            model = self.build_model(**(self.config.hyperparams or {}))
            
            # 3. 训练
            trained_model = self.train(model, data)
            
            # 4. 评估
            metrics = self.evaluate(trained_model, data)
            self.log_metrics(metrics)
            
            # 5. 保存模型
            model_uri = f"runs:/{mlflow.active_run().info.run_id}/{self.config.artifact_path}"
            mlflow.sklearn.log_model(trained_model, self.config.artifact_path)
            
            # 6. 注册模型
            registered_model = self.register_model(model_uri)
            
            return {
                "run_id": mlflow.active_run().info.run_id,
                "metrics": metrics,
                "model_uri": model_uri,
                "registered_model": registered_model
            }
```

### 3.3 XGBoost 训练器实现

```python
import xgboost as xgb
import pandas as pd
import joblib
from typing import List, Tuple


class XGBoostTrainer(BaseTrainer):
    """XGBoost 训练器"""
    
    def __init__(self, config: TrainingConfig):
        super().__init__(config)
        self.feature_cols: List[str] = []
    
    def prepare_data(self) -> Tuple[pd.DataFrame, pd.DataFrame]:
        """准备训练数据"""
        # 加载数据
        df = pd.read_csv(self.config.data_path)
        
        # 特征工程
        self.feature_cols = [c for c in df.columns if c not in ['label', 'id']]
        X = df[self.feature_cols]
        y = df['label']
        
        # 划分训练/验证集
        from sklearn.model_selection import train_test_split
        X_train, X_val, y_train, y_val = train_test_split(
            X, y, test_size=0.2, random_state=42
        )
        
        return (X_train, X_val, y_train, y_val)
    
    def build_model(self, **kwargs) -> xgb.XGBClassifier:
        """构建 XGBoost 模型"""
        # 处理类别不均衡
        scale_pos_weight = kwargs.pop('scale_pos_weight', None)
        if scale_pos_weight is None:
            # 自动计算
            pass
        
        model = xgb.XGBClassifier(
            n_estimators=kwargs.get('n_estimators', 100),
            max_depth=kwargs.get('max_depth', 5),
            learning_rate=kwargs.get('learning_rate', 0.1),
            scale_pos_weight=scale_pos_weight or 1,
            subsample=kwargs.get('subsample', 0.8),
            colsample_bytree=kwargs.get('colsample_bytree', 0.8),
            random_state=42
        )
        return model
    
    def train(self, model: xgb.XGBClassifier, data: Tuple) -> xgb.XGBClassifier:
        """训练 XGBoost 模型"""
        X_train, X_val, y_train, y_val = data
        
        model.fit(
            X_train, y_train,
            eval_set=[(X_val, y_val)],
            early_stopping_rounds=10,
            verbose=True
        )
        
        # 记录特征重要性
        importance = pd.DataFrame({
            'feature': self.feature_cols,
            'importance': model.feature_importances_
        }).sort_values('importance', ascending=False)
        
        importance_path = "/tmp/feature_importance.csv"
        importance.to_csv(importance_path, index=False)
        self.log_artifact(importance_path, "analysis")
        
        # 记录 SHAP 图
        try:
            import shap
            explainer = shap.TreeExplainer(model)
            shap_values = explainer.shap_values(X_train)
            shap_path = "/tmp/shap_summary.png"
            shap.summary_plot(shap_values, X_train, show=False, plot_size=(12, 8))
            self.log_artifact(shap_path, "analysis")
        except ImportError:
            pass
        
        return model
    
    def evaluate(self, model: xgb.XGBClassifier, data: Tuple) -> Dict[str, float]:
        """评估模型"""
        from sklearn.metrics import accuracy_score, precision_score, recall_score, f1_score, roc_auc_score
        
        X_train, X_val, y_train, y_val = data
        y_pred = model.predict(X_val)
        y_pred_proba = model.predict_proba(X_val)[:, 1]
        
        metrics = {
            "accuracy": accuracy_score(y_val, y_pred),
            "precision": precision_score(y_val, y_pred),
            "recall": recall_score(y_val, y_pred),
            "f1": f1_score(y_val, y_pred),
            "auc": roc_auc_score(y_val, y_pred_proba)
        }
        
        # 记录到 MLflow
        self.log_metrics(metrics)
        
        return metrics
```

### 3.4 PyTorch 训练器实现

```python
import torch
import torch.nn as nn
from torch.utils.data import DataLoader, Dataset
from typing import Iterator


class PyTorchTrainer(BaseTrainer):
    """PyTorch 训练器"""
    
    def __init__(self, config: TrainingConfig):
        super().__init__(config)
        self.device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    
    def prepare_data(self) -> DataLoader:
        """准备数据加载器"""
        # 自定义 Dataset 实现
        class CustomDataset(Dataset):
            def __init__(self, data_path: str):
                self.data = pd.read_csv(data_path)
            
            def __len__(self):
                return len(self.data)
            
            def __getitem__(self, idx):
                # 实现数据加载逻辑
                pass
        
        dataset = CustomDataset(self.config.data_path)
        loader = DataLoader(dataset, batch_size=32, shuffle=True)
        return loader
    
    def build_model(self, **kwargs) -> nn.Module:
        """构建 PyTorch 模型"""
        # 子类实现具体模型
        class SimpleNet(nn.Module):
            def __init__(self, input_dim: int, hidden_dim: int, output_dim: int):
                super().__init__()
                self.fc1 = nn.Linear(input_dim, hidden_dim)
                self.relu = nn.ReLU()
                self.fc2 = nn.Linear(hidden_dim, output_dim)
            
            def forward(self, x):
                x = self.fc1(x)
                x = self.relu(x)
                x = self.fc2(x)
                return x
        
        model = SimpleNet(
            input_dim=kwargs.get('input_dim', 128),
            hidden_dim=kwargs.get('hidden_dim', 64),
            output_dim=kwargs.get('output_dim', 10)
        )
        return model.to(self.device)
    
    def train(self, model: nn.Module, data: DataLoader) -> nn.Module:
        """训练 PyTorch 模型"""
        criterion = nn.CrossEntropyLoss()
        optimizer = torch.optim.Adam(model.parameters(), lr=0.001)
        
        epochs = 10
        model.train()
        
        for epoch in range(epochs):
            total_loss = 0
            correct = 0
            total = 0
            
            for batch_idx, (inputs, targets) in enumerate(data):
                inputs, targets = inputs.to(self.device), targets.to(self.device)
                
                optimizer.zero_grad()
                outputs = model(inputs)
                loss = criterion(outputs, targets)
                loss.backward()
                optimizer.step()
                
                total_loss += loss.item()
                _, predicted = outputs.max(1)
                total += targets.size(0)
                correct += predicted.eq(targets).sum().item()
            
            # 记录 epoch 指标
            epoch_loss = total_loss / len(data)
            epoch_acc = correct / total
            self.log_metrics({
                "train_loss": epoch_loss,
                "train_accuracy": epoch_acc
            }, step=epoch)
        
        return model
    
    def evaluate(self, model: nn.Module, data: DataLoader) -> Dict[str, float]:
        """评估模型"""
        model.eval()
        total_loss = 0
        correct = 0
        total = 0
        
        with torch.no_grad():
            for inputs, targets in data:
                inputs, targets = inputs.to(self.device), targets.to(self.device)
                outputs = model(inputs)
                loss = nn.CrossEntropyLoss()(outputs, targets)
                
                total_loss += loss.item()
                _, predicted = outputs.max(1)
                total += targets.size(0)
                correct += predicted.eq(targets).sum().item()
        
        metrics = {
            "val_loss": total_loss / len(data),
            "val_accuracy": correct / total
        }
        self.log_metrics(metrics)
        
        return metrics
```

---

## 四、MLflow 平台设计

### 4.1 MLflow 架构

```
┌─────────────────────────────────────────────────────────────────┐
│                     MLflow Platform                             │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌─────────────────┐     ┌─────────────────┐     ┌───────────┐ │
│  │   Tracking      │     │   Registry      │     │  Serving  │ │
│  │   Server        │     │   Server        │     │  Server   │ │
│  │                 │     │                 │     │           │ │
│  │ • 实验记录      │     │ • 模型版本      │     │ • REST API│ │
│  │ • 参数追踪      │     │ • 阶段管理      │     │ • 自动伸缩│ │
│  │ • 指标可视化    │     │ • 权限控制      │     │ • 多模型  │ │
│  │ • Artifact 存储  │     │ • 部署状态      │     │ • 金丝雀  │ │
│  └────────┬────────┘     └────────┬────────┘     └─────┬─────┘ │
│           │                       │                     │       │
│           ▼                       ▼                     ▼       │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │                  Backend Storage                         │   │
│  │  ┌───────────┐  ┌───────────┐  ┌───────────────────┐   │   │
│  │  │ PostgreSQL│  │   S3/OSS  │  │  Local/NFS Store  │   │   │
│  │  │ (Metadata)│  │(Artifacts)│  │    (Development)  │   │   │
│  │  └───────────┘  └───────────┘  └───────────────────┘   │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### 4.2 实验追踪设计

#### 4.2.1 实验层级结构

```
Experiment: orion-risk-assessment
├── Run: abc123 (2026-04-10 10:00:00)
│   ├── Parameters
│   │   ├── n_estimators: 100
│   │   ├── max_depth: 5
│   │   └── learning_rate: 0.1
│   ├── Metrics
│   │   ├── accuracy: 0.87
│   │   ├── precision: 0.85
│   │   ├── recall: 0.82
│   │   └── f1: 0.83
│   ├── Artifacts
│   │   ├── model/
│   │   │   └── model.pkl
│   │   ├── data/
│   │   │   └── dataset.csv
│   │   └── analysis/
│   │       ├── feature_importance.csv
│   │       └── shap_summary.png
│   └── Tags
│       ├── author: zhangsan
│       ├── version: v1.0.0
│       └── stage: training
│
├── Run: def456 (2026-04-10 14:30:00)
│   └── ...
│
└── Run: ghi789 (2026-04-11 09:00:00)
    └── ...
```

#### 4.2.2 实验记录代码示例

```python
import mlflow
from mlflow.tracking import MlflowClient


class ExperimentTracker:
    """实验追踪管理器"""
    
    def __init__(self, tracking_uri: str):
        self.tracking_uri = tracking_uri
        mlflow.set_tracking_uri(tracking_uri)
        self.client = MlflowClient(tracking_uri)
    
    def create_experiment(self, name: str, tags: dict = None) -> str:
        """创建实验"""
        experiment_id = self.client.create_experiment(name, tags=tags)
        return experiment_id
    
    def start_run(self, experiment_name: str, run_name: str = None, 
                  tags: dict = None) -> mlflow.ActiveRun:
        """开始运行"""
        experiment = self.client.get_experiment_by_name(experiment_name)
        if experiment is None:
            experiment_id = self.create_experiment(experiment_name)
        else:
            experiment_id = experiment.experiment_id
        
        return mlflow.start_run(
            experiment_id=experiment_id,
            run_name=run_name,
            tags=tags or {}
        )
    
    def log_training_info(self, model_name: str, hyperparams: dict, 
                          metrics: dict, artifacts: list = None):
        """记录完整训练信息"""
        # 记录超参数
        mlflow.log_params(hyperparams)
        
        # 记录指标
        mlflow.log_metrics(metrics)
        
        # 记录模型信息
        mlflow.set_tag("model_name", model_name)
        mlflow.set_tag("training_framework", "xgboost")
        
        # 记录 artifacts
        if artifacts:
            for artifact in artifacts:
                mlflow.log_artifact(artifact)
    
    def compare_runs(self, experiment_name: str, 
                     metric: str = "f1") -> list:
        """对比实验运行"""
        experiment = self.client.get_experiment_by_name(experiment_name)
        runs = self.client.search_runs(
            experiment.experiment_id,
            order_by=[f"metrics.{metric} DESC"]
        )
        return runs


# 使用示例
tracker = ExperimentTracker("http://mlflow:5000")

with tracker.start_run(
    experiment_name="orion-risk-assessment",
    run_name="xgboost-v1.0",
    tags={"author": "zhangsan", "git_commit": "abc123"}
):
    # 训练代码
    hyperparams = {"n_estimators": 100, "max_depth": 5}
    metrics = {"accuracy": 0.87, "f1": 0.83}
    
    tracker.log_training_info(
        model_name="risk-assessment",
        hyperparams=hyperparams,
        metrics=metrics,
        artifacts=["/tmp/model", "/tmp/feature_importance.png"]
    )
```

### 4.3 模型注册中心设计

#### 4.3.1 模型生命周期

```
┌─────────────┐    ┌─────────────┐    ┌─────────────┐    ┌─────────────┐
│   staging   │───▶│  production │───▶│   archived  │
│             │    │             │    │             │
│ • 验证中    │    │ • 生产服务   │    │ • 已下线    │
│ • A/B 测试   │    │ • 正式流量   │    │ • 历史参考   │
│ • 性能评估   │    │ • 监控中    │    │             │
└─────────────┘    └─────────────┘    └─────────────┘
       ▲
       │
┌─────────────┐
│   none      │
│             │
│ • 新注册     │
│ • 训练中     │
└─────────────┘
```

#### 4.3.2 模型版本管理

```python
from mlflow.tracking import MlflowClient
from typing import Optional


class ModelRegistry:
    """模型注册中心管理器"""
    
    def __init__(self, registry_uri: str):
        self.client = MlflowClient(registry_uri)
    
    def register_model(self, model_uri: str, model_name: str,
                       tags: dict = None) -> str:
        """注册模型"""
        result = self.client.register_model(
            model_uri=model_uri,
            name=model_name,
            tags=tags or {}
        )
        return result.version
    
    def transition_stage(self, model_name: str, version: str,
                         new_stage: str) -> None:
        """转换模型阶段"""
        valid_stages = ["Staging", "Production", "Archived"]
        if new_stage not in valid_stages:
            raise ValueError(f"Invalid stage: {new_stage}")
        
        self.client.transition_model_version_stage(
            name=model_name,
            version=version,
            stage=new_stage
        )
    
    def get_production_model(self, model_name: str) -> Optional[str]:
        """获取生产环境模型"""
        versions = self.client.search_model_versions(
            f"name='{model_name}' AND stage='Production'"
        )
        if versions:
            # 返回最新版本
            latest = max(versions, key=lambda v: int(v.version))
            return f"models:/{model_name}/{latest.version}"
        return None
    
    def get_model_info(self, model_name: str, version: str = None) -> dict:
        """获取模型信息"""
        if version:
            model_version = self.client.get_model_version(
                name=model_name,
                version=version
            )
        else:
            # 获取最新版本
            versions = self.client.search_model_versions(f"name='{model_name}'")
            latest = max(versions, key=lambda v: int(v.version))
            model_version = self.client.get_model_version(
                name=model_name,
                version=latest.version
            )
        
        return {
            "name": model_version.name,
            "version": model_version.version,
            "stage": model_version.current_stage,
            "run_id": model_version.run_id,
            "creation_timestamp": model_version.creation_timestamp,
            "description": model_version.description
        }
    
    def set_model_alias(self, model_name: str, version: str,
                        alias: str) -> None:
        """设置模型别名"""
        self.client.set_registered_model_alias(
            name=model_name,
            alias=alias,
            version=version
        )
    
    def get_model_by_alias(self, model_name: str, alias: str) -> str:
        """通过别名获取模型"""
        version = self.client.get_model_version_by_alias(
            name=model_name,
            alias=alias
        )
        return f"models:/{model_name}/{version.version}"


# 使用示例
registry = ModelRegistry("sqlite:///mlflow.db")

# 注册新模型
version = registry.register_model(
    model_uri="runs:/abc123/model",
    model_name="risk-assessment",
    tags={"dataset_version": "v1.0", "framework": "xgboost"}
)

# 转换到 Staging
registry.transition_stage("risk-assessment", version, "Staging")

# A/B 测试通过后转换到 Production
registry.transition_stage("risk-assessment", version, "Production")

# 设置别名方便调用
registry.set_model_alias("risk-assessment", version, "latest-stable")
```

#### 4.3.3 模型注册中心与 Orion AI Service 集成

```python
# orion_ai_service/model_loader.py

from mlflow.tracking import MlflowClient
import joblib


class OrionModelLoader:
    """Orion AI Service 模型加载器"""
    
    def __init__(self, mlflow_uri: str):
        self.client = MlflowClient(mlflow_uri)
        self._model_cache = {}
    
    def load_model(self, model_name: str, version: str = None,
                   use_cache: bool = True) -> Any:
        """加载模型"""
        cache_key = f"{model_name}:{version or 'latest'}"
        
        if use_cache and cache_key in self._model_cache:
            return self._model_cache[cache_key]
        
        # 获取模型 URI
        if version:
            model_version = self.client.get_model_version(model_name, version)
        else:
            # 获取 Production 阶段最新版本
            versions = self.client.search_model_versions(
                f"name='{model_name}' AND stage='Production'"
            )
            if not versions:
                raise ValueError(f"No production model found: {model_name}")
            latest = max(versions, key=lambda v: int(v.version))
            model_version = latest
        
        # 下载并加载模型
        model_uri = model_version.source
        local_path = self.client.download_artifacts(model_uri)
        model = joblib.load(local_path)
        
        if use_cache:
            self._model_cache[cache_key] = model
        
        return model
    
    def predict(self, model_name: str, data: Any, version: str = None) -> Any:
        """模型推理"""
        model = self.load_model(model_name, version)
        return model.predict(data)
```

### 4.4 MLflow Serving 设计

```yaml
# mlflow-serving-config.yaml

apiVersion: serving.kserve.io/v1beta1
kind: InferenceService
metadata:
  name: risk-assessment
  annotations:
    serving.knative.openshift.io/enablePassthrough: "true"
spec:
  predictor:
    minReplicas: 2
    maxReplicas: 10
    scaleTarget: 80
    scaleMetric: cpu
    timeoutSec: 60
    logger:
      mode: all
    mlflow:
      storageUri: "s3://orion-mlflow/models/risk-assessment/production"
      resources:
        requests:
          cpu: "500m"
          memory: "1Gi"
        limits:
          cpu: "2000m"
          memory: "4Gi"
      env:
        - name: MLFLOW_TRACKING_URI
          value: "http://mlflow:5000"
```

---

## 五、Kubeflow 流水线设计

### 5.1 Kubeflow 架构

```
┌─────────────────────────────────────────────────────────────────┐
│                    Kubeflow Platform                            │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌─────────────────┐     ┌─────────────────┐                   │
│  │  Pipelines      │     │  Training       │                   │
│  │  (Argo)         │     │  Operator       │                   │
│  │                 │     │                 │                   │
│  │ • 流水线定义    │     │ • PyTorchJob    │                   │
│  │ • 任务调度      │     │ • TFJob         │                   │
│  │ • 条件分支      │     │ • XGBoostJob    │                   │
│  │ • 重试机制      │     │ • 弹性训练      │                   │
│  └────────┬────────┘     └────────┬────────┘                   │
│           │                       │                             │
│           ▼                       ▼                             │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │                  Kubernetes Cluster                      │   │
│  │  ┌───────────┐  ┌───────────┐  ┌───────────────────┐   │   │
│  │  │  Pod:     │  │  Pod:     │  │  Pod:             │   │   │
│  │  │  数据准备  │  │  训练任务  │  │  模型评估         │   │   │
│  │  └───────────┘  └───────────┘  └───────────────────┘   │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### 5.2 训练流水线定义

```python
from kfp import dsl
from kfp.dsl import component, Input, Output, Artifact, Model, Dataset


@dsl.component(
    base_image="python:3.9-slim",
    packages_to_install=["pandas", "scikit-learn"]
)
def prepare_data(
    raw_data_path: str,
    output_train_data: Output[Dataset],
    output_val_data: Output[Dataset],
    output_feature_config: Output[Artifact]
):
    """数据准备组件"""
    import pandas as pd
    from sklearn.model_selection import train_test_split
    import json
    
    # 加载原始数据
    df = pd.read_csv(raw_data_path)
    
    # 数据清洗
    df = df.dropna()
    df = df.drop_duplicates()
    
    # 特征工程
    feature_cols = [c for c in df.columns if c not in ['label', 'id']]
    
    # 保存特征配置
    feature_config = {
        "feature_columns": feature_cols,
        "target_column": "label",
        "total_samples": len(df)
    }
    with open(output_feature_config.path, 'w') as f:
        json.dump(feature_config, f, indent=2)
    
    # 划分训练/验证集
    train_df, val_df = train_test_split(df, test_size=0.2, random_state=42)
    
    # 保存数据
    train_df.to_csv(output_train_data.path, index=False)
    val_df.to_csv(output_val_data.path, index=False)


@dsl.component(
    base_image="python:3.9-slim",
    packages_to_install=["xgboost", "mlflow", "joblib"]
)
def train_model(
    train_data: Input[Dataset],
    feature_config: Input[Artifact],
    n_estimators: int,
    max_depth: int,
    learning_rate: float,
    output_model: Output[Model],
    mlflow_tracking_uri: str
):
    """模型训练组件"""
    import xgboost as xgb
    import pandas as pd
    import json
    import mlflow
    
    # 加载数据
    train_df = pd.read_csv(train_data.path)
    with open(feature_config.path) as f:
        feature_config = json.load(f)
    
    feature_cols = feature_config["feature_columns"]
    X = train_df[feature_cols]
    y = train_df["label"]
    
    # 设置 MLflow
    mlflow.set_tracking_uri(mlflow_tracking_uri)
    
    with mlflow.start_run():
        # 训练模型
        model = xgb.XGBClassifier(
            n_estimators=n_estimators,
            max_depth=max_depth,
            learning_rate=learning_rate,
            random_state=42
        )
        model.fit(X, y)
        
        # 记录到 MLflow
        mlflow.log_params({
            "n_estimators": n_estimators,
            "max_depth": max_depth,
            "learning_rate": learning_rate
        })
        
        # 保存模型
        import joblib
        joblib.dump(model, output_model.path)
        mlflow.sklearn.log_model(model, "model")


@dsl.component(
    base_image="python:3.9-slim",
    packages_to_install=["xgboost", "scikit-learn", "mlflow"]
)
def evaluate_model(
    model: Input[Model],
    val_data: Input[Dataset],
    feature_config: Input[Artifact],
    mlflow_tracking_uri: str,
    accuracy_threshold: float = 0.80
) -> str:
    """模型评估组件"""
    import joblib
    import pandas as pd
    import json
    import mlflow
    from sklearn.metrics import accuracy_score, precision_score, recall_score, f1_score
    
    # 加载数据和模型
    val_df = pd.read_csv(val_data.path)
    model = joblib.load(model.path)
    with open(feature_config.path) as f:
        feature_config = json.load(f)
    
    feature_cols = feature_config["feature_columns"]
    X = val_df[feature_cols]
    y = val_df["label"]
    
    # 预测
    y_pred = model.predict(X)
    
    # 计算指标
    metrics = {
        "accuracy": accuracy_score(y, y_pred),
        "precision": precision_score(y, y_pred),
        "recall": recall_score(y, y_pred),
        "f1": f1_score(y, y_pred)
    }
    
    # 记录到 MLflow
    mlflow.set_tracking_uri(mlflow_tracking_uri)
    with mlflow.start_run():
        mlflow.log_metrics(metrics)
    
    # 判断是否通过
    if metrics["accuracy"] >= accuracy_threshold:
        return "PASSED"
    else:
        return "FAILED"


@dsl.pipeline(
    name="risk-assessment-training",
    description="风险评估模型训练流水线"
)
def risk_assessment_pipeline(
    raw_data_path: str = "s3://orion-data/risk-assessment/raw/train.csv",
    n_estimators: int = 100,
    max_depth: int = 5,
    learning_rate: float = 0.1,
    accuracy_threshold: float = 0.80,
    mlflow_tracking_uri: str = "http://mlflow:5000"
):
    """风险评估模型训练流水线"""
    # 数据准备
    data_prep_task = prepare_data(raw_data_path=raw_data_path)
    
    # 模型训练
    train_task = train_model(
        train_data=data_prep_task.outputs["output_train_data"],
        feature_config=data_prep_task.outputs["output_feature_config"],
        n_estimators=n_estimators,
        max_depth=max_depth,
        learning_rate=learning_rate,
        mlflow_tracking_uri=mlflow_tracking_uri
    )
    
    # 模型评估
    eval_task = evaluate_model(
        model=train_task.outputs["output_model"],
        val_data=data_prep_task.outputs["output_val_data"],
        feature_config=data_prep_task.outputs["output_feature_config"],
        mlflow_tracking_uri=mlflow_tracking_uri,
        accuracy_threshold=accuracy_threshold
    )
    
    # 条件部署（如果评估通过）
    with dsl.If(eval_task.output == "PASSED"):
        # 注册模型到 MLflow
        # deploy_task = register_and_deploy(...)
        pass
```

### 5.3 流水线调度配置

```yaml
# pipeline-schedule.yaml

apiVersion: kubeflow.org/v1
kind: ScheduledWorkflow
metadata:
  name: risk-assessment-weekly-retrain
  namespace: orion-ai
spec:
  schedule: "0 2 * * 0"  # 每周日凌晨 2 点
  maxConcurrency: 1
  maxHistory: 10
  workflow:
    metadata:
      name: risk-assessment-training
    spec:
      entrypoint: risk-assessment-pipeline
      arguments:
        parameters:
          - name: raw_data_path
            value: "s3://orion-data/risk-assessment/weekly/train-{{workflow.creationTimestamp|date:'%Y%m%d'}}.csv"
          - name: n_estimators
            value: "100"
          - name: max_depth
            value: "5"
          - name: learning_rate
            value: "0.1"
          - name: accuracy_threshold
            value: "0.80"
```

---

## 六、MLOps 实践

### 6.1 CI/CD for ML

```
┌─────────────────────────────────────────────────────────────────┐
│                    ML CI/CD Pipeline                            │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  Code Commit ──▶ ┌─────────────────────────────────────────┐   │
│                  │           CI Pipeline                     │   │
│                  │  ┌─────────┐  ┌─────────┐  ┌─────────┐   │   │
│                  │  │ Lint    │  │ Unit    │  │ Data    │   │   │
│                  │  │ Check   │  │ Test    │  │ Validate│   │   │
│                  │  └────┬────┘  └────┬────┘  └────┬────┘   │   │
│                  │       │            │            │         │   │
│                  │       └────────────┴────────────┘         │   │
│                  │                    │                      │   │
│                  │                    ▼                      │   │
│                  │           ┌─────────────────┐             │   │
│                  │           │    Build Passed   │           │   │
│                  │           └─────────────────┘             │   │
│                  └─────────────────────────────────────────┘   │
│                                         │                       │
│                                         ▼                       │
│                  ┌─────────────────────────────────────────┐   │
│                  │           CD Pipeline                     │   │
│                  │  ┌─────────┐  ┌─────────┐  ┌─────────┐   │   │
│                  │  │ Train   │  │ Evaluate│  │ Deploy  │   │   │
│                  │  │ Model   │  │ Model   │  │ Model   │   │   │
│                  │  └────┬────┘  └────┬────┘  └────┬────┘   │   │
│                  │       │            │            │         │   │
│                  │       └────────────┴────────────┘         │   │
│                  │                    │                      │   │
│                  │                    ▼                      │   │
│                  │           ┌─────────────────┐             │   │
│                  │           │   Model Deploy  │             │   │
│                  │           └─────────────────┘             │   │
│                  └─────────────────────────────────────────┘   │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### 6.2 GitLab CI 配置示例

```yaml
# .gitlab-ci.yml

stages:
  - lint
  - test
  - train
  - evaluate
  - deploy

variables:
  MLFLOW_TRACKING_URI: "http://mlflow.orion.ai:5000"
  MODEL_NAME: "risk-assessment"

# Lint 检查
lint:
  stage: lint
  image: python:3.9-slim
  script:
    - pip install flake8 black isort
    - flake8 src/
    - black --check src/
    - isort --check src/

# 单元测试
unit-test:
  stage: test
  image: python:3.9-slim
  script:
    - pip install -r requirements.txt pytest pytest-cov
    - pytest tests/unit --cov=src --cov-report=xml
  artifacts:
    reports:
      coverage_report:
        coverage_format: cobertura
        path: coverage.xml

# 数据验证
data-validate:
  stage: train
  image: python:3.9-slim
  script:
    - pip install great_expectations pandas
    - python scripts/validate_data.py --data-path data/train.csv
  rules:
    - if: $CI_COMMIT_BRANCH == "main"

# 模型训练
train:
  stage: train
  image: python:3.9-slim
  script:
    - pip install -r requirements.txt
    - python scripts/train.py \
        --experiment-name $MODEL_NAME \
        --tracking-uri $MLFLOW_TRACKING_URI \
        --config configs/model.yaml
  artifacts:
    paths:
      - runs/
    expire_in: 1 week
  rules:
    - if: $CI_COMMIT_BRANCH == "main"

# 模型评估
evaluate:
  stage: evaluate
  image: python:3.9-slim
  script:
    - pip install -r requirements.txt
    - python scripts/evaluate.py \
        --model-uri $MODEL_URI \
        --tracking-uri $MLFLOW_TRACKING_URI \
        --threshold 0.80
  rules:
    - if: $CI_COMMIT_BRANCH == "main"

# 部署到 Staging
deploy-staging:
  stage: deploy
  image: bitnami/kubectl:latest
  script:
    - kubectl apply -f k8s/deployment-staging.yaml
    - kubectl rollout status deployment/risk-assessment-staging
  environment:
    name: staging
    url: https://staging-api.orion.ai
  rules:
    - if: $CI_COMMIT_BRANCH == "main"

# A/B 测试
ab-test:
  stage: deploy
  image: bitnami/kubectl:latest
  script:
    - kubectl apply -f k8s/ab-test-config.yaml
    # 等待 A/B 测试结果
    - python scripts/ab-test-monitor.py --duration 24h
  environment:
    name: production
  rules:
    - if: $CI_COMMIT_BRANCH == "main"
      when: manual

# 部署到 Production
deploy-production:
  stage: deploy
  image: bitnami/kubectl:latest
  script:
    - kubectl apply -f k8s/deployment-production.yaml
    - kubectl rollout status deployment/risk-assessment
  environment:
    name: production
    url: https://api.orion.ai
  rules:
    - if: $CI_COMMIT_BRANCH == "main"
      when: manual
```

### 6.3 模型版本管理

```python
# Model Version Control with Git + MLflow

import subprocess
import mlflow
from dataclasses import dataclass


@dataclass
class ModelVersion:
    """模型版本信息"""
    model_name: str
    model_version: str
    git_commit: str
    git_branch: str
    data_version: str
    timestamp: str
    metrics: dict


def get_git_info() -> dict:
    """获取 Git 信息"""
    commit = subprocess.check_output(["git", "rev-parse", "HEAD"]).decode().strip()
    branch = subprocess.check_output(["git", "rev-parse", "--abbrev-ref", "HEAD"]).decode().strip()
    return {"commit": commit, "branch": branch}


def get_data_version() -> str:
    """获取数据版本（从 DVC 或数据仓库）"""
    # 使用 DVC 追踪数据版本
    try:
        result = subprocess.check_output(["dvc", "data", "status", "--json"])
        return result.decode().strip()
    except subprocess.CalledProcessError:
        return "unknown"


def version_model(model_uri: str, model_name: str, metrics: dict) -> ModelVersion:
    """为模型创建版本记录"""
    git_info = get_git_info()
    data_version = get_data_version()
    
    # 注册到 MLflow
    client = mlflow.tracking.MlflowClient()
    result = client.register_model(model_uri, model_name)
    
    # 创建版本标签
    client.set_model_version_tag(
        name=model_name,
        version=result.version,
        key="git_commit",
        value=git_info["commit"]
    )
    client.set_model_version_tag(
        name=model_name,
        version=result.version,
        key="data_version",
        value=data_version
    )
    
    return ModelVersion(
        model_name=model_name,
        model_version=result.version,
        git_commit=git_info["commit"],
        git_branch=git_info["branch"],
        data_version=data_version,
        timestamp=result.creation_timestamp,
        metrics=metrics
    )
```

### 6.4 模型监控设计

```python
# Model Monitoring with Prometheus + Grafana

from prometheus_client import Counter, Histogram, Gauge, start_http_server
import time
from typing import Dict, Any
import json


class ModelMonitor:
    """模型监控指标"""
    
    def __init__(self, model_name: str, port: int = 8000):
        self.model_name = model_name
        
        # 推理指标
        self.prediction_counter = Counter(
            f'{model_name}_predictions_total',
            'Total predictions',
            ['status']  # success, error
        )
        
        self.prediction_latency = Histogram(
            f'{model_name}_prediction_latency_seconds',
            'Prediction latency',
            buckets=[0.01, 0.05, 0.1, 0.5, 1.0, 5.0]
        )
        
        # 预测分布
        self.prediction_score = Histogram(
            f'{model_name}_prediction_score',
            'Prediction score distribution',
            buckets=[0.0, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1.0]
        )
        
        # 特征统计
        self.feature_stats = Gauge(
            f'{model_name}_feature_stats',
            'Feature statistics',
            ['feature_name', 'stat_type']  # mean, std, min, max
        )
        
        # 模型版本
        self.model_version_info = Gauge(
            f'{model_name}_version_info',
            'Model version info',
            ['version', 'stage']
        )
        
        # 启动 HTTP 服务
        start_http_server(port)
    
    def record_prediction(self, prediction: Any, latency: float,
                          status: str = "success"):
        """记录推理结果"""
        self.prediction_counter.labels(status=status).inc()
        self.prediction_latency.observe(latency)
        
        if hasattr(prediction, 'predict_proba'):
            score = prediction.predict_proba.max()
            self.prediction_score.observe(score)
    
    def update_feature_stats(self, feature_stats: Dict[str, Dict[str, float]]):
        """更新特征统计"""
        for feature_name, stats in feature_stats.items():
            for stat_type, value in stats.items():
                self.feature_stats.labels(
                    feature_name=feature_name,
                    stat_type=stat_type
                ).set(value)
    
    def set_model_version(self, version: str, stage: str):
        """设置模型版本"""
        self.model_version_info.labels(
            version=version,
            stage=stage
        ).set(1)


# 使用示例
monitor = ModelMonitor("risk_assessment")

def predict_with_monitoring(model, data):
    start_time = time.time()
    try:
        prediction = model.predict(data)
        latency = time.time() - start_time
        monitor.record_prediction(prediction, latency, "success")
        return prediction
    except Exception as e:
        latency = time.time() - start_time
        monitor.record_prediction(None, latency, "error")
        raise
```

---

## 七、模型部署与回滚策略

### 7.1 部署策略对比

| 策略 | 描述 | 适用场景 | 风险 |
|------|------|---------|------|
| **蓝绿部署** | 新旧版本并存，快速切换 | 重大版本更新 | 低 |
| **金丝雀** | 逐步增加新版本流量 | 常规迭代 | 低 |
| **A/B 测试** | 多版本对比测试 | 算法优化验证 | 低 |
| **影子模式** | 新版本只记录不生效 | 高风险变更 | 无 |

### 7.2 金丝雀部署设计

```
┌─────────────────────────────────────────────────────────────────┐
│                  Canary Deployment Flow                         │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌─────────────┐                                                │
│  │  Version 1  │ 100% ──▶ ┌─────────────┐                      │
│  │  (Stable)   │          │   Users     │                      │
│  └─────────────┘          └─────────────┘                      │
│                                                                 │
│  ┌─────────────┐     ┌─────────────┐                           │
│  │  Version 1  │ 95% ──▶│            │                          │
│  │  (Stable)   │      │            │                          │
│  └─────────────┘      │   Users    │                          │
│                       │            │                          │
│  ┌─────────────┐     │            │                          │
│  │  Version 2  │  5% ──▶│            │                          │
│  │  (Canary)   │      └─────────────┘                          │
│  └─────────────┘                                                │
│         │                                                       │
│         ▼                                                       │
│  ┌─────────────┐                                                │
│  │  Monitor    │                                                │
│  │  • Error Rate                                              │
│  │  • Latency                                                   │
│  │  • Business Metrics                                          │
│  └──────┬──────┘                                                │
│         │                                                       │
│    ┌────┴────┐                                                  │
│    │         │                                                  │
│    ▼         ▼                                                  │
│  ✅ Pass   ❌ Fail                                              │
│    │         │                                                  │
│    ▼         ▼                                                  │
│  增加流量   回滚                                                 │
│  10%→25%→50%                                                    │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### 7.3 Istio 金丝雀配置

```yaml
# canary-deployment.yaml

apiVersion: networking.istio.io/v1beta1
kind: VirtualService
metadata:
  name: risk-assessment
spec:
  hosts:
    - risk-assessment.orion.ai
  http:
    - route:
        - destination:
            host: risk-assessment-stable
            port:
              number: 80
          weight: 95
        - destination:
            host: risk-assessment-canary
            port:
              number: 80
          weight: 5
---
apiVersion: networking.istio.io/v1beta1
kind: DestinationRule
metadata:
  name: risk-assessment
spec:
  host: risk-assessment.orion.ai
  subsets:
    - name: stable
      labels:
        version: v1
    - name: canary
      labels:
        version: v2
```

### 7.4 自动回滚设计

```python
# Auto-rollback Controller

from kubernetes import client, config
from typing import Dict, List
import requests


class AutoRollbackController:
    """自动回滚控制器"""
    
    def __init__(self, model_name: str):
        self.model_name = model_name
        config.load_incluster_config()
        self.apps_v1 = client.AppsV1Api()
        self.networking_v1 = client.NetworkingV1Api()
    
    def get_deployment_status(self, deployment_name: str) -> Dict:
        """获取部署状态"""
        deployment = self.apps_v1.read_namespaced_deployment(
            name=deployment_name,
            namespace="orion-ai"
        )
        return {
            "ready_replicas": deployment.status.ready_replicas or 0,
            "total_replicas": deployment.status.replicas,
            "updated_replicas": deployment.status.updated_replicas or 0
        }
    
    def check_metrics(self, deployment_name: str) -> Dict[str, float]:
        """从 Prometheus 获取指标"""
        prometheus_url = "http://prometheus:9090/api/v1/query"
        
        queries = {
            "error_rate": f'rate({deployment_name}_predictions_total{{status="error"}}[5m])',
            "p99_latency": f'histogram_quantile(0.99, rate({deployment_name}_prediction_latency_seconds_bucket[5m]))',
            "success_rate": f'rate({deployment_name}_predictions_total{{status="success"}}[5m])'
        }
        
        results = {}
        for metric, query in queries.items():
            response = requests.get(prometheus_url, params={"query": query})
            data = response.json()
            if data["data"]["result"]:
                results[metric] = float(data["data"]["result"][0]["value"][1])
            else:
                results[metric] = 0.0
        
        return results
    
    def should_rollback(self, metrics: Dict[str, float]) -> bool:
        """判断是否需要回滚"""
        # 回滚条件
        error_rate_threshold = 0.05  # 错误率 > 5%
        p99_latency_threshold = 5.0  # P99 延迟 > 5s
        success_rate_threshold = 0.95  # 成功率 < 95%
        
        if metrics["error_rate"] > error_rate_threshold:
            return True
        if metrics["p99_latency"] > p99_latency_threshold:
            return True
        if metrics["success_rate"] < success_rate_threshold:
            return True
        
        return False
    
    def rollback(self, deployment_name: str, target_version: str):
        """执行回滚"""
        # 更新 Deployment 镜像
        deployment = self.apps_v1.read_namespaced_deployment(
            name=deployment_name,
            namespace="orion-ai"
        )
        
        container = deployment.spec.template.spec.containers[0]
        # 回滚到目标版本镜像
        container.image = f"orion-ai/{self.model_name}:{target_version}"
        
        self.apps_v1.patch_namespaced_deployment(
            name=deployment_name,
            namespace="orion-ai",
            body=deployment
        )
        
        # 更新 Istio 路由，将流量切回稳定版本
        self.update_istio_routing(canary_weight=0)
    
    def update_istio_routing(self, canary_weight: int):
        """更新 Istio 路由权重"""
        virtual_service = {
            "spec": {
                "http": [{
                    "route": [
                        {
                            "destination": {"host": "risk-assessment-stable"},
                            "weight": 100 - canary_weight
                        },
                        {
                            "destination": {"host": "risk-assessment-canary"},
                            "weight": canary_weight
                        }
                    ]
                }]
            }
        }
        
        self.networking_v1.patch_namespaced_virtual_service(
            name="risk-assessment",
            namespace="orion-ai",
            body=virtual_service
        )
    
    def run(self):
        """运行监控循环"""
        import time
        
        while True:
            metrics = self.check_metrics("risk-assessment-canary")
            
            if self.should_rollback(metrics):
                print(f"Triggering rollback! Metrics: {metrics}")
                self.rollback("risk-assessment-canary", "v1")
            else:
                # 如果金丝雀版本健康，逐步增加流量
                current_weight = self.get_canary_weight()
                if current_weight < 100:
                    new_weight = min(current_weight + 10, 100)
                    self.update_istio_routing(new_weight)
            
            time.sleep(60)  # 每分钟检查一次
```

### 7.5 回滚策略配置

```yaml
# rollback-policy.yaml

rollback:
  # 自动回滚条件
  auto_rollback:
    enabled: true
    conditions:
      - metric: error_rate
        operator: ">"
        threshold: 0.05
        window: 5m
      - metric: p99_latency
        operator: ">"
        threshold: 5.0
        window: 5m
      - metric: success_rate
        operator: "<"
        threshold: 0.95
        window: 5m
  
  # 手动回滚审批
  manual_approval:
    required_for:
      - production
    approvers:
      - sre-team
      - ai-team-lead
  
  # 回滚步骤
  steps:
    - name: traffic-shift
      action: reduce_canary_weight
      target: 0
    - name: scale-down
      action: scale_deployment
      target: 0
    - name: notification
      action: send_alert
      channels:
        - slack
        - email
```

---

## 八、模型监控与漂移检测

### 8.1 监控指标体系

| 指标类别 | 指标名称 | 说明 | 告警阈值 |
|---------|---------|------|---------|
| **性能指标** | prediction_latency_p99 | P99 推理延迟 | > 5s |
| **性能指标** | prediction_latency_p50 | P50 推理延迟 | > 1s |
| **性能指标** | predictions_per_second | 每秒推理数 | - |
| **质量指标** | error_rate | 推理错误率 | > 5% |
| **质量指标** | timeout_rate | 超时率 | > 3% |
| **业务指标** | prediction_distribution | 预测分布 | 显著偏移 |
| **漂移指标** | feature_psi | 特征 PSI | > 0.25 |
| **漂移指标** | concept_drift | 概念漂移 | 检测到 |

### 8.2 漂移检测集成

```python
# 特征漂移检测与 Orion AI Service 集成

from orion_ai_service.model_loader import OrionModelLoader
from drift_detector import FeatureDriftMonitor
import numpy as np


class ModelDriftIntegration:
    """模型漂移检测集成"""
    
    def __init__(self, model_name: str, mlflow_uri: str):
        self.model_loader = OrionModelLoader(mlflow_uri)
        self.drift_monitor = FeatureDriftMonitor(model_name)
        self.model_name = model_name
    
    def predict_with_drift_check(self, input_data: np.ndarray) -> dict:
        """带漂移检测的推理"""
        # 1. 加载当前生产模型
        model = self.model_loader.load_model(self.model_name)
        
        # 2. 执行推理
        prediction = model.predict(input_data)
        
        # 3. 计算输入特征的漂移
        drift_report = self.drift_monitor.check_drift(input_data)
        
        # 4. 根据漂移结果决策
        decision = self._make_decision(drift_report, prediction)
        
        return decision
    
    def _make_decision(self, drift_report: dict, prediction: np.ndarray) -> dict:
        """根据漂移报告做决策"""
        high_risk_features = [
            f for f, m in drift_report["features"].items()
            if m["risk_level"] == "high"
        ]
        
        if len(high_risk_features) >= 3:
            # 严重漂移：使用规则引擎兜底
            return {
                "prediction": prediction,
                "degraded": True,
                "degrade_reason": "Severe feature drift detected",
                "fallback_to": "rule-engine"
            }
        elif len(high_risk_features) >= 1:
            # 轻度漂移：返回预测但标记警告
            return {
                "prediction": prediction,
                "degraded": False,
                "warning": f"Feature drift detected: {high_risk_features}",
                "drift_score": drift_report["summary"]["drifted_features"]
            }
        else:
            # 无漂移：正常返回
            return {
                "prediction": prediction,
                "degraded": False
            }


# 与 Orion AI Service 集成
# orion_ai_service/skill_engine.py

class SkillEngine:
    """AI Skill 引擎"""
    
    def __init__(self):
        self.drift_integration = ModelDriftIntegration(
            model_name="risk-assessment",
            mlflow_uri="http://mlflow:5000"
        )
    
    def execute_skill(self, skill_name: str, input_data: dict) -> dict:
        """执行 AI Skill"""
        if skill_name == "RiskAssess":
            return self._execute_risk_assess(input_data)
        # ... 其他 skill
    
    def _execute_risk_assess(self, input_data: dict) -> dict:
        """执行风险评估 Skill"""
        # 准备特征数据
        features = self._prepare_features(input_data)
        
        # 带漂移检测的推理
        result = self.drift_integration.predict_with_drift_check(features)
        
        # 构建响应
        response = {
            "skill": "RiskAssess",
            "result": result["prediction"],
            "confidence": self._calculate_confidence(result),
            "degraded": result.get("degraded", False),
            "warning": result.get("warning")
        }
        
        return response
```

### 8.3 Grafana Dashboard 设计

```
┌─────────────────────────────────────────────────────────────────────────┐
│  Orion MLOps Dashboard - Risk Assessment Model                          │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  ┌──────────────┐ ┌──────────────┐ ┌──────────────┐ ┌──────────────┐  │
│  │  QPS        │ │  P99 Latency │ │  Error Rate  │ │  Model Ver    │  │
│  │   1,234     │ │    0.85s     │ │    0.02%     │ │    v2.1.0     │  │
│  └──────────────┘ └──────────────┘ └──────────────┘ └──────────────┘  │
│                                                                         │
│  ┌─────────────────────────┐ ┌─────────────────────────┐               │
│  │    推理延迟趋势 (7 天)     │ │    预测分布直方图        │               │
│  │    [折线图]             │ │    [柱状图]             │               │
│  └─────────────────────────┘ └─────────────────────────┘               │
│                                                                         │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │                    特征 PSI 热力图 (30 天)                        │   │
│  │    [热力图：行=特征，列=日期，颜色=PSI 值]                          │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│                                                                         │
│  ┌─────────────────────────┐ ┌─────────────────────────┐               │
│  │    模型版本发布历史     │ │    告警统计 (24h)        │               │
│  │    [时间线图]           │ │    [饼图]               │               │
│  └─────────────────────────┘ └─────────────────────────┘               │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

### 8.4 告警规则配置

```yaml
# mlops-alerts.yaml

groups:
  - name: mlops-alerts
    rules:
      # 高错误率告警
      - alert: HighPredictionErrorRate
        expr: rate(risk_assessment_predictions_total{status="error"}[5m]) > 0.05
        for: 5m
        labels:
          severity: critical
        annotations:
          summary: "High prediction error rate detected"
          description: "Error rate is {{ $value }} for model {{ $labels.model }}"
      
      # 高延迟告警
      - alert: HighPredictionLatency
        expr: histogram_quantile(0.99, rate(risk_assessment_prediction_latency_seconds_bucket[5m])) > 5
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "High prediction latency detected"
          description: "P99 latency is {{ $value }}s"
      
      # 特征漂移告警
      - alert: HighFeatureDrift
        expr: feature_psi{model="risk-assessment"} > 0.25
        for: 10m
        labels:
          severity: warning
        annotations:
          summary: "High feature drift for {{ $labels.feature_name }}"
          description: "PSI value is {{ $value }}"
      
      # 模型版本变更告警
      - alert: ModelVersionChanged
        expr: changes(risk_assessment_version_info[1h]) > 0
        for: 0m
        labels:
          severity: info
        annotations:
          summary: "Model version changed"
          description: "New version: {{ $labels.version }}"
```

---

## 九、与现有 AI 模型集成

### 9.1 现有模型集成矩阵

| 模型 | 当前状态 | MLOps 集成方案 | 优先级 |
|------|---------|---------------|--------|
| XGBoost 风险评估 | 生产运行 | MLflow Tracking + Kubeflow | P0 |
| PageRank 根因定位 | 生产运行 | 定制 Pipeline + MLflow Registry | P1 |
| Prophet 流量预测 | 生产运行 | MLflow + 定时调度 | P1 |
| Thompson Sampling | 生产运行 | 集成到部署 Pipeline | P2 |
| DBSCAN 告警聚类 | 生产运行 | 作为预处理组件 | P2 |
| 动态基线检测 | 生产运行 | 集成到监控层 | P0 |

### 9.2 XGBoost 模型迁移方案

```python
# 将现有 XGBoost 模型迁移到 MLflow

import xgboost as xgb
import mlflow
import joblib
from pathlib import Path


def migrate_existing_model(model_path: str, model_name: str):
    """迁移现有 XGBoost 模型到 MLflow"""
    
    # 加载现有模型
    model = joblib.load(model_path)
    
    # 设置 MLflow
    mlflow.set_tracking_uri("http://mlflow:5000")
    
    # 创建新运行
    with mlflow.start_run():
        # 记录模型信息
        mlflow.log_param("model_type", "xgboost")
        mlflow.log_param("xgboost_version", xgb.__version__)
        
        # 记录模型参数
        mlflow.log_params(model.get_params())
        
        # 保存并记录模型
        mlflow.sklearn.log_model(
            sk_model=model,
            artifact_path="model",
            registered_model_name=model_name
        )
    
    print(f"Model migrated: {model_name}")
```

### 9.3 PageRank 流水线集成

```python
# PageRank 图数据更新流水线

from kfp import dsl
from kfp.dsl import component


@dsl.component
def update_graph_data(
    source: str,
    output_graph: Output[Artifact]
):
    """更新图数据组件"""
    import networkx as nx
    import pickle
    
    # 从数据源加载服务依赖图
    G = nx.DiGraph()
    # ... 加载逻辑
    
    # 保存图数据
    with open(output_graph.path, 'wb') as f:
        pickle.dump(G, f)


@dsl.component
def run_pagerank(
    input_graph: Input[Artifact],
    anomaly_scores: dict,
    output_ranking: Output[Artifact]
):
    """运行 PageRank 组件"""
    import networkx as nx
    import pickle
    import json
    
    # 加载图
    with open(input_graph.path, 'rb') as f:
        G = pickle.load(f)
    
    # 运行 Personalized PageRank
    personalization = anomaly_scores
    reverse_graph = G.reverse()
    
    scores = nx.pagerank(
        reverse_graph,
        personalization=personalization,
        alpha=0.85,
        max_iter=100
    )
    
    # 保存结果
    ranking = sorted(scores.items(), key=lambda x: x[1], reverse=True)
    with open(output_ranking.path, 'w') as f:
        json.dump(ranking, f, indent=2)


@dsl.pipeline(
    name="pagerank-root-cause",
    description="PageRank 根因定位流水线"
)
def pagerank_pipeline(
    data_source: str,
    anomaly_scores: dict
):
    """PageRank 根因定位流水线"""
    graph_task = update_graph_data(source=data_source)
    pagerank_task = run_pagerank(
        input_graph=graph_task.outputs["output_graph"],
        anomaly_scores=anomaly_scores
    )
```

### 9.4 Prophet 流量预测调度

```python
# Prophet 模型定时重训练

from kfp import dsl
from kfp.dsl import component


@dsl.component
def train_prophet(
    history_data: Input[Dataset],
    output_model: Output[Model],
    output_forecast: Output[Artifact]
):
    """训练 Prophet 模型"""
    from prophet import Prophet
    import pandas as pd
    import joblib
    
    # 加载历史数据
    df = pd.read_csv(history_data.path)
    
    # 训练模型
    model = Prophet(
        yearly_seasonality=True,
        weekly_seasonality=True,
        daily_seasonality=True
    )
    model.fit(df)
    
    # 预测未来 30 天
    future = model.make_future_dataframe(periods=30, freq='D')
    forecast = model.predict(future)
    
    # 保存模型和预测
    joblib.dump(model, output_model.path)
    forecast.to_csv(output_forecast.path, index=False)


# 调度配置
prophet_schedule = """
# 每天凌晨 3 点重训练
schedule: "0 3 * * *"
pipeline: prophet-daily-retrain
"""
```

---

## 十、总结

### 10.1 实施路线图

| 阶段 | 时间 | 目标 | 交付物 |
|------|------|------|--------|
| **Phase 1** | Month 1 | MLflow 平台搭建 | MLflow Tracking + Registry 可用 |
| **Phase 2** | Month 2 | XGBoost 迁移 | 风险评估模型接入 MLflow |
| **Phase 3** | Month 3 | Kubeflow Pipeline | 训练流水线自动化 |
| **Phase 4** | Month 4 | 监控体系 | Prometheus + Grafana Dashboard |
| **Phase 5** | Month 5 | 完整 CI/CD | GitLab CI 集成 |
| **Phase 6** | Month 6 | 全模型覆盖 | 所有模型接入 MLOps 平台 |

### 10.2 关键成功指标

| 指标 | 当前 | 目标 | 测量方式 |
|------|------|------|---------|
| 模型上线时间 | 1-2 周 | < 1 天 | 从代码提交到生产部署 |
| 实验可复现率 | ~50% | 100% | MLflow 追踪覆盖率 |
| 模型回滚时间 | 30+ 分钟 | < 5 分钟 | 自动回滚触发到完成 |
| 漂移检测覆盖率 | 手动 | 100% | 自动化监控模型比例 |

### 10.3 相关文档

| 文档 | 说明 |
|------|------|
| AI 模型训练与评估详细设计.md | 训练与评估架构 |
| 特征漂移监控设计.md | 漂移检测详细设计 |
| 算法设计详解.md | 现有算法说明 |
| AI 模型测试集设计.md | 测试集管理 |

---

_文档版本：v1.0 | 创建日期：2026-04-10 | 状态：设计完成_
