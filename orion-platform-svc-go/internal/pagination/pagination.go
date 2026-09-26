// Package pagination parses the offset, limit, page and page_size query
// parameters used by the platform's list endpoints and returns values that are
// safe to bind into a SQL LIMIT / OFFSET clause.
//
// It exists because these parsers used to be copy-pasted into every handler
// package that needed them. Ten byte-identical copies of queryOffset had spread
// across the repository — one untested branch (`?offset=1` folded to 0) was
// duplicated ten times, and any fix had to be applied in ten places. Putting the
// logic here means the clamp is written, reviewed and tested once.
//
// Both parsers come in two shapes. The offset / limit shape reads two separate
// parameters. The page shape reads a 1-based page number and a page size and
// derives the offset, which is how most of the platform's list endpoints are
// written. Both families had the same hole: neither endpoint of the arithmetic
// was ever checked, so one bad query parameter turned a GET into a 500.
//
// Every function here is a floor, not a cap: a caller that wants a maximum page
// size must add it at the repository, which already does so for most modules.

package pagination

import "strconv"

// Page parses a 1-based "page" query param, clamping a value below 1 to the
// default (usually 1). The offset is derived as `(page-1)*pageSize`, so
// `?page=-1` produces a negative OFFSET and `?page=0` produces a negative
// OFFSET too — Postgres rejects both with an error instead of data, turning a
// GET into a 500. Absent and unparsable values are the default.
func Page(value string, def int) int {
	if i, err := strconv.Atoi(value); err == nil && i > 0 {
		return i
	}
	return def
}

// OffsetFromPage returns the SQL OFFSET for a 1-based page number. It clamps
// both inputs so a caller that hands it raw query values still cannot produce a
// negative OFFSET: the page floor is 1 (page 1 is offset 0) and the page size
// floor is 1 (a size of 0 or less is meaningless as an OFFSET step and divides
// by zero in any total-pages calculation).
func OffsetFromPage(page, pageSize int) int {
	if page < 1 {
		page = 1
	}
	if pageSize < 1 {
		pageSize = 1
	}
	return (page - 1) * pageSize
}

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
