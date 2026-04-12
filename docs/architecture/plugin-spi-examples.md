# Plugin SPI 开发示例 (Plugin SPI Development Examples)

> **文档版本**: v1.0 | **创建日期**: 2026-04-10 | **状态**: ✅ 完成

---

## 一、概述

### 1.1 Plugin SPI 架构回顾

基于 [ADR-002](./ADR-002-Plugin-SPI 接口设计.md)，Orion Plugin SPI 支持以下插件类型：

| 插件类型 | 用途 | 运行模式 | 示例 |
|---------|------|---------|------|
| **Custom Task** | 扩展流水线 Stage | gRPC+WASM / 容器 | 安全扫描、代码质量检查 |
| **Webhook Handler** | 处理外部事件 | HTTP / 进程 | GitHub Webhook、Jira 回调 |
| **AI Skill** | 扩展 AI 能力 | SDK / 进程 | 代码审查、测试生成 |
| **Approval Provider** | 自定义审批源 | HTTP / 容器 | 外部审批系统对接 |
| **Notification Channel** | 扩展通知渠道 | HTTP / 进程 | 钉钉、企微、飞书 |
| **Deployment Strategy** | 自定义部署策略 | 容器 / 进程 | 灰度发布、蓝绿部署 |

### 1.2 插件安全级别

| 安全级别 | 隔离方式 | 适用场景 | 开发复杂度 |
|---------|---------|---------|-----------|
| **Level 1 (高)** | WASM 沙箱 | 未信任的第三方插件 | 高 |
| **Level 2 (中)** | 容器隔离 | 内部开发的插件 | 中 |
| **Level 3 (低)** | 进程隔离 | 官方插件/SDK 插件 | 低 |

---

## 二、Custom Task 插件开发示例

### 2.1 Protobuf 接口定义

**文件**: `proto/task.proto`

```protobuf
syntax = "proto3";

package orion.plugin.task;

// Custom Task 服务定义
service CustomTaskService {
  // 执行任务
  rpc Execute(ExecuteRequest) returns (ExecuteResponse);
  
  // 获取任务状态
  rpc GetStatus(StatusRequest) returns (StatusResponse);
  
  // 取消任务
  rpc Cancel(CancelRequest) returns (CancelResponse);
}

// 执行请求
message ExecuteRequest {
  string task_id = 1;
  string task_type = 2;
  map<string, string> parameters = 3;
  ResourceLimits limits = 4;
}

// 资源限制
message ResourceLimits {
  int64 max_memory_mb = 1;
  int64 max_cpu_percent = 2;
  int64 timeout_seconds = 3;
}

// 执行响应
message ExecuteResponse {
  string status = 1;  // running/succeeded/failed
  string message = 2;
  map<string, string> outputs = 3;
  repeated LogEntry logs = 4;
}

// 日志条目
message LogEntry {
  int64 timestamp = 1;
  string level = 2;  // info/warn/error
  string message = 3;
}

// 状态请求
message StatusRequest {
  string task_id = 1;
}

// 状态响应
message StatusResponse {
  string status = 1;
  int64 progress_percent = 2;
  string message = 3;
  map<string, string> outputs = 4;
}

// 取消请求
message CancelRequest {
  string task_id = 1;
  string reason = 2;
}

// 取消响应
message CancelResponse {
  bool cancelled = 1;
  string message = 2;
}
```

### 2.2 Python SDK 实现示例

**文件**: `security-scan-task/main.py`

```python
#!/usr/bin/env python3
"""
Security Scan Custom Task
功能：执行代码安全扫描（Semgrep）
"""

import grpc
from concurrent import futures
import subprocess
import json
import os
from typing import Dict, List

import task_pb2
import task_pb2_grpc


class CustomTaskServicer(task_pb2_grpc.CustomTaskServicer):
    """Custom Task 服务实现"""
    
    def __init__(self):
        self.tasks = {}  # task_id -> task_info
    
    def Execute(self, request, context):
        """执行安全扫描任务"""
        task_id = request.task_id
        task_type = request.task_type
        
        # 记录任务信息
        self.tasks[task_id] = {
            'status': 'running',
            'progress': 0,
            'logs': [],
            'outputs': {}
        }
        
        # 获取参数
        params = dict(request.parameters)
        source_dir = params.get('source_dir', '.')
        scan_level = params.get('scan_level', 'full')
        
        # 执行 Semgrep 扫描
        try:
            logs = self._run_semgrep(source_dir, scan_level, task_id)
            
            self.tasks[task_id]['status'] = 'succeeded'
            self.tasks[task_id]['progress'] = 100
            self.tasks[task_id]['outputs'] = {
                'scan_result': json.dumps({'findings': len(logs)}),
                'report_url': f'/reports/{task_id}.html'
            }
            
            return task_pb2.ExecuteResponse(
                status='succeeded',
                message=f'Scan completed with {len(logs)} findings',
                outputs=self.tasks[task_id]['outputs'],
                logs=[task_pb2.LogEntry(
                    timestamp=int(time.time() * 1000),
                    level='info',
                    message=log
                ) for log in logs]
            )
            
        except Exception as e:
            self.tasks[task_id]['status'] = 'failed'
            return task_pb2.ExecuteResponse(
                status='failed',
                message=str(e),
                logs=[task_pb2.LogEntry(
                    timestamp=int(time.time() * 1000),
                    level='error',
                    message=str(e)
                )]
            )
    
    def _run_semgrep(self, source_dir: str, scan_level: str, task_id: str) -> List[str]:
        """执行 Semgrep 扫描"""
        logs = []
        logs.append(f"Starting security scan in {source_dir}")
        logs.append(f"Scan level: {scan_level}")
        
        # 构建 Semgrep 命令
        cmd = ['semgrep', '--json', '--config', 'auto', source_dir]
        
        if scan_level == 'quick':
            cmd.extend(['--max-lines-per-file', '1000'])
        
        # 执行命令
        result = subprocess.run(
            cmd,
            capture_output=True,
            text=True,
            timeout=300  # 5 分钟超时
        )
        
        # 解析结果
        if result.returncode == 0:
            findings = json.loads(result.stdout)
            logs.append(f"Found {len(findings.get('results', []))} issues")
        else:
            logs.append(f"Scan failed: {result.stderr}")
        
        return logs
    
    def GetStatus(self, request, context):
        """获取任务状态"""
        task_id = request.task_id
        if task_id not in self.tasks:
            context.abort(grpc.StatusCode.NOT_FOUND, 'Task not found')
        
        task_info = self.tasks[task_id]
        return task_pb2.StatusResponse(
            status=task_info['status'],
            progress_percent=task_info['progress'],
            message=f"Task {task_id}",
            outputs=task_info.get('outputs', {})
        )
    
    def Cancel(self, request, context):
        """取消任务"""
        task_id = request.task_id
        if task_id in self.tasks:
            self.tasks[task_id]['status'] = 'cancelled'
            return task_pb2.CancelResponse(
                cancelled=True,
                message='Task cancelled'
            )
        return task_pb2.CancelResponse(
            cancelled=False,
            message='Task not found'
        )


def serve():
    """启动 gRPC 服务"""
    server = grpc.server(futures.ThreadPoolExecutor(max_workers=10))
    task_pb2_grpc.add_CustomTaskServicer_to_server(
        CustomTaskServicer(), server
    )
    
    port = os.environ.get('PLUGIN_PORT', '50051')
    server.add_insecure_port(f'[::]:{port}')
    server.start()
    print(f"Security Scan Task started on port {port}")
    server.wait_for_termination()


if __name__ == '__main__':
    serve()
```

**文件**: `security-scan-task/requirements.txt`

```
grpcio>=1.50.0
grpcio-tools>=1.50.0
```

### 2.3 TypeScript SDK 实现示例

**文件**: `code-quality-task/src/task.ts`

```typescript
import * as grpc from '@grpc/grpc-js';
import * as protoLoader from '@grpc/proto-loader';
import { ExecuteRequest, ExecuteResponse } from './proto/task_pb';

// 加载 Protobuf 定义
const PROTO_PATH = __dirname + '/../proto/task.proto';
const packageDefinition = protoLoader.loadSync(PROTO_PATH, {
  keepCase: true,
  longs: String,
  enums: String,
  defaults: true,
  oneofs: true,
});
const taskProto = grpc.loadPackageDefinition(packageDefinition).orion.plugin.task;

interface TaskInfo {
  status: string;
  progress: number;
  logs: string[];
  outputs: Record<string, string>;
}

class CustomTaskService {
  private tasks: Map<string, TaskInfo> = new Map();

  async execute(call: any, callback: Function) {
    const request = call.request as ExecuteRequest;
    const taskId = request.taskId;
    
    console.log(`Executing task ${taskId} of type ${request.taskType}`);
    
    // 初始化任务
    this.tasks.set(taskId, {
      status: 'running',
      progress: 0,
      logs: [],
      outputs: {}
    });
    
    try {
      // 执行代码质量检查
      const logs = await this.runCodeQuality(request.parameters);
      
      const taskInfo = this.tasks.get(taskId)!;
      taskInfo.status = 'succeeded';
      taskInfo.progress = 100;
      taskInfo.logs = logs;
      taskInfo.outputs = {
        quality_score: '95',
        issues_count: '3',
        report_url: `/reports/${taskId}.html`
      };
      
      callback(null, {
        status: 'succeeded',
        message: `Found ${logs.length} issues`,
        outputs: taskInfo.outputs,
        logs: logs.map((log, i) => ({
          timestamp: Date.now() + i,
          level: 'info',
          message: log
        }))
      });
      
    } catch (error: any) {
      const taskInfo = this.tasks.get(taskId)!;
      taskInfo.status = 'failed';
      
      callback(null, {
        status: 'failed',
        message: error.message,
        logs: [{
          timestamp: Date.now(),
          level: 'error',
          message: error.message
        }]
      });
    }
  }
  
  private async runCodeQuality(params: Record<string, string>): Promise<string[]> {
    const logs: string[] = [];
    const sourceDir = params.source_dir || '.';
    
    logs.push(`Starting code quality check in ${sourceDir}`);
    
    // 模拟代码质量检查
    await new Promise(resolve => setTimeout(resolve, 2000));
    logs.push('Analyzing code structure...');
    
    await new Promise(resolve => setTimeout(resolve, 2000));
    logs.push('Checking code duplication...');
    
    await new Promise(resolve => setTimeout(resolve, 2000));
    logs.push('Calculating complexity metrics...');
    
    logs.push('Code quality check completed');
    
    return logs;
  }
  
  getStatus(call: any, callback: Function) {
    const taskId = call.request.taskId;
    const taskInfo = this.tasks.get(taskId);
    
    if (!taskInfo) {
      callback({
        code: grpc.status.NOT_FOUND,
        details: 'Task not found'
      });
      return;
    }
    
    callback(null, {
      status: taskInfo.status,
      progressPercent: taskInfo.progress,
      message: `Task ${taskId}`,
      outputs: taskInfo.outputs
    });
  }
  
  cancel(call: any, callback: Function) {
    const taskId = call.request.taskId;
    const taskInfo = this.tasks.get(taskId);
    
    if (taskInfo) {
      taskInfo.status = 'cancelled';
      callback(null, { cancelled: true, message: 'Task cancelled' });
    } else {
      callback(null, { cancelled: false, message: 'Task not found' });
    }
  }
}

// 启动服务
const server = new grpc.Server();
server.addService(
  (taskProto as any).CustomTaskService.service,
  new CustomTaskService() as any
);

const port = process.env.PLUGIN_PORT || '50051';
server.bindAsync(
  `0.0.0.0:${port}`,
  grpc.ServerCredentials.createInsecure(),
  (error, port) => {
    if (error) {
      console.error('Failed to start server:', error);
    } else {
      console.log(`Code Quality Task started on port ${port}`);
      server.start();
    }
  }
);
```

---

## 三、Webhook Handler 插件示例

### 3.1 GitHub Webhook 处理示例

**文件**: `github-webhook/main.go`

```go
package main

import (
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"io/ioutil"
	"net/http"
	"os"
)

// Webhook 处理器
type GitHubWebhookHandler struct {
	secret string
}

func NewGitHubWebhookHandler() *GitHubWebhookHandler {
	return &GitHubWebhookHandler{
		secret: os.Getenv("GITHUB_WEBHOOK_SECRET"),
	}
}

// 处理 Webhook 请求
func (h *GitHubWebhookHandler) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	// 1. 验证签名
	signature := r.Header.Get("X-Hub-Signature-256")
	payload, err := ioutil.ReadAll(r.Body)
	if err != nil {
		http.Error(w, "Failed to read payload", http.StatusInternalServerError)
		return
	}
	
	if !h.verifySignature(payload, signature) {
		http.Error(w, "Invalid signature", http.StatusUnauthorized)
		return
	}
	
	// 2. 解析事件类型
	eventType := r.Header.Get("X-GitHub-Event")
	
	// 3. 根据事件类型处理
	switch eventType {
	case "push":
		h.handlePushEvent(payload, w)
	case "pull_request":
		h.handlePREvent(payload, w)
	case "issues":
		h.handleIssueEvent(payload, w)
	default:
		fmt.Printf("Unsupported event type: %s\n", eventType)
		w.WriteHeader(http.StatusOK)
	}
}

// 验证签名
func (h *GitHubWebhookHandler) verifySignature(payload []byte, signature string) bool {
	mac := hmac.New(sha256.New, []byte(h.secret))
	mac.Write(payload)
	expectedMAC := hex.EncodeToString(mac.Sum(nil))
	
	return hmac.Equal([]byte("sha256="+expectedMAC), []byte(signature))
}

// 处理 Push 事件
func (h *GitHubWebhookHandler) handlePushEvent(payload []byte, w http.ResponseWriter) {
	var event struct {
		Repository struct {
			Name     string `json:"name"`
			FullName string `json:"full_name"`
		} `json:"repository"`
		Ref        string   `json:"ref"`
		Commits    []struct {
			ID      string `json:"id"`
			Message string `json:"message"`
			Author  struct {
				Name  string `json:"name"`
				Email string `json:"email"`
			} `json:"author"`
		} `json:"commits"`
	}
	
	json.Unmarshal(payload, &event)
	
	fmt.Printf("Push to %s@%s by %s\n", 
		event.Repository.FullName, 
		event.Ref,
		event.Commits[0].Author.Name)
	
	// 触发流水线
	// h.triggerPipeline(event.Repository.FullName, event.Ref)
	
	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(map[string]string{
		"status": "success",
		"message": "Push event processed",
	})
}

// 处理 Pull Request 事件
func (h *GitHubWebhookHandler) handlePREvent(payload []byte, w http.ResponseWriter) {
	var event struct {
		Action string `json:"action"`
		Number int    `json:"number"`
		PullRequest struct {
			Title  string `json:"title"`
			Head   struct {
				Ref string `json:"ref"`
				Sha string `json:"sha"`
			} `json:"head"`
		} `json:"pull_request"`
		Repository struct {
			FullName string `json:"full_name"`
		} `json:"repository"`
	}
	
	json.Unmarshal(payload, &event)
	
	fmt.Printf("PR %s #%d: %s\n", 
		event.Repository.FullName,
		event.Number,
		event.Action)
	
	// 根据 action 处理
	switch event.Action {
	case "opened", "synchronize":
		// 触发 CI 检查
		// h.triggerCI(event.PullRequest.Head.Sha)
	case "closed":
		// PR 关闭，清理资源
	}
	
	w.WriteHeader(http.StatusOK)
}

// 处理 Issue 事件
func (h *GitHubWebhookHandler) handleIssueEvent(payload []byte, w http.ResponseWriter) {
	var event struct {
		Action string `json:"action"`
		Issue  struct {
			Number int    `json:"number"`
			Title  string `json:"title"`
			Body   string `json:"body"`
		} `json:"issue"`
	}
	
	json.Unmarshal(payload, &event)
	
	// 自动分类 Issue
	if event.Action == "opened" {
		category := h.classifyIssue(event.Issue.Body)
		fmt.Printf("Issue #%d classified as: %s\n", event.Issue.Number, category)
	}
	
	w.WriteHeader(http.StatusOK)
}

func (h *GitHubWebhookHandler) classifyIssue(body string) string {
	// 简单的关键词匹配
	if contains(body, []string{"bug", "error", "fail"}) {
		return "bug"
	}
	if contains(body, []string{"feature", "enhancement"}) {
		return "feature"
	}
	return "question"
}

func contains(text string, keywords []string) bool {
	for _, keyword := range keywords {
		if len(keyword) > 0 && containsRune(text, []rune(keyword)[0]) {
			return true
		}
	}
	return false
}

func main() {
	handler := NewGitHubWebhookHandler()
	
	http.HandleFunc("/webhook/github", handler.ServeHTTP)
	
	port := os.Getenv("PLUGIN_PORT")
	if port == "" {
		port = "8080"
	}
	
	fmt.Printf("GitHub Webhook Handler started on port %s\n", port)
	http.ListenAndServe(":"+port, nil)
}
```

---

## 四、AI Skill 插件示例

### 4.1 Skill 接口实现

**文件**: `code-review-skill/main.py`

```python
#!/usr/bin/env python3
"""
Code Review AI Skill
功能：使用 LLM 进行代码审查
"""

import os
import json
import httpx
from typing import Dict, List, Any


class CodeReviewSkill:
    """代码审查 AI Skill"""
    
    def __init__(self):
        self.llm_api = os.getenv('LLM_API_URL', 'https://api.qwen.ai/v1')
        self.api_key = os.getenv('LLM_API_KEY')
        self.model = os.getenv('LLM_MODEL', 'qwen-3')
    
    async def review_code(self, diff: str, context: Dict[str, Any]) -> Dict[str, Any]:
        """
        审查代码变更
        
        Args:
            diff: Git diff 内容
            context: 上下文信息（仓库名、PR 号等）
        
        Returns:
            审查结果
        """
        # 构建 Prompt
        prompt = self._build_prompt(diff, context)
        
        # 调用 LLM
        response = await self._call_llm(prompt)
        
        # 解析结果
        result = self._parse_response(response)
        
        return result
    
    def _build_prompt(self, diff: str, context: Dict[str, Any]) -> str:
        """构建审查 Prompt"""
        return f"""
你是一个专业的代码审查专家。请审查以下代码变更：

仓库：{context.get('repo', 'unknown')}
PR: #{context.get('pr_number', 'N/A')}
作者：{context.get('author', 'unknown')}

代码变更：
```diff
{diff}
```

请从以下方面进行审查：
1. 代码质量问题（命名、结构、注释）
2. 潜在 bug（空指针、资源泄漏、边界条件）
3. 安全问题（SQL 注入、XSS、敏感信息泄露）
4. 性能问题（循环、数据库查询、内存使用）

请以 JSON 格式返回审查结果：
{{
  "summary": "总体评价",
  "issues": [
    {{
      "severity": "high|medium|low",
      "category": "bug|security|performance|style",
      "line": 行号，
      "message": "问题描述",
      "suggestion": "改进建议"
    }}
  ],
  "approved": true/false,
  "comments": ["额外评论"]
}}
"""
    
    async def _call_llm(self, prompt: str) -> str:
        """调用 LLM API"""
        async with httpx.AsyncClient() as client:
            response = await client.post(
                f"{self.llm_api}/chat/completions",
                headers={
                    "Authorization": f"Bearer {self.api_key}",
                    "Content-Type": "application/json"
                },
                json={
                    "model": self.model,
                    "messages": [
                        {"role": "system", "content": "你是一个专业的代码审查专家。"},
                        {"role": "user", "content": prompt}
                    ],
                    "temperature": 0.3,
                    "max_tokens": 4096
                }
            )
            response.raise_for_status()
            return response.json()["choices"][0]["message"]["content"]
    
    def _parse_response(self, response: str) -> Dict[str, Any]:
        """解析 LLM 响应"""
        try:
            # 提取 JSON
            start = response.find('{')
            end = response.rfind('}') + 1
            json_str = response[start:end]
            
            result = json.loads(json_str)
            
            # 验证 Schema
            required_fields = ['summary', 'issues', 'approved']
            for field in required_fields:
                if field not in result:
                    raise ValueError(f"Missing required field: {field}")
            
            return result
            
        except Exception as e:
            return {
                "summary": "审查失败",
                "issues": [],
                "approved": False,
                "comments": [f"解析错误：{str(e)}"]
            }


# Skill 注册
def register_skill():
    """注册 Skill 到 Orion"""
    return {
        "name": "code-review",
        "version": "1.0.0",
        "description": "AI 代码审查",
        "author": "Orion Team",
        "entrypoint": "code_review_skill:CodeReviewSkill",
        "config": {
            "llm_api_url": "https://api.qwen.ai/v1",
            "model": "qwen-3",
            "max_tokens": 4096
        }
    }
```

---

## 五、插件打包与发布

### 5.1 插件目录结构

```
code-review-skill/
├── src/
│   ├── main.py           # 主入口
│   ├── skill.py          # Skill 实现
│   └── utils.py          # 工具函数
├── tests/
│   ├── test_skill.py     # 单元测试
│   └── fixtures/         # 测试数据
├── plugin.yaml           # 插件描述文件
├── requirements.txt      # Python 依赖
├── Dockerfile           # 容器镜像
├── Makefile             # 构建脚本
└── README.md            # 使用说明
```

### 5.2 打包脚本

**文件**: `scripts/package.sh`

```bash
#!/bin/bash
set -e

PLUGIN_NAME="code-review-skill"
VERSION="1.0.0"

echo "Packaging plugin: $PLUGIN_NAME v$VERSION"

# 1. 运行测试
echo "Running tests..."
pytest tests/ -v

# 2. 构建 Docker 镜像
echo "Building Docker image..."
docker build -t registry.orion.internal/$PLUGIN_NAME:$VERSION .

# 3. 创建插件包
echo "Creating plugin package..."
mkdir -p dist/
tar -czf dist/$PLUGIN_NAME-$VERSION.tar.gz \
    --exclude='.git' \
    --exclude='tests' \
    --exclude='dist' \
    .

# 4. 生成 checksum
echo "Generating checksum..."
sha256sum dist/$PLUGIN_NAME-$VERSION.tar.gz > dist/$PLUGIN_NAME-$VERSION.sha256

# 5. 推送镜像
echo "Pushing Docker image..."
docker push registry.orion.internal/$PLUGIN_NAME:$VERSION

echo "Packaging completed!"
echo "Plugin package: dist/$PLUGIN_NAME-$VERSION.tar.gz"
echo "Checksum: dist/$PLUGIN_NAME-$VERSION.sha256"
```

### 5.3 版本管理

遵循 [Semantic Versioning](https://semver.org/)：

- **MAJOR.MINOR.PATCH** (如 1.2.3)
- MAJOR: 不兼容的 API 变更
- MINOR: 向后兼容的功能新增
- PATCH: 向后兼容的问题修复

---

## 六、插件市场提交规范

### 6.1 plugin.yaml 字段说明

```yaml
apiVersion: plugin.orion.dev/v1alpha1
kind: Plugin
metadata:
  name: code-review-skill        # 必填：插件唯一标识
  version: 1.0.0                 # 必填：语义化版本号
  displayName: "AI 代码审查"      # 必填：显示名称
  description: "..."             # 必填：描述（50-200 字）
  icon: "/plugins/code-review/icon.svg"  # 可选：图标路径
  author: "Orion Team"           # 必填：作者/组织
  license: "Apache-2.0"          # 必填：许可证
  homepage: "https://..."        # 可选：主页
  repository: "https://..."      # 可选：代码仓库
  keywords: ["ai", "code-review"] # 可选：关键词

spec:
  # 服务配置、路由、依赖等...
```

### 6.2 图标和截图要求

**图标**:
- 格式：SVG 或 PNG
- 尺寸：256x256 或矢量图
- 风格：简洁、易识别
- 背景：透明或纯色

**截图**:
- 数量：1-5 张
- 格式：PNG
- 尺寸：1920x1080 或 1280x720
- 内容：核心功能界面

### 6.3 文档要求

**README.md 必须包含**:

1. **功能介绍** (100-300 字)
2. **安装方法** (步骤清晰)
3. **配置说明** (参数列表)
4. **使用示例** (代码片段)
5. **常见问题** (FAQ)
6. **许可证** (明确声明)

---

## 七、参考文档

- [ADR-002: Plugin SPI 接口设计](./ADR-002-Plugin-SPI 接口设计.md)
- [外部系统接入指南](../integration/external-system-onboarding.md)
- [微前端开发规范](../frontend/micro-frontend-development-guide.md)

---

_文档版本：v1.0 | 最后更新：2026-04-10 | 维护团队：Orion Platform Team_
