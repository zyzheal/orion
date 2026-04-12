#!/bin/bash
# Orion 完成度检查与索引自动更新一键脚本
# 用途：执行所有检查工具并自动更新索引

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DOCS_DIR="$SCRIPT_DIR/../docs"
CACHE_DIR="$DOCS_DIR/cache"

echo "============================================================"
echo "  Orion 完成度检查与索引自动更新"
echo "============================================================"
echo ""
echo "📁 工作目录：$SCRIPT_DIR"
echo "📂 文档目录：$DOCS_DIR"
echo ""

# 创建缓存目录
mkdir -p "$CACHE_DIR"

# 步骤 1: 文档审计
echo "⏳ 步骤 1/5: 文档质量审计..."
echo ""
bash "$SCRIPT_DIR/audit-docs.sh"
echo ""

# 步骤 2: 模块映射
echo "⏳ 步骤 2/5: 模块映射..."
echo ""
python3 "$SCRIPT_DIR/module-mapper.py"
echo ""

# 步骤 3: 细节检查
echo "⏳ 步骤 3/5: 文档实现细节检查..."
echo ""
python3 "$SCRIPT_DIR/check-detail-completeness.py"
echo ""

# 步骤 4: 生成仪表盘
echo "⏳ 步骤 4/5: 生成综合仪表盘..."
echo ""
python3 "$SCRIPT_DIR/dashboard-generator.py"
echo ""

# 步骤 5: 自动更新索引
echo "⏳ 步骤 5/5: 自动更新索引..."
echo ""
python3 "$SCRIPT_DIR/auto-update-index.py"
echo ""

# 输出总结
echo "============================================================"
echo "  ✅ 所有检查与更新完成!"
echo "============================================================"
echo ""
echo "📊 生成的报告:"
echo ""
echo "  1. 文档审计报告"
echo "     → $CACHE_DIR/文档审计报告.md"
echo ""
echo "  2. 模块索引卡汇总"
echo "     → $CACHE_DIR/module-cards/模块索引卡汇总.md"
echo ""
echo "  3. 文档实现细节分析报告"
echo "     → $CACHE_DIR/detail-analysis/文档实现细节分析报告.md"
echo ""
echo "  4. 综合完成度仪表盘"
echo "     → $CACHE_DIR/dashboard/综合完成度仪表盘.html"
echo ""
echo "  5. 索引更新摘要"
echo "     → $CACHE_DIR/索引更新摘要.md"
echo ""
echo "============================================================"
echo ""
echo "📖 查看结果:"
echo ""
echo "  open $CACHE_DIR/dashboard/综合完成度仪表盘.html"
echo "  open $CACHE_DIR/索引更新摘要.md"
echo ""
echo "============================================================"
echo ""
echo "🔄 下次检查:"
echo "  - 每日：bash tools/audit-docs.sh"
echo "  - 每周：bash tools/full-check-and-update.sh"
echo ""
