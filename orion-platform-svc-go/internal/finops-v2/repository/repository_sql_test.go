package repository

import (
	"context"
	"fmt"
	"os"
	"path/filepath"
	"regexp"
	"sort"
	"strings"
	"testing"
	"time"

	"orion/platform-svc-go/internal/finops-v2/models"

	"github.com/DATA-DOG/go-sqlmock"
	"github.com/jmoiron/sqlx"
)

// norm collapses whitespace, case, parens and commas so an expectation matches
// the generated SQL exactly. go-sqlmock's default QueryMatcherRegexp treats $
// in the expected text as an end-of-string anchor, which would make any
// expectation containing $1 match nothing and let a test pass vacuously.
func norm(s string) string {
	for _, r := range []string{"\n", "\r", "\t", " ", "(", ")", ","} {
		s = strings.ReplaceAll(s, r, " ")
	}
	return strings.ToLower(strings.Join(strings.Fields(s), " "))
}

func newMock(t *testing.T) (*Repository, sqlmock.Sqlmock) {
	t.Helper()
	raw, mock, err := sqlmock.New(sqlmock.QueryMatcherOption(sqlmock.QueryMatcherFunc(func(expected, actual string) error {
		if norm(expected) == norm(actual) {
			return nil
		}
		return fmt.Errorf("sql mismatch:\n  expected: %s\n     actual: %s", norm(expected), norm(actual))
	})))
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { _ = raw.Close() })
	return NewRepository(sqlx.NewDb(raw, "postgres")), mock
}

// --- schema drift: every table the repository touches must exist in migration 583 ---

const schemaMigration = "583_create_finops_v2_tables.sql"

func readSrc(t testing.TB, parts ...string) string {
	t.Helper()
	b, err := os.ReadFile(filepath.Join(parts...))
	if err != nil {
		t.Fatalf("read %v: %v", parts, err)
	}
	return string(b)
}

var migrationTableRe = regexp.MustCompile(`(?i)CREATE\s+TABLE\s+IF\s+NOT\s+EXISTS\s+(\w+)`)

func migrationTables(t testing.TB) map[string]bool {
	src := readSrc(t, "..", "..", "..", "migrations", schemaMigration)
	tables := map[string]bool{}
	for _, m := range migrationTableRe.FindAllStringSubmatch(src, -1) {
		tables[m[1]] = true
	}
	return tables
}

func TestMigrationCreatesEveryTableTheRepositoryReferences(t *testing.T) {
	tables := migrationTables(t)
	if len(tables) == 0 {
		t.Fatal("no CREATE TABLE statements found in " + schemaMigration)
	}
	referenced := map[string]bool{}
	for _, m := range regexp.MustCompile(`finops_v2_\w+`).FindAllString(readSrc(t, "repository.go"), -1) {
		referenced[m] = true
	}
	if len(referenced) != 8 {
		t.Fatalf("repository references %d finops_v2 tables, want 8: %v", len(referenced), keys(referenced))
	}
	for table := range referenced {
		if !tables[table] {
			t.Errorf("repository references %s but %s never creates it (pq: relation does not exist)", table, schemaMigration)
		}
	}
	// The old un-namespaced names must stay gone: they collide with internal/finops
	// (v1), which owns `finops_budgets` with an incompatible column set.
	for _, stale := range []string{"finops_costs", "finops_budgets", "finops_chargebacks",
		"finops_recommendations", "finops_reports", "finops_roi",
		"finops_collection_schedules", "finops_alert_triggers"} {
		if strings.Contains(readSrc(t, "repository.go"), stale) {
			t.Errorf("repository.go still references the un-namespaced table %s", stale)
		}
	}
}

// --- class C at the schema level: a trigger must not be able to name a budget in another tenant ---

func TestAlertTriggersReferenceTheBudgetInTheSameTenant(t *testing.T) {
	migration := readSrc(t, "..", "..", "..", "migrations", schemaMigration)

	block := tableBody(migration, "finops_v2_alert_triggers")
	if block == "" {
		t.Fatal("finops_v2_alert_triggers is not defined in " + schemaMigration)
	}
	m := regexp.MustCompile(`(?is)FOREIGN\s+KEY\s*\(([^)]+)\)\s*REFERENCES\s+(finops_v2_budgets)\s*\(([^)]+)\)`).
		FindStringSubmatch(block)
	if m == nil {
		t.Fatal("finops_v2_alert_triggers has no FK to finops_v2_budgets: a caller could record a " +
			"trigger against another tenant's budget id, and the orphan row would be hidden forever by " +
			"the JOIN filter in GetAlertTriggers")
	}
	keys := map[string]bool{}
	for _, k := range sqlColumns(m[1]) {
		keys[k] = true
	}
	if !keys["tenant_id"] || !keys["budget_id"] {
		t.Errorf("FK must cover both tenant_id and budget_id, got %v: a bare budget_id FK still "+
			"permits a cross-tenant reference", keys)
	}
	// PostgreSQL refuses a composite FK whose referenced columns are not a unique
	// constraint, so the constraint it depends on has to be present too.
	refs := map[string]bool{}
	for _, k := range sqlColumns(m[3]) {
		refs[k] = true
	}
	budgets := tableBody(migration, "finops_v2_budgets")
	for col := range refs {
		if !regexp.MustCompile(`(?i)UNIQUE\s*\([^)]*\b` + col + `\b`).MatchString(budgets) {
			t.Errorf("finops_v2_budgets has no UNIQUE constraint covering %q, so PostgreSQL "+
				"would refuse the composite FK outright", col)
		}
	}
}

// sqlColumns splits a FK column list such as "tenant_id, budget_id".
func sqlColumns(s string) []string {
	for _, r := range []string{",", "(", ")"} {
		s = strings.ReplaceAll(s, r, " ")
	}
	return strings.Fields(s)
}

func tableBody(migration, table string) string {
	m := regexp.MustCompile(`(?is)CREATE\s+TABLE\s+IF\s+NOT\s+EXISTS\s+` + table + `\s*\((.*?)\);`).FindStringSubmatch(migration)
	if m == nil {
		return ""
	}
	return m[1]
}

// --- class A: a SELECT * only survives if every table column maps to a struct field ---

var selectStarRe = regexp.MustCompile(`SELECT\s*\*\s+FROM\s+(finops_v2_\w+)`)
var funcRe = regexp.MustCompile(`func\s+\(r\s+\*Repository\)\s+(\w+)\s*\(`)
var destRe = regexp.MustCompile(`var\s+\w+\s+.*models\.(\w+)`)

func TestEverySelectStarModelCoversEveryTableColumn(t *testing.T) {
	src := readSrc(t, "repository.go")
	modelSrc := readSrc(t, "..", "models", "models.go")
	migration := readSrc(t, "..", "..", "..", "migrations", schemaMigration)

	models := map[string]map[string]bool{}
	for _, typ := range regexp.MustCompile(`(?m)^type (\w+) struct`).FindAllStringSubmatch(modelSrc, -1) {
		models[typ[1]] = structColumns(modelSrc, typ[1])
	}

	starts := selectStarRe.FindAllStringIndex(src, -1)
	if len(starts) == 0 {
		t.Fatal("no SELECT * statements found; test is vacuous")
	}
	for _, at := range starts {
		table := src[at[0]:at[1]]
		table = table[strings.LastIndex(table, "finops_v2_"):]
		fnEnd := 0
		for _, m := range funcRe.FindAllStringIndex(src[:at[0]], -1) {
			fnEnd = m[1]
		}
		body := src[fnEnd:at[0]]
		dm := destRe.FindStringSubmatch(body)
		if dm == nil {
			t.Fatalf("SELECT * from %s: could not find the destination model", table)
		}
		dst := dm[1]
		cols := structColumns(modelSrc, dst)
		for col := range tableColumns(migration, table) {
			if !cols[col] {
				t.Errorf("SELECT * from %s into models.%s: table column %q has no db field, "+
					"sqlx safe mode returns 'missing destination name' (use explicit columns)", table, dst, col)
			}
		}
	}
}

func structColumns(modelSrc, typ string) map[string]bool {
	m := regexp.MustCompile(`(?ms)^type ` + typ + ` struct \{(.*?)^\}`).FindStringSubmatch(modelSrc)
	if m == nil {
		return nil
	}
	cols := map[string]bool{}
	for _, line := range strings.Split(m[1], "\n") {
		line = strings.TrimSpace(line)
		i := strings.Index(line, "`")
		if i < 0 {
			continue
		}
		if f := regexp.MustCompile(`db:"([^"]+)"`).FindStringSubmatch(line); f != nil {
			cols[f[1]] = true
			continue
		}
		// sqlx v1.4.0 defaults NameMapper to strings.ToLower, so an untagged
		// field only ever matches the lower-cased field name.
		cols[strings.ToLower(strings.Fields(line[0:i])[0])] = true
	}
	return cols
}

func tableColumns(migration, table string) map[string]bool {
	m := regexp.MustCompile(`(?is)CREATE\s+TABLE\s+IF\s+NOT\s+EXISTS\s+` + table + `\s*\((.*?)\);`).FindStringSubmatch(migration)
	if m == nil {
		return nil
	}
	cols := map[string]bool{}
	for _, line := range strings.Split(m[1], "\n") {
		// "--" comments document the column; the whole line is a comment, so
		// skipping it on the marker alone would leave the comment text behind and
		// parse the first word as a column literally named "Carries".
		line = strings.TrimSpace(line)
		if strings.HasPrefix(line, "--") {
			continue
		}
		tok := strings.Fields(line)
		if len(tok) == 0 {
			continue
		}
		if sqlRe(tok[0]) {
			continue
		}
		cols[tok[0]] = true
	}
	return cols
}

func sqlRe(tok string) bool {
	up := strings.ToUpper(tok)
	for _, kw := range []string{"PRIMARY", "FOREIGN", "UNIQUE", "CHECK", "CONSTRAINT", "INDEX"} {
		if strings.HasPrefix(up, kw) {
			return true
		}
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

// --- TrackCost persists every field, including Details ---

func TestTrackCostPersistsEveryFieldIncludingDetails(t *testing.T) {
	r, mock := newMock(t)

	mock.ExpectQuery(`INSERT INTO finops_v2_costs (tenant_id, entity_id, entity_type, cost, currency, category, provider, period_start, period_end, details) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING id`).
		WithArgs("tenant-1", "proj-1", "project", 12.5, "USD", "compute", "aws", "2026-09-01", "2026-09-30", "k8s node auto-scaling").
		WillReturnRows(sqlmock.NewRows([]string{"id"}).AddRow(42))

	id, err := r.TrackCost(context.Background(), &models.CostEntry{
		TenantID: "tenant-1", EntityID: "proj-1", EntityType: "project",
		Cost: 12.5, Currency: "USD", Category: "compute", Provider: "aws",
		Details: "k8s node auto-scaling", PeriodStart: "2026-09-01", PeriodEnd: "2026-09-30",
	})
	if err != nil {
		t.Fatalf("TrackCost: %v", err)
	}
	if id != 42 {
		t.Fatalf("id=%d, want 42", id)
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Errorf("unmet expectations: %v", err)
	}
}

// --- class U: one placeholder per SET clause, values in the same order ---

func TestUpdateBudgetBindsOnePlaceholderPerSetEntry(t *testing.T) {
	r, mock := newMock(t)

	mock.ExpectExec(`UPDATE finops_v2_budgets SET name=$1, updated_at=$2 WHERE id=$3 AND tenant_id=$4`).
		WithArgs("new name", sqlmock.AnyArg(), "7", "tenant-1").
		WillReturnResult(sqlmock.NewResult(0, 1))

	if err := r.UpdateBudget(context.Background(), "tenant-1", "7", map[string]interface{}{"name": "new name"}); err != nil {
		t.Fatalf("UpdateBudget: %v", err)
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Errorf("unmet expectations: %v", err)
	}
}

// --- class C: alert triggers are tenant scoped on both sides of the join ---

func TestGetAlertTriggersIsTenantScoped(t *testing.T) {
	r, mock := newMock(t)

	now := time.Now().UTC()
	mock.ExpectQuery(`SELECT a.budget_id, b.name, a.threshold, a.triggered_at
		FROM finops_v2_alert_triggers a
		JOIN finops_v2_budgets b ON b.id = a.budget_id AND b.tenant_id = a.tenant_id
		WHERE a.tenant_id=$1
		ORDER BY a.triggered_at DESC`).
		WithArgs("tenant-1").
		WillReturnRows(sqlmock.NewRows([]string{"budget_id", "name", "threshold", "triggered_at"}).
			AddRow(3, "infra budget", 85.0, now))

	got, err := r.GetAlertTriggers(context.Background(), "tenant-1")
	if err != nil {
		t.Fatalf("GetAlertTriggers: %v", err)
	}
	if len(got) != 1 || got[0].BudgetID != 3 || got[0].Name != "infra budget" || got[0].Threshold != 85.0 {
		t.Fatalf("unexpected triggers: %+v", got)
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Errorf("unmet expectations: %v", err)
	}
}

// --- class U: the provider filter must reuse the index computed after the append ---

func TestCollectCostBindsTheProviderFilter(t *testing.T) {
	r, mock := newMock(t)

	mock.ExpectQuery(`SELECT COUNT(*) FROM finops_v2_costs WHERE tenant_id=$1 AND created_at >= $2 AND created_at <= $3 AND provider=$4`).
		WithArgs("tenant-1", sqlmock.AnyArg(), sqlmock.AnyArg(), "aws").
		WillReturnRows(sqlmock.NewRows([]string{"count"}).AddRow(7))
	mock.ExpectQuery(`SELECT COALESCE(SUM(cost), 0) FROM finops_v2_costs WHERE tenant_id=$1 AND created_at >= $2 AND created_at <= $3 AND provider=$4`).
		WithArgs("tenant-1", sqlmock.AnyArg(), sqlmock.AnyArg(), "aws").
		WillReturnRows(sqlmock.NewRows([]string{"sum"}).AddRow(900.25))

	resp, err := r.CollectCost(context.Background(), "tenant-1", "aws", 30)
	if err != nil {
		t.Fatalf("CollectCost: %v", err)
	}
	if resp.Collected != 7 || resp.TotalCost != 900.25 || resp.Provider != "aws" {
		t.Fatalf("unexpected response: %+v", resp)
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Errorf("unmet expectations: %v", err)
	}
}

// --- class A: GetSchedule must not SELECT * off a table with an unmapped id ---

func TestGetScheduleSelectsOnlyMappedColumns(t *testing.T) {
	r, mock := newMock(t)

	now := time.Now().UTC()
	mock.ExpectQuery(`SELECT provider, cron_expression, enabled, last_run FROM finops_v2_collection_schedules WHERE provider=$1`).
		WithArgs("azure").
		WillReturnRows(sqlmock.NewRows([]string{"provider", "cron_expression", "enabled", "last_run"}).
			AddRow("azure", "0 3 * * *", false, now))

	got, err := r.GetSchedule(context.Background(), "azure")
	if err != nil {
		t.Fatalf("GetSchedule: %v", err)
	}
	if got.Provider != "azure" || got.CronExpression != "0 3 * * *" || got.Enabled || got.LastRun == nil || *got.LastRun != now {
		t.Fatalf("unexpected schedule: %+v", got)
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Errorf("unmet expectations: %v", err)
	}
}

// --- HealthCheck returns what the database answered ---

func TestHealthCheckReturnsWhatItRead(t *testing.T) {
	for _, tc := range []struct {
		row bool
		ok  bool
	}{
		{true, true},
		{false, false},
	} {
		r, mock := newMock(t)
		mock.ExpectQuery(`SELECT EXISTS(SELECT 1 FROM finops_v2_costs)`).
			WillReturnRows(sqlmock.NewRows([]string{"exists"}).AddRow(tc.row))

		ok, err := r.HealthCheck(context.Background())
		if err != nil {
			t.Fatalf("HealthCheck: %v", err)
		}
		if ok != tc.ok {
			t.Fatalf("HealthCheck row=%v returned ok=%v", tc.row, ok)
		}
		if err := mock.ExpectationsWereMet(); err != nil {
			t.Errorf("unmet expectations: %v", err)
		}
	}
}

// --- CheckBudgetAlerts: used_cost is real, and the entity filter is optional ---

func TestCheckBudgetAlertsBindsTheEntityFilter(t *testing.T) {
	r, mock := newMock(t)

	mock.ExpectQuery(`SELECT b.id AS budget_id, b.name, b.alert_threshold AS threshold, 'warning' AS severity,
		COALESCE((SELECT SUM(c.cost) FROM finops_v2_costs c
		 WHERE c.tenant_id=b.tenant_id AND c.entity_id=b.entity_id AND c.entity_type=b.entity_type), 0) AS used_cost
		FROM finops_v2_budgets b
		WHERE b.tenant_id=$1 AND b.status=$2 AND b.entity_id=$3 AND b.entity_type=$4
		ORDER BY b.created_at DESC`).
		WithArgs("tenant-1", "active", "proj-1", "project").
		WillReturnRows(sqlmock.NewRows([]string{"budget_id", "name", "threshold", "severity", "used_cost"}).
			AddRow(3, "infra budget", 85.0, "warning", 74.5))

	got, err := r.CheckBudgetAlerts(context.Background(), "tenant-1", "proj-1", "project")
	if err != nil {
		t.Fatalf("CheckBudgetAlerts: %v", err)
	}
	if len(got) != 1 || got[0].BudgetID != 3 || got[0].UsedCost != 74.5 || got[0].Threshold != 85.0 || got[0].Severity != "warning" {
		t.Fatalf("unexpected alerts: %+v", got)
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Errorf("unmet expectations: %v", err)
	}
}

func TestCheckBudgetAlertsSkipsEmptyEntityFilter(t *testing.T) {
	r, mock := newMock(t)

	mock.ExpectQuery(`SELECT b.id AS budget_id, b.name, b.alert_threshold AS threshold, 'warning' AS severity,
		COALESCE((SELECT SUM(c.cost) FROM finops_v2_costs c
		 WHERE c.tenant_id=b.tenant_id AND c.entity_id=b.entity_id AND c.entity_type=b.entity_type), 0) AS used_cost
		FROM finops_v2_budgets b
		WHERE b.tenant_id=$1 AND b.status=$2
		ORDER BY b.created_at DESC`).
		WithArgs("tenant-1", "active").
		WillReturnRows(sqlmock.NewRows([]string{"budget_id", "name", "threshold", "severity", "used_cost"}))

	if _, err := r.CheckBudgetAlerts(context.Background(), "tenant-1", "", ""); err != nil {
		t.Fatalf("CheckBudgetAlerts: %v", err)
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Errorf("unmet expectations: %v", err)
	}
}

// --- EstimateSavings: categories and confidence come from the table ---

func TestEstimateSavingsReadsCategoriesAndConfidence(t *testing.T) {
	r, mock := newMock(t)

	mock.ExpectQuery(`SELECT COALESCE(SUM(estimated_savings),0) FROM finops_v2_recommendations WHERE tenant_id=$1 AND status=$2`).
		WithArgs("tenant-1", "open").
		WillReturnRows(sqlmock.NewRows([]string{"sum"}).AddRow(210.0))
	mock.ExpectQuery(`SELECT type AS key, COALESCE(SUM(estimated_savings),0) AS cost FROM finops_v2_recommendations
		WHERE tenant_id=$1 AND status=$2 GROUP BY type ORDER BY cost DESC`).
		WithArgs("tenant-1", "open").
		WillReturnRows(sqlmock.NewRows([]string{"key", "cost"}).AddRow("right-sizing", 150.0).AddRow("unused", 60.0))
	mock.ExpectQuery(`SELECT COALESCE(AVG(confidence),0) FROM finops_v2_recommendations
		WHERE tenant_id=$1 AND status=$2 AND confidence IS NOT NULL`).
		WithArgs("tenant-1", "open").
		WillReturnRows(sqlmock.NewRows([]string{"avg"}).AddRow(82.5))

	got, err := r.EstimateSavings(context.Background(), "tenant-1")
	if err != nil {
		t.Fatalf("EstimateSavings: %v", err)
	}
	if got.TotalPotentialSavings != 210.0 || got.Confidence != 82.5 {
		t.Fatalf("unexpected totals: %+v", got)
	}
	if len(got.OptimizationCategories) != 2 ||
		got.OptimizationCategories["right-sizing"] != 150.0 ||
		got.OptimizationCategories["unused"] != 60.0 {
		t.Fatalf("categories must come from the table, got: %+v", got.OptimizationCategories)
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Errorf("unmet expectations: %v", err)
	}
}

// --- ForecastBudget: the projection is spent + trailing-window run rate ---

func budgetRow() *sqlmock.Rows {
	now := time.Now().UTC()
	return sqlmock.NewRows([]string{
		"id", "tenant_id", "name", "entity_id", "entity_type", "amount", "period",
		"currency", "category", "alert_threshold", "status", "created_at", "updated_at",
	}).AddRow(3, "tenant-1", "infra budget", "proj-1", "project", 1000.0, "monthly",
		"USD", "compute", 85.0, "active", now, now)
}

func TestForecastBudgetUsesTheTrailingWindow(t *testing.T) {
	r, mock := newMock(t)

	mock.ExpectQuery(`SELECT * FROM finops_v2_budgets WHERE id=$1 AND tenant_id=$2`).
		WithArgs("3", "tenant-1").WillReturnRows(budgetRow())
	mock.ExpectQuery(`SELECT COALESCE(SUM(cost),0) FROM finops_v2_costs WHERE tenant_id=$1 AND entity_id=$2 AND entity_type=$3`).
		WithArgs("tenant-1", "proj-1", "project").
		WillReturnRows(sqlmock.NewRows([]string{"sum"}).AddRow(1000.0))
	mock.ExpectQuery(`SELECT COALESCE(SUM(cost),0) FROM finops_v2_costs
		WHERE tenant_id=$1 AND entity_id=$2 AND entity_type=$3 AND created_at >= $4`).
		WithArgs("tenant-1", "proj-1", "project", sqlmock.AnyArg()).
		WillReturnRows(sqlmock.NewRows([]string{"sum"}).AddRow(250.0))

	got, err := r.ForecastBudget(context.Background(), "tenant-1", "3")
	if err != nil {
		t.Fatalf("ForecastBudget: %v", err)
	}
	if got.ProjectedTotalCost != 1250.0 {
		t.Fatalf("ProjectedTotalCost=%v, want usedCost(1000)+recentCost(250)=1250", got.ProjectedTotalCost)
	}
	if got.RemainingDays != forecastHorizonDays {
		t.Fatalf("RemainingDays=%d, want %d", got.RemainingDays, forecastHorizonDays)
	}
	if got.OverrunLikelihood != 25.0 {
		t.Fatalf("OverrunLikelihood=%v, want 25.0", got.OverrunLikelihood)
	}
	if got.Recommendation != "reduce spend or raise the budget" {
		t.Fatalf("Recommendation=%q", got.Recommendation)
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Errorf("unmet expectations: %v", err)
	}
}

// --- GetCostSummary: the forecast is a trailing-window query, not a multiplier ---

func TestGetCostSummaryForecastsFromTheTrailingWindow(t *testing.T) {
	r, mock := newMock(t)

	mock.ExpectQuery(`SELECT COALESCE(SUM(cost), 0) FROM finops_v2_costs WHERE tenant_id=$1`).
		WithArgs("tenant-1").WillReturnRows(sqlmock.NewRows([]string{"sum"}).AddRow(5000.0))
	mock.ExpectQuery(`SELECT category AS key, SUM(cost) AS cost FROM finops_v2_costs WHERE tenant_id=$1 GROUP BY category ORDER BY cost DESC`).
		WithArgs("tenant-1").WillReturnRows(sqlmock.NewRows([]string{"key", "cost"}).AddRow("compute", 3000.0))
	mock.ExpectQuery(`SELECT provider AS key, SUM(cost) AS cost FROM finops_v2_costs WHERE tenant_id=$1 GROUP BY provider ORDER BY cost DESC`).
		WithArgs("tenant-1").WillReturnRows(sqlmock.NewRows([]string{"key", "cost"}).AddRow("aws", 3000.0))
	mock.ExpectQuery(`SELECT COALESCE(SUM(cost),0) FROM finops_v2_costs
		WHERE tenant_id=$1 AND created_at >= $2`).
		WithArgs("tenant-1", sqlmock.AnyArg()).
		WillReturnRows(sqlmock.NewRows([]string{"sum"}).AddRow(400.0))

	got, err := r.GetCostSummary(context.Background(), "tenant-1")
	if err != nil {
		t.Fatalf("GetCostSummary: %v", err)
	}
	if got.TotalCost != 5000.0 {
		t.Fatalf("TotalCost=%v", got.TotalCost)
	}
	if got.ForecastCost != 400.0 {
		t.Fatalf("ForecastCost=%v, want the trailing-window sum (400), not a multiple of TotalCost", got.ForecastCost)
	}
	if len(got.CostByCategory) != 1 || got.CostByCategory[0].Key != "compute" {
		t.Fatalf("unexpected categories: %+v", got.CostByCategory)
	}
	if len(got.CostByProvider) != 1 || got.CostByProvider[0].Key != "aws" {
		t.Fatalf("unexpected providers: %+v", got.CostByProvider)
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Errorf("unmet expectations: %v", err)
	}
}

// --- ROI summary: the ratio is computed from the two aggregates ---

func TestGetROISummaryComputesTheRatio(t *testing.T) {
	r, mock := newMock(t)

	mock.ExpectQuery(`SELECT COALESCE(SUM(total_spend),0) FROM finops_v2_roi WHERE tenant_id=$1`).
		WithArgs("tenant-1").WillReturnRows(sqlmock.NewRows([]string{"sum"}).AddRow(200.0))
	mock.ExpectQuery(`SELECT COALESCE(SUM(total_savings),0) FROM finops_v2_roi WHERE tenant_id=$1`).
		WithArgs("tenant-1").WillReturnRows(sqlmock.NewRows([]string{"sum"}).AddRow(50.0))
	mock.ExpectQuery(`SELECT COALESCE(SUM(implemented_actions),0) FROM finops_v2_roi WHERE tenant_id=$1`).
		WithArgs("tenant-1").WillReturnRows(sqlmock.NewRows([]string{"sum"}).AddRow(12))

	got, err := r.GetROISummary(context.Background(), "tenant-1")
	if err != nil {
		t.Fatalf("GetROISummary: %v", err)
	}
	if got.CurrentROI != 25.0 {
		t.Fatalf("CurrentROI=%v, want (50/200)*100 = 25", got.CurrentROI)
	}
	if got.TotalSpend != 200.0 || got.TotalSavings != 50.0 || got.ImplementedActions != 12 {
		t.Fatalf("unexpected summary: %+v", got)
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Errorf("unmet expectations: %v", err)
	}
}
