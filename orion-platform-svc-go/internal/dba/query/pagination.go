package query

import (
	"encoding/base64"
	"encoding/json"
	"errors"
	"fmt"
	"strings"
)

// ErrInvalidCursor is returned by DecodeCursor when the input is not
// produced by EncodeCursor. It is a sentinel so callers can errors.Is
// without inspecting strings.
var ErrInvalidCursor = errors.New("invalid cursor")

// ErrCursorTooLarge is returned when the decoded cursor claims an
// offset beyond the module's hard cap. It protects the DBA service
// from accepting hand-crafted cursors that would force OFFSET over
// hundreds of millions of rows.
var ErrCursorTooLarge = errors.New("cursor offset exceeds maximum")

// MaxCursorOffset caps the offset the module will honour. Beyond this
// a caller should be re-running the query with a narrower WHERE clause
// rather than paginating linearly.
const MaxCursorOffset int = 10000000

// Cursor is the opaque page position returned by the module. It is
// serialised as base64(json) so the wire format is stable across minor
// version changes: the JSON payload is versioned and any unknown field
// is ignored on decode.
type Cursor struct {
	// Version is a minor schema discriminator. Currently always 1.
	// Reserved so we can add fields later without breaking clients.
	Version int `json:"v"`
	// Offset is the number of rows to skip before reading this page.
	Offset int `json:"o"`
	// Limit is the page size the client requested. Echoed back so a
	// server-side change cannot silently shift page boundaries.
	Limit int `json:"l"`
}

// newCursor validates the caller-provided values before serialisation.
// Kept private: callers build cursors only via service logic.
func newCursor(offset, limit int) (Cursor, error) {
	if offset < 0 {
		return Cursor{}, fmt.Errorf("%w: negative offset %d", ErrInvalidCursor, offset)
	}
	if limit <= 0 {
		return Cursor{}, fmt.Errorf("%w: non-positive limit %d", ErrInvalidCursor, limit)
	}
	if offset > MaxCursorOffset {
		return Cursor{}, fmt.Errorf("%w: %d > %d", ErrCursorTooLarge, offset, MaxCursorOffset)
	}
	return Cursor{Version: 1, Offset: offset, Limit: limit}, nil
}

// EncodeCursor produces the opaque page token stored in
// PagedQueryResult.NextPageToken. It never returns the raw numeric
// values so a caller cannot tamper with the offset directly.
func EncodeCursor(c Cursor) (string, error) {
	if c.Version == 0 {
		c.Version = 1
	}
	if c.Version != 1 {
		return "", fmt.Errorf("%w: unsupported version %d", ErrInvalidCursor, c.Version)
	}
	if c.Offset < 0 {
		return "", fmt.Errorf("%w: negative offset", ErrInvalidCursor)
	}
	if c.Limit <= 0 {
		return "", fmt.Errorf("%w: non-positive limit", ErrInvalidCursor)
	}
	if c.Offset > MaxCursorOffset {
		return "", fmt.Errorf("%w: %d", ErrCursorTooLarge, c.Offset)
	}
	payload, err := json.Marshal(c)
	if err != nil {
		return "", fmt.Errorf("encode cursor: %w", err)
	}
	return base64.RawURLEncoding.EncodeToString(payload), nil
}

// DecodeCursor is the inverse of EncodeCursor. It returns ErrInvalidCursor
// for any malformed input so callers can map the error to a 400 without
// leaking the underlying base64/json details.
func DecodeCursor(s string) (Cursor, error) {
	if s == "" {
		return Cursor{}, fmt.Errorf("%w: empty token", ErrInvalidCursor)
	}
	payload, err := base64.RawURLEncoding.DecodeString(s)
	if err != nil {
		return Cursor{}, fmt.Errorf("%w: %v", ErrInvalidCursor, err)
	}
	var c Cursor
	if err := json.Unmarshal(payload, &c); err != nil {
		return Cursor{}, fmt.Errorf("%w: %v", ErrInvalidCursor, err)
	}
	if c.Version != 1 {
		return Cursor{}, fmt.Errorf("%w: unsupported version %d", ErrInvalidCursor, c.Version)
	}
	if c.Offset < 0 || c.Limit <= 0 {
		return Cursor{}, fmt.Errorf("%w: negative offset or non-positive limit", ErrInvalidCursor)
	}
	if c.Offset > MaxCursorOffset {
		return Cursor{}, fmt.Errorf("%w: %d", ErrCursorTooLarge, c.Offset)
	}
	return c, nil
}

// AppendPagination wraps sql in a subquery and appends LIMIT/OFFSET
// at the outer scope. Wrapping prevents injection and lets the
// subquery keep its own ORDER BY semantics.
//
// Why wrap instead of appending "LIMIT n OFFSET m" directly?
//
//  1. The user SQL may already contain LIMIT/OFFSET. Appending a
//     second LIMIT is a syntax error on PostgreSQL and a semantic
//     surprise on MySQL. The subquery neutralises that case.
//  2. The user SQL may end with ";" or a comment. Appending directly
//     would either break parsing or place the LIMIT inside the comment.
//     Wrapping handles both.
//  3. The user SQL may be a WITH ... SELECT statement. MySQL 8+ and
//     PostgreSQL both accept a WITH clause inside a subquery
//     (parenthesised), which the wrapper form does.
//
// The wrapper always applies, even for an empty cursor — this keeps
// the SQL string shape predictable and lets the DBA audit engine see
// the exact query it is approving.
func AppendPagination(sql string, cursor Cursor) string {
	inner := normalizeSQL(sql)
	limit := cursor.Limit
	offset := cursor.Offset
	if limit <= 0 {
		limit = DefaultPageSize
	}
	if offset < 0 {
		offset = 0
	}
	return fmt.Sprintf("SELECT * FROM (%s) AS __orion_paged LIMIT %d OFFSET %d", inner, limit, offset)
}

// normalizeSQL strips trailing whitespace, semicolons, and line
// comments so the wrapper can append "LIMIT ... OFFSET ..." without
// colliding with SQL syntax.
//
// Block comments (/* */) are NOT stripped: they may contain critical
// hints such as "/*+ IndexHint */" that change the execution plan.
// Line comments are stripped only when they appear at the tail of the
// statement — an inline "--" (e.g. a comment between clauses) is
// preserved.
func normalizeSQL(sql string) string {
	s := strings.TrimSpace(sql)
	for {
		// Strip trailing whitespace and semicolons.
		trimmed := strings.TrimRight(s, " \t\r\n;")
		if trimmed != s {
			s = trimmed
			continue
		}
		// Strip a trailing line comment (from the last "--" onwards).
		if idx := strings.LastIndex(s, "--"); idx >= 0 {
			candidate := strings.TrimSpace(s[:idx])
			// Only peel if the "--" is preceded by a safe boundary:
			// either the start of the string or a non-identifier char
			// (whitespace, comma, semicolon, or a closing paren). This
			// prevents treating "--" inside an identifier or string as
			// a comment marker.
			if idx == 0 || isCommentBoundary(s[idx-1]) {
				s = candidate
				continue
			}
		}
		break
	}
	// Guard against empty SQL — AppendPagination would otherwise
	// produce "SELECT * FROM () AS ..." which is a parse error.
	if s == "" {
		return "SELECT 1"
	}
	return s
}

// isCommentBoundary reports whether the character immediately before a
// candidate "--" is a position where a line comment is syntactically
// valid (whitespace, punctuation, or end-of-string).
func isCommentBoundary(c byte) bool {
	return c == ' ' || c == '\t' || c == '\n' || c == '\r' ||
		c == ';' || c == ',' || c == '(' || c == ')' || c == 0
}
