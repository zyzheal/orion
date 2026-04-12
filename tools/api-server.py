#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Orion 工具调用服务 - 大模型自动调用接口
用途：提供工具调用 API，支持自动检查与索引更新
"""

from flask import Flask, request, jsonify
import subprocess
import os
from datetime import datetime

app = Flask(__name__)

# 工具注册表
TOOLS = {
    "audit-docs": {
        "name": "文档审计",
        "cmd": "bash tools/audit-docs.sh",
        "timeout": 60
    },
    "module-mapper": {
        "name": "模块映射",
        "cmd": "python3 tools/module-mapper.py",
        "timeout": 180
    },
    "detail-check": {
        "name": "细节检查",
        "cmd": "python3 tools/check-detail-completeness.py",
        "timeout": 300
    },
    "dashboard": {
        "name": "仪表盘",
        "cmd": "python3 tools/dashboard-generator.py",
        "timeout": 180
    },
    "auto-index": {
        "name": "索引更新",
        "cmd": "python3 tools/auto-update-index.py",
        "timeout": 60
    },
    "full-check": {
        "name": "完整检查",
        "cmd": "bash tools/full-check-and-update.sh",
        "timeout": 600
    }
}

EXEC_HISTORY = []


@app.route('/api/v1/tools', methods=['GET'])
def list_tools():
    return jsonify({"tools": [{"id": k, "name": v["name"]} for k, v in TOOLS.items()]})


@app.route('/api/v1/recommend', methods=['POST'])
def recommend():
    """根据场景推荐工具"""
    data = request.get_json() or {}
    scenario = data.get("scenario", "")
    
    mapping = {
        "文档质量": ["audit-docs"],
        "模块": ["module-mapper"],
        "实现细节": ["detail-check"],
        "完成度": ["detail-check", "dashboard"],
        "索引": ["auto-index"],
        "全部": ["full-check"]
    }
    
    for key, tools in mapping.items():
        if key in scenario:
            return jsonify({"recommended": tools})
    
    return jsonify({"recommended": []})


@app.route('/api/v1/tools/<tool_id>/validate', methods=['GET'])
def validate(tool_id):
    """验证工具"""
    if tool_id not in TOOLS:
        return jsonify({"valid": False, "error": "工具不存在"}), 404
    
    tool = TOOLS[tool_id]
    cmd_parts = tool["cmd"].split()
    script = cmd_parts[1] if len(cmd_parts) > 1 else ""
    
    if not os.path.exists(script):
        return jsonify({"valid": False, "error": f"脚本不存在：{script}"}), 404
    
    return jsonify({"valid": True, "message": "验证通过"})


@app.route('/api/v1/tools/<tool_id>/logic', methods=['POST'])
def check_logic(tool_id):
    """检查执行逻辑"""
    if tool_id not in TOOLS:
        return jsonify({"valid": False, "error": "工具不存在"}), 404
    
    # 依赖检查
    deps = {
        "auto-index": ["dashboard", "detail-check"],
        "dashboard": ["detail-check"]
    }
    
    if tool_id in deps:
        recent = [e for e in EXEC_HISTORY if e["tool"] in deps[tool_id]]
        if not recent:
            return jsonify({
                "valid": False,
                "error": f"依赖工具未执行：{', '.join(deps[tool_id])}",
                "suggestion": f"请先执行 {', '.join(deps[tool_id])}"
            }), 400
    
    return jsonify({"valid": True, "message": "逻辑验证通过"})


@app.route('/api/v1/tools/<tool_id>/execute', methods=['POST'])
def execute(tool_id):
    """执行工具"""
    if tool_id not in TOOLS:
        return jsonify({"success": False, "error": "工具不存在"}), 404
    
    tool = TOOLS[tool_id]
    data = request.get_json() or {}
    timeout = data.get("timeout", tool["timeout"])
    
    try:
        result = subprocess.run(
            tool["cmd"],
            shell=True,
            capture_output=True,
            text=True,
            timeout=timeout,
            cwd="/Users/heal/orion-design"
        )
        
        record = {
            "tool": tool_id,
            "timestamp": datetime.now().isoformat(),
            "success": result.returncode == 0
        }
        EXEC_HISTORY.append(record)
        
        return jsonify({
            "success": result.returncode == 0,
            "output": result.stdout[:500] if result.stdout else "",
            "error": result.stderr[:500] if result.stderr else ""
        })
    
    except subprocess.TimeoutExpired:
        return jsonify({"success": False, "error": "执行超时"}), 504
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500


@app.route('/api/v1/history', methods=['GET'])
def history():
    return jsonify({"history": EXEC_HISTORY[-10:]})


@app.route('/api/v1/health', methods=['GET'])
def health():
    return jsonify({
        "status": "healthy",
        "tools": len(TOOLS),
        "executions": len(EXEC_HISTORY)
    })


if __name__ == '__main__':
    print("Orion 工具服务启动...")
    print("API: http://localhost:5000/api/v1")
    print("工具:", list(TOOLS.keys()))
    app.run(host='0.0.0.0', port=5000, debug=False)
