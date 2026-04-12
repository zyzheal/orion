#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Orion 设计实现追踪工具
用途：追踪设计文档到代码实现的映射，生成追踪报告
"""

import os
import re
import json
from datetime import datetime
from pathlib import Path

# 代码目录映射
CODE_DIRS = {
    "orion-visor": "/Users/heal/orion-design/orion-visor",
    "orion-knowledge": "/Users/heal/orion-design/orion-knowledge",
    "orion-dba": "/Users/heal/orion-design/orion-dba",
}

# 设计 - 实现映射规则
MAPPING_RULES = {
    "Aegis": {
        "design_docs": ["Orion-完整设计方案.md", "架构设计详解.md"],
        "code_patterns": ["risk_assessor", "aegis", "risk_assess"],
        "api_endpoints": ["/api/v1/risk-assess"],
    },
    "Kintsugi": {
        "design_docs": ["Orion-完整设计方案.md", "架构设计详解.md"],
        "code_patterns": ["kintsugi", "self_healing", "自愈"],
        "api_endpoints": ["/api/v1/self-heal"],
    },
    "AI Code Review": {
        "design_docs": ["AI 模型训练与评估详细设计.md", "算法设计详解.md"],
        "code_patterns": ["ai_review", "code_review", "ai-review"],
        "api_endpoints": ["/api/v1/ai-review"],
    },
}

def find_design_docs(docs_dir):
    """查找所有设计文档"""
    design_docs = []
    
    for root, dirs, files in os.walk(docs_dir):
        for file in files:
            if file.endswith(".md"):
                file_path = os.path.join(root, file)
                design_docs.append({
                    "file": file,
                    "path": file_path,
                    "domain": os.path.basename(root)
                })
    
    return design_docs

def find_code_files(code_dirs):
    """查找所有代码文件"""
    code_files = []
    
    for project, code_dir in code_dirs.items():
        if not os.path.exists(code_dir):
            continue
        
        for root, dirs, files in os.walk(code_dir):
            # 跳过依赖目录
            if 'node_modules' in root or 'vendor' in root or '.git' in root:
                continue
            
            for file in files:
                if file.endswith(('.go', '.java', '.py', '.ts', '.js', '.vue', '.jsx')):
                    file_path = os.path.join(root, file)
                    code_files.append({
                        "file": file,
                        "path": file_path,
                        "project": project,
                        "language": os.path.splitext(file)[1]
                    })
    
    return code_files

def check_api_implementation(code_files, api_endpoints):
    """检查 API 是否实现"""
    implemented = []
    not_implemented = []
    
    for endpoint in api_endpoints:
        found = False
        for code_file in code_files:
            try:
                with open(code_file["path"], 'r', encoding='utf-8') as f:
                    content = f.read(5000)
                    if endpoint in content:
                        found = True
                        implemented.append({
                            "endpoint": endpoint,
                            "file": code_file["file"],
                            "project": code_file["project"]
                        })
                        break
            except:
                pass
        
        if not found:
            not_implemented.append(endpoint)
    
    return implemented, not_implemented

def check_component_implementation(code_files, code_patterns):
    """检查组件是否实现"""
    implementations = []
    
    for pattern in code_patterns:
        for code_file in code_files:
            try:
                with open(code_file["path"], 'r', encoding='utf-8') as f:
                    content = f.read()
                    # 不区分大小写搜索
                    if re.search(pattern, content, re.IGNORECASE):
                        implementations.append({
                            "pattern": pattern,
                            "file": code_file["file"],
                            "path": code_file["path"],
                            "project": code_file["project"]
                        })
                        break
            except:
                pass
    
    return implementations

def analyze_test_coverage(code_files, component_name):
    """分析测试覆盖情况"""
    test_files = []
    
    for code_file in code_files:
        file_dir = os.path.dirname(code_file["path"])
        file_name = os.path.splitext(code_file["file"])[0]
        
        # 查找对应的测试文件
        test_patterns = [
            f"{file_name}_test.go",
            f"{file_name}.test.ts",
            f"test_{file_name}.py",
            f"{file_name}Test.java",
        ]
        
        for test_pattern in test_patterns:
            test_path = os.path.join(file_dir, test_pattern)
            if os.path.exists(test_path):
                test_files.append({
                    "file": test_pattern,
                    "path": test_path,
                    "project": code_file["project"]
                })
                break
        
        # 查找 __tests__ 目录
        tests_dir = os.path.join(file_dir, "__tests__")
        if os.path.exists(tests_dir):
            for file in os.listdir(tests_dir):
                if component_name.lower() in file.lower():
                    test_files.append({
                        "file": file,
                        "path": os.path.join(tests_dir, file),
                        "project": code_file["project"]
                    })
    
    return test_files

def generate_trace_report(docs_dir, code_dirs, output_dir):
    """生成追踪报告"""
    print("📄 查找设计文档...")
    design_docs = find_design_docs(docs_dir)
    print(f"   找到 {len(design_docs)} 份设计文档")
    
    print("💻 查找代码文件...")
    code_files = find_code_files(code_dirs)
    print(f"   找到 {len(code_files)} 个代码文件")
    
    # 分析每个设计组件
    components_analysis = []
    
    for component_name, rules in MAPPING_RULES.items():
        print(f"\n🔍 分析组件：{component_name}")
        
        # 检查设计文档是否存在
        design_found = []
        for doc in design_docs:
            if any(doc_name in doc["file"] for doc_name in rules["design_docs"]):
                design_found.append(doc["file"])
        
        # 检查代码实现
        code_impls = check_component_implementation(code_files, rules["code_patterns"])
        
        # 检查 API 实现
        api_impls, api_missing = check_api_implementation(code_files, rules["api_endpoints"])
        
        # 检查测试覆盖
        test_files = analyze_test_coverage(code_files, component_name)
        
        # 计算完成度
        design_score = 20 if design_found else 0
        code_score = 40 if code_impls else 0
        api_score = 20 if api_impls else 0
        test_score = 20 if test_files else 0
        total_score = design_score + code_score + api_score + test_score
        
        components_analysis.append({
            "component": component_name,
            "design_docs": design_found,
            "design_score": design_score,
            "code_impls": code_impls,
            "code_score": code_score,
            "api_impls": api_impls,
            "api_score": api_score,
            "api_missing": api_missing,
            "test_files": test_files,
            "test_score": test_score,
            "total_score": total_score,
            "status": "✅" if total_score >= 80 else "🟡" if total_score >= 40 else "❌"
        })
        
        print(f"   状态：{components_analysis[-1]['status']} (完成度：{total_score}%)")
    
    # 生成报告
    report_content = f"""# Orion 设计实现追踪报告

> 生成时间：{datetime.now().strftime('%Y-%m-%d %H:%M:%S')}

---

## 总体状态

| 组件 | 设计 | 代码 | API | 测试 | 完成度 | 状态 |
|------|------|------|-----|------|--------|------|
"""
    
    for comp in components_analysis:
        design_status = "✅" if comp["design_docs"] else "❌"
        code_status = "✅" if comp["code_impls"] else "❌"
        api_status = "✅" if comp["api_impls"] else "❌"
        test_status = "✅" if comp["test_files"] else "❌"
        
        report_content += f"| {comp['component']} | {design_status} | {code_status} | {api_status} | {test_status} | {comp['total_score']}% | {comp['status']} |\n"
    
    report_content += f"""
---

## 详细分析

"""
    
    for comp in components_analysis:
        report_content += f"""### {comp['component']}

**完成度**: {comp['total_score']}% {comp['status']}

#### 设计文档 ({len(comp['design_docs'])} 份)
"""
        if comp["design_docs"]:
            for doc in comp["design_docs"]:
                report_content += f"- ✅ {doc}\n"
        else:
            report_content += "- ❌ 未找到设计文档\n"
        
        report_content += f"""
#### 代码实现 ({len(comp['code_impls'])} 个)
"""
        if comp["code_impls"]:
            for impl in comp["code_impls"][:5]:  # 最多显示 5 个
                report_content += f"- ✅ `{impl['file']}` ({impl['project']})\n"
        else:
            report_content += "- ❌ 未找到代码实现\n"
        
        report_content += f"""
#### API 端点
"""
        if comp["api_impls"]:
            for impl in comp["api_impls"]:
                report_content += f"- ✅ `{impl['endpoint']}` → `{impl['file']}`\n"
        if comp["api_missing"]:
            for endpoint in comp["api_missing"]:
                report_content += f"- ❌ `{endpoint}` 未实现\n"
        
        report_content += f"""
#### 测试文件 ({len(comp['test_files'])} 个)
"""
        if comp["test_files"]:
            for test in comp["test_files"]:
                report_content += f"- ✅ `{test['file']}` ({test['project']})\n"
        else:
            report_content += "- ❌ 未找到测试文件\n"
        
        report_content += "\n---\n\n"
    
    report_content += f"""## 待办事项

"""
    
    for comp in components_analysis:
        if comp['total_score'] < 100:
            report_content += f"- [ ] **{comp['component']}**: "
            tasks = []
            if not comp["design_docs"]:
                tasks.append("补充设计文档")
            if not comp["code_impls"]:
                tasks.append("实现代码")
            if comp["api_missing"]:
                tasks.append(f"实现 API ({len(comp['api_missing'])} 个)")
            if not comp["test_files"]:
                tasks.append("添加测试")
            report_content += ", ".join(tasks) + "\n"
    
    report_content += f"""
---

_本报告由 Orion 设计实现追踪工具自动生成_
"""
    
    # 保存报告
    os.makedirs(output_dir, exist_ok=True)
    report_file = os.path.join(output_dir, "设计实现追踪报告.md")
    
    with open(report_file, 'w', encoding='utf-8') as f:
        f.write(report_content)
    
    # 保存 JSON 数据
    json_file = os.path.join(output_dir, "设计实现追踪数据.json")
    with open(json_file, 'w', encoding='utf-8') as f:
        json.dump(components_analysis, f, ensure_ascii=False, indent=2)
    
    return report_file, components_analysis

def main():
    docs_dir = "/Users/heal/orion-design/docs"
    code_dirs = CODE_DIRS
    output_dir = "/Users/heal/orion-design/docs/cache/trace"
    
    print("=" * 60)
    print("  Orion 设计实现追踪工具")
    print("=" * 60)
    print()
    
    report_file, analysis = generate_trace_report(docs_dir, code_dirs, output_dir)
    
    print()
    print("=" * 60)
    print("  追踪完成!")
    print("=" * 60)
    print()
    print(f"📄 追踪报告：{report_file}")
    print(f"📊 分析组件：{len(analysis)} 个")
    print()
    
    # 打印摘要
    completed = sum(1 for a in analysis if a["total_score"] >= 80)
    in_progress = sum(1 for a in analysis if 40 <= a["total_score"] < 80)
    not_started = sum(1 for a in analysis if a["total_score"] < 40)
    
    print("📈 状态摘要:")
    print(f"  ✅ 已完成：{completed} 个")
    print(f"  🟡 进行中：{in_progress} 个")
    print(f"  ❌ 未开始：{not_started} 个")
    print()

if __name__ == "__main__":
    main()
