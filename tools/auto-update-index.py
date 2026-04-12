#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Orion 自动索引更新工具
用途：根据检查结果自动更新 INDEX.md、CHANGELOG.md、模块索引卡等
"""

import os
import re
import json
from datetime import datetime
from pathlib import Path

# 配置
DOCS_DIR = "/Users/heal/orion-design/docs"
TOOLS_DIR = "/Users/heal/orion-design/tools"
CACHE_DIR = "/Users/heal/orion-design/docs/cache"

# 索引文件
INDEX_FILE = "/Users/heal/orion-design/INDEX.md"
CHANGELOG_FILE = "/Users/heal/orion-design/CHANGELOG.md"
DOC_INDEX_FILE = "/Users/heal/orion-design/00-文档索引与任务分发.md"


def load_completeness_data():
    """加载完成度数据"""
    data_files = {
        "dashboard": os.path.join(CACHE_DIR, "dashboard", "综合完成度数据.json"),
        "detail": os.path.join(CACHE_DIR, "detail-analysis", "文档实现细节数据.json"),
        "modules": os.path.join(CACHE_DIR, "module-cards", "模块索引卡汇总.md"),
    }
    
    data = {}
    
    # 加载仪表盘数据
    if os.path.exists(data_files["dashboard"]):
        with open(data_files["dashboard"], 'r', encoding='utf-8') as f:
            data["dashboard"] = json.load(f)
    
    # 加载细节分析数据
    if os.path.exists(data_files["detail"]):
        with open(data_files["detail"], 'r', encoding='utf-8') as f:
            data["detail"] = json.load(f)
    
    return data


def update_index_md(data):
    """更新 INDEX.md"""
    if not os.path.exists(INDEX_FILE):
        print(f"⚠️ 文件不存在：{INDEX_FILE}")
        return False
    
    print("📝 更新 INDEX.md...")
    
    with open(INDEX_FILE, 'r', encoding='utf-8') as f:
        content = f.read()
    
    # 更新总文档数
    if "dashboard" in data and "summary" in data["dashboard"]:
        total_docs = data["dashboard"]["summary"].get("total_docs", 0)
        if total_docs > 0:
            content = re.sub(
                r'总文档数 \| \d+ 份',
                f'总文档数 | {total_docs} 份',
                content
            )
        
        overall = data["dashboard"]["summary"].get("overall_completeness", 0)
        content = re.sub(
            r'总体完成度 \| [\d.]+%',
            f'总体完成度 | {overall:.1f}%',
            content
        )
    
    # 更新时间
    today = datetime.now().strftime('%Y-%m-%d')
    content = re.sub(
        r'最后更新：\d{4}-\d{2}-\d{2}',
        f'最后更新：{today}',
        content
    )
    
    # 添加完成度摘要
    if "dashboard" in data and "modules" in data["dashboard"]:
        modules = data["dashboard"]["modules"]
        
        # 找出 Top 3 模块
        sorted_modules = sorted(modules.values(), key=lambda x: x['total_score'], reverse=True)
        top3 = sorted_modules[:3]
        
        summary_text = f"""

---

## 📊 完成度摘要 (自动更新)

> 更新时间：{today}

### 总体状态

| 指标 | 数值 |
|------|------|
| 总体完成度 | {data['dashboard']['summary'].get('overall_completeness', 0):.1f}% |
| 文档总数 | {data['dashboard']['summary'].get('total_docs', 0)} |
| 代码文件 | {data['dashboard']['summary'].get('total_code_files', 0)} |

### 模块完成度 Top 3

| 排名 | 模块 | 领域 | 完成度 |
|------|------|------|--------|
"""
        
        for i, m in enumerate(top3, 1):
            summary_text += f"| {i} | {m['name']} | {m['domain']} | {m['total_score']:.1f}% |\n"
        
        summary_text += """
### 需要关注的模块

| 模块 | 完成度 | 待办事项 |
|------|--------|---------|
"""
        
        # 找出 Bottom 3
        bottom3 = sorted_modules[-3:]
        for m in bottom3:
            if m['total_score'] < 50:
                summary_text += f"| {m['name']} | {m['total_score']:.1f}% | 补充文档 + 实现代码 |\n"
        
        # 查找是否已有完成度摘要部分
        if "## 📊 完成度摘要" in content:
            # 替换现有部分
            pattern = r'## 📊 完成度摘要.*?(?=##|$)'
            content = re.sub(pattern, summary_text, content, flags=re.DOTALL)
        else:
            # 在文档末尾添加
            content = content.rstrip() + "\n" + summary_text
    
    # 保存更新
    with open(INDEX_FILE, 'w', encoding='utf-8') as f:
        f.write(content)
    
    print("   ✅ INDEX.md 更新完成")
    return True


def update_changelog_md(data):
    """更新 CHANGELOG.md"""
    if not os.path.exists(CHANGELOG_FILE):
        print(f"⚠️ 文件不存在：{CHANGELOG_FILE}")
        return False
    
    print("📝 更新 CHANGELOG.md...")
    
    today = datetime.now().strftime('%Y-%m-%d')
    
    # 生成更新条目
    changelog_entry = f"""## [{today}] — 自动完成度检查

### Updated
- 执行文档实现细节检查
- 生成综合完成度仪表盘
- 更新模块索引卡

### Metrics
- 总体完成度：{data.get('dashboard', {}).get('summary', {}).get('overall_completeness', 0):.1f}%
- 文档总数：{data.get('dashboard', {}).get('summary', {}).get('total_docs', 0)}
- 代码文件：{data.get('dashboard', {}).get('summary', {}).get('total_code_files', 0)}
- 测试文件：{data.get('dashboard', {}).get('summary', {}).get('total_test_files', 0)}

### Reports
- [综合完成度仪表盘](docs/cache/dashboard/综合完成度仪表盘.html)
- [文档实现细节分析报告](docs/cache/detail-analysis/文档实现细节分析报告.md)
- [模块索引卡汇总](docs/cache/module-cards/模块索引卡汇总.md)

---

"""
    
    with open(CHANGELOG_FILE, 'r', encoding='utf-8') as f:
        content = f.read()
    
    # 在第一个条目之前插入
    if "## [" in content:
        content = content.replace(
            '## [',
            changelog_entry + '## [',
            1
        )
    else:
        # 如果没有条目，添加到文件开头
        content = changelog_entry + content
    
    with open(CHANGELOG_FILE, 'w', encoding='utf-8') as f:
        f.write(content)
    
    print("   ✅ CHANGELOG.md 更新完成")
    return True


def update_doc_index_md(data):
    """更新 00-文档索引与任务分发.md"""
    if not os.path.exists(DOC_INDEX_FILE):
        print(f"⚠️ 文件不存在：{DOC_INDEX_FILE}")
        return False
    
    print("📝 更新 00-文档索引与任务分发.md...")
    
    with open(DOC_INDEX_FILE, 'r', encoding='utf-8') as f:
        content = f.read()
    
    # 更新版本号
    version_match = re.search(r'> 版本：v([\d.]+)', content)
    if version_match:
        current_version = version_match.group(1)
        version_parts = current_version.split('.')
        version_parts[-1] = str(int(version_parts[-1]) + 1)
        new_version = '.'.join(version_parts)
        
        content = re.sub(
            r'> 版本：v[\d.]+',
            f'> 版本：v{new_version}',
            content
        )
    
    # 更新时间
    today = datetime.now().strftime('%Y-%m-%d')
    content = re.sub(
        r'> 最后更新：\d{4}-\d{2}-\d{2}',
        f'> 最后更新：{today}',
        content
    )
    
    # 添加完成度状态表
    if "dashboard" in data and "modules" in data["dashboard"]:
        modules = data["dashboard"]["modules"]
        sorted_modules = sorted(modules.values(), key=lambda x: x['total_score'], reverse=True)
        
        status_table = f"""
---

## 📊 实时完成度状态

> 自动更新：{today}

### 模块完成度排行

| 排名 | 模块 ID | 模块名称 | 领域 | 完成度 | 状态 |
|------|--------|---------|------|--------|------|
"""
        
        for i, m in enumerate(sorted_modules, 1):
            status_icon = '✅' if m['total_score'] >= 80 else '🟡' if m['total_score'] >= 50 else '🔴'
            status_table += f"| {i} | {m.get('module_id', 'M'+str(i))} | {m['name']} | {m['domain']} | {m['total_score']:.1f}% | {status_icon} |\n"
        
        # 查找是否已有实时完成度状态部分
        if "## 📊 实时完成度状态" in content:
            pattern = r'## 📊 实时完成度状态.*?(?=##|$)'
            content = re.sub(pattern, status_table, content, flags=re.DOTALL)
        else:
            # 在文档末尾添加
            content = content.rstrip() + "\n" + status_table
    
    with open(DOC_INDEX_FILE, 'w', encoding='utf-8') as f:
        f.write(content)
    
    print("   ✅ 00-文档索引与任务分发.md 更新完成")
    return True


def update_module_cards(data):
    """更新模块索引卡"""
    module_cards_dir = os.path.join(CACHE_DIR, "module-cards")
    
    if not os.path.exists(module_cards_dir):
        print(f"⚠️ 目录不存在：{module_cards_dir}")
        return False
    
    print("📝 更新模块索引卡...")
    
    if "dashboard" not in data or "modules" not in data["dashboard"]:
        print("   ⚠️ 无模块数据")
        return False
    
    modules = data["dashboard"]["modules"]
    updated_count = 0
    
    for module_id, module_data in modules.items():
        # 查找对应的模块卡文件
        module_name = module_data.get("name", "")
        safe_name = module_name.replace('/', '-').replace(':', '-')
        card_file = os.path.join(module_cards_dir, f"MODULE-{module_id}-{safe_name}.md")
        
        if os.path.exists(card_file):
            with open(card_file, 'r', encoding='utf-8') as f:
                content = f.read()
            
            # 更新完成度
            completeness = module_data.get("total_score", 0)
            status = 'approved' if completeness >= 80 else 'review' if completeness >= 50 else 'draft'
            status_icon = '🟢' if completeness >= 80 else '🟡' if completeness >= 50 else '🔴'
            
            # 更新 frontmatter
            content = re.sub(
                r'completeness: [\d.]+%',
                f'completeness: {completeness:.1f}%',
                content
            )
            
            content = re.sub(
                r'status: \w+',
                f'status: {status}',
                content
            )
            
            # 更新完成度显示
            content = re.sub(
                r'完成度：\*\*[\d.]+%\*\*',
                f'完成度：**{completeness:.1f}%**',
                content
            )
            
            content = re.sub(
                r'状态：[🟢🟡🔴] \w+',
                f'状态：{status_icon} {status}',
                content
            )
            
            # 添加更新时间
            today = datetime.now().strftime('%Y-%m-%d')
            if '最后更新' in content:
                content = re.sub(
                    r'最后更新：\d{4}-\d{2}-\d{2}',
                    f'最后更新：{today}',
                    content
                )
            
            with open(card_file, 'w', encoding='utf-8') as f:
                f.write(content)
            
            updated_count += 1
    
    print(f"   ✅ 更新 {updated_count} 份模块索引卡")
    return True


def generate_update_summary(data):
    """生成更新摘要报告"""
    today = datetime.now().strftime('%Y-%m-%d %H:%M:%S')
    
    summary = f"""# 索引自动更新摘要

> 生成时间：{today}

---

## 更新内容

| 文件 | 状态 | 说明 |
|------|------|------|
| INDEX.md | ✅ | 添加完成度摘要 |
| CHANGELOG.md | ✅ | 添加检查记录 |
| 00-文档索引与任务分发.md | ✅ | 更新版本号 + 完成度状态 |
| 模块索引卡 | ✅ | 更新所有模块完成度 |

---

## 完成度摘要

| 指标 | 数值 |
|------|------|
| 总体完成度 | {data.get('dashboard', {}).get('summary', {}).get('overall_completeness', 0):.1f}% |
| 文档总数 | {data.get('dashboard', {}).get('summary', {}).get('total_docs', 0)} |
| 代码文件 | {data.get('dashboard', {}).get('summary', {}).get('total_code_files', 0)} |
| 测试文件 | {data.get('dashboard', {}).get('summary', {}).get('total_test_files', 0)} |

---

## Top 3 模块

| 排名 | 模块 | 领域 | 完成度 |
|------|------|------|--------|
"""
    
    if "dashboard" in data and "modules" in data["dashboard"]:
        modules = data["dashboard"]["modules"]
        sorted_modules = sorted(modules.values(), key=lambda x: x['total_score'], reverse=True)
        
        for i, m in enumerate(sorted_modules[:3], 1):
            summary += f"| {i} | {m['name']} | {m['domain']} | {m['total_score']:.1f}% |\n"
    
    summary += f"""
---

## Bottom 3 模块

| 排名 | 模块 | 领域 | 完成度 |
|------|------|------|--------|
"""
    
    if "dashboard" in data and "modules" in data["dashboard"]:
        sorted_modules = sorted(modules.values(), key=lambda x: x['total_score'], reverse=True)
        
        for i, m in enumerate(sorted_modules[-3:], 1):
            summary += f"| {len(sorted_modules)-3+i} | {m['name']} | {m['domain']} | {m['total_score']:.1f}% |\n"
    
    summary += f"""
---

## 下次检查

- 每日检查：`bash tools/audit-docs.sh`
- 每周检查：`python3 tools/auto-update-index.py`
- 每月检查：执行全部工具并查看仪表盘

---

_本摘要由 Orion 自动索引更新工具生成_
"""
    
    # 保存摘要
    summary_file = os.path.join(CACHE_DIR, "索引更新摘要.md")
    with open(summary_file, 'w', encoding='utf-8') as f:
        f.write(summary)
    
    print(f"📄 生成更新摘要：{summary_file}")
    return summary_file


def main():
    print("=" * 60)
    print("  Orion 自动索引更新工具")
    print("=" * 60)
    print()
    
    # 加载数据
    print("📊 加载完成度数据...")
    data = load_completeness_data()
    
    if not data:
        print("⚠️ 未找到完成度数据，请先执行检查工具")
        print()
        print("执行顺序:")
        print("  1. python3 tools/check-detail-completeness.py")
        print("  2. python3 tools/dashboard-generator.py")
        print("  3. python3 tools/auto-update-index.py")
        return
    
    print(f"   ✅ 加载成功")
    print(f"      - 仪表盘数据：{'✅' if 'dashboard' in data else '❌'}")
    print(f"      - 细节分析数据：{'✅' if 'detail' in data else '❌'}")
    print()
    
    # 更新各个索引文件
    updates = []
    
    if update_index_md(data):
        updates.append("INDEX.md")
    
    if update_changelog_md(data):
        updates.append("CHANGELOG.md")
    
    if update_doc_index_md(data):
        updates.append("00-文档索引与任务分发.md")
    
    if update_module_cards(data):
        updates.append("模块索引卡")
    
    print()
    
    # 生成摘要
    summary_file = generate_update_summary(data)
    
    print()
    print("=" * 60)
    print("  索引更新完成!")
    print("=" * 60)
    print()
    print(f"📝 更新的文件:")
    for f in updates:
        print(f"   ✅ {f}")
    print()
    print(f"📄 更新摘要：{summary_file}")
    print()
    print("🔄 下次自动更新时间：建议每周一执行")
    print()


if __name__ == "__main__":
    main()
