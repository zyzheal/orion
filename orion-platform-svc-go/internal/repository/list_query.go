// Package repository provides the base tenant-aware repository and shared
// query types for domain repositories. This file defines ListQuery — a
// generic struct that captures search, filter, and sort parameters for
// paginated list endpoints.
package repository

import "fmt"

// ListQuery captures search, filter, sort, and pagination parameters for
// list endpoints. Handlers parse query string parameters into this struct,
// services pass it through, and repositories use it to build dynamic SQL.
type ListQuery struct {
	Search   string            // text search on name/title fields
	Filters  map[string]string // field=value filters (whitelist enforced by repo)
	SortBy   string            // sort field (must be in repo whitelist)
	SortDir  string            // "asc" or "desc" (default: "desc")
	Page     int
	PageSize int
}

// NewListQuery creates a ListQuery with sensible defaults.
func NewListQuery() *ListQuery {
	return &ListQuery{
		Filters:  make(map[string]string),
		SortDir:  "desc",
		Page:     1,
		PageSize: 20,
	}
}

// Normalize ensures page/pageSize are within valid bounds.
func (q *ListQuery) Normalize() {
	if q.Page < 1 {
		q.Page = 1
	}
	if q.PageSize < 1 {
		q.PageSize = 20
	}
	if q.PageSize > 100 {
		q.PageSize = 100
	}
	if q.SortDir != "asc" && q.SortDir != "desc" {
		q.SortDir = "desc"
	}
}

// BuildWhereClause constructs a WHERE clause fragment from the provided
// filter map and search field. It returns the fragment (without the leading
// "WHERE" keyword — the TenantAwareRepository will inject tenant_id filtering)
// and the args slice. Placeholder numbering starts at $1; the caller is
// responsible for knowing how many args precede these (the TenantAwareRepository
// run() method will shift placeholders to make room for tenant_id=$1).
//
// Parameters:
//   - filters: map of column→value (columns must be from a whitelist)
//   - searchField: the column to apply ILIKE search against (e.g., "name")
//   - searchValue: the search term (already trimmed)
//
// The returned whereStr is safe to embed in SQL because:
//   - Filter keys are validated against a whitelist by the caller
//   - Values are parameterized ($N placeholders)
//   - The search uses ILIKE with a parameterized placeholder
//
// Example output: "1=1 AND severity=$1 AND name ILIKE $2"
// Example args:   ["critical", "%mysearch%"]
func BuildWhereClause(filters map[string]string, searchField, searchValue string) (string, []interface{}) {
	where := []string{"1=1"}
	args := []interface{}{}
	idx := 1

	for col, val := range filters {
		if val == "" {
			continue
		}
		where = append(where, fmt.Sprintf("%s=$%d", col, idx))
		args = append(args, val)
		idx++
	}

	if searchField != "" && searchValue != "" {
		where = append(where, fmt.Sprintf("%s ILIKE $%d", searchField, idx))
		args = append(args, "%"+searchValue+"%")
		idx++
	}

	whereStr := ""
	for i, w := range where {
		if i > 0 {
			whereStr += " AND "
		}
		whereStr += w
	}
	return whereStr, args
}

// ValidateSortField checks if the given sort field is in the whitelist.
// If not, it returns the default field.
func ValidateSortField(field string, whitelist []string, defaultField string) string {
	for _, f := range whitelist {
		if field == f {
			return f
		}
	}
	return defaultField
}
