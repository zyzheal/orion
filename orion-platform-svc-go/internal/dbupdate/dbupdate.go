// Package dbupdate builds parameterised UPDATE statements for partial updates
// constrained to a per-table column whitelist.
//
// It exists because six repositories had drifted into the same shape: an
// Update method that accepted an updates map and issued
// "UPDATE <table> SET updated_at = NOW() WHERE id = $1 AND tenant_id = $2",
// so every caller-visible field was silently dropped while the method still
// reported success. The whitelist is the point of centralising it -- a column
// name that is not a real column of the table must never reach SQL, and the
// rule cannot drift between six packages.
package dbupdate

import (
	"errors"
	"fmt"
	"sort"
	"strings"
	"time"
)

// ErrEmpty reports that the updates map carried no column the table allows.
// Callers must skip the write and report the row unchanged rather than issuing
// an UPDATE that would touch only updated_at.
var ErrEmpty = errors.New("dbupdate: no updatable column in updates")

// ErrUnsafeTable reports a table identifier that cannot be interpolated.
var ErrUnsafeTable = errors.New("dbupdate: unsafe table name")

// Build renders "UPDATE <table> SET ... WHERE id=$N AND tenant_id=$M" for a
// partial update. Only keys present in allowed are written; keys outside the
// whitelist are ignored rather than interpolated. updated_at is always
// refreshed and is never accepted from the caller's map, so a map that only
// carries updated_at reports ErrEmpty.
//
// Keys are sorted so the rendered SQL is deterministic; tests compare it
// verbatim.
func Build(table string, updates map[string]any, allowed []string, id, tenantID string) (string, []any, error) {
	if strings.ContainsAny(table, " \t\r\n;'\"") || table == "" {
		return "", nil, ErrUnsafeTable
	}
	ok := make(map[string]struct{}, len(allowed))
	for _, c := range allowed {
		if c != "" {
			ok[c] = struct{}{}
		}
	}
	keys := make([]string, 0, len(updates))
	for k := range updates {
		if k == "updated_at" {
			continue
		}
		if _, yes := ok[k]; yes {
			keys = append(keys, k)
		}
	}
	sort.Strings(keys)
	if len(keys) == 0 {
		return "", nil, ErrEmpty
	}

	setClauses := make([]string, 0, len(keys)+1)
	args := make([]any, 0, len(keys)+2)
	i := 1
	for _, k := range keys {
		setClauses = append(setClauses, fmt.Sprintf("%s = $%d", k, i))
		args = append(args, updates[k])
		i++
	}
	setClauses = append(setClauses, fmt.Sprintf("updated_at = $%d", i))
	args = append(args, time.Now().UTC())
	i++
	args = append(args, id)
	idPos := i
	i++
	args = append(args, tenantID)
	stmt := fmt.Sprintf("UPDATE %s SET %s WHERE id = $%d AND tenant_id = $%d",
		table, strings.Join(setClauses, ", "), idPos, i)
	return stmt, args, nil
}
