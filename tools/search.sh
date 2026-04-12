#!/bin/bash
# Orion 文档搜索工具
# 用法: ./tools/search.sh [选项]
#
# 选项:
#   -k, --keyword <词>    全文关键词搜索
#   -t, --tag <标签>      按标签搜索 (frontmatter)
#   -d, --domain <领域>   按领域目录搜索
#   -s, --status <状态>   按状态搜索
#   --adr                 列出所有 ADR
#   --stats               显示文档统计
#   --broken              检查断裂链接
#   --missing-fm          列出缺少 frontmatter 的文档

set -e
DOCS_ROOT="/Users/heal/orion-design"

case "$1" in
  -k|--keyword)
    echo "=== 关键词搜索: $2 ==="
    grep -rn "$2" "$DOCS_ROOT/docs/" --include="*.md" \
      -l 2>/dev/null | while read f; do
      count=$(grep -c "$2" "$f" 2>/dev/null)
      echo "  📄 $f ($count 次)"
    done
    ;;

  -t|--tag)
    echo "=== 标签搜索: $2 ==="
    grep -rl "tags:.*$2" "$DOCS_ROOT/docs/" --include="*.md" 2>/dev/null \
      || echo "  (无匹配文档)"
    ;;

  -d|--domain)
    echo "=== 领域: $2 ==="
    find "$DOCS_ROOT/docs/$2" -name "*.md" 2>/dev/null | while read f; do
      lines=$(wc -l < "$f")
      echo "  📄 $(basename "$f") ($lines 行)"
    done
    ;;

  -s|--status)
    echo "=== 状态: $2 ==="
    grep -rl "status: $2" "$DOCS_ROOT/docs/" --include="*.md" 2>/dev/null \
      || echo "  (无匹配文档)"
    ;;

  --adr)
    echo "=== 架构决策记录 (ADR) ==="
    ls -1 "$DOCS_ROOT/docs/adr/ADR-"*.md 2>/dev/null | while read f; do
      num=$(basename "$f" | sed 's/ADR-0*\([0-9]*\).*/\1/')
      title=$(basename "$f" | sed 's/ADR-[0-9]*-//' | sed 's/\.md//')
      echo "  ADR-$num: $title"
    done
    ;;

  --stats)
    echo "=== 📊 文档统计 ==="
    total=$(find "$DOCS_ROOT" -name "*.md" \
      -not -path "*/node_modules/*" \
      -not -path "*/.git/*" \
      -not -path "*/archive/*" \
      -not -path "*/orion-visor/*" \
      -not -path "*/Yearning/*" \
      -not -path "*/orion-dba/*" \
      -not -path "*/orion-knowledge/*" \
      -not -path "*/design-md/*" | wc -l)
    total_lines=$(find "$DOCS_ROOT" -name "*.md" \
      -not -path "*/node_modules/*" \
      -not -path "*/.git/*" \
      -not -path "*/archive/*" \
      -not -path "*/orion-visor/*" \
      -not -path "*/Yearning/*" \
      -not -path "*/orion-dba/*" \
      -not -path "*/orion-knowledge/*" \
      -not -path "*/design-md/*" \
      -exec cat {} + | wc -l)
    adr_count=$(ls "$DOCS_ROOT/docs/adr/ADR-"*.md 2>/dev/null | wc -l)
    draft_count=$(grep -rl "status: draft" "$DOCS_ROOT/docs/" --include="*.md" 2>/dev/null | wc -l)

    echo "  总文档数:    $total"
    echo "  总行数:      $total_lines"
    echo "  ADR 数量:    $adr_count"
    echo "  Draft 文档:  $draft_count"
    echo ""
    echo "  按领域分布:"
    for dir in "$DOCS_ROOT/docs/"*/; do
      name=$(basename "$dir")
      count=$(find "$dir" -name "*.md" 2>/dev/null | wc -l)
      [ "$count" -gt 0 ] && printf "    %-15s %3d 份\n" "$name" "$count"
    done
    ;;

  --broken)
    echo "=== 检查断裂链接 ==="
    echo "  (检查文档间的相对路径引用)"
    # 简化版：检查常见的断裂模式
    grep -roh '\[.*\](docs/[^)]*\.md)' "$DOCS_ROOT/docs/" 2>/dev/null | \
      sed 's/.*](\(.*\))/\1/' | sort -u | while read link; do
      full_path="$DOCS_ROOT/$link"
      if [ ! -f "$full_path" ]; then
        echo "  ❌ 断裂: $link"
      fi
    done
    echo "  ✅ 检查完成"
    ;;

  --missing-fm)
    echo "=== 缺少 frontmatter 的文档 ==="
    for f in $(find "$DOCS_ROOT/docs/" -name "*.md" -not -path "*/node_modules/*"); do
      if ! head -1 "$f" 2>/dev/null | grep -q "^---$"; then
        echo "  ⚠️  $f"
      fi
    done
    ;;

  *)
    echo "Orion 文档搜索工具"
    echo ""
    echo "用法: ./tools/search.sh [选项]"
    echo ""
    echo "选项:"
    echo "  -k, --keyword <词>    全文关键词搜索"
    echo "  -t, --tag <标签>      按标签搜索"
    echo "  -d, --domain <领域>   按领域目录搜索"
    echo "  -s, --status <状态>   按状态搜索"
    echo "  --adr                 列出所有 ADR"
    echo "  --stats               显示文档统计"
    echo "  --broken              检查断裂链接"
    echo "  --missing-fm          列出缺少 frontmatter 的文档"
    echo ""
    echo "示例:"
    echo "  ./tools/search.sh --stats"
    echo "  ./tools/search.sh --adr"
    echo "  ./tools/search.sh -k '自愈引擎'"
    echo "  ./tools/search.sh -d ai"
    ;;
esac
