package main

import (
	"os"
	"path/filepath"
	"regexp"
	"strconv"
	"strings"
	"testing"
)

// The config-mgmt-enhanced module is wired on every boot and its handler
// registers 13 routes, but no migration created the relations its repository
// queries. Migration 115 created config_mgmts, change_requests,
// change_histories and drift_reports; the repository reads config_mgmt,
// config_change_requests, config_change_history and config_drift_reports. All
// 13 endpoints failed at the SQL layer before any business logic could run, and
// a second independent break had every INSERT fail because sqlx named
// placeholders were matched against strings.ToLower(TenantID).
//
// Migration 590 creates the relations the repository actually names and these
// tests derive the relation, column, nullability, placeholder, whitelist and
// index sets out of the Go source, so a statement, a db tag, an INSERT column
// list and a migration cannot drift apart again. Every identifier here is
// prefixed with cfg so nothing collides with the dr_ and runbook helpers
// already in this package.

const cfgMigration = "590_create_config_mgmt_enhanced_tables.sql"
const cfgDownMigration = "590_create_config_mgmt_enhanced_tables_down.sql"
const cfgLegacyMigration = "115_create_config-mgmt-enhanced_tables.sql"

var (
	// reCfgRel names every relation the module SQL mentions. All four relations
	// carry the config_ prefix, which keeps prose in comments out of the set.
	reCfgRel    = regexp.MustCompile(`(?i)(?:FROM|INTO|UPDATE)\s+(config_[a-z0-9_]*)`)
	reCfgCreate = regexp.MustCompile(
		`(?s)CREATE TABLE(?:\s+IF NOT EXISTS)?\s+(config_[a-z0-9_]*)\s*\(([^;]+?)\);`)
	// reCfgAnyCreate is used only for the legacy migration: three of its four
	// tables do not carry the config_ prefix.
	reCfgAnyCreate = regexp.MustCompile(`(?i)CREATE TABLE(?:\s+IF NOT EXISTS)?\s+([a-z0-9_]+)\s*\(`)
	reCfgInsert    = regexp.MustCompile(
		`(?s)INSERT INTO (config_[a-z0-9_]*)\s*\(([^)]+)\)\s*VALUES\s*\(([^)]+)\)`)
	reCfgCreateIndex = regexp.MustCompile(
		`(?i)CREATE INDEX IF NOT EXISTS ([a-z0-9_]+)\s+ON\s+(config_[a-z0-9_]*)\s*\(([^)]+)\)`)
	reCfgDropIndex   = regexp.MustCompile(`(?i)DROP INDEX IF EXISTS "?([a-z0-9_]+)"?`)
	reCfgDropTable   = regexp.MustCompile(`(?i)DROP TABLE IF EXISTS (config_[a-z0-9_]*)`)
	reCfgPlaceholder = regexp.MustCompile(`\$(\d+)`)
	reCfgQuestion    = regexp.MustCompile(`\?`)
	// reCfgSelectStar is checked line by line with comment lines skipped, so a
	// comment discussing the SELECT * policy does not fail the check.
	reCfgSelectStar = regexp.MustCompile(`(?i)\bSELECT\s+\*`)
	reCfgDBTag      = regexp.MustCompile("`db:\"([a-z0-9_]+)\"")
	reCfgQuote      = regexp.MustCompile(`"([^"]*)"`)
	reCfgNotNull    = regexp.MustCompile(`(?i)\bNOT NULL\b`)
	reCfgDefault    = regexp.MustCompile(`(?i)\bDEFAULT\b`)
	reCfgWhitelist  = regexp.MustCompile(`(?s)var\s+([a-zA-Z]+UpdateColumns)\s*=\s*map\[string\]bool\{([^}]*)\}`)
	// reCfgColDecl matches a column declaration anywhere in a CREATE TABLE
	// block. The type is matched loosely on purpose: a strict type list is what
	// made the older shared helper silently drop BIGINT and DECIMAL columns.
	reCfgColDecl = regexp.MustCompile(`^\s*([a-z_0-9]+)\s+([A-Za-z]+(?:\s*\(?\d*\)?))?(.*)$`)
)

// cfgStructToTable pins the four row structs to the relations the repository
// scans them into. Deriving this mapping from source would be circular.
var cfgStructToTable = map[string]string{
	"ConfigMgmt":    "config_mgmt",
	"ChangeRequest": "config_change_requests",
	"ChangeHistory": "config_change_history",
	"DriftReport":   "config_drift_reports",
}

// cfgConstToTable names the SELECT column lists in the repository.
var cfgConstToTable = map[string]string{
	"configMgmtColumns":    "config_mgmt",
	"changeRequestColumns": "config_change_requests",
	"changeHistoryColumns": "config_change_history",
	"driftReportColumns":   "config_drift_reports",
}

// cfgWhitelistToTable names the SET clause whitelists in the repository.
var cfgWhitelistToTable = map[string]string{
	"configMgmtUpdateColumns":    "config_mgmt",
	"changeRequestUpdateColumns": "config_change_requests",
	"driftReportUpdateColumns":   "config_drift_reports",
}

// cfgColumnExceptions records a column the migration declares but the SELECT
// list and the row struct deliberately omit. config_drift_reports.updated_at
// is written by UpdateDriftReport, but DriftReport has no UpdatedAt field, so
// neither the const nor the struct may claim it.
var cfgColumnExceptions = map[string]map[string]bool{
	"config_drift_reports": {"updated_at": true},
}

// cfgLegacyTables is the four relations migration 115 created under the wrong
// names. They are recorded here rather than dropped: 590 shadows them, and the
// tables that later migrations (239, 570, 572) alter are these plural names, so
// deleting them would break those migrations.
var cfgLegacyTables = []string{
	"config_mgmts",
	"change_requests",
	"change_histories",
	"drift_reports",
}

func cfgSourceFiles(t *testing.T) []string {
	t.Helper()
	var out []string
	err := filepath.WalkDir("../../internal/config-mgmt-enhanced", func(path string, d os.DirEntry, err error) error {
		if err != nil || d.IsDir() || !strings.HasSuffix(path, ".go") || strings.HasSuffix(path, "_test.go") {
			return nil
		}
		b, rerr := os.ReadFile(path)
		if rerr != nil {
			return nil
		}
		out = append(out, string(b))
		return nil
	})
	if err != nil {
		t.Fatal(err)
	}
	if len(out) == 0 {
		t.Fatal("no config-mgmt-enhanced source file was found")
	}
	return out
}

func cfgReadRepo(t *testing.T) string {
	t.Helper()
	b, err := os.ReadFile("../../internal/config-mgmt-enhanced/repository/repository.go")
	if err != nil {
		t.Fatal(err)
	}
	return string(b)
}

// cfgJoinLiterals rebuilds a string literal that spans several lines joined by
// +. The INSERT statements here are written that way, so the raw source puts
// quotes and plus signs between the closing paren and VALUES, which makes the
// INSERT regexp fail on the second line instead of matching the whole thing.
func cfgJoinLiterals(in string) string {
	out := strings.ReplaceAll(in, `" +`, "")
	out = strings.ReplaceAll(out, `"+`, "")
	out = strings.ReplaceAll(out, `+`, "")
	out = strings.ReplaceAll(out, `"`, "")
	return strings.Join(strings.Fields(out), " ")
}

func cfgColumnException(table, col string) bool {
	return cfgColumnExceptions[table][col]
}

func cfgModelTags(t *testing.T) map[string][]string {
	t.Helper()
	b, err := os.ReadFile("../../internal/config-mgmt-enhanced/models/models.go")
	if err != nil {
		t.Fatalf("models.go: %v", err)
	}
	tags := map[string][]string{}
	cur := ""
	for _, line := range strings.Split(string(b), "\n") {
		trim := strings.TrimSpace(line)
		if strings.HasPrefix(trim, "type ") && strings.HasSuffix(trim, "struct {") {
			cur = strings.TrimSpace(strings.TrimSuffix(
				strings.TrimPrefix(trim, "type "), "struct {"))
			continue
		}
		if cur == "" {
			continue
		}
		if trim == "}" {
			cur = ""
			continue
		}
		if m := reCfgDBTag.FindStringSubmatch(line); m != nil {
			tags[cur] = append(tags[cur], m[1])
		}
	}
	return tags
}

// cfgSchema returns, per table, the declared column set and the NOT NULL
// columns that carry no default. Everything comes from migration 590 alone.
func cfgSchema(t *testing.T) (map[string][]string, map[string][]string) {
	t.Helper()
	body := migrationBody(t, cfgMigration)
	declared := map[string][]string{}
	noDefault := map[string][]string{}
	for _, m := range reCfgCreate.FindAllStringSubmatch(body, -1) {
		table, block := m[1], m[2]
		for _, raw := range strings.Split(block, "\n") {
			line := strings.TrimSpace(raw)
			if line == "" || strings.HasPrefix(line, "--") {
				continue
			}
			cm := reCfgColDecl.FindStringSubmatch(line)
			if cm == nil {
				continue
			}
			declared[table] = append(declared[table], cm[1])
			if reCfgNotNull.MatchString(cm[3]) && !reCfgDefault.MatchString(cm[3]) {
				noDefault[table] = append(noDefault[table], cm[1])
			}
		}
	}
	return declared, noDefault
}

// cfgConstColumns reads the column list a const holds by concatenating the
// quoted fragments the declaration spans. The list is never restated here, so a
// truncated const is caught rather than copied.
func cfgConstColumns(t *testing.T, name string) []string {
	t.Helper()
	src := cfgReadRepo(t)
	header := regexp.MustCompile(`(?m)^\s*const\s+` + regexp.QuoteMeta(name) + `\s+=`)
	lines := strings.Split(src, "\n")
	start := -1
	for i, l := range lines {
		if header.MatchString(l) {
			start = i
			break
		}
	}
	if start < 0 {
		t.Fatalf("const %s not found in repository.go", name)
	}
	chunk := []string{lines[start]}
	for _, l := range lines[start+1:] {
		if strings.HasPrefix(l, "\t") {
			chunk = append(chunk, l)
			continue
		}
		break
	}
	var cols []string
	for _, frag := range reCfgQuote.FindAllStringSubmatch(strings.Join(chunk, "\n"), -1) {
		for _, c := range strings.Split(frag[1], ",") {
			c = strings.TrimSpace(c)
			if c != "" {
				cols = append(cols, c)
			}
		}
	}
	if len(cols) == 0 {
		t.Fatalf("const %s holds no columns", name)
	}
	return cols
}

func TestCfgMigrationsCreateEveryRelation(t *testing.T) {
	want := map[string]bool{}
	for _, src := range cfgSourceFiles(t) {
		for _, m := range reCfgRel.FindAllStringSubmatch(src, -1) {
			want[m[1]] = true
		}
	}
	if len(want) == 0 {
		t.Fatal("no config relation was found in the module source")
	}

	creators := map[string][]string{}
	for _, f := range entriesInMigrationsDir() {
		if strings.Contains(f.name, "_down") {
			continue
		}
		for _, m := range reCfgCreate.FindAllStringSubmatch(f.body, -1) {
			creators[m[1]] = append(creators[m[1]], f.name)
		}
	}
	for table := range want {
		switch n := len(creators[table]); {
		case n == 0:
			t.Errorf("relation %q is referenced by the module but no migration creates it", table)
		case n > 1:
			t.Errorf("relation %q is created by %d migrations: %v", table, n, creators[table])
		}
	}

	// 590 must own the whole set. A table it creates that the module never
	// touches is either misnamed or dead; a relation the module reads that 590
	// does not create is the exact break this migration closed.
	owned := map[string]bool{}
	for _, m := range reCfgCreate.FindAllStringSubmatch(migrationBody(t, cfgMigration), -1) {
		owned[m[1]] = true
	}
	if len(owned) != len(want) {
		t.Errorf("%s creates %d relations but the module references %d", cfgMigration, len(owned), len(want))
	}
	for table := range owned {
		if !want[table] {
			t.Errorf("%s creates %q but the module source never references it", cfgMigration, table)
		}
	}
}

func TestCfgLegacyMigration115DoesNotShadowTheRealTables(t *testing.T) {
	got := map[string]bool{}
	for _, m := range reCfgAnyCreate.FindAllStringSubmatch(migrationBody(t, cfgLegacyMigration), -1) {
		got[m[1]] = true
	}
	if len(got) != len(cfgLegacyTables) {
		t.Errorf("%s creates %d tables, the recorded legacy set holds %d: %v",
			cfgLegacyMigration, len(got), len(cfgLegacyTables), got)
	}
	for _, name := range cfgLegacyTables {
		if !got[name] {
			t.Errorf("%s no longer creates %q, so the shadow this module works around has moved",
				cfgLegacyMigration, name)
		}
	}

	referenced := map[string]bool{}
	for _, src := range cfgSourceFiles(t) {
		for _, m := range reCfgRel.FindAllStringSubmatch(src, -1) {
			referenced[m[1]] = true
		}
	}
	for table := range got {
		if referenced[table] {
			t.Errorf("%s creates %q, which the module source also queries: two CREATE TABLE statements now describe one relation",
				cfgLegacyMigration, table)
		}
	}
}

func TestCfgColumnConstsCoverEveryMigrationColumn(t *testing.T) {
	declared, _ := cfgSchema(t)
	src := cfgReadRepo(t)

	// An exception that names a column the migration does not declare would
	// silently excuse a missing SELECT, so it must be checked in turn.
	for table, cols := range cfgColumnExceptions {
		if _, ok := declared[table]; !ok {
			t.Errorf("exception set for %q names a table %s does not create", table, cfgMigration)
			continue
		}
		for c := range cols {
			if !containsStr(declared[table], c) {
				t.Errorf("exception %q for %s is not a declared column", c, table)
			}
		}
	}

	for constName, table := range cfgConstToTable {
		cols := cfgConstColumns(t, constName)
		have := map[string]bool{}
		for _, c := range cols {
			have[c] = true
		}
		decl := []string{}
		for _, c := range declared[table] {
			if !cfgColumnException(table, c) {
				decl = append(decl, c)
			}
		}
		if len(cols) != len(decl) {
			t.Errorf("%s lists %d columns but %s declares %d after %d documented omissions",
				constName, len(cols), table, len(decl), len(declared[table])-len(decl))
		}
		for _, c := range cols {
			if !containsStr(decl, c) {
				t.Errorf("%s selects %q but %s does not declare that column", constName, c, table)
			}
		}
		for _, c := range decl {
			if !have[c] {
				t.Errorf("%s declares column %q but %s never selects it, so the read would drop it",
					table, c, constName)
			}
		}

		// The const backs SELECTs only. Splicing it into an UPDATE or an
		// INSERT would quietly change which columns a write touches.
		refs := strings.Count(src, "+"+constName+"+")
		sels := strings.Count(src, `"SELECT "+`+constName+`+"`)
		if refs == 0 {
			t.Errorf("%s is defined but never interpolated into a statement", constName)
			continue
		}
		if sels != refs {
			t.Errorf("%s is interpolated %d times but only %d of them are SELECTs", constName, refs, sels)
		}
	}
}

func TestCfgMigrationMatchesModelTags(t *testing.T) {
	tags := cfgModelTags(t)
	declared, _ := cfgSchema(t)
	for structName, table := range cfgStructToTable {
		raw, ok := tags[structName]
		if !ok {
			t.Fatalf("struct %s has no db tags", structName)
		}
		have := map[string]bool{}
		for _, c := range raw {
			have[c] = true
		}
		decl := []string{}
		for _, c := range declared[table] {
			if !cfgColumnException(table, c) {
				decl = append(decl, c)
			}
		}
		if len(raw) != len(decl) {
			t.Errorf("%s declares %d db tags but %s has %d columns after the documented omissions",
				structName, len(raw), table, len(decl))
		}
		for _, c := range raw {
			if !containsStr(decl, c) {
				t.Errorf("%s has db tag %q but %s does not declare that column", structName, c, table)
			}
		}
		for _, c := range decl {
			if !have[c] {
				t.Errorf("%s declares column %q but %s has no db tag for it, so the scan would fail",
					table, c, structName)
			}
		}
	}
}

func TestCfgNotNullColumnsAreSuppliedByInserts(t *testing.T) {
	_, noDefault := cfgSchema(t)
	checked := map[string]bool{}
	for _, src := range cfgSourceFiles(t) {
		for _, m := range reCfgInsert.FindAllStringSubmatch(cfgJoinLiterals(src), -1) {
			table, colList := m[1], m[2]
			checked[table] = true
			supplied := map[string]bool{}
			for _, c := range strings.Split(colList, ",") {
				supplied[strings.TrimSpace(c)] = true
			}
			for _, col := range noDefault[table] {
				if !supplied[col] {
					t.Errorf("%s.%s is NOT NULL with no default but the %s INSERT omits it, so the insert fails",
						table, col, table)
				}
			}
		}
	}
	for _, table := range cfgStructToTable {
		if !checked[table] {
			t.Errorf("no INSERT INTO %s was found in the module source", table)
		}
	}
}

func TestCfgInsertColumnListMatchesTheSelectConst(t *testing.T) {
	for constName, table := range cfgConstToTable {
		constCols := cfgConstColumns(t, constName)
		found := false
		for _, src := range cfgSourceFiles(t) {
			for _, m := range reCfgInsert.FindAllStringSubmatch(cfgJoinLiterals(src), -1) {
				if m[1] != table {
					continue
				}
				found = true
				var ins []string
				for _, c := range strings.Split(m[2], ",") {
					ins = append(ins, strings.TrimSpace(c))
				}
				if len(ins) != len(constCols) {
					t.Errorf("the %s INSERT names %d columns but %s reads %d", table, len(ins), constName, len(constCols))
					continue
				}
				for i := range ins {
					if ins[i] != constCols[i] {
						t.Errorf("the %s INSERT writes %q at position %d but %s reads %q there, so the argument order and the scan disagree",
							table, ins[i], i+1, constName, constCols[i])
					}
				}
			}
		}
		if !found {
			t.Errorf("no INSERT INTO %s was found to compare against %s", table, constName)
		}
	}
}

func TestCfgInsertPlaceholdersAreContiguousAndComplete(t *testing.T) {
	declared, _ := cfgSchema(t)
	for _, src := range cfgSourceFiles(t) {
		for _, m := range reCfgInsert.FindAllStringSubmatch(cfgJoinLiterals(src), -1) {
			table, colList, valList := m[1], m[2], m[3]
			nCols := len(strings.Split(colList, ","))
			seen := map[int]bool{}
			for _, p := range reCfgPlaceholder.FindAllStringSubmatch(valList, -1) {
				n, err := strconv.Atoi(p[1])
				if err != nil || n < 1 {
					t.Fatalf("%s INSERT has a bad placeholder %q", table, p[1])
				}
				seen[n] = true
			}
			if len(seen) != nCols {
				t.Errorf("%s INSERT names %d columns but only %d distinct placeholders", table, nCols, len(seen))
			}
			for i := 1; i <= len(seen); i++ {
				if !seen[i] {
					t.Errorf("%s INSERT is missing placeholder $%d", table, i)
				}
			}
			if _, ok := declared[table]; !ok {
				t.Errorf("%s INSERT has no CREATE TABLE in %s", table, cfgMigration)
			}
		}
	}
}

func TestCfgRepositoryUsesPostgresPlaceholdersOnly(t *testing.T) {
	for _, src := range cfgSourceFiles(t) {
		for i, line := range strings.Split(src, "\n") {
			trim := strings.TrimSpace(line)
			if strings.HasPrefix(trim, "//") {
				continue
			}
			if reCfgQuestion.MatchString(line) {
				t.Errorf("line %d uses a MySQL style placeholder: %s", i+1, trim)
			}
			if reCfgSelectStar.MatchString(line) {
				t.Errorf("line %d uses a wildcard select: %s", i+1, trim)
			}
		}
	}
}

func TestCfgEveryStatementIsTenantScoped(t *testing.T) {
	// Every statement must carry a tenant_id predicate or column. The module's
	// repository used to build SELECTs from a caller map with no tenant filter,
	// which is how one tenant can read another tenant's change requests.
	found := map[string]bool{}
	for _, src := range cfgSourceFiles(t) {
		for i, line := range strings.Split(src, "\n") {
			trim := strings.TrimSpace(line)
			if strings.HasPrefix(trim, "//") {
				continue
			}
			for _, m := range reCfgRel.FindAllStringSubmatch(line, -1) {
				table := m[1]
				found[table] = true
				if !strings.Contains(line, "tenant_id") {
					t.Errorf("line %d queries %s without a tenant_id predicate: %s", i+1, table, trim)
				}
			}
		}
	}
	for _, table := range cfgStructToTable {
		if !found[table] {
			t.Errorf("no statement against %s was found in the module source", table)
		}
	}
}

func TestCfgUpdateWhitelistsAreDeclaredColumns(t *testing.T) {
	declared, _ := cfgSchema(t)
	src := cfgReadRepo(t)

	found := map[string][]string{}
	for _, m := range reCfgWhitelist.FindAllStringSubmatch(src, -1) {
		keys := []string{}
		for _, q := range reCfgQuote.FindAllStringSubmatch(m[2], -1) {
			keys = append(keys, q[1])
		}
		found[m[1]] = keys
	}
	if len(found) != len(cfgWhitelistToTable) {
		t.Fatalf("repository.go declares %d update whitelists, %d are cross-checked: %v",
			len(found), len(cfgWhitelistToTable), found)
	}
	for name, table := range cfgWhitelistToTable {
		keys, ok := found[name]
		if !ok {
			t.Errorf("%s is not declared in repository.go", name)
			continue
		}
		refs := strings.Count(src, "updateSet("+name)
		if refs != 1 {
			t.Errorf("%s is passed to updateSet %d times, want exactly 1", name, refs)
		}
		allowed := map[string]bool{}
		for _, k := range keys {
			allowed[k] = true
		}
		if allowed["id"] || allowed["tenant_id"] || allowed["created_at"] {
			t.Errorf("%s whitelists an identity column, so a caller could rewrite a row's identity or move it between tenants", name)
		}
		for _, k := range keys {
			if !containsStr(declared[table], k) {
				t.Errorf("%s whitelists %q but %s does not declare that column, so the UPDATE would fail at the database",
					name, k, table)
			}
		}
	}
}

func TestCfgDownDropsEveryForwardObject(t *testing.T) {
	fwd := migrationBody(t, cfgMigration)
	down := migrationBody(t, cfgDownMigration)

	idx := map[string]bool{}
	for _, m := range reCfgCreateIndex.FindAllStringSubmatch(fwd, -1) {
		idx[m[1]] = true
	}
	dropped := map[string]bool{}
	for _, m := range reCfgDropIndex.FindAllStringSubmatch(down, -1) {
		dropped[m[1]] = true
	}
	if len(idx) != len(dropped) {
		t.Errorf("forward creates %d indexes, down drops %d", len(idx), len(dropped))
	}
	for name := range idx {
		if !dropped[name] {
			t.Errorf("index %s is created by %s but never dropped", name, cfgMigration)
		}
	}
	for name := range dropped {
		if !idx[name] {
			t.Errorf("index %s is dropped by %s but never created", name, cfgDownMigration)
		}
	}

	tabs := map[string]bool{}
	for _, m := range reCfgCreate.FindAllStringSubmatch(fwd, -1) {
		tabs[m[1]] = true
	}
	droppedTabs := map[string]bool{}
	for _, m := range reCfgDropTable.FindAllStringSubmatch(down, -1) {
		droppedTabs[m[1]] = true
	}
	if len(tabs) != len(droppedTabs) {
		t.Errorf("forward creates %d tables, down drops %d", len(tabs), len(droppedTabs))
	}
	for tab := range tabs {
		if !droppedTabs[tab] {
			t.Errorf("table %s is created by %s but never dropped", tab, cfgMigration)
		}
	}
	for tab := range droppedTabs {
		if !tabs[tab] {
			t.Errorf("table %s is dropped by %s but never created", tab, cfgDownMigration)
		}
	}

	// The down file must drop tables in the reverse order of creation so a
	// rollback cannot leave a table whose indexes are already gone.
	order := []string{}
	for _, m := range reCfgDropTable.FindAllStringSubmatch(down, -1) {
		order = append(order, m[1])
	}
	created := []string{}
	for _, m := range reCfgCreate.FindAllStringSubmatch(fwd, -1) {
		created = append(created, m[1])
	}
	if strings.Join(order, ",") != strings.Join(reverseDr(created), ",") {
		t.Errorf("down drops %v but forward creates %v", order, created)
	}
}

func TestCfgEveryTableGetsATenantIndex(t *testing.T) {
	declared, _ := cfgSchema(t)
	body := migrationBody(t, cfgMigration)
	created := map[string]bool{}
	for _, m := range reCfgCreate.FindAllStringSubmatch(body, -1) {
		created[m[1]] = true
	}
	tenantIndexed := map[string]bool{}
	for _, m := range reCfgCreateIndex.FindAllStringSubmatch(body, -1) {
		name, table, cols := m[1], m[2], strings.TrimSpace(m[3])
		if !created[table] {
			t.Errorf("index %s targets %s, which %s does not create", name, table, cfgMigration)
			continue
		}
		col := strings.TrimSpace(strings.Split(cols, ",")[0])
		col = strings.TrimSpace(strings.SplitN(col, " ", 2)[0])
		if !containsStr(declared[table], col) {
			t.Errorf("index %s sorts on %s.%s, which %s does not declare", name, table, col, cfgMigration)
		}
		if col == "tenant_id" {
			tenantIndexed[table] = true
		}
	}
	for table := range created {
		if !tenantIndexed[table] {
			t.Errorf("table %s has no tenant_id index, so a cross-tenant scan has to read every row", table)
		}
	}
}
