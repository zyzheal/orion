#!/bin/bash
# 数据库迁移文件重编号脚本
# 用法: bash scripts/renumber-migrations.sh

MIGRATIONS_DIR="orion-platform-service/src/db/migrations"

if [ ! -d "$MIGRATIONS_DIR" ]; then
  echo "❌ 迁移目录不存在: $MIGRATIONS_DIR"
  exit 1
fi

echo "=== 数据库迁移重编号 ==="
echo "目录: $MIGRATIONS_DIR"

# 1. 列出所有迁移文件，按原始编号排序
echo ""
echo "[Step 1] 扫描迁移文件..."
mapfile -t FILES < <(ls "$MIGRATIONS_DIR"/*.sql 2>/dev/null | sort)
TOTAL=${#FILES[@]}
echo "  共找到 $TOTAL 个迁移文件"

# 2. 检测重复编号
echo ""
echo "[Step 2] 检测重复编号..."
DUPLICATES=$(ls "$MIGRATIONS_DIR"/*.sql | xargs -n1 basename | cut -d_ -f1 | sort | uniq -d)
if [ -n "$DUPLICATES" ]; then
  echo "  ❌ 发现重复编号:"
  echo "$DUPLICATES" | while read num; do
    echo "    $num: $(ls "$MIGRATIONS_DIR"/${num}_*.sql | xargs -n1 basename)"
  done
else
  echo "  ✅ 无重复编号"
fi

# 3. 生成新编号（从最大编号+1 开始）
echo ""
echo "[Step 3] 生成新编号..."
MAX_NUM=$(ls "$MIGRATIONS_DIR"/*.sql | xargs -n1 basename | cut -d_ -f1 | sort -n | tail -1)
NEXT_NUM=$((10#${MAX_NUM} + 1))
echo "  当前最大编号: $MAX_NUM"
echo "  新编号从: $NEXT_NUM"

# 4. 生成重命名计划
echo ""
echo "[Step 4] 重命名计划:"
COUNTER=$NEXT_NUM
DRY_RUN=true

for FILE in "${FILES[@]}"; do
  BASENAME=$(basename "$FILE")
  OLD_NUM=$(echo "$BASENAME" | cut -d_ -f1)
  REST=$(echo "$BASENAME" | cut -d_ -f2-)
  NEW_NUM=$(printf "%03d" $COUNTER)

  if [ "$OLD_NUM" != "$NEW_NUM" ]; then
    echo "  $BASENAME → ${NEW_NUM}_${REST}"
  fi
  COUNTER=$((COUNTER + 1))
done

# 5. 确认执行
echo ""
if $DRY_RUN; then
  echo "  以上是 DRY RUN 结果"
  echo "  确认执行: 去掉脚本中的 DRY_RUN=true 行后重新运行"
else
  echo "  执行重命名..."
  COUNTER=$NEXT_NUM
  for FILE in "${FILES[@]}"; do
    BASENAME=$(basename "$FILE")
    REST=$(echo "$BASENAME" | cut -d_ -f2-)
    NEW_NUM=$(printf "%03d" $COUNTER)
    DIR=$(dirname "$FILE")

    if [ "$(echo "$BASENAME" | cut -d_ -f1)" != "$NEW_NUM" ]; then
      mv "$FILE" "$DIR/${NEW_NUM}_${REST}"
      echo "  ✅ $BASENAME → ${NEW_NUM}_${REST}"
    fi
    COUNTER=$((COUNTER + 1))
  done
  echo "  ✅ 重编号完成"
fi