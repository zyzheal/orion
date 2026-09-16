package service

import (
	"context"
	"errors"
	"strings"
	"testing"
	"time"

	"orion/platform-svc-go/internal/condition/models"
	"orion/platform-svc-go/internal/condition/repository"

	"github.com/DATA-DOG/go-sqlmock"
	"github.com/jmoiron/sqlx"
	"go.uber.org/zap"
)

func newMockEngine(t *testing.T) (*ConditionEngine, sqlmock.Sqlmock) {
	t.Helper()
	db, mock, err := sqlmock.New(sqlmock.QueryMatcherOption(sqlmock.QueryMatcherRegexp))
	if err != nil {
		t.Fatalf("sqlmock: %v", err)
	}
	t.Cleanup(func() { _ = db.Close() })
	return NewConditionEngine(repository.NewRepository(sqlx.NewDb(db, "postgres")), zap.NewNop()), mock
}

// CreateGroup used to call the repository with enabled=nil and description="",
// so a caller that sent enabled:false and a description got back an enabled
// group with an empty description. Both values were already wired through to the
// INSERT; only the engine discarded them.
func TestCreateGroupForwardsEnabledAndDescription(t *testing.T) {
	e, mock := newMockEngine(t)
	mock.ExpectExec(`INSERT INTO condition_groups`).
		WithArgs(
			sqlmock.AnyArg(), // id, generated
			"tenant-a",
			"production-outage",
			"and",
			`[{"field":"severity","operator":"=","value":"critical"}]`,
			false,
			"blocks deploy when a critical alert is open",
			sqlmock.AnyArg(), // created_at
			sqlmock.AnyArg(), // updated_at
		).
		WillReturnResult(sqlmock.NewResult(1, 1))

	disabled := false
	group, err := e.CreateGroup(context.Background(), "tenant-a", &models.CreateGroupRequest{
		Name:        "production-outage",
		Type:        "and",
		Children:    []map[string]interface{}{{"field": "severity", "operator": "=", "value": "critical"}},
		Description: "blocks deploy when a critical alert is open",
		Enabled:     &disabled,
	})
	if err != nil {
		t.Fatalf("CreateGroup: %v", err)
	}
	if group == nil {
		t.Fatal("CreateGroup returned a nil group")
	}
	if group.Enabled {
		t.Fatal("group.Enabled = true, want false: the caller sent enabled:false")
	}
	if group.Description != "blocks deploy when a critical alert is open" {
		t.Fatalf("group.Description = %q", group.Description)
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatalf("the enabled flag or description never reached the INSERT: %v", err)
	}
}

// An omitted enabled/description must preserve the pre-existing defaults: the
// repository treats a nil enabled pointer as true and stores the empty
// description.
func TestCreateGroupDefaultsEnabled(t *testing.T) {
	e, mock := newMockEngine(t)
	mock.ExpectExec(`INSERT INTO condition_groups`).
		WithArgs(sqlmock.AnyArg(), "tenant-a", "warn-group", "or", "null", true, "",
			sqlmock.AnyArg(), sqlmock.AnyArg()).
		WillReturnResult(sqlmock.NewResult(1, 1))

	group, err := e.CreateGroup(context.Background(), "tenant-a",
		&models.CreateGroupRequest{Name: "warn-group", Type: "or"})
	if err != nil {
		t.Fatalf("CreateGroup: %v", err)
	}
	if !group.Enabled {
		t.Fatal("group.Enabled = false, want the default true for an omitted field")
	}
	if group.Description != "" {
		t.Fatalf("group.Description = %q, want empty", group.Description)
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatalf("unexpected SQL: %v", err)
	}
}

// value_type selects the numeric and boolean branches of normalizeValue, so the
// old hardcoded "string" turned every declared number or boolean comparison into
// a string comparison. enabled was hardcoded the same way.
func TestCreateExpressionForwardsValueTypeAndEnabled(t *testing.T) {
	e, mock := newMockEngine(t)
	mock.ExpectQuery(`SELECT \* FROM condition_groups`).
		WillReturnRows(groupRows("grp-1", "tenant-a"))
	mock.ExpectExec(`INSERT INTO condition_expressions`).
		WithArgs(
			sqlmock.AnyArg(), // id, generated
			"grp-1",
			"age",
			">",
			"18",
			"number",
			false,
			sqlmock.AnyArg(), // created_at
		).
		WillReturnResult(sqlmock.NewResult(1, 1))

	disabled := false
	expr, err := e.CreateExpression(context.Background(), "tenant-a", "grp-1", &models.CreateExpressionRequest{
		Field:     "age",
		Operator:  ">",
		Value:     "18",
		ValueType: "Number",
		Enabled:   &disabled,
	})
	if err != nil {
		t.Fatalf("CreateExpression: %v", err)
	}
	if expr == nil {
		t.Fatal("CreateExpression returned a nil expression")
	}
	if expr.ValueType != "number" {
		t.Fatalf("expr.ValueType = %q, want the lowercased caller value", expr.ValueType)
	}
	if expr.Enabled {
		t.Fatal("expr.Enabled = true, want false: the caller sent enabled:false")
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatalf("value_type or enabled never reached the INSERT: %v", err)
	}
}

// Omitted value_type must keep today's behaviour so callers that never send it
// are unaffected.
func TestCreateExpressionDefaultsValueTypeToString(t *testing.T) {
	e, mock := newMockEngine(t)
	mock.ExpectQuery(`SELECT \* FROM condition_groups`).
		WillReturnRows(groupRows("grp-1", "tenant-a"))
	mock.ExpectExec(`INSERT INTO condition_expressions`).
		WithArgs(sqlmock.AnyArg(), "grp-1", "name", "=", "admin", "string", true, sqlmock.AnyArg()).
		WillReturnResult(sqlmock.NewResult(1, 1))

	expr, err := e.CreateExpression(context.Background(), "tenant-a", "grp-1",
		&models.CreateExpressionRequest{Field: "name", Operator: "=", Value: "admin"})
	if err != nil {
		t.Fatalf("CreateExpression: %v", err)
	}
	if expr.ValueType != "string" {
		t.Fatalf("expr.ValueType = %q, want the default string", expr.ValueType)
	}
	if !expr.Enabled {
		t.Fatal("expr.Enabled = false, want the default true")
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatalf("unexpected SQL: %v", err)
	}
}

// A value_type outside the documented vocabulary must be rejected rather than
// stored: normalizeValue only recognises number and boolean, so anything else
// would be silently evaluated as a string comparison.
func TestCreateExpressionRejectsUnknownValueType(t *testing.T) {
	e, mock := newMockEngine(t)

	expr, err := e.CreateExpression(context.Background(), "tenant-a", "grp-1",
		&models.CreateExpressionRequest{Field: "age", Operator: ">", Value: "18", ValueType: "banana"})

	if err == nil {
		t.Fatal("expected an error for an unknown value_type")
	}
	if expr != nil {
		t.Fatalf("expected a nil expression with an error, got %+v", expr)
	}
	if !errors.Is(err, ErrInvalidValueType) {
		t.Fatalf("err = %v, want ErrInvalidValueType", err)
	}
	if !strings.Contains(err.Error(), "banana") {
		t.Fatalf("err = %q, want it to name the rejected value", err.Error())
	}
	// Rejected before any SQL, so no group lookup and no insert were issued.
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatalf("validation must happen before storage: %v", err)
	}
}

func TestCreateExpressionRejectsInvalidOperatorBeforeStorage(t *testing.T) {
	e, mock := newMockEngine(t)

	expr, err := e.CreateExpression(context.Background(), "tenant-a", "grp-1",
		&models.CreateExpressionRequest{Field: "age", Operator: "~~", Value: "1"})

	if err == nil {
		t.Fatal("expected an error for an unknown operator")
	}
	if expr != nil {
		t.Fatalf("expected a nil expression, got %+v", expr)
	}
	if !errors.Is(err, ErrInvalidOperator) {
		t.Fatalf("err = %v, want ErrInvalidOperator", err)
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatalf("operator validation must happen before storage: %v", err)
	}
}

func TestValidateValueType(t *testing.T) {
	for _, ok := range []string{"string", "number", "boolean", "array", "object"} {
		if err := validateValueType(ok); err != nil {
			t.Fatalf("validateValueType(%q) = %v, want nil", ok, err)
		}
	}
	for _, bad := range []string{"", "banana", "NUMBER", "Number ", "float"} {
		if err := validateValueType(bad); err == nil {
			t.Fatalf("validateValueType(%q) = nil, want an error", bad)
		}
	}
}

// groupRows is the shape of a real condition_groups row. The timestamps must be
// actual time.Time values: created_at and updated_at are written by every
// writer, so the struct scan must not be exercised with NULLs that production
// cannot produce.
func groupRows(id, tenantID string) *sqlmock.Rows {
	now := time.Now().UTC()
	return sqlmock.NewRows([]string{
		"id", "tenant_id", "name", "type", "children", "enabled", "description", "created_at", "updated_at",
	}).AddRow(id, tenantID, "grp", "and", "[]", true, "", now, now)
}
