#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Orion 文档进度管理工具
用途：统计文档完成度、模块实现进度，自动更新索引
"""

import os
import re
import json
from datetime import datetime

DOCS_DIR = "/Users/heal/orion-design/docs"
CACHE_DIR = f"{DOCS_DIR}/cache"
CODE_DIRS = ["/Users/heal/orion-design/orion-visor", "/Users/heal/orion-design/orion-knowledge"]

# 28 个核心模块
MODULES = {f"M{i:02d}": name for i, name in enumerate([
    "效能看板", "流水线可视化", "审批工作台", "安全审计中心", "Pipeline 引擎",
    "多分支产品线", "配置管理 GitOps", "通知协作", "AI 算法引擎", "LLM 推理层",
    "AI 增强层", "Skill 管理", "代码管理", "构建环境", "多工具链", "智能部署",
    "自愈引擎", "安全合规", "多租户", "IaC 管理", "审计中心", "FinOps 成本",
    "SSO/RBAC", "事件总线", "数据存储", "可观测性", "插件扩展", "Orion-Knowledge"
], 1)}


def count_docs():
    """统计文档"""
    stats = {"total": 0, "approved": 0, "by_domain": {}}
    
    for domain in os.listdir(DOCS_DIR):
        domain_path = os.path.join(DOCS_DIR, domain)
        if not os.path.isdir(domain_path):
            continue
        
        domain_stats = {"total": 0, "approved": 0}
        for f in os.listdir(domain_path):
            if f.endswith('.md'):
                domain_stats["total"] += 1
                with open(os.path.join(domain_path, f), 'r', encoding='utf-8') as file:
                    if 'status: approved' in file.read():
                        domain_stats["approved"] += 1
        
        stats["by_domain"][domain] = domain_stats
        stats["total"] += domain_stats["total"]
        stats["approved"] += domain_stats["approved"]
    
    return stats


def count_code():
    """统计代码"""
    stats = {"total": 0, "tests": 0}
    
    for code_dir in CODE_DIRS:
        if not os.path.exists(code_dir):
            continue
        
        for root, _, files in os.walk(code_dir):
            if any(x in root for x in ['node_modules', 'vendor', '.git']):
                continue
            
            for f in files:
                if f.endswith(('.go', '.py', '.ts', '.js', '.java')):
                    stats["total"] += 1
                    if any(x in f for x in ['_test.', '.test.', 'Test.']):
                        stats["tests"] += 1
    
    return stats


def generate_progress_report():
    """生成进度报告"""
    os.makedirs(CACHE_DIR, exist_ok=True)
    
    doc_stats = count_docs()
    code_stats = count_code()
    
    # 计算完成度
    doc_completeness = (doc_stats["approved"] / doc_stats["total"] * 100) if doc_stats["total"] > 0 else 0
    code_completeness = (code_stats["tests"] / code_stats["total"] * 100) if code_stats["total"] > 0 else 0
    overall = (doc_completeness + code_completeness) / 2
    
    report = {
        "timestamp": datetime.now().isoformat(),
        "documents": doc_stats,
        "code": code_stats,
        "completeness": {
            "documents": doc_completeness,
            "code": code_completeness,
            "overall": overall
        }
    }
    
    # 保存 JSON
    with open(f"{CACHE_DIR}/进度数据.json", 'w', encoding='utf-8') as f:
        json.dump(report, f, ensure_ascii=False, indent=2)
    
    # 生成 Markdown 摘要
    md = f"""# Orion 文档进度报告

> 生成时间：{datetime.now().strftime('%Y-%m-%d %H:%M:%S')}

---

## 总体进度

| 指标 | 数值 | 完成度 |
|------|------|--------|
| 文档总数 | {doc_stats['total']} | {doc_completeness:.1f}% |
| 已批准文档 | {doc_stats['approved']} | - |
| 代码文件 | {code_stats['total']} | {code_completeness:.1f}% |
| 测试文件 | {code_stats['tests']} | - |
| **总体完成度** | - | **{overall:.1f}%** |

---

## 各领域文档统计

| 领域 | 文档数 | 已批准 | 完成度 |
|------|--------|--------|--------|
"""
    
    for domain, stats in doc_stats["by_domain"].items():
        completeness = (stats["approved"] / stats["total"] * 100) if stats["total"] > 0 else 0
        md += f"| {domain} | {stats['total']} | {stats['approved']} | {completeness:.1f}% |\n"
    
    md += f"""
---

## 待办事项

- [ ] 补充未批准文档的评审
- [ ] 增加测试覆盖率 (当前 {code_completeness:.1f}%)
- [ ] 更新模块索引卡
"""
    
    with open(f"{CACHE_DIR}/进度报告.md", 'w', encoding='utf-8') as f:
        f.write(md)
    
    # 更新 INDEX.md
    update_index(report)
    
    print(f"✅ 进度报告已生成")
    print(f"   📄 {CACHE_DIR}/进度报告.md")
    print(f"   📊 总体完成度：{overall:.1f}%")
    
    return report


def update_index(report):
    """更新 INDEX.md"""
    index_file = "/Users/heal/orion-design/INDEX.md"
    
    if not os.path.exists(index_file):
        return
    
    with open(index_file, 'r', encoding='utf-8') as f:
        content = f.read()
    
    # 更新统计
    content = re.sub(r'总文档数 \| \d+ 份', f"总文档数 | {report['documents']['total']} 份", content)
    content = re.sub(r'最后更新：\d{4}-\d{2}-\d{2}', f"最后更新：{datetime.now().strftime('%Y-%m-%d')}", content)
    
    # 添加进度摘要
    progress_section = f"""

---

## 📊 进度摘要 (自动更新)

> 更新时间：{datetime.now().strftime('%Y-%m-%d %H:%M:%S')}

| 指标 | 数值 |
|------|------|
| 总体完成度 | {report['completeness']['overall']:.1f}% |
| 文档完成度 | {report['completeness']['documents']:.1f}% |
| 代码完成度 | {report['completeness']['code']:.1f}% |
| 文档总数 | {report['documents']['total']} |
| 代码文件 | {report['code']['total']} |
"""
    
    if "## 📊 进度摘要" not in content:
        content = content.rstrip() + progress_section
    
    with open(index_file, 'w', encoding='utf-8') as f:
        f.write(content)
    
    print(f"   ✅ INDEX.md 已更新")


if __name__ == '__main__':
    print("=" * 50)
    print("  Orion 文档进度管理工具")
    print("=" * 50)
    print()
    generate_progress_report()
