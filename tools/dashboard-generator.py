#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Orion 综合完成度仪表盘工具
用途：整合文档完成度、代码完成度、测试完成度，生成统一仪表盘
"""

import os
import re
import json
from datetime import datetime
from pathlib import Path

# 配置
CODE_DIRS = {
    "orion-visor": "/Users/heal/orion-design/orion-visor",
    "orion-knowledge": "/Users/heal/orion-design/orion-knowledge",
    "orion-dba": "/Users/heal/orion-design/orion-dba",
}

DOCS_DIR = "/Users/heal/orion-design/docs"
OUTPUT_DIR = "/Users/heal/orion-design/docs/cache/dashboard"

# 28 个核心模块
MODULES = {
    "M1": {"name": "效能看板", "domain": "efficiency"},
    "M2": {"name": "流水线可视化", "domain": "frontend"},
    "M3": {"name": "审批工作台", "domain": "frontend"},
    "M4": {"name": "安全审计中心", "domain": "security"},
    "M5": {"name": "Pipeline 引擎", "domain": "cicd"},
    "M6": {"name": "多分支产品线", "domain": "architecture"},
    "M7": {"name": "配置管理 GitOps", "domain": "architecture"},
    "M8": {"name": "通知协作", "domain": "collaboration"},
    "M9": {"name": "AI 算法引擎", "domain": "ai"},
    "M10": {"name": "LLM 推理层", "domain": "ai"},
    "M11": {"name": "AI 增强层", "domain": "ai"},
    "M12": {"name": "Skill 管理", "domain": "ai"},
    "M13": {"name": "代码管理", "domain": "integration"},
    "M14": {"name": "构建环境", "domain": "cicd"},
    "M15": {"name": "多工具链", "domain": "architecture"},
    "M16": {"name": "智能部署", "domain": "architecture"},
    "M17": {"name": "自愈引擎", "domain": "sre"},
    "M18": {"name": "安全合规", "domain": "security"},
    "M19": {"name": "多租户", "domain": "architecture"},
    "M20": {"name": "IaC 管理", "domain": "iac"},
    "M21": {"name": "审计中心", "domain": "security"},
    "M22": {"name": "FinOps 成本", "domain": "efficiency"},
    "M23": {"name": "SSO/RBAC", "domain": "security"},
    "M24": {"name": "事件总线", "domain": "event-bus"},
    "M25": {"name": "数据存储", "domain": "db"},
    "M26": {"name": "可观测性", "domain": "sre"},
    "M27": {"name": "插件扩展", "domain": "architecture"},
    "M28": {"name": "Orion-Knowledge", "domain": "knowledge"},
}


def count_docs_by_domain(docs_dir):
    """统计各领域文档数"""
    domain_stats = {}
    
    for domain in set(m["domain"] for m in MODULES.values()):
        domain_dir = os.path.join(docs_dir, domain)
        if os.path.exists(domain_dir):
            doc_count = len([f for f in os.listdir(domain_dir) if f.endswith('.md')])
            approved_count = 0
            
            for file in os.listdir(domain_dir):
                if file.endswith('.md'):
                    try:
                        with open(os.path.join(domain_dir, file), 'r', encoding='utf-8') as f:
                            content = f.read()
                            if 'status: approved' in content:
                                approved_count += 1
                    except:
                        pass
            
            domain_stats[domain] = {
                "total_docs": doc_count,
                "approved_docs": approved_count,
                "doc_completeness": (approved_count / doc_count * 100) if doc_count > 0 else 0
            }
        else:
            domain_stats[domain] = {
                "total_docs": 0,
                "approved_docs": 0,
                "doc_completeness": 0
            }
    
    return domain_stats


def count_code_files(code_dirs):
    """统计各领域代码文件数"""
    code_stats = {}
    
    for domain in set(m["domain"] for m in MODULES.values()):
        code_stats[domain] = {
            "total_files": 0,
            "test_files": 0,
            "code_completeness": 0
        }
    
    for project, code_dir in code_dirs.items():
        if not os.path.exists(code_dir):
            continue
        
        for root, dirs, files in os.walk(code_dir):
            if 'node_modules' in root or 'vendor' in root or '.git' in root:
                continue
            
            for file in files:
                if file.endswith(('.go', '.java', '.py', '.ts', '.js', '.vue', '.jsx')):
                    # 判断是否为测试文件
                    is_test = any(p in file for p in ['_test.', '.test.', 'Test.'])
                    
                    # 简单映射项目到领域
                    if 'visor' in project:
                        domain = 'frontend'  # 简化处理
                    elif 'knowledge' in project:
                        domain = 'knowledge'
                    elif 'dba' in project:
                        domain = 'db'
                    else:
                        domain = 'architecture'
                    
                    if domain in code_stats:
                        code_stats[domain]["total_files"] += 1
                        if is_test:
                            code_stats[domain]["test_files"] += 1
    
    # 计算代码完成度
    for domain in code_stats:
        total = code_stats[domain]["total_files"]
        tests = code_stats[domain]["test_files"]
        # 假设有代码文件就有实现，测试文件比例影响完成度
        code_stats[domain]["code_completeness"] = min(100, (total / 10) * 50 + (tests / 5) * 50) if total > 0 else 0
    
    return code_stats


def calculate_module_completeness(module_id, module_info, docs_dir, code_dirs):
    """计算单个模块的完成度"""
    domain = module_info["domain"]
    
    # 获取领域统计
    doc_stats = count_docs_by_domain(docs_dir)
    code_stats = count_code_files(code_dirs)
    
    # 模块完成度 = 文档完成度 (40%) + 代码完成度 (40%) + 测试完成度 (20%)
    domain_doc = doc_stats.get(domain, {"doc_completeness": 0})
    domain_code = code_stats.get(domain, {"code_completeness": 0})
    
    doc_score = domain_doc["doc_completeness"] * 0.4
    code_score = domain_code["code_completeness"] * 0.4
    test_ratio = (domain_code.get("test_files", 0) / max(1, domain_code.get("total_files", 1)))
    test_score = test_ratio * 100 * 0.2
    
    total_score = doc_score + code_score + test_score
    
    return {
        "doc_score": doc_score,
        "code_score": code_score,
        "test_score": test_score,
        "total_score": total_score,
        "status": "✅" if total_score >= 80 else "🟡" if total_score >= 50 else "🔴"
    }


def generate_dashboard():
    """生成综合仪表盘"""
    print("=" * 60)
    print("  Orion 综合完成度仪表盘")
    print("=" * 60)
    print()
    
    # 统计文档
    print("📊 统计文档完成度...")
    doc_stats = count_docs_by_domain(DOCS_DIR)
    
    # 统计代码
    print("💻 统计代码完成度...")
    code_stats = count_code_files(CODE_DIRS)
    
    # 计算模块完成度
    print("📈 计算模块完成度...")
    module_results = {}
    for module_id, module_info in MODULES.items():
        result = calculate_module_completeness(module_id, module_info, DOCS_DIR, CODE_DIRS)
        module_results[module_id] = {
            **module_info,
            **result
        }
    
    # 生成仪表盘 HTML
    print("🎨 生成仪表盘...")
    
    dashboard_html = f"""<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Orion 综合完成度仪表盘</title>
    <style>
        * {{ margin: 0; padding: 0; box-sizing: border-box; }}
        body {{ font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; background: #f5f5f5; padding: 20px; }}
        .container {{ max-width: 1400px; margin: 0 auto; }}
        h1 {{ color: #333; margin-bottom: 20px; }}
        .summary {{ display: grid; grid-template-columns: repeat(4, 1fr); gap: 20px; margin-bottom: 30px; }}
        .summary-card {{ background: white; padding: 20px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }}
        .summary-card h3 {{ color: #666; font-size: 14px; margin-bottom: 10px; }}
        .summary-card .value {{ font-size: 32px; font-weight: bold; color: #333; }}
        .summary-card .trend {{ font-size: 12px; color: #666; margin-top: 5px; }}
        
        .section {{ background: white; border-radius: 8px; padding: 20px; margin-bottom: 20px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }}
        .section h2 {{ color: #333; margin-bottom: 20px; border-bottom: 2px solid #007bff; padding-bottom: 10px; }}
        
        table {{ width: 100%; border-collapse: collapse; }}
        th, td {{ padding: 12px; text-align: left; border-bottom: 1px solid #eee; }}
        th {{ background: #f8f9fa; font-weight: 600; color: #333; }}
        tr:hover {{ background: #f8f9fa; }}
        
        .progress-bar {{ width: 100%; height: 8px; background: #e9ecef; border-radius: 4px; overflow: hidden; }}
        .progress-fill {{ height: 100%; border-radius: 4px; transition: width 0.3s; }}
        .progress-fill.green {{ background: #28a745; }}
        .progress-fill.yellow {{ background: #ffc107; }}
        .progress-fill.red {{ background: #dc3545; }}
        
        .status {{ padding: 4px 8px; border-radius: 4px; font-size: 12px; font-weight: 600; }}
        .status.approved {{ background: #d4edda; color: #155724; }}
        .status.review {{ background: #fff3cd; color: #856404; }}
        .status.draft {{ background: #f8d7da; color: #721c24; }}
        
        .domain-grid {{ display: grid; grid-template-columns: repeat(4, 1fr); gap: 15px; }}
        .domain-card {{ background: #f8f9fa; padding: 15px; border-radius: 6px; }}
        .domain-card h4 {{ color: #666; font-size: 13px; margin-bottom: 10px; }}
        .domain-card .stats {{ display: flex; justify-content: space-between; font-size: 12px; color: #666; }}
        
        .timestamp {{ text-align: center; color: #999; font-size: 12px; margin-top: 30px; }}
    </style>
</head>
<body>
    <div class="container">
        <h1>📊 Orion 综合完成度仪表盘</h1>
        
        <div class="summary">
            <div class="summary-card">
                <h3>模块总数</h3>
                <div class="value">{len(MODULES)}</div>
                <div class="trend">28 个核心模块</div>
            </div>
            <div class="summary-card">
                <h3>文档总数</h3>
                <div class="value">{sum(s['total_docs'] for s in doc_stats.values())}</div>
                <div class="trend">平均完成度 {sum(s['doc_completeness'] for s in doc_stats.values()) / len(doc_stats):.1f}%</div>
            </div>
            <div class="summary-card">
                <h3>代码文件</h3>
                <div class="value">{sum(s['total_files'] for s in code_stats.values())}</div>
                <div class="trend">测试文件 {sum(s['test_files'] for s in code_stats.values())} 个</div>
            </div>
            <div class="summary-card">
                <h3>总体完成度</h3>
                <div class="value">{sum(m['total_score'] for m in module_results.values()) / len(module_results):.1f}%</div>
                <div class="trend">目标：80%</div>
            </div>
        </div>
        
        <div class="section">
            <h2>📁 各领域完成度</h2>
            <div class="domain-grid">
"""
    
    # 添加领域卡片
    for domain, stats in doc_stats.items():
        code_comp = code_stats.get(domain, {}).get("code_completeness", 0)
        dashboard_html += f"""
                <div class="domain-card">
                    <h4>{domain}</h4>
                    <div style="margin-bottom: 10px;">
                        <div style="display: flex; justify-content: space-between; margin-bottom: 5px;">
                            <span style="font-size: 12px;">文档</span>
                            <span style="font-size: 12px;">{stats['doc_completeness']:.0f}%</span>
                        </div>
                        <div class="progress-bar">
                            <div class="progress-fill {'green' if stats['doc_completeness'] >= 80 else 'yellow' if stats['doc_completeness'] >= 50 else 'red'}" style="width: {stats['doc_completeness']}%"></div>
                        </div>
                    </div>
                    <div>
                        <div style="display: flex; justify-content: space-between; margin-bottom: 5px;">
                            <span style="font-size: 12px;">代码</span>
                            <span style="font-size: 12px;">{code_comp:.0f}%</span>
                        </div>
                        <div class="progress-bar">
                            <div class="progress-fill {'green' if code_comp >= 80 else 'yellow' if code_comp >= 50 else 'red'}" style="width: {code_comp}%"></div>
                        </div>
                    </div>
                    <div class="stats">
                        <span>文档：{stats['total_docs']}</span>
                        <span>代码：{code_stats.get(domain, {}).get('total_files', 0)}</span>
                    </div>
                </div>
"""
    
    dashboard_html += """
            </div>
        </div>
        
        <div class="section">
            <h2>📦 模块完成度排行</h2>
            <table>
                <thead>
                    <tr>
                        <th>排名</th>
                        <th>模块</th>
                        <th>领域</th>
                        <th>文档 (40%)</th>
                        <th>代码 (40%)</th>
                        <th>测试 (20%)</th>
                        <th>总完成度</th>
                        <th>状态</th>
                    </tr>
                </thead>
                <tbody>
"""
    
    # 添加模块排行
    sorted_modules = sorted(module_results.values(), key=lambda x: x['total_score'], reverse=True)
    for i, m in enumerate(sorted_modules, 1):
        status_class = 'approved' if m['total_score'] >= 80 else 'review' if m['total_score'] >= 50 else 'draft'
        status_text = '✅' if m['total_score'] >= 80 else '🟡' if m['total_score'] >= 50 else '🔴'
        
        dashboard_html += f"""
                    <tr>
                        <td>{i}</td>
                        <td><strong>{m['name']}</strong></td>
                        <td>{m['domain']}</td>
                        <td>
                            <div style="display: flex; align-items: center; gap: 8px;">
                                <div class="progress-bar" style="width: 80px;">
                                    <div class="progress-fill {'green' if m['doc_score'] >= 32 else 'yellow' if m['doc_score'] >= 20 else 'red'}" style="width: {m['doc_score'] / 0.4}%"></div>
                                </div>
                                <span>{m['doc_score'] / 0.4:.0f}%</span>
                            </div>
                        </td>
                        <td>
                            <div style="display: flex; align-items: center; gap: 8px;">
                                <div class="progress-bar" style="width: 80px;">
                                    <div class="progress-fill {'green' if m['code_score'] >= 32 else 'yellow' if m['code_score'] >= 20 else 'red'}" style="width: {m['code_score'] / 0.4}%"></div>
                                </div>
                                <span>{m['code_score'] / 0.4:.0f}%</span>
                            </div>
                        </td>
                        <td>{m['test_score'] / 0.2:.0f}%</td>
                        <td><strong>{m['total_score']:.1f}%</strong></td>
                        <td><span class="status {status_class}">{status_text}</span></td>
                    </tr>
"""
    
    dashboard_html += f"""
                </tbody>
            </table>
        </div>
        
        <div class="timestamp">
            生成时间：{datetime.now().strftime('%Y-%m-%d %H:%M:%S')} | Orion 综合完成度仪表盘 v1.0
        </div>
    </div>
</body>
</html>
"""
    
    # 保存 HTML
    os.makedirs(OUTPUT_DIR, exist_ok=True)
    html_file = os.path.join(OUTPUT_DIR, "综合完成度仪表盘.html")
    
    with open(html_file, 'w', encoding='utf-8') as f:
        f.write(dashboard_html)
    
    # 保存 Markdown 摘要
    md_summary = f"""# Orion 综合完成度仪表盘摘要

> 生成时间：{datetime.now().strftime('%Y-%m-%d %H:%M:%S')}

---

## 总体状态

| 指标 | 数值 |
|------|------|
| 模块总数 | {len(MODULES)} |
| 文档总数 | {sum(s['total_docs'] for s in doc_stats.values())} |
| 代码文件 | {sum(s['total_files'] for s in code_stats.values())} |
| 测试文件 | {sum(s['test_files'] for s in code_stats.values())} |
| 总体完成度 | {sum(m['total_score'] for m in module_results.values()) / len(module_results):.1f}% |

---

## 模块完成度 Top 5

| 排名 | 模块 | 领域 | 完成度 | 状态 |
|------|------|------|--------|------|
"""
    
    for i, m in enumerate(sorted_modules[:5], 1):
        status = '✅' if m['total_score'] >= 80 else '🟡' if m['total_score'] >= 50 else '🔴'
        md_summary += f"| {i} | {m['name']} | {m['domain']} | {m['total_score']:.1f}% | {status} |\n"
    
    md_summary += f"""
---

## 模块完成度 Bottom 5

| 排名 | 模块 | 领域 | 完成度 | 状态 |
|------|------|------|--------|------|
"""
    
    for i, m in enumerate(sorted_modules[-5:], 1):
        status = '✅' if m['total_score'] >= 80 else '🟡' if m['total_score'] >= 50 else '🔴'
        md_summary += f"| {len(sorted_modules)-5+i} | {m['name']} | {m['domain']} | {m['total_score']:.1f}% | {status} |\n"
    
    md_summary += f"""
---

## 待办事项

"""
    
    for m in sorted_modules:
        if m['total_score'] < 50:
            md_summary += f"- [ ] **{m['name']}**: 完成度 {m['total_score']:.1f}% (文档：{m['doc_score']/0.4:.0f}%, 代码：{m['code_score']/0.4:.0f}%)\n"
    
    md_summary += f"""
---

📊 查看完整仪表盘：[综合完成度仪表盘.html](综合完成度仪表盘.html)
"""
    
    md_file = os.path.join(OUTPUT_DIR, "综合完成度摘要.md")
    with open(md_file, 'w', encoding='utf-8') as f:
        f.write(md_summary)
    
    # 保存 JSON 数据
    json_file = os.path.join(OUTPUT_DIR, "综合完成度数据.json")
    with open(json_file, 'w', encoding='utf-8') as f:
        json.dump({
            "summary": {
                "total_modules": len(MODULES),
                "total_docs": sum(s['total_docs'] for s in doc_stats.values()),
                "total_code_files": sum(s['total_files'] for s in code_stats.values()),
                "total_test_files": sum(s['test_files'] for s in code_stats.values()),
                "overall_completeness": sum(m['total_score'] for m in module_results.values()) / len(module_results)
            },
            "domains": doc_stats,
            "modules": module_results
        }, f, ensure_ascii=False, indent=2)
    
    print()
    print("=" * 60)
    print("  仪表盘生成完成!")
    print("=" * 60)
    print()
    print(f"📊 HTML 仪表盘：{html_file}")
    print(f"📄 Markdown 摘要：{md_file}")
    print(f"📈 总体完成度：{sum(m['total_score'] for m in module_results.values()) / len(module_results):.1f}%")
    print()
    
    return html_file, md_file


if __name__ == "__main__":
    generate_dashboard()
