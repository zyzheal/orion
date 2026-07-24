// Package database provides helpers for auto-injecting the _source column
// into INSERT/UPDATE queries so the Go service always tags its writes.

package database

import (
	"database/sql"
	"fmt"
)

const SourceColumn = "_source"
const SourceGO = "go"
const SourceTS = "ts"

// SourceTag is a repository-level helper that appends `_source = 'go'` to
// INSERT/UPDATE statements so the Go service always tags the rows it writes.
type SourceTag struct{}

// NewSourceTag returns a new SourceTag.
func NewSourceTag() *SourceTag {
	return &SourceTag{}
}

// AppendSourceToInsert takes an INSERT query string (without ON CONFLICT or
// RETURNING clauses) and appends the _source column if it is not already
// present in the column list.
//
// Example:
//
//	query := "INSERT INTO tickets (id, title) VALUES (:id, :title)"
//	query := tag.AppendSourceToInsert(query)
//	// => "INSERT INTO tickets (id, title, _source) VALUES (:id, :title, 'go')"
func (t *SourceTag) AppendSourceToInsert(query string, source string) string {
	if source == "" {
		source = SourceGO
	}
	if containsColumn(query, SourceColumn) {
		return query
	}

	// Find the VALUES keyword boundary.
	idx := -1
	for i := 0; i <= len(query)-6; i++ {
		if query[i:i+6] == "VALUES" {
			idx = i
			break
		}
	}
	if idx == -1 {
		return query
	}

	// Find the closing parenthesis of the column list — the ')' immediately
	// before the VALUES keyword.
	closeParen := -1
	for i := idx - 1; i >= 0; i-- {
		if query[i] == ')' {
			closeParen = i
			break
		}
	}
	if closeParen == -1 {
		return query
	}

	// Insert ", _source" into the column list before the closing ')'.
	colList := query[:closeParen] + ", " + SourceColumn

	// Now find the closing ')' of the VALUES list (still at idx+6 in original query).
	// Build new query up to VALUES, then inject source value.
	prefix := colList + query[closeParen:] // colList + ") VALUES (...)"
	// prefix now: "INSERT INTO tickets (id, title, _source) VALUES (:id, :title)"
	// Find VALUES position in prefix
	valIdx2 := -1
	for i := 0; i <= len(prefix)-6; i++ {
		if prefix[i:i+6] == "VALUES" {
			valIdx2 = i
			break
		}
	}
	if valIdx2 == -1 {
		return prefix
	}
	// Find the opening '(' after VALUES
	openParen2 := valIdx2 + 6
	for openParen2 < len(prefix) && prefix[openParen2] == ' ' {
		openParen2++
	}
	if openParen2 >= len(prefix) || prefix[openParen2] != '(' {
		return prefix
	}
	// Find the closing ')' of VALUES
	valClose2 := -1
	for i := openParen2 + 1; i < len(prefix); i++ {
		if prefix[i] == ')' {
			valClose2 = i
			break
		}
	}
	if valClose2 == -1 {
		return prefix
	}

	// Insert source value before the closing ')' of VALUES
	return prefix[:valClose2] + fmt.Sprintf(", '%s'", source) + prefix[valClose2:]
}

// AppendSourceToUpdate takes an UPDATE query and appends `_source = 'go'` to
// the SET clause.
//
// Example:
//
//	query := "UPDATE tickets SET title=:title WHERE id=:id"
//	query := tag.AppendSourceToUpdate(query)
//	// => "UPDATE tickets SET title=:title, _source='go' WHERE id=:id"
func (t *SourceTag) AppendSourceToUpdate(query string, source string) string {
	if source == "" {
		source = SourceGO
	}
	if containsSourceAssignment(query) {
		return query
	}

	// Find the WHERE keyword boundary.
	whereIdx := -1
	for i := 0; i <= len(query)-5; i++ {
		if query[i:i+5] == "WHERE" {
			whereIdx = i
			break
		}
	}
	if whereIdx == -1 {
		// No WHERE — append at end
		return query + fmt.Sprintf(" SET %s = '%s'", SourceColumn, source)
	}

	// Find the SET keyword.
	setIdx := -1
	for i := 0; i <= whereIdx-3; i++ {
		if query[i:i+3] == "SET" {
			setIdx = i
			break
		}
	}
	if setIdx == -1 {
		return query
	}

	// Insert ", _source='go'" before WHERE.
	prefix := query[:whereIdx] + fmt.Sprintf(" %s = '%s',", SourceColumn, source)
	suffix := query[whereIdx:]
	return prefix + suffix
}

// UpsertSource returns the ON CONFLICT ... DO UPDATE SET _source = 'go'
// fragment suitable for append to an INSERT ... ON CONFLICT query.
//
// Note: callers must supply the conflict target (e.g., "ON CONFLICT (id)")
// themselves. This returns just the DO UPDATE SET clause.
func (t *SourceTag) UpsertSource(source string) string {
	if source == "" {
		source = SourceGO
	}
	return fmt.Sprintf("DO UPDATE SET %s = '%s'", SourceColumn, source)
}

// ReadSource executes SELECT _source FROM <table> WHERE <where> <args> and
// returns the existing source value. Returns SourceTS if the column is absent
// or the query fails (backward compatible: legacy rows have no _source).
func (t *SourceTag) ReadSource(db *sql.DB, table string, where string, args ...interface{}) string {
	var src string
	err := db.QueryRow(fmt.Sprintf("SELECT %s FROM %s WHERE %s", SourceColumn, table, where), args...).Scan(&src)
	if err != nil {
		return SourceTS // backward compatible: missing column or row → ts
	}
	if src == "" {
		return SourceTS
	}
	return src
}

// containsColumn checks if the column name appears in a query string.
func containsColumn(query, col string) bool {
	for i := 0; i <= len(query)-len(col); i++ {
		if query[i:i+len(col)] == col {
			return true
		}
	}
	return false
}

// containsSourceAssignment checks if _source is already being set in the query.
func containsSourceAssignment(query string) bool {
	assignment := fmt.Sprintf("%s = ", SourceColumn)
	for i := 0; i <= len(query)-len(assignment); i++ {
		if query[i:i+len(assignment)] == assignment {
			return true
		}
	}
	return false
}
