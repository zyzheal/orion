#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Orion 文档实现细节检查工具
用途：深度分析文档中定义的功能点，追踪每个功能点的实现状态
"""

import os
import re
import json
from datetime import datetime
from pathlib import Path

# 代码目录
CODE_DIRS = {
    "orion-visor": "/Users/heal/orion-design/orion-visor",
    "orion-knowledge": "/Users/heal/orion-design/orion-knowledge",
    "orion-dba": "/Users/heal/orion-design/orion-dba",
}

# 功能点识别规则
FEATURE_PATTERNS = {
    "API 端点": r"(GET|POST|PUT|DELETE|PATCH)\s+/api/v1/[\w/-]+",
    "数据库表": r"CREATE TABLE\s+(\w+)",
    "配置项": r"(\w+\.\w+\.\w+)\s*[=:]\s*[\w.]+",
    "函数/方法": r"(func|def|function)\s+(\w+)",
    "结构体/类": r"(type|class|struct)\s+(\w+)",
    "接口": r"(interface|protocol)\s+(\w+)",
}

# 实现状态判定规则
IMPLEMENTATION_RULES = {
    "API 端点": {
        "design_marker": ["api", "endpoint", "接口", "路由"],
        "code_marker": ["@GetMapping", "@PostMapping", "router.", "r.GET", "r.POST"],
        "test_marker": ["TestHandler", "TestAPI", "test_", "_test.go"],
    },
    "数据库表": {
        "design_marker": ["schema", "table", "表结构", "ER 图"],
        "code_marker": ["CREATE TABLE", "migration", "schema"],
        "test_marker": ["migration_test", "schema_test"],
    },
    "配置项": {
        "design_marker": ["config", "配置", "environment"],
        "code_marker": ["viper", "config.", "os.Getenv", "process.env"],
        "test_marker": ["config_test", "config.test"],
    },
}


def extract_features_from_doc(doc_path):
    """从设计文档中提取功能点"""
    features = []
    
    try:
        with open(doc_path, 'r', encoding='utf-8') as f:
            content = f.read()
        
        # 提取 API 端点
        api_matches = re.findall(FEATURE_PATTERNS["API 端点"], content)
        for match in api_matches:
            features.append({
                "type": "API 端点",
                "content": match[1] if isinstance(match, tuple) else match,
                "line": content.count('\n', 0, content.find(match))
            })
        
        # 提取数据库表
        table_matches = re.findall(FEATURE_PATTERNS["数据库表"], content, re.IGNORECASE)
        for match in table_matches:
            features.append({
                "type": "数据库表",
                "content": match,
                "line": content.count('\n', 0, content.find(match))
            })
        
        # 提取核心功能描述 (通过标题识别)
        section_pattern = r'##+\s*(.+?)(?=\n##+|$)'
        sections = re.findall(section_pattern, content)
        for section in sections:
            if any(kw in section for kw in ["功能", "特性", "能力", "模块", "组件"]):
                features.append({
                    "type": "功能模块",
                    "content": section.strip(),
                    "line": content.count('\n', 0, content.find(section))
                })
        
        # 提取 Mermaid 流程图中的组件
        mermaid_pattern = r'```mermaid(.*?)```'
        mermaid_blocks = re.findall(mermaid_pattern, content, re.DOTALL)
        for block in mermaid_blocks:
            # 提取节点名称
            node_pattern = r'(\w+)\s*\['
            nodes = re.findall(node_pattern, block)
            for node in nodes:
                features.append({
                    "type": "架构组件",
                    "content": node,
                    "line": content.count('\n', 0, content.find(block))
                })
    
    except Exception as e:
        print(f"   ⚠️ 读取文档失败：{e}")
    
    return features


def check_api_implementation(code_dirs, endpoint):
    """检查 API 端点是否实现"""
    implementations = []
    
    for project, code_dir in code_dirs.items():
        if not os.path.exists(code_dir):
            continue
        
        for root, dirs, files in os.walk(code_dir):
            if 'node_modules' in root or 'vendor' in root:
                continue
            
            for file in files:
                if file.endswith(('.go', '.java', '.py', '.ts', '.js')):
                    file_path = os.path.join(root, file)
                    try:
                        with open(file_path, 'r', encoding='utf-8') as f:
                            content = f.read()
                            if endpoint in content:
                                implementations.append({
                                    "file": file,
                                    "project": project,
                                    "path": file_path
                                })
                    except:
                        pass
    
    return implementations


def check_table_implementation(code_dirs, table_name):
    """检查数据库表是否实现"""
    implementations = []
    
    for project, code_dir in code_dirs.items():
        if not os.path.exists(code_dir):
            continue
        
        # 查找 migration 文件
        migration_dirs = ['migration', 'migrations', 'db/migrate', 'schema']
        for migration_dir in migration_dirs:
            full_path = os.path.join(code_dir, migration_dir)
            if os.path.exists(full_path):
                for file in os.listdir(full_path):
                    if file.endswith(('.sql', '.go', '.py')):
                        file_path = os.path.join(full_path, file)
                        try:
                            with open(file_path, 'r', encoding='utf-8') as f:
                                content = f.read()
                                if table_name.lower() in content.lower():
                                    implementations.append({
                                        "file": file,
                                        "project": project,
                                        "path": file_path,
                                        "type": "migration"
                                    })
                        except:
                            pass
        
        # 查找 model/entity 文件
        model_dirs = ['model', 'models', 'entity', 'entities', 'domain']
        for model_dir in model_dirs:
            full_path = os.path.join(code_dir, model_dir)
            if os.path.exists(full_path):
                for file in os.listdir(full_path):
                    if file.lower().find(table_name.lower()) >= 0:
                        implementations.append({
                            "file": file,
                            "project": project,
                            "path": os.path.join(full_path, file),
                            "type": "model"
                        })
    
    return implementations


def check_feature_implementation(code_dirs, feature):
    """检查功能模块是否实现"""
    implementations = []
    keywords = feature["content"].lower().split()
    
    for project, code_dir in code_dirs.items():
        if not os.path.exists(code_dir):
            continue
        
        for root, dirs, files in os.walk(code_dir):
            if 'node_modules' in root or 'vendor' in root:
                continue
            
            for file in files:
                if file.endswith(('.go', '.java', '.py', '.ts', '.js', '.vue')):
                    file_path = os.path.join(root, file)
                    try:
                        with open(file_path, 'r', encoding='utf-8') as f:
                            content = f.read(5000)  # 读取前 5000 字符
                            
                            # 检查是否包含关键词
                            match_count = sum(1 for kw in keywords if kw.lower() in content.lower())
                            if match_count >= 2:  # 至少匹配 2 个关键词
                                implementations.append({
                                    "file": file,
                                    "project": project,
                                    "path": file_path,
                                    "match_score": match_count
                                })
                    except:
                        pass
    
    return implementations


def check_test_coverage(code_dirs, feature):
    """检查测试覆盖情况"""
    test_files = []
    feature_name = feature["content"]
    
    for project, code_dir in code_dirs.items():
        if not os.path.exists(code_dir):
            continue
        
        for root, dirs, files in os.walk(code_dir):
            if 'node_modules' in root or 'vendor' in root:
                continue
            
            # 查找测试目录
            if '__tests__' in root or 'test' in root or 'tests' in root:
                for file in files:
                    if file.endswith(('_test.go', '.test.ts', '.test.js', '_test.py', 'Test.java')):
                        file_path = os.path.join(root, file)
                        try:
                            with open(file_path, 'r', encoding='utf-8') as f:
                                content = f.read()
                                if feature_name.lower() in content.lower():
                                    test_files.append({
                                        "file": file,
                                        "project": project,
                                        "path": file_path
                                    })
                        except:
                            pass
    
    return test_files


def calculate_completeness(design_features, code_impls, test_files):
    """计算完成度"""
    if not design_features:
        return 0
    
    # 设计分 (20 分)
    design_score = 20
    
    # 实现分 (50 分)
    impl_ratio = len(code_impls) / len(design_features) if design_features else 0
    impl_score = min(50, impl_ratio * 50)
    
    # 测试分 (30 分)
    test_ratio = len(test_files) / len(design_features) if design_features else 0
    test_score = min(30, test_ratio * 30)
    
    return design_score + impl_score + test_score


def analyze_document(doc_path, code_dirs):
    """分析单个文档"""
    print(f"\n📄 分析文档：{os.path.basename(doc_path)}")
    
    # 提取功能点
    features = extract_features_from_doc(doc_path)
    print(f"   提取功能点：{len(features)} 个")
    
    # 检查每个功能的实现
    feature_analysis = []
    for feature in features[:20]:  # 最多分析 20 个功能点
        print(f"   🔍 检查功能：{feature['type']} - {feature['content'][:30]}...")
        
        # 根据类型检查实现
        if feature["type"] == "API 端点":
            impls = check_api_implementation(code_dirs, feature["content"])
        elif feature["type"] == "数据库表":
            impls = check_table_implementation(code_dirs, feature["content"])
        else:
            impls = check_feature_implementation(code_dirs, feature)
        
        # 检查测试
        tests = check_test_coverage(code_dirs, feature)
        
        # 计算完成度
        completeness = calculate_completeness([feature], impls, tests)
        
        feature_analysis.append({
            "feature": feature,
            "implementations": impls,
            "tests": tests,
            "completeness": completeness,
            "status": "✅" if completeness >= 80 else "🟡" if completeness >= 40 else "❌"
        })
        
        print(f"      实现：{len(impls)}, 测试：{len(tests)}, 完成度：{completeness:.0f}%")
    
    # 总体完成度
    total_completeness = sum(f["completeness"] for f in feature_analysis) / len(feature_analysis) if feature_analysis else 0
    
    return {
        "doc_path": doc_path,
        "features": feature_analysis,
        "total_completeness": total_completeness,
        "feature_count": len(feature_analysis)
    }


def generate_detailed_report(docs_dir, code_dirs, output_dir):
    """生成详细分析报告"""
    print("=" * 60)
    print("  Orion 文档实现细节检查工具")
    print("=" * 60)
    
    # 查找核心设计文档
    core_docs = []
    for root, dirs, files in os.walk(docs_dir):
        for file in files:
            if file.endswith('.md') and any(kw in file for kw in ['设计', 'design', '架构', '方案']):
                core_docs.append(os.path.join(root, file))
    
    print(f"\n📚 找到核心设计文档：{len(core_docs)} 份")
    
    # 分析每个文档
    results = []
    for doc in core_docs[:10]:  # 最多分析 10 份文档
        result = analyze_document(doc, code_dirs)
        results.append(result)
    
    # 生成报告
    report_content = f"""# Orion 文档实现细节分析报告

> 生成时间：{datetime.now().strftime('%Y-%m-%d %H:%M:%S')}

---

## 总体状态

| 指标 | 数值 |
|------|------|
| 分析文档数 | {len(results)} |
| 提取功能点 | {sum(r['feature_count'] for r in results)} |
| 平均完成度 | {sum(r['total_completeness'] for r in results) / len(results):.1f}% |

---

## 文档完成度排行

| 排名 | 文档 | 功能点数 | 完成度 | 状态 |
|------|------|---------|--------|------|
"""
    
    sorted_results = sorted(results, key=lambda x: x['total_completeness'], reverse=True)
    
    for i, r in enumerate(sorted_results, 1):
        doc_name = os.path.basename(r['doc_path'])
        status = '✅' if r['total_completeness'] >= 80 else '🟡' if r['total_completeness'] >= 40 else '❌'
        report_content += f"| {i} | {doc_name} | {r['feature_count']} | {r['total_completeness']:.1f}% | {status} |\n"
    
    report_content += f"""
---

## 详细分析

"""
    
    for r in results:
        doc_name = os.path.basename(r['doc_path'])
        report_content += f"""### {doc_name}

**完成度**: {r['total_completeness']:.1f}%

| # | 功能点 | 类型 | 实现 | 测试 | 完成度 |
|---|-------|------|------|------|--------|
"""
        
        for j, f in enumerate(r['features'][:10], 1):
            feature_name = f['feature']['content'][:20]
            impl_count = len(f['implementations'])
            test_count = len(f['tests'])
            completeness = f['completeness']
            status = '✅' if completeness >= 80 else '🟡' if completeness >= 40 else '❌'
            
            report_content += f"| {j} | {feature_name} | {f['feature']['type']} | {impl_count} | {test_count} | {completeness:.0f}% {status} |\n"
        
        report_content += "\n---\n\n"
    
    report_content += f"""## 待办事项

"""
    
    for r in results:
        if r['total_completeness'] < 80:
            doc_name = os.path.basename(r['doc_path'])
            report_content += f"- [ ] **{doc_name}**: 完成度 {r['total_completeness']:.1f}%"
            
            # 找出未完成的功能点
            incomplete = [f for f in r['features'] if f['completeness'] < 80]
            if incomplete:
                report_content += f" - 需实现 {len(incomplete)} 个功能点\n"
            else:
                report_content += "\n"
    
    report_content += f"""
---

_本报告由 Orion 文档实现细节检查工具自动生成_
"""
    
    # 保存报告
    os.makedirs(output_dir, exist_ok=True)
    report_file = os.path.join(output_dir, "文档实现细节分析报告.md")
    
    with open(report_file, 'w', encoding='utf-8') as f:
        f.write(report_content)
    
    # 保存 JSON 数据
    json_file = os.path.join(output_dir, "文档实现细节数据.json")
    with open(json_file, 'w', encoding='utf-8') as f:
        json.dump(results, f, ensure_ascii=False, indent=2)
    
    print()
    print("=" * 60)
    print("  分析完成!")
    print("=" * 60)
    print()
    print(f"📄 分析报告：{report_file}")
    print(f"📊 分析文档：{len(results)} 份")
    print(f"📈 平均完成度：{sum(r['total_completeness'] for r in results) / len(results):.1f}%")
    print()
    
    return report_file, results


def main():
    docs_dir = "/Users/heal/orion-design/docs"
    code_dirs = CODE_DIRS
    output_dir = "/Users/heal/orion-design/docs/cache/detail-analysis"
    
    generate_detailed_report(docs_dir, code_dirs, output_dir)


if __name__ == "__main__":
    main()
