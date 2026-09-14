package main

import (
	"os"
	"path/filepath"
	"regexp"
	"sort"
	"strconv"
	"strings"
	"testing"
)

// The code-scan tables must be created by a forward migration. Every write
// against code_scan_runs died at runtime with
// "could not find name total_vulns" (sqlx's default NameMapper lowercases Go
// field names, so TotalVulns would bind to "totalvulns") and every read with
// "missing destination name total_vulns" until the models carried db tags and
// the placeholders were realigned with the columns this migration creates.
//
// Neither failure is visible to go build or go vet, so the test below pins the
// closure: if any Go file references the tables, some forward migration must
// create both, and the columns the repository names must all exist in it.
func TestMigrationsCreateTheCodeScanTables(t *testing.T) {
	callers := 0
	_ = filepath.WalkDir("../../internal", func(path string, d os.DirEntry, err error) error {
		if err != nil || d.IsDir() || !strings.HasSuffix(path, ".go") || strings.HasSuffix(path, "_test.go") {
			return nil
		}
		b, rerr := os.ReadFile(path)
		if rerr != nil {
			return nil
		}
		if strings.Contains(string(b), "code_scan_runs") || strings.Contains(string(b), "code_scan_findings") {
			callers++
		}
		return nil
	})
	if callers == 0 {
		t.Skip("no Go code references the code scan tables")
	}

	entries, err := os.ReadDir("../../migrations")
	if err != nil {
		t.Fatalf("read migrations dir: %v", err)
	}
	files := map[string]string{}
	versions := map[string][]string{}
	for _, e := range entries {
		if e.IsDir() || !strings.HasSuffix(e.Name(), ".sql") {
			continue
		}
		b, rerr := os.ReadFile(filepath.Join("../../migrations", e.Name()))
		if rerr != nil {
			continue
		}
		name := e.Name()
		// Rollbacks run only on explicit MIGRATE_DOWN_TO and would drop the
		// tables; the invariant is about the forward path.
		if strings.HasSuffix(name, "_down.sql") {
			continue
		}
		files[name] = string(b)
		if n, err := strconv.Atoi(name[:3]); err == nil && n > 0 {
			versions[name[:3]] = append(versions[name[:3]], name)
		}
	}

	// The runner reads the flat directory in version order, so a duplicated
	// version would apply two files at the same step and the later one would
	// silently overwrite the earlier.
	for _, v := range sortedKeys(versions) {
		if len(versions[v]) > 1 {
			t.Errorf("migration version %s is used by %d files: %v", v, len(versions[v]), versions[v])
		}
	}

	for _, tbl := range []string{"code_scan_runs", "code_scan_findings"} {
		found := false
		for name, body := range files {
			if strings.Contains(body, "CREATE TABLE IF NOT EXISTS "+tbl) || strings.Contains(body, "CREATE TABLE "+tbl) {
				found = true
				t.Logf("%s creates %s", name, tbl)
				// The migration runner wraps each file in its own transaction,
				// so a literal BEGIN/COMMIT inside the file would end the runner's
				// transaction early and the later statements would run without a
				// rollback on error.
				if reLiteralTx.MatchString(body) {
					t.Errorf("%s contains a literal BEGIN or COMMIT; the runner wraps each file in its own transaction", name)
				}
			}
		}
		if !found {
			t.Errorf("%d Go files reference %s but no forward migration creates it", callers, tbl)
		}
	}
}

// TestMigrationColumnsMatchTheRepositoryNames pins every column the repository
// reads or writes. The column list is read out of the repository source, so
// adding a column to a query forces this test to fail until the migration
// catches up -- the exact "invisible to go build" class of defect.
func TestMigrationColumnsMatchTheRepositoryNames(t *testing.T) {
	src, err := os.ReadFile("../../internal/code-scan/repository/repository.go")
	if err != nil {
		t.Fatalf("read repository: %v", err)
	}

	// Restrict to the code scan migration: matching against every migration would
	// let an unrelated table's identically named column satisfy the check.
	var body string
	for _, e := range entriesInMigrationsDir() {
		if strings.HasSuffix(e.name, "_down.sql") || !strings.Contains(e.name, "code_scan") {
			continue
		}
		body += "\n" + e.body
	}
	if strings.TrimSpace(body) == "" {
		t.Fatalf("no forward migration creates the code scan tables")
	}

	for _, tc := range []struct {
		name  string
		re    *regexp.Regexp
		table string
	}{
		{"runColumns", reColumnConst, "code_scan_runs"},
		{"findingColumns", reFindingColumnConst, "code_scan_findings"},
	} {
		m := tc.re.FindStringSubmatch(string(src))
		if m == nil {
			t.Fatalf("repository declares no %s constant", tc.name)
		}
		got := ""
		for _, c := range strings.Split(m[1], ",") {
			c = strings.TrimSpace(c)
			if c == "" {
				continue
			}
			if !reColumnInDDL(c).MatchString(body) {
				t.Errorf("%s reads %s but the %s migration does not define that column", tc.name, c, tc.table)
			}
			got += " " + c
		}
		if strings.TrimSpace(got) == "" {
			t.Fatalf("%s is empty", tc.name)
		}
	}
}

type migrationFile struct{ name, body string }

func entriesInMigrationsDir() []migrationFile {
	entries, err := os.ReadDir("../../migrations")
	if err != nil {
		return nil
	}
	out := []migrationFile{}
	for _, e := range entries {
		if e.IsDir() || !strings.HasSuffix(e.Name(), ".sql") {
			continue
		}
		b, rerr := os.ReadFile(filepath.Join("../../migrations", e.Name()))
		if rerr != nil {
			continue
		}
		out = append(out, migrationFile{name: e.Name(), body: string(b)})
	}
	return out
}

func sortedKeys(m map[string][]string) []string {
	out := make([]string, 0, len(m))
	for k := range m {
		out = append(out, k)
	}
	sort.Strings(out)
	return out
}

var (
	// reLiteralTx matches a standalone BEGIN; or COMMIT;. The migration runner
	// wraps each file in its own transaction, so a literal one here would end
	// the runner's transaction early.
	reLiteralTx          = regexp.MustCompile(`(?i)(^|\n)\s*(BEGIN|COMMIT)\s*;\s*(--.*)?$`)
	reColumnConst        = regexp.MustCompile(`runColumns\s*=\s*"([^"]+)"`)
	reFindingColumnConst = regexp.MustCompile(`findingColumns\s*=\s*"([^"]+)"`)
)

// reColumnInDDL matches a column name as its own word inside DDL, so "status"
// does not pass for "audit_status".
func reColumnInDDL(col string) *regexp.Regexp {
	return regexp.MustCompile(`(?m)^\s*` + regexp.QuoteMeta(col) + `\s+[^,\n]+`)
}
