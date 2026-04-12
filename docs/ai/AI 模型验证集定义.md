# AI 模型验证集定义

> 版本：v1.0  
> 创建日期：2026-04-10  
> 负责人：算法团队  
> 适用范围：AI 算法引擎、LLM 推理层、AI Skill

---

## 一、验证集总览

### 1.1 验证集分类

| 验证集名称 | 用途 | 数据量 | 更新频率 |
|-----------|------|--------|---------|
| CodeReview-500 | 代码审查准确率评估 | 500 条 | 月度 |
| RiskAssess-1000 | 风险评估模型验证 | 1000 条 | 月度 |
| LogAnalysis-300 | 日志根因分析验证 | 300 条 | 季度 |
| SQLReview-200 | SQL 审查准确率验证 | 200 条 | 月度 |
| LLM-Output-1000 | LLM 输出格式验证 | 1000 条 | 周度 |

### 1.2 验证集存储结构

```
datasets/
├── code-review/
│   ├── v1/
│   │   ├── train.json      # 训练集 (400 条)
│   │   ├── validation.json # 验证集 (50 条)
│   │   ├── test.json       # 测试集 (50 条)
│   │   └── README.md       # 数据集说明
│   └── v2/
│       └── ...
├── risk-assess/
│   └── ...
├── log-analysis/
│   └── ...
└── README.md               # 总说明
```

---

## 二、CodeReview 验证集

### 2.1 数据格式

```json
{
  "version": "1.0",
  "name": "CodeReview-500",
  "description": "代码审查 AI 模型验证集",
  "created_at": "2026-04-10",
  "total_count": 500,
  "split": {
    "train": 400,
    "validation": 50,
    "test": 50
  },
  "samples": [
    {
      "id": "cr-001",
      "language": "python",
      "diff": "@@ -1,5 +1,8 @@\n-def login(request):\n+def login(request):\n+    user_id = request.GET.get('id')\n+    query = f\"SELECT * FROM users WHERE id = {user_id}\"\n     ...\n-",
      "issues": [
        {
          "file": "auth.py",
          "line": 4,
          "severity": "CRITICAL",
          "type": "sql-injection",
          "message": "存在 SQL 注入风险",
          "suggestion": "使用参数化查询"
        }
      ],
      "metadata": {
        "repo": "payment-service",
        "pr_number": 123,
        "author_experience": "junior"
      }
    }
  ]
}
```

### 2.2 评估指标

| 指标 | 计算公式 | 目标值 |
|------|---------|--------|
| Precision | TP / (TP + FP) | > 0.85 |
| Recall | TP / (TP + FN) | > 0.80 |
| F1-Score | 2 * Precision * Recall / (Precision + Recall) | > 0.82 |
| False Positive Rate | FP / (FP + TN) | < 10% |
| Avg Latency | 总耗时 / 样本数 | < 15s |

### 2.3 评估流程

```python
def evaluate_code_review(model, test_dataset):
    """评估代码审查模型"""
    
    results = {
        'tp': 0, 'fp': 0, 'fn': 0, 'tn': 0,
        'latencies': []
    }
    
    for sample in test_dataset.samples:
        start_time = time.time()
        
        # 模型预测
        prediction = model.review(sample.diff)
        
        latency = time.time() - start_time
        results['latencies'].append(latency)
        
        # 对比真实标注
        actual_issues = set(
            (i.file, i.line, i.type) 
            for i in sample.issues
        )
        predicted_issues = set(
            (i.file, i.line, i.type) 
            for i in prediction.issues
        )
        
        # 计算 TP/FP/FN
        results['tp'] += len(actual_issues & predicted_issues)
        results['fp'] += len(predicted_issues - actual_issues)
        results['fn'] += len(actual_issues - predicted_issues)
    
    # 计算指标
    precision = results['tp'] / (results['tp'] + results['fp'] + 1e-8)
    recall = results['tp'] / (results['tp'] + results['fn'] + 1e-8)
    f1 = 2 * precision * recall / (precision + recall + 1e-8)
    fpr = results['fp'] / (results['fp'] + results['tn'] + 1e-8)
    avg_latency = sum(results['latencies']) / len(results['latencies'])
    
    return {
        'precision': round(precision, 4),
        'recall': round(recall, 4),
        'f1_score': round(f1, 4),
        'false_positive_rate': round(fpr, 4),
        'avg_latency_sec': round(avg_latency, 2),
        'passed': (
            precision > 0.85 and 
            recall > 0.80 and 
            f1 > 0.82 and 
            fpr < 0.10 and 
            avg_latency < 15
        )
    }
```

### 2.4 测试样本示例

```json
{
  "id": "cr-001",
  "language": "python",
  "diff": "diff --git a/auth.py b/auth.py\n--- a/auth.py\n+++ b/auth.py\n@@ -1,5 +1,8 @@\n def login(request):\n-    user_id = request.GET.get('id')\n-    query = f\"SELECT * FROM users WHERE id = {user_id}\"\n+    user_id = request.GET.get('id')\n+    # TODO: 需要修复\n+    query = f\"SELECT * FROM users WHERE id = {user_id}\"\n     cursor.execute(query)\n     ...\n",
  "issues": [
    {
      "file": "auth.py",
      "line": 5,
      "severity": "CRITICAL",
      "type": "sql-injection",
      "message": "使用字符串格式化构建 SQL 查询，存在 SQL 注入风险。攻击者可以通过构造恶意的 user_id 参数执行任意 SQL 命令。",
      "suggestion": "使用参数化查询：cursor.execute('SELECT * FROM users WHERE id = %s', (user_id,))",
      "cwe_id": "CWE-89",
      "owasp": "A03:2021-Injection"
    }
  ],
  "metadata": {
    "repo": "payment-service",
    "pr_number": 123,
    "author": "zhangsan",
    "author_experience": "junior",
    "created_at": "2026-03-15T10:00:00Z"
  }
}
```

---

## 三、RiskAssess 验证集

### 3.1 数据格式

```json
{
  "version": "1.0",
  "name": "RiskAssess-1000",
  "description": "AI 变更风险评估模型验证集",
  "created_at": "2026-04-10",
  "total_count": 1000,
  "split": {
    "train": 700,
    "validation": 150,
    "test": 150
  },
  "samples": [
    {
      "id": "ra-001",
      "features": {
        "files_changed_count": 12,
        "lines_added": 340,
        "lines_deleted": 28,
        "affected_services_count": 3,
        "is_core_service_change": true,
        "has_database_migration": true,
        "has_api_breaking_change": false,
        "has_new_service": true,
        "similar_changes_failure_rate": 0.05,
        "recent_failure_count_7d": 0,
        "service_mtbf_days": 90,
        "is_friday_deploy": false,
        "is_holiday_period": false,
        "time_since_last_deploy_hours": 48,
        "author_experience_months": 24,
        "reviewer_count": 2,
        "review_rounds": 2,
        "test_coverage_changed": 0.85,
        "code_complexity_delta": 5,
        "security_issues_count": 0
      },
      "risk_score": 42,
      "risk_level": "MEDIUM",
      "actual_outcome": "success",
      "metadata": {
        "pr_number": 478,
        "service": "payment-service",
        "deployed_at": "2026-04-10T09:24:00Z"
      }
    }
  ]
}
```

### 3.2 评估指标

| 指标 | 目标值 | 说明 |
|------|--------|------|
| AUC | > 0.85 | 风险分类 AUC |
| Precision (High Risk) | > 0.80 | 高风险预测准确率 |
| Recall (High Risk) | > 0.75 | 高风险召回率 |
| MAE (风险评分) | < 10 | 风险评分平均误差 |

---

## 四、LLM 输出验证集

### 4.1 验证目的

验证 LLM 输出格式的稳定性和 JSON Schema 合规性。

### 4.2 验证用例

```json
{
  "version": "1.0",
  "name": "LLM-Output-1000",
  "description": "LLM 输出格式验证集",
  "total_count": 1000,
  "categories": {
    "code_review": 200,
    "sql_review": 150,
    "log_analysis": 150,
    "diagnosis": 200,
    "suggestion": 150,
    "report": 150
  },
  "test_cases": [
    {
      "id": "llm-001",
      "category": "code_review",
      "prompt_template": "code-review-v2",
      "input": {
        "diff": "@@ -1,3 +1,5 @@\n..."
      },
      "expected_schema": {
        "type": "array",
        "items": {
          "type": "object",
          "required": ["file", "line", "severity", "type", "message"],
          "properties": {
            "file": {"type": "string"},
            "line": {"type": "integer"},
            "severity": {"enum": ["CRITICAL", "HIGH", "MEDIUM", "LOW", "INFO"]},
            "type": {"type": "string"},
            "message": {"type": "string"},
            "suggestion": {"type": "string"}
          }
        }
      },
      "validation_rules": [
        "valid_json",
        "schema_conformance",
        "severity_valid",
        "message_not_empty"
      ]
    }
  ]
}
```

### 4.3 验证流程

```python
import json
from jsonschema import validate, ValidationError

def validate_llm_output(output: str, expected_schema: dict) -> ValidationResult:
    """验证 LLM 输出"""
    
    result = ValidationResult(
        valid=False,
        errors=[],
        warnings=[]
    )
    
    # 1. JSON 格式验证
    try:
        parsed = json.loads(output)
    except json.JSONDecodeError as e:
        result.errors.append(f"Invalid JSON: {str(e)}")
        return result
    
    # 2. Schema 验证
    try:
        validate(instance=parsed, schema=expected_schema)
    except ValidationError as e:
        result.errors.append(f"Schema validation failed: {e.message}")
    
    # 3. 业务规则验证
    if isinstance(parsed, list):
        for i, item in enumerate(parsed):
            if item.get('severity') not in ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW', 'INFO']:
                result.errors.append(f"Item {i}: Invalid severity value")
            if not item.get('message'):
                result.errors.append(f"Item {i}: Message is required")
    
    # 4. 长度检查
    if len(output) > 16384:
        result.warnings.append(f"Output too long: {len(output)} bytes")
    
    result.valid = len(result.errors) == 0
    return result
```

### 4.4 重试与降级策略

```python
async def execute_with_retry_and_fallback(
    skill_id: str,
    input_data: dict,
    max_retries: int = 2
) -> ExecuteResult:
    """执行 AI Skill，带重试和降级"""
    
    last_error = None
    
    for attempt in range(max_retries + 1):
        try:
            # 调用 LLM
            response = await call_llm(skill_id, input_data)
            
            # 验证输出
            validation = validate_llm_output(
                response.output,
                skill.expected_schema
            )
            
            if validation.valid:
                return ExecuteResult(
                    success=True,
                    output=response.output,
                    metrics=response.metrics
                )
            else:
                last_error = f"Validation failed: {validation.errors}"
                
        except LLMError as e:
            last_error = str(e)
        
        # 重试前等待
        if attempt < max_retries:
            await asyncio.sleep(2 ** attempt)  # 指数退避
    
    # 所有重试失败，降级到规则引擎
    log.warning(f"LLM failed after {max_retries} retries, falling back to rule engine")
    return await execute_rule_engine(skill_id, input_data)
```

---

## 五、验证集更新流程

### 5.1 更新频率

| 验证集 | 更新频率 | 负责人 | 审批人 |
|--------|---------|--------|--------|
| CodeReview-500 | 月度 | 算法工程师 | 架构师 |
| RiskAssess-1000 | 月度 | 算法工程师 | 架构师 |
| LogAnalysis-300 | 季度 | 算法工程师 | 架构师 |
| SQLReview-200 | 月度 | 算法工程师 | 架构师 |
| LLM-Output-1000 | 周度 | 算法工程师 | Tech Lead |

### 5.2 更新流程

```
1. 收集新数据
   └── 从生产环境采集真实案例
   └── 人工标注新样本

2. 数据清洗
   └── 去重
   └── 格式标准化
   └── 质量检查

3. 评估基准
   └── 用新验证集评估当前模型
   └── 确保不劣化 (回归测试)

4. 审批发布
   └── 技术评审
   └── 版本发布
   └── 通知相关团队
```

### 5.3 版本管理

```yaml
版本命名：语义化版本 (Major.Minor.Patch)
- Major: 数据格式变更/大规模扩充
- Minor: 新增样本/优化标注
- Patch: 修正错误标注

版本存储：Git
存储路径：datasets/{dataset_name}/v{version}/
```

---

## 六、评估报告模板

### 6.1 评估报告格式

```markdown
# AI 模型评估报告

## 评估信息
- 模型名称：CodeReview-v2.1
- 评估日期：2026-04-10
- 评估人：算法工程师
- 验证集：CodeReview-500 v1.0

## 评估结果

### 核心指标
| 指标 | 目标值 | 实测值 | 状态 |
|------|--------|--------|------|
| Precision | > 0.85 | 0.87 | ✅ |
| Recall | > 0.80 | 0.82 | ✅ |
| F1-Score | > 0.82 | 0.84 | ✅ |
| False Positive Rate | < 10% | 8% | ✅ |
| Avg Latency | < 15s | 12s | ✅ |

### 整体评估：✅ 通过

## 问题分析

### False Positive 分析
- 共 15 个 FP
- 主要类型：
  1. 误报类型 A：8 个 (53%)
  2. 误报类型 B：5 个 (33%)
  3. 其他：2 个 (14%)

### False Negative 分析
- 共 12 个 FN
- 主要漏报：
  1. 漏报类型 A：6 个 (50%)
  2. 漏报类型 B：4 个 (33%)
  3. 其他：2 个 (17%)

## 改进建议
1. 针对误报类型 A，优化规则 XXX
2. 针对漏报类型 B，增加训练数据
3. 考虑调整阈值从 0.5 到 0.45

## 附录
- 详细测试结果：[链接]
- 原始数据：[链接]
```

---

## 七、监控告警

### 7.1 监控指标

| 指标 | 告警规则 | 严重级别 |
|------|---------|---------|
| 准确率下降 | 连续 3 天 F1 < 0.80 | WARNING |
| 准确率大幅下降 | F1 < 0.75 | CRITICAL |
| 延迟增加 | P95 > 20s | WARNING |
| JSON 验证失败率 | > 5% | WARNING |
| 降级触发率 | > 10% | WARNING |

### 7.2 告警响应

```yaml
告警响应流程:
  1. 收到告警
  2. 检查验证集是否过期
  3. 检查模型服务健康状态
  4. 分析失败样本
  5. 必要时回滚模型版本
  6. 更新验证集或重新训练
```

---

_文档版本：v1.0_  
_创建日期：2026-04-10_  
_状态：草稿，待评审_
