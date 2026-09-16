package repository

import (
	"context"
	"database/sql/driver"
	"strings"
	"testing"
	"time"

	"orion/go-common/pkg/sentinel"

	sqlmock "github.com/DATA-DOG/go-sqlmock"
	"github.com/jmoiron/sqlx"

	"orion/platform-svc-go/internal/observability/models"
)

func newMockRepo(t *testing.T) (*Repository, sqlmock.Sqlmock) {
	t.Helper()
	db, mock, err := sqlmock.New(sqlmock.QueryMatcherOption(sqlmock.QueryMatcherRegexp))
	if err != nil {
		t.Fatalf("sqlmock.New: %v", err)
	}
	t.Cleanup(func() { _ = db.Close() })
	mock.MatchExpectationsInOrder(false)
	return NewRepository(sqlx.NewDb(db, "postgres")), mock
}

var metricCols = []string{"tenant_id", "name", "value", "tags", "timestamp"}

var ruleCols = []string{"id", "tenant_id", "metric", "operator", "threshold", "severity", "enabled"}

// TestCreateAlertRuleBindsTenantByIdAndDbTag pins the value bound to each
// placeholder. The statement used to bind :tenantId, the json tag, which matched
// no db tag and no Go field, so POST /observability/alerts failed every request
// with "could not find name tenantId". The tenantID parameter was also never
// read, so the tenant would have been written as "" even had the binding worked.
func TestCreateAlertRuleBindsTenantByIdAndDbTag(t *testing.T) {
	repo, mock := newMockRepo(t)
	mock.ExpectExec(`INSERT INTO observability_alert_rules`).WithArgs(
		sqlmock.AnyArg(), "t1", "cpu_usage", ">", 90.0, "critical", false,
	).WillReturnResult(sqlmock.NewResult(1, 1))

	rule, err := repo.CreateAlertRule(context.Background(), "t1", &models.AlertRule{
		Metric: "cpu_usage", Operator: ">", Threshold: 90, Severity: "critical",
	})
	if err != nil {
		t.Fatalf("CreateAlertRule returned an error: %v", err)
	}
	if rule == nil {
		t.Fatal("CreateAlertRule returned nil")
	}
	if rule.ID == "" {
		t.Error("CreateAlertRule did not assign an ID")
	}
	if rule.TenantID != "t1" {
		t.Errorf("TenantID = %q, want t1 (the tenant must come from the request context)", rule.TenantID)
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatalf("unmet expectations: %v", err)
	}
}

// TestListMetricsBuildsThePositionalFilters pins the generated query text and
// the number bound to each position. The old code did
// " AND name = $" + string(rune(idx)) + "s", which emitted U+0002 (STX) rather
// than the digit "2" and then the stray "s", so the query read
// " AND name = $\x02s" — a Postgres syntax error — and
// GET /observability/metrics?name=... answered 500 for every filtered request.
// Past idx 9 string(rune(idx)) is a visible character or a newline, never the
// digits. The single-filter arms matter: they are the only ones where the index
// has to start at 2 regardless of which clause came first.
func TestListMetricsBuildsThePositionalFilters(t *testing.T) {
	cases := []struct {
		name string
		q    models.MetricQuery
		want string
		args []driver.Value
	}{
		{"no filter", models.MetricQuery{},
			`SELECT \* FROM observability_metrics WHERE tenant_id=\$1 ORDER BY timestamp DESC`,
			[]driver.Value{"t1"}},
		{"name only", models.MetricQuery{Name: "cpu"},
			`SELECT \* FROM observability_metrics WHERE tenant_id=\$1 AND name = \$2 ORDER BY timestamp DESC`,
			[]driver.Value{"t1", "cpu"}},
		{"from only", models.MetricQuery{From: "2026-08-01"},
			`SELECT \* FROM observability_metrics WHERE tenant_id=\$1 AND timestamp >= \$2 ORDER BY timestamp DESC`,
			[]driver.Value{"t1", "2026-08-01"}},
		{"to only", models.MetricQuery{To: "2026-08-31"},
			`SELECT \* FROM observability_metrics WHERE tenant_id=\$1 AND timestamp <= \$2 ORDER BY timestamp DESC`,
			[]driver.Value{"t1", "2026-08-31"}},
		{"name and from", models.MetricQuery{Name: "cpu", From: "2026-08-01"},
			`SELECT \* FROM observability_metrics WHERE tenant_id=\$1 AND name = \$2 AND timestamp >= \$3 ORDER BY timestamp DESC`,
			[]driver.Value{"t1", "cpu", "2026-08-01"}},
		{"all three", models.MetricQuery{Name: "cpu", From: "2026-08-01", To: "2026-08-31"},
			`SELECT \* FROM observability_metrics WHERE tenant_id=\$1 AND name = \$2 AND timestamp >= \$3 AND timestamp <= \$4 ORDER BY timestamp DESC`,
			[]driver.Value{"t1", "cpu", "2026-08-01", "2026-08-31"}},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			repo, mock := newMockRepo(t)
			mock.ExpectQuery(tc.want).WithArgs(tc.args...).WillReturnRows(sqlmock.NewRows(metricCols))
			metrics, err := repo.ListMetrics(context.Background(), "t1", tc.q)
			if err != nil {
				t.Fatalf("ListMetrics(%s) returned an error: %v", tc.name, err)
			}
			if len(metrics) != 0 {
				t.Errorf("ListMetrics(%s) returned %d rows, want 0", tc.name, len(metrics))
			}
			if err := mock.ExpectationsWereMet(); err != nil {
				t.Fatalf("unmet expectations: %v", err)
			}
		})
	}
}

// TestListMetricsScansEveryColumnAndHydratesTags pins the column-to-field
// mapping. observability_metrics has tenant_id NOT NULL, which SELECT * returns,
// so Metric needed a TenantID destination; without it every non-empty
// GET /observability/metrics died with "missing destination name tenant_id".
// The tags column is JSONB, which arrives as []byte and cannot scan into
// map[string]string, so the tags column is read into TagsJSON and unmarshalled.
func TestListMetricsScansEveryColumnAndHydratesTags(t *testing.T) {
	repo, mock := newMockRepo(t)
	seen := time.Date(2026, 8, 26, 12, 0, 0, 0, time.UTC)
	mock.ExpectQuery(`SELECT \* FROM observability_metrics`).WillReturnRows(sqlmock.NewRows(metricCols).
		AddRow("t1", "cpu", []byte("0.42"), []byte(`{"host":"node-1","region":"us"}`), seen))

	metrics, err := repo.ListMetrics(context.Background(), "t1", models.MetricQuery{})
	if err != nil {
		t.Fatalf("ListMetrics returned an error: %v", err)
	}
	if len(metrics) != 1 {
		t.Fatalf("ListMetrics returned %d metrics, want 1", len(metrics))
	}
	m := metrics[0]
	if m.TenantID != "t1" {
		t.Errorf("TenantID = %q, want t1", m.TenantID)
	}
	if m.Name != "cpu" {
		t.Errorf("Name = %q, want cpu", m.Name)
	}
	if m.Value != 0.42 {
		t.Errorf("Value = %v, want 0.42", m.Value)
	}
	if got := m.Tags["host"]; got != "node-1" {
		t.Errorf("Tags[host] = %q, want node-1", got)
	}
	if got := m.Tags["region"]; got != "us" {
		t.Errorf("Tags[region] = %q, want us", got)
	}
	if !m.Timestamp.Equal(seen) {
		t.Errorf("Timestamp = %v, want %v", m.Timestamp, seen)
	}
}

// TestListMetricsSurvivesCorruptTags pins the best-effort contract of
// hydrateTags: one bad row must not turn the whole listing into a 500.
func TestListMetricsSurvivesCorruptTags(t *testing.T) {
	repo, mock := newMockRepo(t)
	mock.ExpectQuery(`SELECT \* FROM observability_metrics`).WillReturnRows(sqlmock.NewRows(metricCols).
		AddRow("t1", "cpu", []byte("0.42"), []byte(`{not json`), time.Now().UTC()))

	metrics, err := repo.ListMetrics(context.Background(), "t1", models.MetricQuery{})
	if err != nil {
		t.Fatalf("ListMetrics returned an error on corrupt tags: %v", err)
	}
	if len(metrics) != 1 {
		t.Fatalf("ListMetrics returned %d metrics, want 1", len(metrics))
	}
	if metrics[0].Tags != nil {
		t.Errorf("Tags = %v, want nil for an unparseable column", metrics[0].Tags)
	}
	if metrics[0].Name != "cpu" {
		t.Errorf("Name = %q, want cpu (other columns must still scan)", metrics[0].Name)
	}
}

// TestGetMetricReturnsNotFoundAndHydratesTags covers the single-row reader on
// both paths: the empty table must answer sentinel.NotFound, not a 500, and the
// found path must return the scanned tenant and the unmarshalled tags.
func TestGetMetricReturnsNotFoundAndHydratesTags(t *testing.T) {
	repo, mock := newMockRepo(t)
	mock.ExpectQuery(`SELECT \* FROM observability_metrics`).WillReturnRows(sqlmock.NewRows(metricCols))
	m, err := repo.GetMetric(context.Background(), "t1", "cpu")
	// Pin the sentinel: the route answers 404 from it, so any other error here
	// would turn an empty metric store into a 500.
	if err != sentinel.NotFound {
		t.Fatalf("GetMetric err = %v, want sentinel.NotFound", err)
	}
	if m != nil {
		t.Errorf("GetMetric returned %v, want nil", m)
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatalf("unmet expectations: %v", err)
	}

	// The found path must scan every column and unmarshal the JSONB tags.
	repo2, mock2 := newMockRepo(t)
	seen := time.Date(2026, 8, 26, 9, 0, 0, 0, time.UTC)
	mock2.ExpectQuery(`SELECT \* FROM observability_metrics`).WillReturnRows(sqlmock.NewRows(metricCols).
		AddRow("t1", "cpu", []byte("0.42"), []byte(`{"host":"node-1"}`), seen))
	m, err = repo2.GetMetric(context.Background(), "t1", "cpu")
	if err != nil {
		t.Fatalf("GetMetric returned an error: %v", err)
	}
	if m == nil {
		t.Fatal("GetMetric returned nil on a matching row")
	}
	if m.TenantID != "t1" || m.Name != "cpu" || m.Value != 0.42 {
		t.Errorf("scanned metric = %+v", m)
	}
	if got := m.Tags["host"]; got != "node-1" {
		t.Errorf("Tags[host] = %q, want node-1 (the JSONB column must be unmarshalled)", got)
	}
	if !m.Timestamp.Equal(seen) {
		t.Errorf("Timestamp = %v, want %v", m.Timestamp, seen)
	}
	if err := mock2.ExpectationsWereMet(); err != nil {
		t.Fatalf("unmet expectations: %v", err)
	}
}

func TestListAlertRulesScansTheTenantColumn(t *testing.T) {
	repo, mock := newMockRepo(t)
	mock.ExpectQuery(`SELECT \* FROM observability_alert_rules`).WillReturnRows(sqlmock.NewRows(ruleCols).
		AddRow("r-1", "t1", "cpu_usage", ">", 90.0, "critical", true))

	rules, err := repo.ListAlertRules(context.Background(), "t1")
	if err != nil {
		t.Fatalf("ListAlertRules returned an error: %v", err)
	}
	if len(rules) != 1 {
		t.Fatalf("ListAlertRules returned %d rules, want 1", len(rules))
	}
	if rules[0].TenantID != "t1" {
		t.Errorf("TenantID = %q, want t1", rules[0].TenantID)
	}
	if rules[0].Metric != "cpu_usage" || !rules[0].Enabled {
		t.Errorf("rule = %+v, want metric=cpu_usage enabled=true", rules[0])
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatalf("unmet expectations: %v", err)
	}
}

// TestTheDriversObservePlaceholdersTagsAndColumnsIsThePositiveControl proves
// each fix above is observable at all. sqlmock never runs sqlx's named-arg
// resolution and never runs struct-tag mapping, so the reviewer could argue
// those tests pass regardless of the code. sqlmock DOES hand the raw row values
// to database/sql's scan machinery, which is how the JSONB arm is visible.
// Without all three arms failing here, the three fixes would be unverified.
func TestTheDriversObservePlaceholdersTagsAndColumnsIsThePositiveControl(t *testing.T) {
	t.Run("camelCase placeholder", func(t *testing.T) {
		db, mock, err := sqlmock.New(sqlmock.QueryMatcherOption(sqlmock.QueryMatcherRegexp))
		if err != nil {
			t.Fatalf("sqlmock.New: %v", err)
		}
		defer func() { _ = db.Close() }()
		mock.ExpectExec(`INSERT INTO observability_alert_rules`).WillReturnResult(sqlmock.NewResult(1, 1))
		conn := sqlx.NewDb(db, "postgres")
		_, err = conn.NamedExecContext(context.Background(),
			"INSERT INTO observability_alert_rules (id, tenant_id, metric, operator, threshold, severity, enabled) VALUES (:id, :tenantId, :metric, :operator, :threshold, :severity, :enabled)",
			&models.AlertRule{ID: "r-1", TenantID: "t1", Metric: "cpu", Operator: ">", Threshold: 1, Severity: "low"})
		if err == nil {
			t.Fatal("mutant placeholder unexpectedly bound; the binding test above is vacuous")
		}
		if want := "could not find name tenantId"; !strings.Contains(err.Error(), want) {
			t.Fatalf("err = %q, want it to contain %q", err.Error(), want)
		}
	})

	t.Run("untagged struct", func(t *testing.T) {
		db, mock, err := sqlmock.New(sqlmock.QueryMatcherOption(sqlmock.QueryMatcherRegexp))
		if err != nil {
			t.Fatalf("sqlmock.New: %v", err)
		}
		defer func() { _ = db.Close() }()
		mock.ExpectQuery(`SELECT`).WillReturnRows(sqlmock.NewRows(
			[]string{"tenant_id", "name", "value", "tags", "timestamp"}).
			AddRow("t1", "cpu", []byte("0.42"), []byte("{}"), time.Now().UTC()))
		conn := sqlx.NewDb(db, "postgres")
		var untagged struct {
			Name      string
			Value     float64
			Tags      map[string]string
			Timestamp time.Time
		}
		err = conn.GetContext(context.Background(), &untagged,
			"SELECT tenant_id, name, value, tags, timestamp FROM observability_metrics WHERE tenant_id=$1", "t1")
		if err == nil {
			t.Fatal("untagged struct unexpectedly scanned; the column-mapping test above is vacuous")
		}
		if want := "missing destination name tenant_id"; !strings.Contains(err.Error(), want) {
			t.Fatalf("err = %q, want it to contain %q", err.Error(), want)
		}
	})

	t.Run("jsonb into a map", func(t *testing.T) {
		db, mock, err := sqlmock.New(sqlmock.QueryMatcherOption(sqlmock.QueryMatcherRegexp))
		if err != nil {
			t.Fatalf("sqlmock.New: %v", err)
		}
		defer func() { _ = db.Close() }()
		mock.ExpectQuery(`SELECT`).WillReturnRows(sqlmock.NewRows(
			[]string{"tenant_id", "name", "value", "tags", "timestamp"}).
			AddRow("t1", "cpu", []byte("0.42"), []byte(`{"host":"n1"}`), time.Now().UTC()))
		conn := sqlx.NewDb(db, "postgres")
		var dest struct {
			TenantID  string            `db:"tenant_id"`
			Name      string            `db:"name"`
			Value     float64           `db:"value"`
			Tags      map[string]string `db:"tags"`
			Timestamp time.Time         `db:"timestamp"`
		}
		err = conn.GetContext(context.Background(), &dest,
			"SELECT tenant_id, name, value, tags, timestamp FROM observability_metrics WHERE tenant_id=$1", "t1")
		if err == nil {
			t.Fatal("JSONB scanned into a map; the tags test above is vacuous")
		}
		if want := "unsupported Scan, storing driver.Value type []uint8 into type *map[string]string"; !strings.Contains(err.Error(), want) {
			t.Fatalf("err = %q, want it to contain %q", err.Error(), want)
		}
	})
}
