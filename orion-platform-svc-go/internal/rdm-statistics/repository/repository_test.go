package repository

import (
	"context"
	"database/sql/driver"
	"encoding/json"
	"reflect"
	"testing"

	"github.com/DATA-DOG/go-sqlmock"
	"github.com/jmoiron/sqlx"

	baserepo "orion/platform-svc-go/internal/repository"
)

type jsonConverter struct{}

func (jsonConverter) ConvertValue(v interface{}) (driver.Value, error) {
	switch v.(type) {
	case map[string]interface{}, []interface{}, []string, []int:
		b, err := json.Marshal(v)
		if err != nil {
			return nil, err
		}
		return string(b), nil
	}
	if reflect.TypeOf(v).Kind() == reflect.Slice {
		b, err := json.Marshal(v)
		if err != nil {
			return nil, err
		}
		return string(b), nil
	}
	return driver.DefaultParameterConverter.ConvertValue(v)
}

func newMockDB(t *testing.T) (*sqlx.DB, sqlmock.Sqlmock) {
	t.Helper()
	db, mock, err := sqlmock.New(
		sqlmock.QueryMatcherOption(sqlmock.QueryMatcherRegexp),
		sqlmock.ValueConverterOption(jsonConverter{}),
	)
	if err != nil {
		t.Fatalf("sqlmock: %v", err)
	}
	t.Cleanup(func() { _ = db.Close() })
	mock.MatchExpectationsInOrder(false)
	return sqlx.NewDb(db, "postgres"), mock
}

func ctxTenant(tenantID string) context.Context {
	return baserepo.WithTenant(context.Background(), tenantID)
}

func TestGetBurndown_ExecutesQuery(t *testing.T) {
	db, mock := newMockDB(t)
	repo := NewRepository(db)
	mock.ExpectQuery(`SELECT.*FROM rdm_requirements`).WillReturnRows(
		sqlmock.NewRows([]string{"total_points", "completed_points", "sprint_start"}).
			AddRow(20, 10, "2026-01-01"))

	result, err := repo.GetBurndown(ctxTenant("t1"), "t1", "sprint-1")
	if err != nil {
		t.Fatalf("GetBurndown: %v", err)
	}
	if len(result) == 0 {
		t.Fatal("expected at least 1 point")
	}
}

func TestGetVelocity_ExecutesQuery(t *testing.T) {
	db, mock := newMockDB(t)
	repo := NewRepository(db)
	mock.ExpectQuery(`SELECT.*FROM rdm_requirements`).WillReturnRows(
		sqlmock.NewRows([]string{"sprint", "completed_points"}).
			AddRow("s1", 30))

	result, err := repo.GetVelocity(ctxTenant("t1"), "t1", "proj-1", 10)
	if err != nil {
		t.Fatalf("GetVelocity: %v", err)
	}
	if len(result) != 1 {
		t.Fatalf("expected 1 point, got %d", len(result))
	}
	if result[0].Sprint != "s1" {
		t.Errorf("expected sprint 's1', got %q", result[0].Sprint)
	}
	if result[0].CompletedPoints != 30 {
		t.Errorf("expected 30 points, got %d", result[0].CompletedPoints)
	}
}

func TestGetDefectStats_ExecutesQuery(t *testing.T) {
	db, mock := newMockDB(t)
	repo := NewRepository(db)
	mock.ExpectQuery(`SELECT.*FROM rdm_requirements.*WHERE.*type.*bug.*GROUP BY.*severity`).
		WillReturnRows(sqlmock.NewRows([]string{"severity", "count"}).
			AddRow("critical", 3))
	mock.ExpectQuery(`SELECT.*FROM rdm_requirements.*WHERE.*type.*bug.*GROUP BY.*status`).
		WillReturnRows(sqlmock.NewRows([]string{"status", "count"}).
			AddRow("open", 5))

	result, err := repo.GetDefectStats(ctxTenant("t1"), "t1", "proj-1")
	if err != nil {
		t.Fatalf("GetDefectStats: %v", err)
	}
	if result == nil {
		t.Fatal("expected non-nil result")
	}
}

func TestGetSprintStats_ExecutesQuery(t *testing.T) {
	db, mock := newMockDB(t)
	repo := NewRepository(db)
	mock.ExpectQuery(`SELECT.*FROM rdm_requirements.*GROUP BY`).WillReturnRows(
		sqlmock.NewRows([]string{"sprint_id", "sprint_name", "total_tasks", "completed_tasks", "total_points", "completed_points"}).
			AddRow("s1", "Sprint 1", 10, 8, 30, 24))

	result, err := repo.GetSprintStats(ctxTenant("t1"), "t1", "proj-1")
	if err != nil {
		t.Fatalf("GetSprintStats: %v", err)
	}
	if len(result) != 1 {
		t.Fatalf("expected 1 sprint, got %d", len(result))
	}
	if result[0].SprintID != "s1" {
		t.Errorf("expected sprint ID 's1', got %q", result[0].SprintID)
	}
	if result[0].CompletedPoints != 24 {
		t.Errorf("expected 24 completed points, got %d", result[0].CompletedPoints)
	}
}

func TestGetBurndown_MissingTenant(t *testing.T) {
	db, _ := newMockDB(t)
	repo := NewRepository(db)

	_, err := repo.GetBurndown(context.Background(), "t1", "sprint-1")
	if err == nil {
		t.Fatal("expected error for missing tenant context")
	}
}
