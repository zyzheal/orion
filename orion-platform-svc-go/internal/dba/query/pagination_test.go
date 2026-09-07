package query

import (
	"strings"
	"testing"
)

func TestEncodeDecodeCursor_RoundTrip(t *testing.T) {
	in := Cursor{Version: 1, Offset: 4242, Limit: 100}
	tok, err := EncodeCursor(in)
	if err != nil {
		t.Fatalf("encode: %v", err)
	}
	if tok == "" {
		t.Fatal("empty token")
	}
	if tok == "4242" || strings.Contains(tok, "offset") || strings.Contains(tok, "4242,") {
		t.Fatalf("token leaks raw offset: %q", tok)
	}
	out, err := DecodeCursor(tok)
	if err != nil {
		t.Fatalf("decode: %v", err)
	}
	if out != in {
		t.Errorf("roundtrip mismatch: got %+v want %+v", out, in)
	}
}

func TestEncodeCursor_RejectsBadValues(t *testing.T) {
	cases := []Cursor{
		{Version: 0, Offset: 5, Limit: 0},              // non-positive limit
		{Version: 0, Offset: -1, Limit: 10},             // negative offset
		{Version: 2, Offset: 0, Limit: 10},              // unsupported version
		{Version: 0, Offset: MaxCursorOffset + 1, Limit: 10}, // too large
	}
	for _, c := range cases {
		if _, err := EncodeCursor(c); err == nil {
			t.Errorf("expected error for %+v", c)
		}
	}
}

func TestDecodeCursor_RejectsMalformed(t *testing.T) {
	cases := []string{
		"",
		"not-base64-!!!",
		"eyJ2IjoxLCJvIjotMSwibCI6MTB9", // base64 of JSON with negative offset
		"eyJ2IjoyLCJvIjowLCJsIjoxMH0",    // version 2
	}
	for _, s := range cases {
		if _, err := DecodeCursor(s); err == nil {
			t.Errorf("expected error for %q", s)
		}
	}
}

func TestAppendPagination_WrapsSQL(t *testing.T) {
	got := AppendPagination("SELECT id FROM users ORDER BY id", Cursor{Version: 1, Offset: 0, Limit: 10})
	want := "SELECT * FROM (SELECT id FROM users ORDER BY id) AS __orion_paged LIMIT 10 OFFSET 0"
	if got != want {
		t.Errorf("got:  %s\nwant: %s", got, want)
	}
}

func TestAppendPagination_OverridesInnerLimit(t *testing.T) {
	// When the user's SQL already has a LIMIT, our wrapper's outer
	// LIMIT/OFFSET takes precedence. Both LIMITs appear in the SQL
	// string but the outer one determines which rows are returned.
	got := AppendPagination("SELECT id FROM users LIMIT 5", Cursor{Version: 1, Offset: 100, Limit: 20})
	if !strings.Contains(got, "LIMIT 20 OFFSET 100") {
		t.Errorf("outer LIMIT/OFFSET missing: %s", got)
	}
	// The outer LIMIT must be the final LIMIT in the string.
	last := strings.LastIndex(got, "LIMIT ")
	if last < 0 {
		t.Fatalf("no LIMIT found in: %s", got)
	}
	if got[last:] != "LIMIT 20 OFFSET 100" {
		t.Errorf("outer LIMIT is not last: %s", got[last:])
	}
}

func TestAppendPagination_StripsTrailingSemicolon(t *testing.T) {
	got := AppendPagination("SELECT id FROM users;", Cursor{Version: 1, Offset: 0, Limit: 5})
	if strings.Contains(got, ";") {
		t.Errorf("semicolons should be stripped: %s", got)
	}
}

func TestAppendPagination_StripsLineComment(t *testing.T) {
	got := AppendPagination("SELECT id FROM users -- trailing", Cursor{Version: 1, Offset: 0, Limit: 5})
	if strings.Contains(got, "--") {
		t.Errorf("line comment should be stripped: %s", got)
	}
}

func TestAppendPagination_PreservesBlockComment(t *testing.T) {
	// Block comments are preserved because they can carry query hints.
	inner := "SELECT /*+ IndexHint(i) */ id FROM users"
	got := AppendPagination(inner, Cursor{Version: 1, Offset: 0, Limit: 5})
	if !strings.Contains(got, "/*+") {
		t.Errorf("block comment stripped: %s", got)
	}
}

func TestAppendPagination_DefendsAgainstInjection(t *testing.T) {
	// A user cannot smuggle a second LIMIT/OFFSET by appending SQL —
	// the wrapper always terminates their statement.
	inner := "SELECT 1; DROP TABLE users"
	got := AppendPagination(inner, Cursor{Version: 1, Offset: 0, Limit: 5})
	// The wrapper still produces valid syntax (as a subquery) — but the
	// audit engine must reject the multi-statement SQL upstream. We
	// assert that we at least do not place the attacker's DROP inside
	// the LIMIT clause.
	if strings.Contains(got, "DROP TABLE users LIMIT") {
		t.Errorf("attacker SQL leaked into LIMIT: %s", got)
	}
	// Our outer LIMIT is always last.
	if !strings.HasSuffix(got, "LIMIT 5 OFFSET 0") {
		t.Errorf("outer LIMIT not at end: %s", got)
	}
}

func TestAppendPagination_EmptySQLProducesFallback(t *testing.T) {
	got := AppendPagination("", Cursor{Version: 1, Offset: 0, Limit: 5})
	if !strings.Contains(got, "SELECT 1") {
		t.Errorf("empty SQL should fall back to SELECT 1: %s", got)
	}
}

func TestAppendPagination_DefaultsLimitWhenZero(t *testing.T) {
	got := AppendPagination("SELECT 1", Cursor{Version: 1, Offset: 0, Limit: 0})
	if !strings.Contains(got, "LIMIT "+itoa(DefaultPageSize)) {
		t.Errorf("limit default not applied: %s", got)
	}
}

func TestAppendPagination_DefaultsOffsetWhenNegative(t *testing.T) {
	got := AppendPagination("SELECT 1", Cursor{Version: 1, Offset: -100, Limit: 5})
	if strings.Contains(got, "OFFSET -") {
		t.Errorf("negative offset leaked: %s", got)
	}
	if !strings.Contains(got, "OFFSET 0") {
		t.Errorf("offset default not applied: %s", got)
	}
}

// itoa is a tiny helper to avoid importing strconv just for a test.
func itoa(n int) string {
	if n == 0 {
		return "0"
	}
	b := make([]byte, 0, 8)
	for n > 0 {
		b = append([]byte{byte('0' + n%10)}, b...)
		n /= 10
	}
	return string(b)
}
