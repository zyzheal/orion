#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Orion 模块映射工具
用途：为每个模块创建索引卡，建立模块 - 文档映射关系
"""

import os
import json
import re
from datetime import datetime
from pathlib import Path

def parse_frontmatter(content):
    """简单解析 frontmatter，不依赖 yaml 库"""
    if not content.startswith('---'):
        return {}
    
    parts = content.split('---')
    if len(parts) < 2:
        return {}
    
    fm_text = parts[1]
    data = {}
    
    for line in fm_text.strip().split('\n'):
        if ':' in line:
            key, value = line.split(':', 1)
            key = key.strip()
            value = value.strip().strip('"\'')
            data[key] = value
    
    return data

# 模块定义 (28 个核心模块)
MODULES = {
    "M1": {"name": "效能看板", "domain": "efficiency", "owner": "待指定"},
    "M2": {"name": "流水线可视化", "domain": "frontend", "owner": "待指定"},
    "M3": {"name": "审批工作台", "domain": "frontend", "owner": "待指定"},
    "M4": {"name": "安全审计中心", "domain": "security", "owner": "待指定"},
    "M5": {"name": "Pipeline 引擎", "domain": "cicd", "owner": "待指定"},
    "M6": {"name": "多分支产品线", "domain": "architecture", "owner": "待指定"},
    "M7": {"name": "配置管理 GitOps", "domain": "architecture", "owner": "待指定"},
    "M8": {"name": "通知协作", "domain": "collaboration", "owner": "待指定"},
    "M9": {"name": "AI 算法引擎", "domain": "ai", "owner": "待指定"},
    "M10": {"name": "LLM 推理层", "domain": "ai", "owner": "待指定"},
    "M11": {"name": "AI 增强层", "domain": "ai", "owner": "待指定"},
    "M12": {"name": "Skill 管理", "domain": "ai", "owner": "待指定"},
    "M13": {"name": "代码管理", "domain": "integration", "owner": "待指定"},
    "M14": {"name": "构建环境", "domain": "cicd", "owner": "待指定"},
    "M15": {"name": "多工具链", "domain": "architecture", "owner": "待指定"},
    "M16": {"name": "智能部署", "domain": "architecture", "owner": "待指定"},
    "M17": {"name": "自愈引擎", "domain": "sre", "owner": "待指定"},
    "M18": {"name": "安全合规", "domain": "security", "owner": "待指定"},
    "M19": {"name": "多租户", "domain": "architecture", "owner": "待指定"},
    "M20": {"name": "IaC 管理", "domain": "iac", "owner": "待指定"},
    "M21": {"name": "审计中心", "domain": "security", "owner": "待指定"},
    "M22": {"name": "FinOps 成本", "domain": "efficiency", "owner": "待指定"},
    "M23": {"name": "SSO/RBAC", "domain": "security", "owner": "待指定"},
    "M24": {"name": "事件总线", "domain": "event-bus", "owner": "待指定"},
    "M25": {"name": "数据存储", "domain": "db", "owner": "待指定"},
    "M26": {"name": "可观测性", "domain": "sre", "owner": "待指定"},
    "M27": {"name": "插件扩展", "domain": "architecture", "owner": "待指定"},
    "M28": {"name": "Orion-Knowledge", "domain": "knowledge", "owner": "待指定"},
}

# 需求 - 模块映射
REQUIREMENTS_MAP = {
    "US-1.1": {"desc": "一键触发流水线", "module": "M2"},
    "US-1.2": {"desc": "流水线实时状态", "module": "M2"},
    "US-2.1": {"desc": "AI 自动审查代码", "module": "M9"},
    "US-2.5": {"desc": "AI 学习团队规范", "module": "M9"},
    "US-3.4": {"desc": "AI 推荐测试用例", "module": "M9"},
    "US-4.1": {"desc": "AI 评估变更风险", "module": "M5"},
    "US-6.1": {"desc": "系统自动诊断故障", "module": "M17"},
    "US-6.5": {"desc": "故障知识库查询", "module": "M28"},
    "US-7.1": {"desc": "查看 DORA 四指标", "module": "M1"},
    "US-8.4": {"desc": "On-Call 排班", "module": "M17"},
    "FR-1.8": {"desc": "自动周报", "module": "M1"},
    "E2E-11": {"desc": "新人 Onboarding", "module": "M8"},
}

def find_related_docs(module_id, module_info, docs_dir):
    """查找与模块相关的文档"""
    related_docs = []
    domain = module_info.get("domain", "")
    module_name = module_info.get("name", "")
    
    # 搜索策略 1: 按目录搜索
    domain_dir = os.path.join(docs_dir, domain)
    if os.path.exists(domain_dir):
        for file in os.listdir(domain_dir):
            if file.endswith(".md"):
                file_path = os.path.join(domain_dir, file)
                with open(file_path, 'r', encoding='utf-8') as f:
                    content = f.read(2000)  # 读取前 2000 字符
                    # 检查是否包含模块名称或 ID
                    if module_name.lower() in content.lower() or module_id.lower() in content.lower():
                        related_docs.append({
                            "file": file,
                            "path": file_path,
                            "relevance": "high"
                        })
    
    # 搜索策略 2: 全文搜索模块名称
    for root, dirs, files in os.walk(docs_dir):
        for file in files:
            if file.endswith(".md"):
                file_path = os.path.join(root, file)
                try:
                    with open(file_path, 'r', encoding='utf-8') as f:
                        content = f.read()
                        if module_name in content and file_path not in [d["path"] for d in related_docs]:
                            related_docs.append({
                                "file": file,
                                "path": file_path,
                                "relevance": "medium"
                            })
                except:
                    pass
    
    return related_docs

def check_doc_status(file_path):
    """检查文档状态"""
    try:
        with open(file_path, 'r', encoding='utf-8') as f:
            content = f.read()
        
        # 提取 frontmatter
        frontmatter = parse_frontmatter(content)
        
        if frontmatter:
            return {
                "status": frontmatter.get("status", "unknown"),
                "version": frontmatter.get("version", "unknown"),
                "updated": frontmatter.get("updated", "unknown"),
                "type": frontmatter.get("type", "unknown")
            }
        
        return {"status": "unknown", "version": "unknown", "updated": "unknown", "type": "unknown"}
    except:
        return {"status": "unknown", "version": "unknown", "updated": "unknown", "type": "unknown"}

def generate_module_card(module_id, module_info, docs_dir, output_dir):
    """生成模块索引卡"""
    module_name = module_info.get("name", "")
    domain = module_info.get("domain", "")
    owner = module_info.get("owner", "待指定")
    
    # 查找相关文档
    related_docs = find_related_docs(module_id, module_info, docs_dir)
    
    # 分析文档状态
    docs_analysis = []
    for doc in related_docs[:10]:  # 最多取 10 篇
        status = check_doc_status(doc["path"])
        docs_analysis.append({
            "file": doc["file"],
            "status": status["status"],
            "updated": status["updated"],
            "type": status["type"]
        })
    
    # 计算完成度
    total_docs = len(related_docs)
    approved_docs = sum(1 for d in docs_analysis if d["status"] == "approved")
    draft_docs = sum(1 for d in docs_analysis if d["status"] == "draft")
    completeness = (approved_docs / total_docs * 100) if total_docs > 0 else 0
    
    # 生成模块卡内容
    card_content = f"""---
module_id: {module_id}
module_name: {module_name}
domain: {domain}
owner: {owner}
status: {'approved' if completeness >= 80 else 'review' if completeness >= 50 else 'draft'}
completeness: {completeness:.0f}%
created: "{datetime.now().strftime('%Y-%m-%d')}"
updated: "{datetime.now().strftime('%Y-%m-%d')}"
tags: [{domain}, module]
related:
  - "docs/{domain}/"
---

# 模块索引卡：{module_id} - {module_name}

> 生成时间：{datetime.now().strftime('%Y-%m-%d %H:%M')} | 完成度：**{completeness:.0f}%**

---

## 基本信息

| 属性 | 值 |
|------|-----|
| 模块 ID | {module_id} |
| 模块名称 | {module_name} |
| 所属领域 | {domain} |
| 负责人 | {owner} |
| 状态 | {'🟢 已批准' if completeness >= 80 else '🟡 评审中' if completeness >= 50 else '🔴 草稿'} |
| 完成度 | {completeness:.0f}% |

---

## 需求覆盖

| 需求 ID | 需求描述 | 覆盖文档 | 状态 |
|--------|---------|---------|------|
"""
    
    # 添加需求覆盖
    for req_id, req_info in REQUIREMENTS_MAP.items():
        if req_info["module"] == module_id:
            card_content += f"| {req_id} | {req_info['desc']} | - | ⏳ 待分析 |\n"
    
    if not any(r["module"] == module_id for r in REQUIREMENTS_MAP.values()):
        card_content += "| - | 无直接需求 | - | - |\n"
    
    card_content += f"""
---

## 关联文档 ({total_docs} 份)

| # | 文档名称 | 类型 | 状态 | 最后更新 |
|---|---------|------|------|---------|
"""
    
    # 添加文档列表
    for i, doc in enumerate(docs_analysis, 1):
        card_content += f"| {i} | {doc['file']} | {doc['type']} | {doc['status']} | {doc['updated']} |\n"
    
    if not docs_analysis:
        card_content += "| - | 暂无关联文档 | - | - | - |\n"
    
    card_content += f"""
---

## 实现状态

| 功能 | 设计 | 代码 | 测试 | 备注 |
|------|------|------|------|------|
| 核心功能 1 | ✅ | ⏳ | ❌ | 待实现 |
| 核心功能 2 | ✅ | ⏳ | ❌ | 待实现 |

---

## 待办事项

- [ ] 补充需求覆盖分析
- [ ] 更新实现状态
- [ ] 添加测试覆盖率

---

## 变更日志

| 日期 | 变更内容 | 负责人 |
|------|---------|--------|
| {datetime.now().strftime('%Y-%m-%d')} | 创建模块索引卡 | 系统自动 |

---

_本文档由 Orion 模块映射工具自动生成_
"""
    
    # 保存模块卡
    # 清理文件名中的特殊字符
    safe_module_name = module_name.replace('/', '-').replace(':', '-')
    output_file = os.path.join(output_dir, f"MODULE-{module_id}-{safe_module_name}.md")
    os.makedirs(output_dir, exist_ok=True)
    
    with open(output_file, 'w', encoding='utf-8') as f:
        f.write(card_content)
    
    return {
        "module_id": module_id,
        "module_name": module_name,
        "completeness": completeness,
        "doc_count": total_docs,
        "output_file": output_file
    }

def generate_summary(results, output_dir):
    """生成汇总报告"""
    summary_content = f"""# Orion 模块索引卡汇总报告

> 生成时间：{datetime.now().strftime('%Y-%m-%d %H:%M:%S')}

---

## 总体统计

| 指标 | 数值 |
|------|------|
| 模块总数 | {len(results)} |
| 平均完成度 | {sum(r['completeness'] for r in results) / len(results):.1f}% |
| 关联文档总数 | {sum(r['doc_count'] for r in results)} |

---

## 模块完成度排行

| 排名 | 模块 ID | 模块名称 | 完成度 | 文档数 | 状态 |
|------|--------|---------|--------|--------|------|
"""
    
    # 按完成度排序
    sorted_results = sorted(results, key=lambda x: x['completeness'], reverse=True)
    
    for i, r in enumerate(sorted_results, 1):
        status = '🟢' if r['completeness'] >= 80 else '🟡' if r['completeness'] >= 50 else '🔴'
        summary_content += f"| {i} | {r['module_id']} | {r['module_name']} | {r['completeness']:.0f}% | {r['doc_count']} | {status} |\n"
    
    summary_content += f"""
---

## 按领域分布

| 领域 | 模块数 | 平均完成度 |
|------|--------|-----------|
"""
    
    # 按领域统计
    domain_stats = {}
    for r in results:
        domain = MODULES[r['module_id']].get('domain', 'other')
        if domain not in domain_stats:
            domain_stats[domain] = {'count': 0, 'completeness_sum': 0}
        domain_stats[domain]['count'] += 1
        domain_stats[domain]['completeness_sum'] += r['completeness']
    
    for domain, stats in domain_stats.items():
        avg = stats['completeness_sum'] / stats['count']
        summary_content += f"| {domain} | {stats['count']} | {avg:.1f}% |\n"
    
    summary_content += f"""
---

## 模块索引卡列表

"""
    
    for r in results:
        summary_content += f"- [{r['module_id']} - {r['module_name']}](MODULE-{r['module_id']}-{r['module_name']}.md) - 完成度：{r['completeness']:.0f}%\n"
    
    summary_content += f"""
---

_本报告由 Orion 模块映射工具自动生成_
"""
    
    # 保存汇总报告
    summary_file = os.path.join(output_dir, "模块索引卡汇总.md")
    with open(summary_file, 'w', encoding='utf-8') as f:
        f.write(summary_content)
    
    return summary_file

def main():
    docs_dir = "/Users/heal/orion-design/docs"
    output_dir = "/Users/heal/orion-design/docs/cache/module-cards"
    
    print("=" * 60)
    print("  Orion 模块映射工具")
    print("=" * 60)
    print()
    print(f"文档目录：{docs_dir}")
    print(f"输出目录：{output_dir}")
    print()
    
    results = []
    
    for module_id, module_info in MODULES.items():
        print(f"📦 处理模块：{module_id} - {module_info['name']}")
        result = generate_module_card(module_id, module_info, docs_dir, output_dir)
        results.append(result)
        print(f"   ✅ 完成度：{result['completeness']:.0f}%, 文档数：{result['doc_count']}")
    
    print()
    print("📊 生成汇总报告...")
    summary_file = generate_summary(results, output_dir)
    print(f"   ✅ 汇总报告：{summary_file}")
    
    print()
    print("=" * 60)
    print("  模块映射完成!")
    print("=" * 60)
    print()
    print(f"📁 输出目录：{output_dir}")
    print(f"📄 模块卡片：{len(results)} 份")
    print(f"📊 平均完成度：{sum(r['completeness'] for r in results) / len(results):.1f}%")
    print()

if __name__ == "__main__":
    main()
