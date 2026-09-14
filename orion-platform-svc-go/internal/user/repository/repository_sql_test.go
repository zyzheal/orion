package repository

import (
	"context"
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"sort"
	"strings"
	"testing"

	"orion/go-common/pkg/sentinel"

	"github.com/DATA-DOG/go-sqlmock"
	"github.com/jmoiron/sqlx"
)

// norm collapses whitespace and drops punctuation so the matcher compares the
// shape of the statement rather than its formatting. sqlmock's default
// QueryMatcherRegexp is deliberately not used: a trailing "$" in the expected
// text is read as a regexp end-anchor, which makes assertions pass for the
// wrong reason. Every expectation here is therefore an exact statement.
func norm(s string) string {
	for _, r := range []string{"\n", "\r", "\t", "(", ")", ","} {
		s = strings.ReplaceAll(s, r, " ")
	}
	return strings.ToLower(strings.Join(strings.Fields(s), " "))
}

func openMock(t *testing.T) (*Repository, sqlmock.Sqlmock) {
	t.Helper()
	raw, mock, err := sqlmock.New(sqlmock.QueryMatcherOption(sqlmock.QueryMatcherFunc(func(expected, actual string) error {
		if norm(expected) == norm(actual) {
			return nil
		}
		return fmt.Errorf("sql mismatch:\n  expected: %s\n     actual: %s", norm(expected), norm(actual))
	})))
	if err != nil {
		t.Fatalf("sqlmock.New: %v", err)
	}
	return NewRepository(sqlx.NewDb(raw, "postgres")), mock
}

// errNotFound is the one value the rest of the platform can see: the service and
// the handler recognise only sentinel.NotFound, so a package-private sentinel
// here would make every missing user look like a database outage (500 instead of
// 404). Pinning the identity keeps the swap from being reverted silently.
func TestErrNotFoundIsThePlatformSentinel(t *testing.T) {
	if !errors.Is(errNotFound, sentinel.NotFound) {
		t.Fatal("errNotFound must be sentinel.NotFound: the service only recognises that sentinel")
	}
}

// --- the bug this file pins ---
//
// Update used to render its SET list with fmt.Sprintf("%v", fields). %v on a
// []string emits square brackets, space separators and no commas:
//
//	UPDATE users SET [full_name=$3 updated_at=NOW()] WHERE id=$1 AND tenant_id=$2
//
// which is a hard syntax error on every call. The statement was registered and
// permission-guarded, so PUT /users/:id could never succeed; because the
// handler maps every error to 404 it reported the user as not found while the
// row sat there untouched.

func TestSetClauseRendersACommaSeparatedSetList(t *testing.T) {
	set, args, n := setClause(map[string]interface{}{
		"full_name": "Ada",
		"email":     "ada@x.io",
	}, usersUpdatable)

	if strings.Contains(set, "[") || strings.Contains(set, "]") {
		t.Fatalf("SET list contains list syntax: %q", set)
	}
	if !strings.Contains(set, ",") {
		t.Fatalf("SET list has no comma separator: %q", set)
	}
	for _, want := range []string{"email=$3", "full_name=$4", "updated_at=NOW()"} {
		if !strings.Contains(set, want) {
			t.Errorf("SET list missing %q: %q", want, set)
		}
	}
	if set == "" || n != 2 {
		t.Fatalf("want 2 columns, got n=%d set=%q", n, set)
	}
	// Placeholders must continue after id=$1 and tenant_id=$2.
	for _, forbidden := range []string{"=$1", "=$2"} {
		if strings.Contains(set, forbidden) {
			t.Errorf("SET placeholder collides with the WHERE clause: %q in %q", forbidden, set)
		}
	}
	if len(args) != n {
		t.Fatalf("want %d bound values, got %d: %v", n, len(args), args)
	}
	if args[0] != "ada@x.io" || args[1] != "Ada" {
		t.Fatalf("values are not in placeholder order: %v", args)
	}
}

func TestSetClauseBindsOneArgumentPerColumn(t *testing.T) {
	updates := map[string]interface{}{
		"full_name":  "Ada",
		"email":      "ada@x.io",
		"role":       "admin",
		"status":     "active",
		"avatar_url": "https://x/1.png",
		"settings":   "{}",
	}
	set, args, n := setClause(updates, usersUpdatable)
	if n != len(updates) || len(args) != len(updates) {
		t.Fatalf("want %d columns and values, got n=%d args=%d", len(updates), n, len(args))
	}
	for i := 0; i < n; i++ {
		if !strings.Contains(set, fmt.Sprintf("=$%d", i+3)) {
			t.Errorf("no placeholder at position %d: %q", i+3, set)
		}
	}
}

func TestSetClauseSkipsKeysOutsideTheWhitelist(t *testing.T) {
	set, args, n := setClause(map[string]interface{}{
		"id":         "another-user",
		"tenant_id":  "tenant-2",
		"password":   "hash",
		"created_at": "2020-01-01",
		"username":   "not exposed by the request model",
		"full_name":  "Ada",
		"role":       "admin",
	}, usersUpdatable)
	if n != 2 {
		t.Fatalf("want 2 settable columns, got %d: %q", n, set)
	}
	for _, forbidden := range []string{"id=$", "tenant_id=$", "password=$", "created_at=$", "username=$"} {
		if strings.Contains(set, forbidden) {
			t.Errorf("unwhitelisted column rendered: %q in %q", forbidden, set)
		}
	}
	if set != "full_name=$3, role=$4, updated_at=NOW()" {
		t.Fatalf("unexpected SET list: %q", set)
	}
	if len(args) != 2 || args[0] != "Ada" || args[1] != "admin" {
		t.Fatalf("values must cover exactly the rendered columns: %v", args)
	}
}

func TestSetClauseRejectsAMapWithNoSettableKeys(t *testing.T) {
	set, args, n := setClause(map[string]interface{}{"id": "u2", "password": "hash"}, usersUpdatable)
	if set != "" || n != 0 || len(args) != 0 {
		t.Fatalf("want an empty clause, got set=%q n=%d args=%v", set, n, args)
	}
}

// Go maps iterate in unspecified order, so the rendered statement must not
// depend on it. Repeats catch non-determinism a single call cannot.
func TestSetClauseIsDeterministicAcrossMapIterations(t *testing.T) {
	updates := map[string]interface{}{
		"settings":   "{}",
		"full_name":  "Ada",
		"role":       "admin",
		"avatar_url": "https://x/1.png",
		"email":      "ada@x.io",
		"status":     "active",
	}
	want := "avatar_url=$3, email=$4, full_name=$5, role=$6, settings=$7, status=$8, updated_at=NOW()"
	for i := 0; i < 500; i++ {
		set, _, n := setClause(updates, usersUpdatable)
		if n != 6 {
			t.Fatalf("iteration %d: want 6 columns, got %d", i, n)
		}
		if set != want {
			t.Fatalf("iteration %d rendered:\n  want: %s\n  got:  %s", i, want, set)
		}
	}
}

// --- Update executes exactly the whitelisted statement ---

func TestUpdateExecutesTheWhitelistedStatement(t *testing.T) {
	repo, mock := openMock(t)
	mock.ExpectExec(`UPDATE users SET avatar_url=$3, email=$4, full_name=$5, role=$6, settings=$7, status=$8, updated_at=NOW() WHERE id=$1 AND tenant_id=$2`).
		WithArgs("u1", "t1", "https://x/1.png", "ada@x.io", "Ada", "admin", "{}", "active").
		WillReturnResult(sqlmock.NewResult(1, 1))

	err := repo.Update(context.Background(), "t1", "u1", map[string]interface{}{
		"full_name":  "Ada",
		"email":      "ada@x.io",
		"role":       "admin",
		"status":     "active",
		"avatar_url": "https://x/1.png",
		"settings":   "{}",
	})
	if err != nil {
		t.Fatalf("Update: %v", err)
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatalf("statement or argument list is wrong: %v", err)
	}
}

func TestUpdateDropsUnwhitelistedColumnsFromTheStatement(t *testing.T) {
	repo, mock := openMock(t)
	mock.ExpectExec(`UPDATE users SET full_name=$3, role=$4, updated_at=NOW() WHERE id=$1 AND tenant_id=$2`).
		WithArgs("u1", "t1", "Ada", "admin").
		WillReturnResult(sqlmock.NewResult(1, 1))

	// Identifiers and immutable columns interleaved with the two settable ones.
	err := repo.Update(context.Background(), "t1", "u1", map[string]interface{}{
		"id":         "u2",
		"full_name":  "Ada",
		"tenant_id":  "tenant-2",
		"created_at": "2020-01-01",
		"role":       "admin",
		"password":   "hash",
	})
	if err != nil {
		t.Fatalf("Update: %v", err)
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatalf("unwhitelisted columns leaked into the statement or the arg list: %v", err)
	}
}

func TestUpdateRefusesAMapWithNoSettableFields(t *testing.T) {
	repo, mock := openMock(t)
	// No ExpectExec: a statement here fails the test at cleanup.

	err := repo.Update(context.Background(), "t1", "u1", map[string]interface{}{
		"id": "u2", "tenant_id": "tenant-2", "password": "hash", "created_at": "2020-01-01",
	})
	if !errors.Is(err, errNoUpdatableFields) {
		t.Fatalf("want errNoUpdatableFields, got %v", err)
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatalf("an unexpected statement was executed: %v", err)
	}
}

func TestUpdateReportsNotFoundWhenNoRowWasTouched(t *testing.T) {
	repo, mock := openMock(t)
	mock.ExpectExec(`UPDATE users SET full_name=$3, updated_at=NOW() WHERE id=$1 AND tenant_id=$2`).
		WithArgs("u1", "t1", "Ada").
		WillReturnResult(sqlmock.NewResult(1, 0)) // query ran, zero rows affected

	err := repo.Update(context.Background(), "t1", "u1", map[string]interface{}{"full_name": "Ada"})
	if !errors.Is(err, errNotFound) {
		t.Fatalf("want errNotFound for a zero-row write, got %v", err)
	}
}

func TestUpdateIsScopedToTheTenant(t *testing.T) {
	repo, mock := openMock(t)
	// Where the predicate went, the arg list goes with it: tenant_id=$2 means
	// the second bound value is the tenant id.
	mock.ExpectExec(`UPDATE users SET full_name=$3, updated_at=NOW() WHERE id=$1 AND tenant_id=$2`).
		WithArgs("u1", "t1", "Ada").
		WillReturnResult(sqlmock.NewResult(1, 1))

	if err := repo.Update(context.Background(), "t1", "u1", map[string]interface{}{"full_name": "Ada"}); err != nil {
		t.Fatalf("Update: %v", err)
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatalf("statement is not tenant-bound: %v", err)
	}
}

// --- the columns Update may set must exist in the users table ---

func TestWhitelistedColumnsExistInTheSchema(t *testing.T) {
	cols := readUserColumns(t)
	for col := range usersUpdatable {
		if !cols[col] {
			t.Errorf("usersUpdatable allows %q, but no migration gives the users table that column", col)
		}
	}
	for _, forbidden := range []string{"id", "tenant_id", "created_at", "password", "updated_at", "username"} {
		if usersUpdatable[forbidden] {
			t.Errorf("usersUpdatable must not allow %q", forbidden)
		}
	}
}

// readUserColumns parses the users CREATE TABLE out of migrations/.
func readUserColumns(t *testing.T) map[string]bool {
	t.Helper()
	migrationsDir := filepath.Join("..", "..", "..", "migrations")
	entries, err := os.ReadDir(migrationsDir)
	if err != nil {
		t.Fatalf("reading migrations: %v", err)
	}
	cols := map[string]bool{}
	found := false
	for _, e := range entries {
		name := e.Name()
		if e.IsDir() || strings.HasSuffix(name, "_down.sql") || !strings.HasSuffix(name, ".sql") {
			continue
		}
		body, err := os.ReadFile(filepath.Join(migrationsDir, name))
		if err != nil {
			t.Fatalf("reading %s: %v", name, err)
		}
		idx := strings.Index(string(body), "CREATE TABLE IF NOT EXISTS users (")
		if idx < 0 {
			continue
		}
		found = true
		rest := string(body)[idx:]
		end := strings.Index(rest, "\n);")
		if end < 0 {
			continue
		}
		for _, line := range strings.Split(rest[:end], "\n") {
			// "--" comments document the column; the whole line is a comment,
			// so skipping only the marker would leave the comment body behind
			// and parse its first word as a column name.
			line = strings.TrimSpace(line)
			if strings.HasPrefix(line, "--") {
				continue
			}
			tok := strings.Fields(line)
			if len(tok) == 0 {
				continue
			}
			if sqlKeyword(tok[0]) {
				continue
			}
			cols[tok[0]] = true
		}
		// 000 and 077 both define the table; the last one read wins.
	}
	if !found {
		t.Fatal("no migration creates the users table, so every user repository call fails with 'relation does not exist'")
	}
	if len(cols) < 8 {
		t.Fatalf("parsed only %d columns from the users table: %v", len(cols), keys(cols))
	}
	return cols
}

func sqlKeyword(tok string) bool {
	switch strings.ToUpper(tok) {
	case "CONSTRAINT", "PRIMARY", "KEY", "FOREIGN", "REFERENCES", "UNIQUE",
		"DEFAULT", "NOT", "NULL", "INDEX", "CHECK", "ON", "CREATE", "TABLE", "IF", "EXISTS":
		return true
	}
	return false
}

func keys(m map[string]bool) []string {
	out := make([]string, 0, len(m))
	for k := range m {
		out = append(out, k)
	}
	sort.Strings(out)
	return out
}
