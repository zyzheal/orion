package repository

import (
	"context"
	"database/sql"
	"errors"
	"regexp"
	"strings"
	"testing"
	"time"

	"orion/go-common/pkg/sentinel"

	"github.com/DATA-DOG/go-sqlmock"
)

// The handler layer switches on service.IsNotFound, which is
// errors.Is(err, sentinel.NotFound). Before getOne and oneRow existed the
// repository handed the handler the driver's own errors, so all twenty-one
// IsNotFound branches were unreachable and a missing id answered 500 with
// "sql: no rows" instead of 404. A brand-new tenant's first
// GET /notification-preferences or GET /dnd-settings hit exactly that path.

// TestGetOne_MapsTheDriverMissToNotFound pins the mapping and asserts that the
// driver error does not escape it, so the sentinel is load-bearing rather than
// an alias for the value it replaces.
func TestGetOne_MapsTheDriverMissToNotFound(t *testing.T) {
	db, mock := mockDB(t)
	mock.ExpectQuery(`SELECT `+webhookColumns+` FROM chatops_webhooks WHERE id=$1 AND tenant_id=$2`).
		WithArgs("w-none", "t-1").WillReturnRows(sqlmock.NewRows([]string{
		"id", "tenant_id", "name", "url", "events", "secret_key", "enabled", "retry_count",
		"timeout_seconds", "headers", "description", "created_by", "created_at",
	}))

	_, err := NewRepository(db).GetWebhook(context.Background(), "t-1", "w-none")
	if !errors.Is(err, sentinel.NotFound) {
		t.Fatalf("expected sentinel.NotFound, got %v", err)
	}
	if errors.Is(err, sql.ErrNoRows) {
		t.Fatalf("the driver error must not escape the repository: %v", err)
	}
}

// The same miss on the settings readers is the first-request case: there is no
// row to update yet, and the handler answers 200 with a zero value.
func TestGetOne_SettingsReadersAreNotFoundOnTheFirstRequest(t *testing.T) {
	for _, tc := range []struct {
		name    string
		columns string
		query   string
		read    func(*Repository, context.Context) error
	}{
		{
			name:    "notification preference",
			columns: notificationColumns,
			query:   `SELECT ` + notificationColumns + ` FROM chatops_notification_preferences WHERE tenant_id=$1 AND user_id=$2`,
			read: func(r *Repository, ctx context.Context) error {
				_, err := r.GetNotificationPreference(ctx, "t-1", "u-1")
				return err
			},
		},
		{
			name:    "dnd settings",
			columns: dndColumns,
			query:   `SELECT ` + dndColumns + ` FROM chatops_dnd_settings WHERE tenant_id=$1 AND user_id=$2`,
			read: func(r *Repository, ctx context.Context) error {
				_, err := r.GetDNDSettings(ctx, "t-1", "u-1")
				return err
			},
		},
	} {
		t.Run(tc.name, func(t *testing.T) {
			db, mock := mockDB(t)
			mock.ExpectQuery(tc.query).WithArgs("t-1", "u-1").
				WillReturnRows(sqlmock.NewRows(strings.Split(tc.columns, ",")))
			if err := tc.read(NewRepository(db), context.Background()); !errors.Is(err, sentinel.NotFound) {
				t.Fatalf("expected sentinel.NotFound, got %v", err)
			}
		})
	}
}

// A real failure has to keep its own message. Wrapping every error into
// NotFound would make a dead database indistinguishable from an empty id.
func TestGetOne_ARealErrorPassesThrough(t *testing.T) {
	db, mock := mockDB(t)
	boom := errors.New("pq: connection refused")
	mock.ExpectQuery(`SELECT `+webhookColumns+` FROM chatops_webhooks WHERE id=$1 AND tenant_id=$2`).
		WithArgs("w-1", "t-1").WillReturnError(boom)

	_, err := NewRepository(db).GetWebhook(context.Background(), "t-1", "w-1")
	if !errors.Is(err, boom) || errors.Is(err, sentinel.NotFound) {
		t.Fatalf("expected the driver error unchanged, got %v", err)
	}
}

// A live row is not a miss, so it must come back untouched.
func TestGetOne_ALiveRowIsNotWrapped(t *testing.T) {
	db, mock := mockDB(t)
	now := time.Now().UTC()
	mock.ExpectQuery(`SELECT `+webhookColumns+` FROM chatops_webhooks WHERE id=$1 AND tenant_id=$2`).
		WithArgs("w-1", "t-1").WillReturnRows(sqlmock.NewRows([]string{
		"id", "tenant_id", "name", "url", "events", "secret_key", "enabled", "retry_count",
		"timeout_seconds", "headers", "description", "created_by", "created_at",
	}).AddRow("w-1", "t-1", "ci-done", "https://example.test/hook", `["ci_done"]`,
		"shh", true, 3, 15, `{"X-Team":"ci"}`, "ci webhook", "u-1", now))

	wh, err := NewRepository(db).GetWebhook(context.Background(), "t-1", "w-1")
	if err != nil || wh.ID != "w-1" || wh.SecretKey != "shh" {
		t.Fatalf("got %+v, %v", wh, err)
	}
}

// --- oneRow ---

func TestOneRow_ADeleteThatMatchedNothingIsNotFound(t *testing.T) {
	db, mock := mockDB(t)
	mock.ExpectExec(`DELETE FROM chatops_webhooks WHERE id=$1 AND tenant_id=$2`).
		WithArgs("w-gone", "t-1").WillReturnResult(sqlmock.NewResult(0, 0))

	err := NewRepository(db).DeleteWebhook(context.Background(), "t-1", "w-gone")
	if !errors.Is(err, sentinel.NotFound) {
		t.Fatalf("expected sentinel.NotFound, got %v", err)
	}
	if !strings.Contains(err.Error(), "w-gone") {
		t.Fatalf("the id must be in the message so the operator can find the row: %v", err)
	}
}

func TestOneRow_ADeleteThatMatchedOneRowIsSuccess(t *testing.T) {
	db, mock := mockDB(t)
	mock.ExpectExec(`DELETE FROM chatops_webhooks WHERE id=$1 AND tenant_id=$2`).
		WithArgs("w-1", "t-1").WillReturnResult(sqlmock.NewResult(0, 1))

	if err := NewRepository(db).DeleteWebhook(context.Background(), "t-1", "w-1"); err != nil {
		t.Fatalf("DeleteWebhook: %v", err)
	}
}

// The WHERE clause carries tenant_id too, so "the row belongs to another
// tenant" arrives here as a zero-row delete and must not be a silent success.
func TestOneRow_AnotherTenantsRowIsNotFound(t *testing.T) {
	db, mock := mockDB(t)
	mock.ExpectExec(`DELETE FROM chatops_commands WHERE id=$1 AND tenant_id=$2`).
		WithArgs("c-other", "t-1").WillReturnResult(sqlmock.NewResult(0, 0))

	err := NewRepository(db).DeleteCommand(context.Background(), "t-1", "c-other")
	if !errors.Is(err, sentinel.NotFound) {
		t.Fatalf("expected sentinel.NotFound, got %v", err)
	}
}

// --- source-level guards: neither helper may be dropped silently ---

func functionBody(src string, start string) string {
	at := strings.Index(src, start)
	if at < 0 {
		return ""
	}
	rest := src[at+len(start):]
	if nl := strings.Index(rest, "\nfunc "); nl >= 0 {
		return rest[:nl]
	}
	return rest
}

// TestSource_EveryIDScopedWriteChecksRowsAffected fails if a DELETE or UPDATE
// scoped by id forgets the oneRow call, which is exactly how the bug was born:
// the sql.Result sat on a blank identifier and every caller saw success.
func TestSource_EveryIDScopedWriteChecksRowsAffected(t *testing.T) {
	src := loadSQL(t, "repository.go")
	reFunc := regexp.MustCompile(`(?m)^func \(r \*Repository\) (\w+)\(`)
	// tenant_id and version_id are scoping columns, not identity, so only a
	// WHERE clause keyed on id itself counts. The placeholder may be positional
	// ($1) or named (:id): a NamedExecContext call compiles its named args to
	// $1..$N, so leaving a literal $1 next to them rebinds id to the first SET
	// value instead of the id the caller passed.
	reIDScoped := regexp.MustCompile(`(?:DELETE FROM|UPDATE) chatops_[a-z_]+[\s\S]*?\bid=(\$|:)`)
	missing := []string{}
	checked := 0
	for _, m := range reFunc.FindAllStringSubmatchIndex(src, -1) {
		name := src[m[2]:m[3]]
		body := functionBody(src, "func (r *Repository) "+name+"(")
		if body == "" || reIDScoped.FindString(body) == "" {
			continue
		}
		checked++
		if !strings.Contains(body, "oneRow(res,") {
			missing = append(missing, name)
		}
	}
	if len(missing) > 0 {
		t.Fatalf("id-scoped writes that never check RowsAffected: %v", missing)
	}
	if checked < 16 {
		t.Fatalf("detector matched only %d writes; the pattern is too narrow", checked)
	}

	// positive controls: dropping the RowsAffected check must flag a function
	// in either bindvar style. The named form is the one that regressed, so
	// both branches of the alternation above have to be seen here or a future
	// edit to the detector could go wide without anything failing.
	for _, tc := range []struct {
		name     string
		funcName string
		fixture  string
	}{
		{"positional", "DeleteX", "func (r *Repository) DeleteX(ctx context.Context, tenantID, id string) error {\n" +
			"_, err := r.db.ExecContext(ctx, \"DELETE FROM chatops_commands WHERE id=$1 AND tenant_id=$2\", id, tenantID)\n" +
			"if err != nil { return err }\nreturn nil\n}"},
		{"named", "UpdateX", "func (r *Repository) UpdateX(ctx context.Context, tenantID, id string, u map[string]interface{}) error {\n" +
			"_, err := r.db.NamedExecContext(ctx, \"UPDATE chatops_roles SET name=:name WHERE id=:id AND tenant_id=:tenant_id\", u)\n" +
			"if err != nil { return err }\nreturn nil\n}"},
	} {
		body := functionBody(tc.fixture, "func (r *Repository) "+tc.funcName+"(")
		if reIDScoped.FindString(body) == "" {
			t.Fatalf("detector did not match the %s fixture statement", tc.name)
		}
		if strings.Contains(body, "oneRow(res,") {
			t.Fatalf("%s fixture wrongly counted as checked", tc.name)
		}
	}
}

// TestSource_SingleRowReadsUseGetOne fails if a reader goes back to a bare
// GetContext, which is the shape that dropped the mapping.
func TestSource_SingleRowReadsUseGetOne(t *testing.T) {
	src := loadSQL(t, "repository.go")
	bare := "r.db.GetContext(ctx, &m,"
	if n := strings.Count(src, bare); n != 0 {
		t.Fatalf("%d bare GetContext into a model", n)
	}
	if n := strings.Count(src, "r.getOne(ctx,"); n < 13 {
		t.Fatalf("expected at least 13 getOne call sites, found %d", n)
	}

	// positive control: the detector must flag a fixture it can see
	fixture := "err := r.db.GetContext(ctx, &m, \"SELECT id FROM t WHERE id=$1\", id)"
	if n := strings.Count(fixture, bare); n != 1 {
		t.Fatalf("detector missed the fixture, found %d", n)
	}
}
