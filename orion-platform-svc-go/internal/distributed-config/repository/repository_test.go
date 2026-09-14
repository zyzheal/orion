package repository

import (
	"context"
	"database/sql/driver"
	"errors"
	"fmt"
	"os"
	"regexp"
	"strings"
	"testing"
	"time"

	"orion/platform-svc-go/internal/distributed-config/models"

	"github.com/DATA-DOG/go-sqlmock"
	"github.com/jmoiron/sqlx"
)

var ws = regexp.MustCompile(`\s+`)

func normSQL(s string) string {
	return strings.TrimSpace(ws.ReplaceAllString(s, " "))
}

func mockDB(t *testing.T) (*sqlx.DB, sqlmock.Sqlmock) {
	t.Helper()
	raw, mock, err := sqlmock.New(sqlmock.QueryMatcherOption(sqlmock.QueryMatcherFunc(func(expected, actual string) error {
		if normSQL(expected) != normSQL(actual) {
			return fmt.Errorf("sql mismatch: want %q got %q", expected, actual)
		}
		return nil
	})))
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { _ = raw.Close() })
	return sqlx.NewDb(raw, "postgres"), mock
}

// mockDBRecording also records every statement handed to the driver, so a test
// can assert that a statement was never issued. ExpectationsWereMet cannot
// prove that for an expectation that was never registered.
func mockDBRecording(t *testing.T) (*sqlx.DB, sqlmock.Sqlmock, *[]string) {
	t.Helper()
	seen := []string{}
	raw, mock, err := sqlmock.New(sqlmock.QueryMatcherOption(sqlmock.QueryMatcherFunc(func(expected, actual string) error {
		seen = append(seen, normSQL(actual))
		if normSQL(expected) != normSQL(actual) {
			return fmt.Errorf("sql mismatch: want %q got %q", expected, actual)
		}
		return nil
	})))
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { _ = raw.Close() })
	return sqlx.NewDb(raw, "postgres"), mock, &seen
}

// The column-list constants are comma-space separated, so the split has to trim before sqlx can match a column name to a db tag.
func columns(spec string) []string {
	parts := strings.Split(spec, ",")
	for i, p := range parts {
		parts[i] = strings.TrimSpace(p)
	}
	return parts
}

var itemColumnsList = columns(itemColumns)

func now() time.Time {
	return time.Date(2026, 9, 14, 10, 0, 0, 0, time.UTC)
}

// A full config_item row in itemColumns order. The value_type and level columns
// come back as strings, encrypted and priority as int64, labels as []byte
// because the column is JSON, and the three nullable columns as nil: that is
// exactly the shape a real Postgres result has for a row written with the
// migrations' defaults.
func itemRow(values ...interface{}) *sqlmock.Rows {
	if len(values) != len(itemColumnsList) {
		panic(fmt.Sprintf("itemRow: %d values for %d columns", len(values), len(itemColumnsList)))
	}
	vals := make([]driver.Value, len(values))
	for i, v := range values {
		vals[i] = v
	}
	return sqlmock.NewRows(itemColumnsList).AddRow(vals...)
}

func itemFixture(t *testing.T) *sqlmock.Rows {
	t.Helper()
	return itemRow("it-1", "t1", "grp-1", "ns-1", "k", "v1", "string",
		int64(0), "desc-1", []byte(`{"env":"prod"}`), now(), now(), "tenant", nil, int64(50))
}

func TestNoStatementUsesAMySQLPlaceholder(t *testing.T) {
	src, err := os.ReadFile("repository.go")
	if err != nil {
		t.Fatal(err)
	}
	for _, line := range strings.Split(string(src), "\n") {
		trimmed := strings.TrimSpace(line)
		if strings.HasPrefix(trimmed, "//") {
			continue
		}
		if strings.Contains(trimmed, "?") {
			t.Errorf("MySQL-style placeholder in a Postgres statement: %s", trimmed)
		}
	}
}

func TestNoStatementUsesSelectStar(t *testing.T) {
	src, err := os.ReadFile("repository.go")
	if err != nil {
		t.Fatal(err)
	}
	for _, line := range strings.Split(string(src), "\n") {
		trimmed := strings.TrimSpace(line)
		if strings.HasPrefix(trimmed, "//") {
			continue
		}
		if strings.Contains(trimmed, "SELECT *") {
			t.Errorf("SELECT * would break every read route that gains a column: %s", trimmed)
		}
	}
}

// The encrypted column is SMALLINT. lib/pq renders a Go bool as the text
// true or false regardless of the target type, and Postgres refuses that text
// for a smallint, so a bool bound here would fail every insert of an encrypted
// item. The expectation pins the integer on purpose: a mutant that binds the
// bool arrives as true and does not compare equal to int64(1).
func TestCreateItemBindsAnIntegerForTheEncryptedColumn(t *testing.T) {
	db, mock := mockDB(t)
	r := NewRepository(db)

	wantSQL := normSQL("INSERT INTO config_item (" + itemColumns + ") VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)")
	mock.ExpectExec(wantSQL).WithArgs(
		"it-1", "t1", "grp-1", "ns-1", "k", "v1", "secret",
		int64(1),
		"an encrypted value",
		`{"env":"prod"}`,
		sqlmock.AnyArg(), sqlmock.AnyArg(),
		"tenant",
		"",
		int64(50),
	).WillReturnResult(sqlmock.NewResult(0, 1))

	err := r.CreateItem(context.Background(), &models.ConfigItem{
		ID: "it-1", TenantID: "t1", GroupID: "grp-1", NamespaceID: "ns-1",
		KeyName: "k", Value: "v1", ValueType: models.ValueTypeSecret, Encrypted: true,
		Description: "an encrypted value",
		Labels:      `{"env":"prod"}`,
		CreatedAt:   now(), UpdatedAt: now(),
		Level:      models.ConfigLevelTenant,
		OverrideOf: "",
		Priority:   50,
	})
	if err != nil {
		t.Fatalf("error: %v", err)
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatalf("expectations: %v", err)
	}
}

// description, labels and override_of are the three config_item columns that
// 395 and 406 leave nullable. A plain string destination cannot receive a
// NULL, so one NULL anywhere in the result set fails the whole read and the
// route answers 500. This row has all three NULL and must still scan.
func TestGetItemScansASQLNullIntoATextColumn(t *testing.T) {
	db, mock := mockDB(t)
	r := NewRepository(db)

	mock.ExpectQuery(normSQL("SELECT "+itemColumns+" FROM config_item WHERE id = $1 AND tenant_id = $2")).
		WithArgs("it-1", "t1").
		WillReturnRows(itemRow("it-1", "t1", "grp-1", "ns-1", "k", "v1", "string",
			int64(0), nil, nil, now(), now(), "tenant", nil, int64(50)))

	item, err := r.GetItem(context.Background(), "it-1", "t1")
	if err != nil {
		t.Fatalf("error: %v", err)
	}
	if item.Description != "" {
		t.Errorf("Description = %q, want the empty string for a NULL", item.Description)
	}
	if item.Labels != "" {
		t.Errorf("Labels = %q, want the empty string for a NULL", item.Labels)
	}
	if item.OverrideOf != "" {
		t.Errorf("OverrideOf = %q, want the empty string for a NULL", item.OverrideOf)
	}
	if item.Priority != 50 {
		t.Errorf("Priority = %d, want 50", item.Priority)
	}
}

func TestGetItemRequiresATenant(t *testing.T) {
	db, mock, statements := mockDBRecording(t)
	r := NewRepository(db)

	mock.ExpectQuery(normSQL("SELECT "+itemColumns+" FROM config_item WHERE id = $1 AND tenant_id = $2")).
		WithArgs("it-1", "t1").WillReturnRows(itemFixture(t))

	if _, err := r.GetItem(context.Background(), "it-1", "t1"); err != nil {
		t.Fatalf("error: %v", err)
	}
	if len(*statements) != 1 {
		t.Fatalf("statements = %d, want exactly one", len(*statements))
	}
}

func TestGetSnapshotRequiresATenant(t *testing.T) {
	db, mock, statements := mockDBRecording(t)
	r := NewRepository(db)

	mock.ExpectQuery(normSQL("SELECT "+snapshotColumns+" FROM config_snapshot WHERE id = $1 AND tenant_id = $2")).
		WithArgs("snap-1", "t1").
		WillReturnRows(sqlmock.NewRows(columns(snapshotColumns)).AddRow(
			"snap-1", "t1", "grp-1", "ns-1", "prod", int64(1),
			`{"k":"v"}`, "chk", now(), "admin"))

	if _, err := r.GetSnapshot(context.Background(), "snap-1", "t1"); err != nil {
		t.Fatalf("error: %v", err)
	}
	if len(*statements) != 1 {
		t.Fatalf("statements = %d, want exactly one", len(*statements))
	}
}

func TestGetItemLatestVersionReturnsZeroForAnEmptyHistory(t *testing.T) {
	db, mock := mockDB(t)
	r := NewRepository(db)

	mock.ExpectQuery(normSQL("SELECT COALESCE(MAX(version), 0) FROM config_item_history WHERE tenant_id = $1 AND item_id = $2")).
		WithArgs("t1", "it-1").
		WillReturnRows(sqlmock.NewRows([]string{"version"}).AddRow(int64(0)))

	version, err := r.GetItemLatestVersion(context.Background(), "t1", "it-1")
	if err != nil {
		t.Fatalf("an empty history must be zero, not an error: %v", err)
	}
	if version != 0 {
		t.Errorf("version = %d, want 0", version)
	}
}

// buildSET walks the whitelist rather than the caller's map, so the column
// order and the placeholder numbering are the same whatever order the map was
// filled in. This pins both, for every attribute at once.
func TestUpdateItemValuePinsEveryAttributeInWhitelistOrder(t *testing.T) {
	db, mock := mockDB(t)
	r := NewRepository(db)

	wantSet := "UPDATE config_item SET value = $1, value_type = $2, encrypted = $3, description = $4, labels = $5, level = $6, priority = $7, override_of = $8, updated_at = NOW() WHERE id = $9 AND tenant_id = $10"
	mock.ExpectExec(normSQL(wantSet)).WithArgs(
		"v2", "int", int64(1), "new description", `{"a":"b"}`, "platform", int64(100), "parent-1",
		"it-1", "t1",
	).WillReturnResult(sqlmock.NewResult(0, 1))
	mock.ExpectQuery(normSQL("SELECT "+itemColumns+" FROM config_item WHERE id = $1 AND tenant_id = $2")).
		WithArgs("it-1", "t1").WillReturnRows(itemFixture(t))

	got, err := r.UpdateItemValue(context.Background(), "it-1", "t1", map[string]interface{}{
		"override_of": "parent-1", "priority": 100, "labels": `{"a":"b"}`,
		"encrypted": true, "description": "new description", "value_type": models.ValueTypeInt,
		"value": "v2", "level": models.ConfigLevelPlatform,
	})
	if err != nil {
		t.Fatalf("error: %v", err)
	}
	if got.ID != "it-1" {
		t.Errorf("returned ID = %q, want it-1", got.ID)
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatalf("expectations: %v", err)
	}
}

// tenant_id is not updatable: re-pointing it moves a row into someone else's
// namespace. The guard must reject it before any statement is issued, so no
// expectation is registered here and a mutant that bypasses the whitelist
// fails with sqlmock's own unrelated text instead.
func TestUpdateItemValueRejectsAColumnItWillNotWrite(t *testing.T) {
	db, _ := mockDB(t)
	r := NewRepository(db)

	_, err := r.UpdateItemValue(context.Background(), "it-1", "t1", map[string]interface{}{"tenant_id": "t2"})
	if err == nil {
		t.Fatal("expected an error for a non-updatable column")
	}
	want := `column "tenant_id" is not updatable on config_item`
	if err.Error() != want {
		t.Fatalf("error = %q, want %q", err.Error(), want)
	}
}

func TestUpdateItemValueWithNoColumnsReturnsTheExistingRow(t *testing.T) {
	db, mock, statements := mockDBRecording(t)
	r := NewRepository(db)

	mock.ExpectQuery(normSQL("SELECT "+itemColumns+" FROM config_item WHERE id = $1 AND tenant_id = $2")).
		WithArgs("it-1", "t1").WillReturnRows(itemFixture(t))

	got, err := r.UpdateItemValue(context.Background(), "it-1", "t1", map[string]interface{}{})
	if err != nil {
		t.Fatalf("error: %v", err)
	}
	if got.ID != "it-1" {
		t.Errorf("ID = %q, want it-1", got.ID)
	}
	for _, s := range *statements {
		if reUpdateWord.MatchString(s) {
			t.Fatalf("an UPDATE was issued for an empty attribute set: %s", s)
		}
	}
}

// config_release has no updated_at column, so appending one would fail the
// statement against a real database. UpdateItemValue does append it.
func TestUpdateReleaseDoesNotAppendUpdatedAt(t *testing.T) {
	db, mock, statements := mockDBRecording(t)
	r := NewRepository(db)

	wantSet := "UPDATE config_release SET status = $1 WHERE id = $2 AND tenant_id = $3"
	mock.ExpectExec(normSQL(wantSet)).WithArgs("released", "rel-1", "t1").
		WillReturnResult(sqlmock.NewResult(0, 1))
	mock.ExpectQuery(normSQL("SELECT "+releaseColumns+" FROM config_release WHERE id = $1 AND tenant_id = $2")).
		WithArgs("rel-1", "t1").
		WillReturnRows(sqlmock.NewRows(columns(releaseColumns)).AddRow(
			"rel-1", "t1", "snap-1", "grp-1", "prod", int64(1), "released",
			"note", now(), "admin", nil, now()))

	if _, err := r.UpdateRelease(context.Background(), "rel-1", "t1", map[string]interface{}{"status": "released"}); err != nil {
		t.Fatalf("error: %v", err)
	}
	for _, s := range *statements {
		if reUpdateWord.MatchString(s) && strings.Contains(s, "updated_at") {
			t.Fatalf("updated_at was written to a table without that column: %s", s)
		}
	}
}

func TestUpdateReleaseWithNoColumnsReturnsTheExistingRow(t *testing.T) {
	db, mock, statements := mockDBRecording(t)
	r := NewRepository(db)

	mock.ExpectQuery(normSQL("SELECT "+releaseColumns+" FROM config_release WHERE id = $1 AND tenant_id = $2")).
		WithArgs("rel-1", "t1").
		WillReturnRows(sqlmock.NewRows(columns(releaseColumns)).AddRow(
			"rel-1", "t1", "snap-1", "grp-1", "prod", int64(1), "released",
			"note", now(), "admin", nil, now()))

	got, err := r.UpdateRelease(context.Background(), "rel-1", "t1", map[string]interface{}{})
	if err != nil {
		t.Fatalf("error: %v", err)
	}
	if got.ID != "rel-1" {
		t.Errorf("ID = %q, want rel-1", got.ID)
	}
	for _, s := range *statements {
		if reUpdateWord.MatchString(s) {
			t.Fatalf("an UPDATE was issued for an empty attribute set: %s", s)
		}
	}
}

// RowsAffected is itself fallible: it fails when the driver cannot determine
// the affected count. The repository must report that instead of guessing a
// deletion that may never have happened.
type rowCountFailure struct{}

func (rowCountFailure) LastInsertId() (int64, error) { return 0, nil }
func (rowCountFailure) RowsAffected() (int64, error) {
	return 0, errors.New("row count unavailable")
}

func TestDeleteItemReportsARowCountFailure(t *testing.T) {
	db, mock := mockDB(t)
	r := NewRepository(db)

	mock.ExpectExec(normSQL("DELETE FROM config_item WHERE id = $1 AND tenant_id = $2")).
		WithArgs("it-1", "t1").WillReturnResult(rowCountFailure{})

	deleted, err := r.DeleteItem(context.Background(), "it-1", "t1")
	if err == nil {
		t.Fatal("expected an error when the row count is unavailable")
	}
	if deleted {
		t.Error("deleted = true for a failure")
	}
	if !strings.Contains(err.Error(), "row count unavailable") {
		t.Fatalf("error = %q", err.Error())
	}
}

func TestGetLatestSnapshotVersionReadsTheSnapshotCounter(t *testing.T) {
	db, mock := mockDB(t)
	r := NewRepository(db)

	mock.ExpectQuery(normSQL("SELECT COALESCE(MAX(version), 0) FROM config_snapshot WHERE tenant_id = $1 AND group_id = $2 AND environment = $3")).
		WithArgs("t1", "grp-1", "prod").
		WillReturnRows(sqlmock.NewRows([]string{"version"}).AddRow(int64(3)))

	version, err := r.GetLatestSnapshotVersion(context.Background(), "t1", "grp-1", "prod")
	if err != nil {
		t.Fatalf("error: %v", err)
	}
	if version != 3 {
		t.Errorf("version = %d, want 3", version)
	}
}

func TestGetLatestReleaseVersionReadsTheReleaseCounter(t *testing.T) {
	db, mock := mockDB(t)
	r := NewRepository(db)

	// The release counter comes from config_release.release_version, not from
	// config_snapshot.version, whose rows are all zero: reading the snapshot
	// table here would number every published release one.
	mock.ExpectQuery(normSQL("SELECT COALESCE(MAX(release_version), 0) FROM config_release WHERE tenant_id = $1 AND group_id = $2 AND environment = $3")).
		WithArgs("t1", "grp-1", "prod").
		WillReturnRows(sqlmock.NewRows([]string{"release_version"}).AddRow(int64(7)))

	version, err := r.GetLatestReleaseVersion(context.Background(), "t1", "grp-1", "prod")
	if err != nil {
		t.Fatalf("error: %v", err)
	}
	if version != 7 {
		t.Errorf("version = %d, want 7", version)
	}
}

// Both ends of the clamp are pinned. Postgres rejects a negative LIMIT
// outright and an unbounded read of an append-only audit table is an outage.
func TestListAuditClampsTheLimit(t *testing.T) {
	for _, tc := range []struct{ sent, want int }{
		{0, defaultAuditLimit},
		{-5, defaultAuditLimit},
		{500, maxAuditLimit},
		{9999, maxAuditLimit},
	} {
		tc := tc
		t.Run(fmt.Sprintf("sent %d", tc.sent), func(t *testing.T) {
			db, mock := mockDB(t)
			r := NewRepository(db)

			mock.ExpectQuery(normSQL("SELECT "+auditColumns+" FROM config_audit WHERE tenant_id = $1 ORDER BY created_at DESC LIMIT $2")).
				WithArgs("t1", int64(tc.want)).
				WillReturnRows(sqlmock.NewRows(columns(auditColumns)))

			audits, err := r.ListAudit(context.Background(), "t1", tc.sent)
			if err != nil {
				t.Fatalf("error: %v", err)
			}
			if len(audits) != 0 {
				t.Errorf("audits = %d, want 0", len(audits))
			}
			if err := mock.ExpectationsWereMet(); err != nil {
				t.Fatalf("expectations: %v", err)
			}
		})
	}
}

var reUpdateWord = regexp.MustCompile(`(?i)\bUPDATE\b`)
