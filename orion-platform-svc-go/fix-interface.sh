#!/bin/bash
# Fix the 15 failing modules: add RepositoryInterface, replace *repository.Repository with interface

cd /Users/heal/orion-design/orion-platform-svc-go

MODULES="internal/ai-decisions/service internal/audit/service internal/capability/service internal/chatops/service internal/developer-portal/service internal/digital-twin/service internal/digital-twin-simulation/service internal/efficiency/service internal/governance/service internal/monitoring/service internal/pipeline-graph/service internal/tenant/service internal/test-selector/service internal/ticketing/service internal/workflow/service"

for MOD in $MODULES; do
  SVC="$MOD/service.go"
  REPO="$MOD/../repository/repository.go"

  if [ ! -f "$SVC" ]; then
    echo "skip $SVC: not found"
    continue
  fi

  # Check if already has interface
  if grep -q "type RepositoryInterface interface" "$SVC" 2>/dev/null; then
    echo "skip $SVC: already has interface"
    continue
  fi

  # Check if NewService uses *repository.Repository
  if ! grep -q "NewService.*\*repository\.Repository" "$SVC" 2>/dev/null; then
    echo "skip $SVC: NewService doesn't use *repository.Repository"
    continue
  fi

  echo "fixing $SVC..."

  # Extract all s.repo.XXX() method calls
  METHODS=$(grep -oP 's\.repo\.\K[A-Z][A-Za-z0-9]+(?=\()' "$SVC" | sort -u)

  # Extract signatures from repository.go
  SIGS=""
  if [ -f "$REPO" ]; then
    for METHOD in $METHODS; do
      # Find the function signature in repository.go
      SIG=$(grep -E "func.*\b$METHOD\(" "$REPO" | head -1)
      if [ -n "$SIG" ]; then
        # Extract just the method name and signature
        CLEAN_SIG=$(echo "$SIG" | sed 's/func [^*]*\([^(]*\) (\([^)]*\)) \([[:space:]]*\)/\1(\2) \3/')
        SIGS="$SIGS\n\t$CLEAN_SIG"
      fi
    done
  fi

  # Create the interface block
  IFACE="
// RepositoryInterface defines the repository methods used by the service.
type RepositoryInterface interface {
$(echo "$SIGS" | grep -v '^$')
}
"

  # Insert interface after package declaration (before import)
  # Find the line after "package service" and the blank line after it
  LINE=$(grep -n "^package service" "$SVC" | head -1 | cut -d: -f1)
  if [ -n "$LINE" ]; then
    # Insert after line + 1 (the blank line after package)
    INSERT_LINE=$((LINE + 1))
    # Use sed to insert after the blank line
    sed -i '' "${INSERT_LINE}a\\$IFACE" "$SVC" 2>/dev/null || {
      # Alternative: use awk
      awk -v insert="$IFACE" -v after="$INSERT_LINE" 'NR==after{print; print insert; next} {print}' "$SVC" > "${SVC}.tmp" && mv "${SVC}.tmp" "$SVC"
    }
  fi

  # Replace *repository.Repository with RepositoryInterface
  sed -i '' 's/repo \*repository\.Repository/repo RepositoryInterface/g' "$SVC" 2>/dev/null
  sed -i '' 's/NewService(repo \*repository\.Repository)/NewService(repo RepositoryInterface)/g' "$SVC" 2>/dev/null

  # Check if repository import is still needed (look for other repository.XXX references)
  if ! grep -v "NewService\|RepositoryInterface" "$SVC" | grep -q "repository\."; then
    # Remove the repository import line
    sed -i '' '/"orion\/platform-svc-go\/internal\/[^"]*\/repository"/d' "$SVC" 2>/dev/null
  fi

  echo "  done ($SVC)"
done

echo ""
echo "Running go test..."
go test ./internal/... 2>&1 | grep -c "FAIL"
