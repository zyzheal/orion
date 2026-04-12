#!/bin/bash
# Orion 文档审计工具
# 用途：盘点文档体系、检查文档质量、生成审计报告

set -e

DOCS_DIR="${1:-/Users/heal/orion-design/docs}"
OUTPUT_DIR="$DOCS_DIR/cache"
REPORT_FILE="$OUTPUT_DIR/文档审计报告.md"

echo "============================================================"
echo "  Orion 文档体系审计工具"
echo "============================================================"
echo ""
echo "审计目录：$DOCS_DIR"
echo "输出目录：$OUTPUT_DIR"
echo ""

# 创建输出目录
mkdir -p "$OUTPUT_DIR"

# 初始化报告
cat > "$REPORT_FILE" << 'EOF'
# Orion 文档审计报告

> 生成时间：TIMESTAMP_PLACEHOLDER

---

## 一、文档分布统计

EOF

# 替换时间戳
sed -i '' "s/TIMESTAMP_PLACEHOLDER/$(date '+%Y-%m-%d %H:%M:%S')/g" "$REPORT_FILE"

# 1. 统计各目录文档数
echo "📊 1. 统计各目录文档分布..."
echo "" >> "$REPORT_FILE"
echo "| 目录 | 文档数 | 总行数 | 平均行数 |" >> "$REPORT_FILE"
echo "|------|--------|--------|----------|" >> "$REPORT_FILE"

total_docs=0
total_lines=0

for dir in "$DOCS_DIR"/*/; do
    if [ -d "$dir" ]; then
        dir_name=$(basename "$dir")
        doc_count=$(find "$dir" -maxdepth 1 -name "*.md" -type f 2>/dev/null | wc -l | tr -d ' ')
        if [ "$doc_count" -gt 0 ]; then
            line_count=$(find "$dir" -maxdepth 1 -name "*.md" -type f -exec wc -l {} \; 2>/dev/null | awk '{sum+=$1} END {print sum}')
            avg_lines=$((line_count / doc_count))
            echo "| $dir_name | $doc_count | $line_count | $avg_lines |" >> "$REPORT_FILE"
            total_docs=$((total_docs + doc_count))
            total_lines=$((total_lines + line_count))
        fi
    fi
done

echo "| **总计** | **$total_docs** | **$total_lines** | $((total_lines / total_docs)) |" >> "$REPORT_FILE"
echo "" >> "$REPORT_FILE"

# 2. 检查 frontmatter
echo "📋 2. 检查文档 frontmatter..."
echo "" >> "$REPORT_FILE"
echo "## 二、文档质量检查" >> "$REPORT_FILE"
echo "" >> "$REPORT_FILE"
echo "### 2.1 Frontmatter 检查" >> "$REPORT_FILE"
echo "" >> "$REPORT_FILE"

missing_fm=0
with_fm=0
missing_fm_list=""

for file in $(find "$DOCS_DIR" -name "*.md" -type f 2>/dev/null); do
    first_line=$(head -1 "$file" 2>/dev/null)
    if [ "$first_line" != "---" ]; then
        missing_fm=$((missing_fm + 1))
        missing_fm_list="$missing_fm_list\n- $file"
    else
        with_fm=$((with_fm + 1))
    fi
done

fm_rate=$((with_fm * 100 / (with_fm + missing_fm)))
echo "✅ 有 frontmatter: $with_fm 份" >> "$REPORT_FILE"
echo "❌ 缺少 frontmatter: $missing_fm 份" >> "$REPORT_FILE"
echo "📊 覆盖率：**$fm_rate%**" >> "$REPORT_FILE"

if [ "$missing_fm" -gt 0 ]; then
    echo "" >> "$REPORT_FILE"
    echo "#### 缺少 frontmatter 的文档 ($missing_fm 份)" >> "$REPORT_FILE"
    echo "" >> "$REPORT_FILE"
    echo -e "$missing_fm_list" >> "$REPORT_FILE"
fi

# 3. 检查 Mermaid 图表
echo "📈 3. 检查 Mermaid 图表..."
echo "" >> "$REPORT_FILE"
echo "" >> "$REPORT_FILE"
echo "### 2.2 Mermaid 图表检查" >> "$REPORT_FILE"
echo "" >> "$REPORT_FILE"

with_mermaid=0
mermaid_files=""

for file in $(find "$DOCS_DIR" -name "*.md" -type f 2>/dev/null); do
    if grep -q '```mermaid' "$file" 2>/dev/null; then
        with_mermaid=$((with_mermaid + 1))
        mermaid_files="$mermaid_files\n- $file"
    fi
done

mermaid_rate=$((with_mermaid * 100 / total_docs))
echo "✅ 含 Mermaid 图表：$with_mermaid 份" >> "$REPORT_FILE"
echo "📊 覆盖率：**$mermaid_rate%**" >> "$REPORT_FILE"

# 4. 检查文档状态分布
echo "📊 4. 统计文档状态分布..."
echo "" >> "$REPORT_FILE"
echo "" >> "$REPORT_FILE"
echo "### 2.3 文档状态分布" >> "$REPORT_FILE"
echo "" >> "$REPORT_FILE"

draft_count=0
review_count=0
approved_count=0
other_count=0

for file in $(find "$DOCS_DIR" -name "*.md" -type f 2>/dev/null); do
    if grep -q 'status: draft' "$file" 2>/dev/null; then
        draft_count=$((draft_count + 1))
    elif grep -q 'status: review' "$file" 2>/dev/null; then
        review_count=$((review_count + 1))
    elif grep -q 'status: approved' "$file" 2>/dev/null; then
        approved_count=$((approved_count + 1))
    else
        other_count=$((other_count + 1))
    fi
done

echo "| 状态 | 文档数 | 占比 |" >> "$REPORT_FILE"
echo "|------|--------|------|" >> "$REPORT_FILE"
echo "| 📝 草稿 (draft) | $draft_count | $((draft_count * 100 / total_docs))% |" >> "$REPORT_FILE"
echo "| 👀 评审中 (review) | $review_count | $((review_count * 100 / total_docs))% |" >> "$REPORT_FILE"
echo "| ✅ 已批准 (approved) | $approved_count | $((approved_count * 100 / total_docs))% |" >> "$REPORT_FILE"
echo "| 其他 | $other_count | $((other_count * 100 / total_docs))% |" >> "$REPORT_FILE"

# 5. 检查过期文档 (超过 30 天未更新)
echo "⏰ 5. 检查过期文档..."
echo "" >> "$REPORT_FILE"
echo "" >> "$REPORT_FILE"
echo "### 2.4 过期文档检查 (超过 30 天未更新)" >> "$REPORT_FILE"
echo "" >> "$REPORT_FILE"

outdated_count=0
outdated_files=""

while IFS= read -r file; do
    if [ -n "$file" ]; then
        mod_date=$(stat -f "%Sm" -t "%Y-%m-%d" "$file" 2>/dev/null)
        mod_timestamp=$(date -j -f "%Y-%m-%d" "$mod_date" +%s 2>/dev/null)
        now_timestamp=$(date +%s)
        days_old=$(( (now_timestamp - mod_timestamp) / 86400 ))
        
        if [ "$days_old" -gt 30 ]; then
            outdated_count=$((outdated_count + 1))
            outdated_files="$outdated_files\n- $file (最后更新：$mod_date, $days_old 天前)"
        fi
    fi
done < <(find "$DOCS_DIR" -name "*.md" -type f 2>/dev/null)

echo "📊 过期文档数：**$outdated_count 份**" >> "$REPORT_FILE"

if [ "$outdated_count" -gt 0 ]; then
    echo "" >> "$REPORT_FILE"
    echo "#### 过期文档列表" >> "$REPORT_FILE"
    echo "" >> "$REPORT_FILE"
    echo -e "$outdated_files" >> "$REPORT_FILE"
fi

# 6. 总结
echo "" >> "$REPORT_FILE"
echo "" >> "$REPORT_FILE"
echo "## 三、审计总结" >> "$REPORT_FILE"
echo "" >> "$REPORT_FILE"
echo "| 指标 | 数值 | 状态 |" >> "$REPORT_FILE"
echo "|------|------|------|" >> "$REPORT_FILE"

fm_status="✅"
[ "$fm_rate" -lt 80 ] && fm_status="⚠️"
[ "$fm_rate" -lt 50 ] && fm_status="❌"

mermaid_status="✅"
[ "$mermaid_rate" -lt 50 ] && mermaid_status="⚠️"
[ "$mermaid_rate" -lt 30 ] && mermaid_status="❌"

outdated_status="✅"
[ "$outdated_count" -gt 20 ] && outdated_status="⚠️"
[ "$outdated_count" -gt 50 ] && outdated_status="❌"

echo "| Frontmatter 覆盖率 | $fm_rate% | $fm_status |" >> "$REPORT_FILE"
echo "| Mermaid 图表覆盖率 | $mermaid_rate% | $mermaid_status |" >> "$REPORT_FILE"
echo "| 过期文档数 | $outdated_count | $outdated_status |" >> "$REPORT_FILE"
echo "| 文档总数 | $total_docs | - |" >> "$REPORT_FILE"
echo "| 总行数 | $total_lines | - |" >> "$REPORT_FILE"

echo ""
echo "============================================================"
echo "  审计完成!"
echo "============================================================"
echo ""
echo "📄 审计报告：$REPORT_FILE"
echo ""
echo "关键指标:"
echo "  - 文档总数：$total_docs 份"
echo "  - Frontmatter 覆盖率：$fm_rate%"
echo "  - Mermaid 图表覆盖率：$mermaid_rate%"
echo "  - 过期文档数：$outdated_count 份"
echo ""
