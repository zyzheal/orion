# Orion AI 模型训练与评估详细设计

> 版本：v1.0  
> 创建日期：2026-04-10  
> 负责人：算法团队  
> 适用范围：CodeReview、RiskAssess、LogAnalysis、SQLReview AI 模型

---

## 一、模型架构总览

### 1.1 模型选型

| 模型名称 | 基础模型 | 微调方式 | 用途 | 部署方式 |
|---------|---------|---------|------|---------|
| CodeReview-v2 | Claude-3.5-Sonnet | Prompt Engineering + Few-Shot | 代码审查 | API 调用 |
| RiskAssess-v1 | XGBoost + LLM Ensemble | 监督学习 | 变更风险评估 | 本地部署 |
| LogAnalysis-v1 | Fine-tuned Llama-3-8B | LoRA 微调 | 日志根因分析 | 本地部署 |
| SQLReview-v1 | Claude-3.5-Sonnet | Prompt Engineering | SQL 审查 | API 调用 |

### 1.2 模型调用架构

```
┌─────────────────────────────────────────────────────────────────┐
│                      AI Skill 执行引擎                          │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────┐        │
│  │  CodeReview │    │ RiskAssess  │    │ LogAnalysis │        │
│  │    Skill    │    │    Skill    │    │    Skill    │        │
│  └──────┬──────┘    └──────┬──────┘    └──────┬──────┘        │
│         │                  │                  │                │
│         ▼                  ▼                  ▼                │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │              AI Router (模型路由层)                      │   │
│  │                                                         │   │
│  │  - 模型选择 (基于成本/延迟/可用性)                        │   │
│  │  - 负载均衡                                             │   │
│  │  - 熔断降级                                             │   │
│  └─────────────────────────────────────────────────────────┘   │
│         │                  │                  │                │
│         ▼                  ▼                  ▼                │
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────┐        │
│  │  Anthropic  │    │  XGBoost    │    │   Llama-3   │        │
│  │   Claude    │    │  (Local)    │    │  (Local)    │        │
│  │    API      │    │  Model      │    │   Model     │        │
│  └─────────────┘    └─────────────┘    └─────────────┘        │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## 二、CodeReview 模型详解

### 2.1 Prompt 模板设计

```python
# prompts/code_review_v2.py

CODE_REVIEW_SYSTEM_PROMPT = """
你是一位资深的代码审查专家，具有 10 年以上的代码审查经验。

你的职责：
1. 识别代码中的安全问题、性能问题、可维护性问题
2. 给出具体、可执行的改进建议
3. 评估问题的严重程度

输出格式要求：
- 必须输出有效的 JSON 数组
- 每个问题包含：file, line, severity, type, message, suggestion
- severity 只能是：CRITICAL, HIGH, MEDIUM, LOW, INFO
"""

CODE_REVIEW_USER_TEMPLATE = """
请审查以下代码变更：

<language>{language}</language>
<diff>
{diff}
</diff>

<context>
- 项目名称：{project_name}
- 变更类型：{change_type}
- 相关文件：{related_files}
</context>

审查重点：
1. 安全问题 (SQL 注入、XSS、命令注入等)
2. 性能问题 (N+1 查询、内存泄漏、锁竞争等)
3. 代码质量问题 (重复代码、过长函数、过度耦合等)
4. 规范问题 (命名、注释、格式化等)

请输出 JSON 格式的审查结果：
[
  {{
    "file": "文件名",
    "line": 行号，
    "severity": "严重程度",
    "type": "问题类型",
    "message": "问题描述",
    "suggestion": "改进建议",
    "cwe_id": "CWE-xxx (如有)",
    "owasp": "Axx:2021 (如有)"
  }}
]
"""

# Few-Shot 示例
FEWSHOT_EXAMPLES = [
    {
        "input": """
def login(request):
    user_id = request.GET.get('id')
    query = f"SELECT * FROM users WHERE id = {user_id}"
    cursor.execute(query)
        """,
        "output": '''[
  {
    "file": "auth.py",
    "line": 3,
    "severity": "CRITICAL",
    "type": "sql-injection",
    "message": "使用字符串格式化构建 SQL 查询，存在 SQL 注入风险",
    "suggestion": "使用参数化查询：cursor.execute('SELECT * FROM users WHERE id = %s', (user_id,))",
    "cwe_id": "CWE-89",
    "owasp": "A03:2021-Injection"
  }
]'''
    },
    # ... 更多示例
]
```

### 2.2 模型调用实现

```python
# services/ai_skills/code_review_skill.py

import asyncio
import json
from typing import List, Optional
from anthropic import AsyncAnthropic
from jsonschema import validate, ValidationError

from .base_skill import BaseSkill
from .validators import JSONSchemaValidator
from .fallbacks import RuleEngineFallback

class CodeReviewSkill(BaseSkill):
    """代码审查 AI Skill"""
    
    OUTPUT_SCHEMA = {
        "type": "array",
        "items": {
            "type": "object",
            "required": ["file", "line", "severity", "type", "message"],
            "properties": {
                "file": {"type": "string"},
                "line": {"type": "integer", "minimum": 1},
                "severity": {
                    "enum": ["CRITICAL", "HIGH", "MEDIUM", "LOW", "INFO"]
                },
                "type": {"type": "string"},
                "message": {"type": "string"},
                "suggestion": {"type": "string"},
                "cwe_id": {"type": "string"},
                "owasp": {"type": "string"}
            }
        }
    }
    
    def __init__(self, config: dict):
        super().__init__(config)
        self.client = AsyncAnthropic(api_key=config["anthropic_api_key"])
        self.validator = JSONSchemaValidator(self.OUTPUT_SCHEMA)
        self.fallback = RuleEngineFallback()
        
    async def execute(self, input_data: dict) -> SkillResult:
        """
        执行代码审查
        
        Args:
            input_data: 包含 diff, language, project_name 等
            
        Returns:
            SkillResult: 审查结果
        """
        retry_count = 0
        last_error = None
        
        while retry_count <= self.config.get("max_retries", 2):
            try:
                # 1. 构建 Prompt
                prompt = self._build_prompt(input_data)
                
                # 2. 调用 LLM
                response = await self._call_llm(prompt)
                
                # 3. 解析输出
                output = self._parse_response(response)
                
                # 4. Schema 验证
                validation = self.validator.validate(output)
                if not validation.valid:
                    raise ValidationError(f"Schema validation failed: {validation.errors}")
                
                # 5. 业务规则验证
                issues = self._validate_business_rules(output)
                
                return SkillResult(
                    success=True,
                    output=issues,
                    metrics={
                        "tokens_used": response.usage.total_tokens,
                        "latency_ms": response.latency_ms,
                        "is_fallback": False
                    }
                )
                
            except Exception as e:
                last_error = e
                retry_count += 1
                
                if retry_count <= self.config.get("max_retries", 2):
                    # 指数退避
                    await asyncio.sleep(2 ** retry_count)
        
        # 所有重试失败，降级到规则引擎
        self.logger.warning(f"LLM failed after {retry_count} retries, using fallback")
        fallback_result = await self.fallback.execute(input_data)
        
        return SkillResult(
            success=True,
            output=fallback_result.issues,
            metrics={
                "is_fallback": True,
                "fallback_reason": str(last_error)
            }
        )
    
    def _build_prompt(self, input_data: dict) -> str:
        """构建审查 Prompt"""
        user_prompt = CODE_REVIEW_USER_TEMPLATE.format(
            language=input_data.get("language", "python"),
            diff=input_data["diff"],
            project_name=input_data.get("project_name", "unknown"),
            change_type=input_data.get("change_type", "feature"),
            related_files=", ".join(input_data.get("related_files", []))
        )
        
        # 添加 Few-Shot 示例
        if self.config.get("enable_few_shot", True):
            examples_section = "\n\n参考示例：\n"
            for example in FEWSHOT_EXAMPLES:
                examples_section += f"输入：\n```\n{example['input']}\n```\n"
                examples_section += f"输出：\n{example['output']}\n\n"
            user_prompt += examples_section
        
        return user_prompt
    
    async def _call_llm(self, prompt: str) -> LLMResponse:
        """调用 Anthropic API"""
        start_time = asyncio.get_event_loop().time()
        
        response = await self.client.messages.create(
            model=self.config.get("model", "claude-3-5-sonnet-20241022"),
            max_tokens=self.config.get("max_tokens", 4096),
            system=CODE_REVIEW_SYSTEM_PROMPT,
            messages=[{"role": "user", "content": prompt}],
            temperature=self.config.get("temperature", 0.1),  # 低温度保证输出稳定
        )
        
        latency_ms = (asyncio.get_event_loop().time() - start_time) * 1000
        
        return LLMResponse(
            content=response.content[0].text,
            usage=response.usage,
            latency_ms=latency_ms
        )
    
    def _parse_response(self, response: LLMResponse) -> List[dict]:
        """解析 LLM 输出"""
        content = response.content.strip()
        
        # 提取 JSON 代码块
        if "```json" in content:
            json_str = content.split("```json")[1].split("```")[0].strip()
        elif "```" in content:
            json_str = content.split("```")[1].split("```")[0].strip()
        else:
            json_str = content
        
        return json.loads(json_str)
    
    def _validate_business_rules(self, issues: List[dict]) -> List[dict]:
        """业务规则验证"""
        validated_issues = []
        
        for issue in issues:
            # 过滤无效行号
            if issue.get("line", 0) <= 0:
                continue
            
            # 标准化 severity
            if issue.get("severity") not in ["CRITICAL", "HIGH", "MEDIUM", "LOW", "INFO"]:
                issue["severity"] = "INFO"
            
            # 确保 message 不为空
            if not issue.get("message"):
                continue
            
            validated_issues.append(issue)
        
        # 按严重程度排序
        severity_order = {
            "CRITICAL": 0, "HIGH": 1, "MEDIUM": 2, "LOW": 3, "INFO": 4
        }
        validated_issues.sort(key=lambda x: severity_order.get(x["severity"], 5))
        
        return validated_issues
```

### 2.3 规则引擎降级实现

```python
# services/ai_skills/fallbacks.py

import re
from typing import List

class RuleEngineFallback:
    """基于规则的降级引擎"""
    
    # 安全规则
    SECURITY_PATTERNS = [
        {
            "pattern": r"f[\"'].*SELECT.*FROM.*\{.*\}",
            "type": "sql-injection",
            "severity": "CRITICAL",
            "message": "存在 SQL 注入风险",
            "suggestion": "使用参数化查询"
        },
        {
            "pattern": r"eval\s*\(",
            "type": "code-injection",
            "severity": "CRITICAL",
            "message": "使用 eval() 存在代码注入风险",
            "suggestion": "避免使用 eval()，考虑使用 ast.literal_eval()"
        },
        {
            "pattern": r"exec\s*\(",
            "type": "command-injection",
            "severity": "CRITICAL",
            "message": "使用 exec() 存在命令注入风险",
            "suggestion": "使用 subprocess 模块替代"
        },
        {
            "pattern": r"os\.system\s*\(",
            "type": "command-injection",
            "severity": "HIGH",
            "message": "使用 os.system() 存在命令注入风险",
            "suggestion": "使用 subprocess.run() 替代"
        },
        {
            "pattern": r"requests\.get\s*\([^)]*\+[^)]*\)",
            "type": "ssrf",
            "severity": "HIGH",
            "message": "存在 SSRF 风险",
            "suggestion": "验证 URL 协议和域名白名单"
        },
    ]
    
    # 代码质量规则
    QUALITY_PATTERNS = [
        {
            "pattern": r"def\s+\w+\s*\([^)]*\):\s*\n\s{4}[^\n]{100,}",
            "type": "long-line",
            "severity": "LOW",
            "message": "代码行超过 100 字符",
            "suggestion": "考虑将长行拆分为多行"
        },
        {
            "pattern": r"def\s+\w+\s*\([^)]*\):\s*\n(\s{4}[^\n]*\n){50,}",
            "type": "long-function",
            "severity": "MEDIUM",
            "message": "函数过长 (超过 50 行)",
            "suggestion": "考虑将函数拆分为多个小函数"
        },
        {
            "pattern": r"except\s*:",
            "type": "bare-except",
            "severity": "MEDIUM",
            "message": "使用裸 except，会捕获所有异常",
            "suggestion": "明确捕获特定异常类型"
        },
        {
            "pattern": r"import\s+\*\s+from",
            "type": "wildcard-import",
            "severity": "LOW",
            "message": "使用通配符导入",
            "suggestion": "明确导入需要的模块"
        },
    ]
    
    async def execute(self, input_data: dict) -> FallbackResult:
        """执行规则引擎审查"""
        diff = input_data.get("diff", "")
        issues = []
        
        # 安全规则检查
        for rule in self.SECURITY_PATTERNS:
            matches = re.finditer(rule["pattern"], diff, re.MULTILINE)
            for match in matches:
                line_number = self._get_line_number(diff, match.start())
                issues.append({
                    "file": self._get_filename(diff),
                    "line": line_number,
                    "severity": rule["severity"],
                    "type": rule["type"],
                    "message": rule["message"],
                    "suggestion": rule["suggestion"]
                })
        
        # 代码质量检查
        for rule in self.QUALITY_PATTERNS:
            matches = re.finditer(rule["pattern"], diff, re.MULTILINE)
            for match in matches:
                line_number = self._get_line_number(diff, match.start())
                issues.append({
                    "file": self._get_filename(diff),
                    "line": line_number,
                    "severity": rule["severity"],
                    "type": rule["type"],
                    "message": rule["message"],
                    "suggestion": rule["suggestion"]
                })
        
        return FallbackResult(issues=issues)
    
    def _get_line_number(self, diff: str, position: int) -> int:
        """计算匹配位置对应的行号"""
        content_before = diff[:position]
        return content_before.count('\n') + 1
    
    def _get_filename(self, diff: str) -> str:
        """从 diff 中提取文件名"""
        match = re.search(r'\+\+\+ b/(\S+)', diff)
        if match:
            return match.group(1)
        return "unknown"
```

---

## 三、RiskAssess 风险预测模型

### 3.1 特征工程

```python
# models/risk_assess/features.py

import pandas as pd
from typing import List, Dict

class RiskFeatureExtractor:
    """风险预测特征提取器"""
    
    FEATURE_NAMES = [
        # 代码变更特征
        "files_changed_count",
        "lines_added",
        "lines_deleted",
        "lines_modified",
        "avg_file_change_size",
        
        # 服务影响特征
        "affected_services_count",
        "is_core_service_change",
        "has_database_migration",
        "has_api_breaking_change",
        "has_new_service",
        
        # 历史失败特征
        "similar_changes_failure_rate",
        "recent_failure_count_7d",
        "recent_failure_count_30d",
        "service_mtbf_days",
        
        # 时间特征
        "is_friday_deploy",
        "is_holiday_period",
        "time_since_last_deploy_hours",
        "deploy_time_of_day",
        
        # 人员特征
        "author_experience_months",
        "author_recent_changes_count",
        "reviewer_count",
        "review_rounds",
        
        # 质量特征
        "test_coverage_changed",
        "code_complexity_delta",
        "security_issues_count",
        "static_analysis_issues_count",
    ]
    
    def extract(self, pr_data: dict) -> Dict[str, float]:
        """提取风险特征"""
        features = {}
        
        # 1. 代码变更特征
        features["files_changed_count"] = len(pr_data.get("files_changed", []))
        features["lines_added"] = pr_data.get("stats", {}).get("additions", 0)
        features["lines_deleted"] = pr_data.get("stats", {}).get("deletions", 0)
        features["lines_modified"] = features["lines_added"] + features["lines_deleted"]
        features["avg_file_change_size"] = (
            features["lines_modified"] / max(features["files_changed_count"], 1)
        )
        
        # 2. 服务影响特征
        features["affected_services_count"] = len(pr_data.get("affected_services", []))
        features["is_core_service_change"] = self._is_core_service(
            pr_data.get("affected_services", [])
        )
        features["has_database_migration"] = self._has_db_migration(
            pr_data.get("files_changed", [])
        )
        features["has_api_breaking_change"] = pr_data.get("has_breaking_change", False)
        features["has_new_service"] = pr_data.get("is_new_service", False)
        
        # 3. 历史失败特征
        history = pr_data.get("history", {})
        features["similar_changes_failure_rate"] = history.get("similar_failure_rate", 0.0)
        features["recent_failure_count_7d"] = history.get("failures_7d", 0)
        features["recent_failure_count_30d"] = history.get("failures_30d", 0)
        features["service_mtbf_days"] = history.get("mtbf_days", 90)
        
        # 4. 时间特征
        deploy_time = pd.to_datetime(pr_data.get("deploy_time"))
        features["is_friday_deploy"] = deploy_time.weekday() == 4
        features["is_holiday_period"] = self._is_holiday_period(deploy_time)
        features["time_since_last_deploy_hours"] = pr_data.get("hours_since_last_deploy", 48)
        features["deploy_time_of_day"] = deploy_time.hour
        
        # 5. 人员特征
        features["author_experience_months"] = pr_data.get("author_experience_months", 12)
        features["author_recent_changes_count"] = pr_data.get("author_changes_7d", 0)
        features["reviewer_count"] = len(pr_data.get("reviewers", []))
        features["review_rounds"] = pr_data.get("review_rounds", 1)
        
        # 6. 质量特征
        features["test_coverage_changed"] = pr_data.get("coverage_delta", 0.0)
        features["code_complexity_delta"] = pr_data.get("complexity_delta", 0)
        features["security_issues_count"] = pr_data.get("security_issues", 0)
        features["static_analysis_issues_count"] = pr_data.get("static_analysis_issues", 0)
        
        return features
    
    def _is_core_service(self, services: List[str]) -> bool:
        """判断是否为核心服务"""
        core_services = {"payment", "order", "user", "auth", "gateway"}
        return bool(set(services) & core_services)
    
    def _has_db_migration(self, files: List[str]) -> bool:
        """判断是否有数据库迁移"""
        migration_patterns = ["migration", "schema", "alembic", "flyway", ".sql"]
        return any(
            any(p in f.lower() for p in migration_patterns)
            for f in files
        )
    
    def _is_holiday_period(self, date: pd.Timestamp) -> bool:
        """判断是否为节假日"""
        # 简化实现，实际应接入节假日 API
        holiday_months = {1, 5, 10}  # 春节、五一、国庆
        return date.month in holiday_months
```

### 3.2 XGBoost 模型实现

```python
# models/risk_assess/model.py

import xgboost as xgb
from sklearn.model_selection import train_test_split
from sklearn.metrics import roc_auc_score, precision_score, recall_score
import joblib
from typing import Tuple, Dict

class RiskAssessmentModel:
    """变更风险预测模型"""
    
    def __init__(self, config: dict):
        self.config = config
        self.model = None
        self.feature_extractor = RiskFeatureExtractor()
        
    def train(self, training_data: pd.DataFrame) -> TrainingResult:
        """
        训练风险预测模型
        
        Args:
            training_data: 训练数据集，包含特征和标签
                标签：0=成功，1=失败
            
        Returns:
            TrainingResult: 训练结果
        """
        # 提取特征
        feature_names = self.feature_extractor.FEATURE_NAMES
        X = training_data[feature_names].values
        y = training_data["failed"].values
        
        # 划分训练集/验证集
        X_train, X_val, y_train, y_val = train_test_split(
            X, y, test_size=0.2, random_state=42, stratify=y
        )
        
        # 创建 DMatrix
        dtrain = xgb.DMatrix(X_train, label=y_train)
        dval = xgb.DMatrix(X_val, label=y_val)
        
        # 模型参数
        params = {
            "objective": "binary:logistic",
            "eval_metric": "auc",
            "max_depth": 6,
            "learning_rate": 0.1,
            "n_estimators": 100,
            "subsample": 0.8,
            "colsample_bytree": 0.8,
            "min_child_weight": 3,
            "scale_pos_weight": sum(y_train == 0) / sum(y_train == 1),  # 处理类别不平衡
        }
        
        # 训练
        self.model = xgb.train(
            params,
            dtrain,
            num_boost_round=100,
            evals=[(dval, "val")],
            early_stopping_rounds=10,
            verbose_eval=10,
        )
        
        # 评估
        y_pred_proba = self.model.predict(dval)
        y_pred = (y_pred_proba > 0.5).astype(int)
        
        metrics = {
            "auc": roc_auc_score(y_val, y_pred_proba),
            "precision": precision_score(y_val, y_pred),
            "recall": recall_score(y_val, y_pred),
            "feature_importance": dict(zip(
                feature_names,
                self.model.get_score(importance_type="gain").values()
            ))
        }
        
        return TrainingResult(
            success=True,
            metrics=metrics,
            model=self.model
        )
    
    def predict(self, pr_data: dict) -> RiskPrediction:
        """
        预测变更风险
        
        Args:
            pr_data: PR 数据
            
        Returns:
            RiskPrediction: 风险预测结果
        """
        # 提取特征
        features = self.feature_extractor.extract(pr_data)
        feature_vector = [features[name] for name in self.feature_extractor.FEATURE_NAMES]
        
        # 预测
        dtest = xgb.DMatrix([feature_vector])
        risk_score = self.model.predict(dtest)[0]
        
        # 风险等级
        if risk_score >= 0.7:
            risk_level = "HIGH"
        elif risk_score >= 0.4:
            risk_level = "MEDIUM"
        else:
            risk_level = "LOW"
        
        # 关键风险因素
        risk_factors = self._explain_prediction(feature_vector)
        
        return RiskPrediction(
            risk_score=risk_score * 100,  # 转换为 0-100
            risk_level=risk_level,
            risk_factors=risk_factors,
            recommendation=self._get_recommendation(risk_level)
        )
    
    def _explain_prediction(self, feature_vector: list) -> list:
        """解释预测结果 (基于特征重要性)"""
        # 简化实现，实际应使用 SHAP 值
        feature_names = self.feature_extractor.FEATURE_NAMES
        importance = self.model.get_score(importance_type="gain")
        
        risk_factors = []
        for i, name in enumerate(feature_names):
            if feature_vector[i] > 0.5:  # 阈值可根据实际情况调整
                risk_factors.append({
                    "factor": name,
                    "value": feature_vector[i],
                    "importance": importance.get(i, 0)
                })
        
        # 按重要性排序
        risk_factors.sort(key=lambda x: x["importance"], reverse=True)
        return risk_factors[:5]  # 返回 Top 5 风险因素
    
    def _get_recommendation(self, risk_level: str) -> str:
        """给出建议"""
        recommendations = {
            "HIGH": "建议：1) 增加 Code Review 人员 2) 确保测试覆盖率 3) 避免周五部署",
            "MEDIUM": "建议：1) 确保有回滚方案 2) 关注部署后的监控指标",
            "LOW": "建议：标准发布流程即可",
        }
        return recommendations.get(risk_level, "建议：按标准流程执行")
    
    def save(self, path: str):
        """保存模型"""
        joblib.dump(self.model, path)
    
    def load(self, path: str):
        """加载模型"""
        self.model = joblib.load(path)
```

---

## 四、模型评估体系

### 4.1 评估指标定义

```python
# models/evaluation/metrics.py

from typing import List, Dict
from dataclasses import dataclass

@dataclass
class EvaluationResult:
    """评估结果"""
    model_name: str
    dataset_name: str
    metrics: Dict[str, float]
    passed: bool
    report_url: str

class ModelEvaluator:
    """模型评估器"""
    
    def evaluate_code_review(
        self,
        predictions: List[dict],
        ground_truth: List[dict]
    ) -> EvaluationResult:
        """
        评估 CodeReview 模型
        
        Args:
            predictions: 模型预测结果
            ground_truth: 真实标注
            
        Returns:
            EvaluationResult: 评估结果
        """
        # 计算 TP/FP/FN
        tp = fp = fn = 0
        
        for pred, truth in zip(predictions, ground_truth):
            pred_issues = set(
                (i["file"], i["line"], i["type"]) 
                for i in pred.get("issues", [])
            )
            truth_issues = set(
                (i["file"], i["line"], i["type"]) 
                for i in truth.get("issues", [])
            )
            
            tp += len(pred_issues & truth_issues)
            fp += len(pred_issues - truth_issues)
            fn += len(truth_issues - pred_issues)
        
        # 计算指标
        precision = tp / (tp + fp + 1e-8)
        recall = tp / (tp + fn + 1e-8)
        f1 = 2 * precision * recall / (precision + recall + 1e-8)
        fpr = fp / (fp + 200)  # 假设 TN=200
        
        # 判定是否通过
        passed = (
            precision > 0.85 and
            recall > 0.80 and
            f1 > 0.82 and
            fpr < 0.10
        )
        
        return EvaluationResult(
            model_name="CodeReview-v2",
            dataset_name="CodeReview-500",
            metrics={
                "precision": round(precision, 4),
                "recall": round(recall, 4),
                "f1_score": round(f1, 4),
                "false_positive_rate": round(fpr, 4)
            },
            passed=passed,
            report_url=f"/evaluations/code-review/{uuid.uuid4()}"
        )
    
    def evaluate_risk_assessment(
        self,
        predictions: List[float],
        ground_truth: List[int]
    ) -> EvaluationResult:
        """
        评估 RiskAssess 模型
        
        Args:
            predictions: 预测风险分数 (0-1)
            ground_truth: 真实结果 (0=成功，1=失败)
        """
        from sklearn.metrics import roc_auc_score, precision_recall_curve
        
        # AUC
        auc = roc_auc_score(ground_truth, predictions)
        
        # 最佳阈值下的 Precision/Recall
        precisions, recalls, thresholds = precision_recall_curve(
            ground_truth, predictions
        )
        
        # 找到 F1 最大的阈值
        f1_scores = 2 * precisions * recalls / (precisions + recalls + 1e-8)
        best_idx = f1_scores.argmax()
        best_threshold = thresholds[best_idx]
        
        # 判定是否通过
        passed = auc > 0.85
        
        return EvaluationResult(
            model_name="RiskAssess-v1",
            dataset_name="RiskAssess-1000",
            metrics={
                "auc": round(auc, 4),
                "best_threshold": round(best_threshold, 4),
                "precision_at_threshold": round(precisions[best_idx], 4),
                "recall_at_threshold": round(recalls[best_idx], 4)
            },
            passed=passed,
            report_url=f"/evaluations/risk-assess/{uuid.uuid4()}"
        )
```

### 4.2 评估报告生成

```python
# models/evaluation/report.py

from datetime import datetime
from typing import Dict, Any

class EvaluationReportGenerator:
    """评估报告生成器"""
    
    TEMPLATE = """
# AI 模型评估报告

## 评估信息
- 模型名称：{model_name}
- 评估日期：{eval_date}
- 评估人：{evaluator}
- 验证集：{dataset_name} v{dataset_version}

## 评估结果

### 核心指标
| 指标 | 目标值 | 实测值 | 状态 |
|------|--------|--------|------|
{metrics_table}

### 整体评估：{overall_status}

## 详细分析

### 分类别表现
{category_breakdown}

### Bad Case 分析
{bad_cases}

## 改进建议
{recommendations}

## 附录
- 详细测试结果：{detailed_results_url}
- 原始数据：{raw_data_url}
"""
    
    def generate(
        self,
        result: EvaluationResult,
        detailed_results: Dict[str, Any]
    ) -> str:
        """生成评估报告"""
        
        # 生成指标表格
        metrics_table = self._generate_metrics_table(result.metrics)
        
        # 整体状态
        overall_status = "✅ 通过" if result.passed else "❌ 未通过"
        
        # 分类别表现
        category_breakdown = self._generate_category_breakdown(detailed_results)
        
        # Bad Case 分析
        bad_cases = self._analyze_bad_cases(detailed_results)
        
        # 改进建议
        recommendations = self._generate_recommendations(result, detailed_results)
        
        return self.TEMPLATE.format(
            model_name=result.model_name,
            eval_date=datetime.now().strftime("%Y-%m-%d"),
            evaluator="算法团队",
            dataset_name=result.dataset_name,
            dataset_version="1.0",
            metrics_table=metrics_table,
            overall_status=overall_status,
            category_breakdown=category_breakdown,
            bad_cases=bad_cases,
            recommendations=recommendations,
            detailed_results_url=result.report_url,
            raw_data_url="/datasets/raw"
        )
    
    def _generate_metrics_table(self, metrics: Dict[str, float]) -> str:
        """生成指标表格"""
        targets = {
            "precision": "> 0.85",
            "recall": "> 0.80",
            "f1_score": "> 0.82",
            "false_positive_rate": "< 10%",
            "auc": "> 0.85"
        }
        
        rows = []
        for name, value in metrics.items():
            if isinstance(value, float):
                value = round(value, 4)
            target = targets.get(name, "-")
            status = "✅" if self._meet_target(name, value, target) else "❌"
            rows.append(f"| {name} | {target} | {value} | {status} |")
        
        return "\n".join(rows)
    
    def _meet_target(self, metric: str, value: float, target: str) -> bool:
        """判断是否达到目标"""
        if target.startswith(">"):
            threshold = float(target.replace(">", ""))
            return value > threshold
        elif target.startswith("<"):
            threshold = float(target.replace("<", ""))
            return value < threshold
        return True
```

---

## 五、持续训练 pipeline

### 5.1 训练流水线

```python
# pipelines/model_training.py

import asyncio
from datetime import datetime
from typing import List

class ModelTrainingPipeline:
    """模型训练流水线"""
    
    async def run(self, model_name: str, config: TrainingConfig) -> TrainingRun:
        """
        执行模型训练流水线
        
        流程:
        1. 数据采集
        2. 数据清洗
        3. 特征工程
        4. 模型训练
        5. 模型评估
        6. 模型注册
        """
        run_id = f"train-{model_name}-{datetime.now().strftime('%Y%m%d-%H%M%S')}"
        
        try:
            # Step 1: 数据采集
            await self._collect_data(config.data_source)
            
            # Step 2: 数据清洗
            cleaned_data = await self._clean_data()
            
            # Step 3: 特征工程
            features = await self._extract_features(cleaned_data)
            
            # Step 4: 模型训练
            model = await self._train_model(features, config.model_params)
            
            # Step 5: 模型评估
            eval_result = await self._evaluate_model(model, config.eval_dataset)
            
            # Step 6: 模型注册
            if eval_result.passed:
                await self._register_model(model, eval_result)
                return TrainingRun(
                    run_id=run_id,
                    success=True,
                    model_version=model.version,
                    eval_result=eval_result
                )
            else:
                return TrainingRun(
                    run_id=run_id,
                    success=False,
                    error="模型评估未通过"
                )
                
        except Exception as e:
            return TrainingRun(
                run_id=run_id,
                success=False,
                error=str(e)
            )
    
    async def _collect_data(self, data_source: DataSource):
        """数据采集"""
        # 从生产环境采集数据
        pass
    
    async def _clean_data(self) -> pd.DataFrame:
        """数据清洗"""
        # 去重、填充缺失值、异常值处理
        pass
    
    async def _extract_features(self, data: pd.DataFrame) -> pd.DataFrame:
        """特征工程"""
        pass
    
    async def _train_model(
        self, 
        features: pd.DataFrame, 
        params: dict
    ) -> Model:
        """模型训练"""
        pass
    
    async def _evaluate_model(
        self, 
        model: Model, 
        eval_dataset: str
    ) -> EvaluationResult:
        """模型评估"""
        pass
    
    async def _register_model(self, model: Model, eval_result: EvaluationResult):
        """模型注册"""
        # 保存到模型仓库
        pass
```

---

## 六、模型监控

### 6.1 监控指标

| 指标 | 采集方式 | 告警阈值 | 说明 |
|------|---------|---------|------|
| 调用量 | Prometheus | - | 每分钟调用次数 |
| 平均延迟 | Prometheus | P95 > 5s | 请求处理延迟 |
| 错误率 | Prometheus | > 5% | 调用失败比例 |
| Token 消耗 | 日志统计 | - | API Token 使用量 |
| 降级触发率 | 日志统计 | > 10% | LLM 失败降级比例 |
| 输出验证失败率 | 日志统计 | > 5% | JSON Schema 验证失败 |
| 准确率下降 | 定期评估 | F1 < 0.80 | 模型准确率 |

### 6.2 监控告警配置

```yaml
# monitoring/alerts/ai_skills.yaml

groups:
- name: ai_skills
  rules:
  # P1 - AI Skill 错误率升高
  - alert: AISkillHighErrorRate
    expr: |
      sum(rate(ai_skill_executions_total{status="failed"}[5m])) 
      / 
      sum(rate(ai_skill_executions_total[5m])) 
      > 0.05
    for: 5m
    labels:
      severity: high
    annotations:
      summary: "AI Skill 错误率超过 5%"
      
  # P2 - AI Skill 延迟升高
  - alert: AISkillHighLatency
    expr: |
      histogram_quantile(0.95, 
        sum(rate(ai_skill_execution_duration_seconds_bucket[5m])) 
        by (le, skill)) 
      > 5
    for: 10m
    labels:
      severity: medium
    annotations:
      summary: "AI Skill P95 延迟超过 5 秒"
      
  # P2 - 降级触发率升高
  - alert: AISkillHighFallbackRate
    expr: |
      sum(rate(ai_skill_executions_total{is_fallback="true"}[10m])) 
      / 
      sum(rate(ai_skill_executions_total[10m])) 
      > 0.1
    for: 15m
    labels:
      severity: medium
    annotations:
      summary: "AI Skill 降级触发率超过 10%"
      
  # P3 - 输出验证失败率升高
  - alert: AISkillHighValidationFailure
    expr: |
      sum(rate(ai_skill_executions_total{validation_passed="false"}[10m])) 
      / 
      sum(rate(ai_skill_executions_total[10m])) 
      > 0.05
    for: 30m
    labels:
      severity: low
    annotations:
      summary: "AI Skill 输出验证失败率超过 5%"
```

---

_文档版本：v1.0_  
_创建日期：2026-04-10_
