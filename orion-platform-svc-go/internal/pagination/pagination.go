// Package pagination parses the offset and limit query parameters used by the
// platform's list endpoints and returns values that are safe to bind into a SQL
// LIMIT / OFFSET clause.
//
// It exists because these two parsers used to be copy-pasted into every handler
// package that needed them. Ten byte-identical copies of queryOffset had spread
// across the repository — one untested branch (`?offset=1` folded to 0) was
// duplicated ten times, and any fix had to be applied in ten places. Putting the
// logic here means the clamp is written, reviewed and tested once.
//
// Both functions are floors, not caps: a caller that wants a maximum page size
// must add it at the repository, which already does so for most modules.
package pagination

import "strconv"

// Offset parses an "offset" query param, clamping a negative value to 0.
// Postgres rejects a negative OFFSET, so without the clamp `?offset=-1` turns a
// list endpoint into a 500. Most repositories in this platform clamp `limit`
// but never offset, so a handler-level clamp is the only guard on the path.
// Absent and unparsable values are 0.
func Offset(value string) int {
	if i, err := strconv.Atoi(value); err == nil && i > 0 {
		return i
	}
	return 0
}

// Limit parses a "limit" query param as a page size, falling back to the
// default when it is missing, unparsable or <= 0. A page size of 0 passes
// LIMIT 0 to the database and divides by zero in the Page calculation, so it is
// treated like an absent param. This is a floor, not a cap.
func Limit(value string, def int) int {
	if i, err := strconv.Atoi(value); err == nil && i > 0 {
		return i
	}
	return def
}
