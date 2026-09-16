package repository

import (
	"context"
	"errors"
	"testing"
	"time"

	"github.com/DATA-DOG/go-sqlmock"
	"github.com/jmoiron/sqlx"
)

// These tests exist because the five read methods used to scan their results
// into map[string]interface{}. sqlx treats any non-struct kind as scannable and
// then refuses a multi-column result, so GetGroup, ListGroups, UpdateGroup,
// GetExpression and ListExpressions failed on every call and every condition
// read endpoint returned 500. Each test below registers a multi-column result
// and asserts the fields come back: with the map destination they would fail
// with "scannable dest type map with >1 columns (N) in result" or
// "non-struct dest type map with >1 columns (N)".

func newMockRepo(t *testing.T) (sqlmock.Sqlmock, *Repository) {
	t.Helper()
	db, mock, err := sqlmock.New(sqlmock.QueryMatcherOption(sqlmock.QueryMatcherRegexp))
	if err != nil {
		t.Fatalf("sqlmock: %v", err)
	}
	t.Cleanup(func() { _ = db.Close() })
	return mock, NewRepository(sqlx.NewDb(db, "postgres"))
}

func groupRows(name string) *sqlmock.Rows {
	now := time.Now().UTC()
	return sqlmock.NewRows([]string{
		"id", "tenant_id", "name", "type", "children", "enabled", "description", "created_at", "updated_at",
	}).AddRow("grp-1", "tenant-a", name, "and", "[]", false, "critical", now, now)
}

func exprRows() *sqlmock.Rows {
	return sqlmock.NewRows([]string{
		"id", "group_id", "field", "operator", "value", "value_type", "enabled", "created_at",
	}).AddRow("exp-1", "grp-1", "age", ">", "18", "number", true, time.Now().UTC())
}

func TestGetGroupReturnsMultiColumnRow(t *testing.T) {
	mock, r := newMockRepo(t)
	mock.ExpectQuery(`SELECT \* FROM condition_groups WHERE id`).
		WithArgs("grp-1", "tenant-a").
		WillReturnRows(groupRows("production-outage"))

	g, err := r.GetGroup(context.Background(), "tenant-a", "grp-1")
	if err != nil {
		t.Fatalf("GetGroup: %v", err)
	}
	if g == nil {
		t.Fatal("GetGroup returned a nil group")
	}
	if g.ID != "grp-1" || g.TenantID != "tenant-a" || g.Name != "production-outage" {
		t.Fatalf("identity = %q/%q/%q", g.ID, g.TenantID, g.Name)
	}
	if g.Type != "and" || g.Children != "[]" {
		t.Fatalf("type/children = %q/%q", g.Type, g.Children)
	}
	if g.Enabled {
		t.Fatal("group.Enabled = true, want false from the row")
	}
	if g.Description != "critical" {
		t.Fatalf("group.Description = %q, want the stored value", g.Description)
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatalf("SQL mismatch: %v", err)
	}
}

func TestGetGroupPropagatesNotFound(t *testing.T) {
	mock, r := newMockRepo(t)
	mock.ExpectQuery(`SELECT \* FROM condition_groups WHERE id`).
		WillReturnError(sqlmock.ErrCancelled)

	g, err := r.GetGroup(context.Background(), "tenant-a", "missing")
	if err == nil {
		t.Fatal("expected an error for a missing group")
	}
	if g != nil {
		t.Fatalf("expected a nil group with an error, got %+v", g)
	}
}

func TestListGroupsReturnsMultiColumnRows(t *testing.T) {
	mock, r := newMockRepo(t)
	mock.ExpectQuery(`SELECT \* FROM condition_groups WHERE tenant_id = \$1 ORDER BY`).
		WillReturnRows(groupRows("production-outage"))

	groups, err := r.ListGroups(context.Background(), "tenant-a", "")
	if err != nil {
		t.Fatalf("ListGroups: %v", err)
	}
	if len(groups) != 1 {
		t.Fatalf("len(groups) = %d, want 1", len(groups))
	}
	if groups[0].Name != "production-outage" || groups[0].Description != "critical" {
		t.Fatalf("row fields lost: %q / %q", groups[0].Name, groups[0].Description)
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatalf("SQL mismatch: %v", err)
	}
}

func TestListGroupsAppliesTypeFilter(t *testing.T) {
	mock, r := newMockRepo(t)
	// The type filter must add a second parameter; without it the stored
	// vocabulary could not be used to narrow a list.
	mock.ExpectQuery(`AND type = \$2`).
		WithArgs("tenant-a", "and").
		WillReturnRows(groupRows("production-outage"))

	if _, err := r.ListGroups(context.Background(), "tenant-a", "and"); err != nil {
		t.Fatalf("ListGroups with filter: %v", err)
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatalf("the type filter was not applied: %v", err)
	}
}

func TestListGroupsReturnsEmptySlice(t *testing.T) {
	mock, r := newMockRepo(t)
	mock.ExpectQuery(`SELECT \* FROM condition_groups WHERE tenant_id = \$1 ORDER BY`).
		WillReturnRows(sqlmock.NewRows([]string{
			"id", "tenant_id", "name", "type", "children", "enabled", "description", "created_at", "updated_at",
		}))

	groups, err := r.ListGroups(context.Background(), "tenant-empty", "")
	if err != nil {
		t.Fatalf("ListGroups: %v", err)
	}
	if len(groups) != 0 {
		t.Fatalf("len(groups) = %d, want 0", len(groups))
	}
}

func TestUpdateGroupReturnsUpdatedRow(t *testing.T) {
	mock, r := newMockRepo(t)
	name := "renamed-group"
	mock.ExpectQuery(`UPDATE condition_groups SET name = \$1, updated_at = \$2 WHERE id=\$3 AND tenant_id=\$4 RETURNING \*`).
		WithArgs("renamed-group", sqlmock.AnyArg(), "grp-1", "tenant-a").
		WillReturnRows(groupRows("renamed-group"))

	g, err := r.UpdateGroup(context.Background(), "tenant-a", "grp-1", &name, nil, nil, nil)
	if err != nil {
		t.Fatalf("UpdateGroup: %v", err)
	}
	if g == nil {
		t.Fatal("UpdateGroup returned a nil group")
	}
	if g.ID != "grp-1" || g.Name != "renamed-group" || g.Description != "critical" {
		t.Fatalf("RETURNING row lost fields: %q %q %q", g.ID, g.Name, g.Description)
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatalf("SQL mismatch: %v", err)
	}
}

func TestGetExpressionReturnsMultiColumnRow(t *testing.T) {
	mock, r := newMockRepo(t)
	mock.ExpectQuery(`SELECT e\.\* FROM condition_expressions`).
		WithArgs("exp-1", "tenant-a").
		WillReturnRows(exprRows())

	expr, err := r.GetExpression(context.Background(), "tenant-a", "exp-1")
	if err != nil {
		t.Fatalf("GetExpression: %v", err)
	}
	if expr == nil {
		t.Fatal("GetExpression returned a nil expression")
	}
	if expr.GroupID != "grp-1" || expr.Field != "age" || expr.Value != "18" {
		t.Fatalf("row fields lost: %q %q %q", expr.GroupID, expr.Field, expr.Value)
	}
	if expr.ValueType != "number" {
		t.Fatalf("expr.ValueType = %q, want the stored value_type", expr.ValueType)
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatalf("SQL mismatch: %v", err)
	}
}

func TestGetExpressionScopedToTenant(t *testing.T) {
	mock, r := newMockRepo(t)
	// The join is the tenant boundary: an expression row is only visible when
	// its group belongs to the caller's tenant.
	mock.ExpectQuery(`JOIN condition_groups g ON e\.group_id = g\.id WHERE e\.id=\$1 AND g\.tenant_id=\$2`).
		WithArgs("exp-1", "tenant-a").
		WillReturnRows(exprRows())

	if _, err := r.GetExpression(context.Background(), "tenant-a", "exp-1"); err != nil {
		t.Fatalf("GetExpression: %v", err)
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatalf("tenant scope missing: %v", err)
	}
}

func TestListExpressionsReturnsMultiColumnRows(t *testing.T) {
	mock, r := newMockRepo(t)
	mock.ExpectQuery(`SELECT \* FROM condition_groups WHERE id`).
		WillReturnRows(groupRows("production-outage"))
	mock.ExpectQuery(`SELECT \* FROM condition_expressions WHERE group_id=\$1`).
		WillReturnRows(exprRows())

	exprs, err := r.ListExpressions(context.Background(), "tenant-a", "grp-1")
	if err != nil {
		t.Fatalf("ListExpressions: %v", err)
	}
	if len(exprs) != 1 {
		t.Fatalf("len(exprs) = %d, want 1", len(exprs))
	}
	if exprs[0].Field != "age" || exprs[0].ValueType != "number" {
		t.Fatalf("row fields lost: %q %q", exprs[0].Field, exprs[0].ValueType)
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatalf("SQL mismatch: %v", err)
	}
}

func TestListExpressionsRejectsForeignGroup(t *testing.T) {
	mock, r := newMockRepo(t)
	mock.ExpectQuery(`SELECT \* FROM condition_groups WHERE id`).
		WillReturnError(sqlmock.ErrCancelled)

	exprs, err := r.ListExpressions(context.Background(), "tenant-a", "grp-x")
	if err == nil {
		t.Fatal("expected an error when the group is not accessible")
	}
	if exprs != nil {
		t.Fatalf("expected nil expressions with an error, got %+v", exprs)
	}
	if !errors.Is(err, sqlmock.ErrCancelled) {
		t.Fatalf("the group lookup error was not preserved: %v", err)
	}
}
