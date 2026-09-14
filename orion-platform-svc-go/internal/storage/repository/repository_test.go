package repository

import (
	"context"
	"errors"
	"fmt"
	"regexp"
	"strings"
	"testing"
	"time"

	"orion/go-common/pkg/sentinel"

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

func updatedRow() *sqlmock.Rows {
	now := time.Date(2026, 9, 14, 10, 0, 0, 0, time.UTC)
	return sqlmock.NewRows([]string{
		"id", "tenant_id", "bucket", "key", "size", "provider", "created_at", "updated_at",
	}).AddRow("e-1", "t-1", "b2", "k2", int64(1024), "s3", now, now)
}

func TestUpdateRendersSortedSetClauseScopedToTheTenant(t *testing.T) {
	for i := 0; i < 40; i++ {
		db, mock := mockDB(t)
		mock.ExpectExec(normSQL("UPDATE storage_entries SET bucket=$1, key=$2, size=$3, updated_at=$4 WHERE id=$5 AND tenant_id=$6")).
			WithArgs("b2", "k2", int64(1024), sqlmock.AnyArg(), "e-1", "t-1").
			WillReturnResult(sqlmock.NewResult(0, 1))
		mock.ExpectQuery(normSQL("SELECT * FROM storage_entries WHERE id=$1 AND tenant_id=$2")).
			WithArgs("e-1", "t-1").
			WillReturnRows(updatedRow())

		entry, err := NewRepository(db).Update(context.Background(), "e-1", "t-1", map[string]interface{}{
			"bucket": "b2",
			"key":    "k2",
			"size":   int64(1024),
		})
		if err != nil {
			t.Fatalf("iteration %d: Update returned %v", i, err)
		}
		if entry.ID != "e-1" || entry.Bucket != "b2" || entry.Key != "k2" || entry.Size != 1024 {
			t.Fatalf("iteration %d: Update returned %v, want the updated row", i, entry)
		}
		if err := mock.ExpectationsWereMet(); err != nil {
			t.Fatalf("iteration %d: %v", i, err)
		}
	}
}

func TestUpdateDoesNotMutateTheCallerMap(t *testing.T) {
	db, mock := mockDB(t)
	mock.ExpectExec(normSQL("UPDATE storage_entries SET bucket=$1, key=$2, updated_at=$3 WHERE id=$4 AND tenant_id=$5")).
		WithArgs("b2", "k2", sqlmock.AnyArg(), "e-1", "t-1").
		WillReturnResult(sqlmock.NewResult(0, 1))
	mock.ExpectQuery(normSQL("SELECT * FROM storage_entries WHERE id=$1 AND tenant_id=$2")).
		WillReturnRows(updatedRow())

	attrs := map[string]interface{}{"bucket": "b2", "key": "k2"}
	if _, err := NewRepository(db).Update(context.Background(), "e-1", "t-1", attrs); err != nil {
		t.Fatalf("Update returned %v", err)
	}
	if _, ok := attrs["updated_at"]; ok {
		t.Fatalf("Update stamped updated_at into the caller's map: %v", attrs)
	}
	if attrs["bucket"] != "b2" || attrs["key"] != "k2" {
		t.Fatalf("Update changed the caller's values: %v", attrs)
	}
	if len(attrs) != 2 {
		t.Fatalf("Update changed the caller's key count: got %d want 2", len(attrs))
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatalf("%v", err)
	}
}

func TestUpdateRejectsAColumnOutsideTheWhitelist(t *testing.T) {
	db, mock := mockDB(t)
	for _, tc := range []struct {
		column string
		value  interface{}
	}{
		{column: "id", value: "v-1"},
		{column: "tenant_id", value: "t-9"},
		{column: "created_at", value: time.Now()},
		{column: "ke", value: "b2"},
		{column: "password", value: "p"},
	} {
		attrs := map[string]interface{}{tc.column: tc.value}
		_, err := NewRepository(db).Update(context.Background(), "e-1", "t-1", attrs)
		if err == nil {
			t.Fatalf("column %q: Update returned nil, want sentinel.BadRequest", tc.column)
		}
		if !errors.Is(err, sentinel.BadRequest) {
			t.Fatalf("column %q: error = %v, want sentinel.BadRequest", tc.column, err)
		}
		if !strings.Contains(err.Error(), tc.column) {
			t.Fatalf("column %q: error %q does not name the column", tc.column, err)
		}
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatalf("a rejected column still wrote: %v", err)
	}
}

func TestUpdateRejectsAnEmptyMap(t *testing.T) {
	db, mock := mockDB(t)
	_, err := NewRepository(db).Update(context.Background(), "e-1", "t-1", nil)
	if err == nil {
		t.Fatalf("Update(nil) returned nil, want sentinel.BadRequest")
	}
	if !errors.Is(err, sentinel.BadRequest) {
		t.Fatalf("error = %v, want sentinel.BadRequest: nothing to write is a caller bug, not a missing row", err)
	}
	if errors.Is(err, sentinel.NotFound) {
		t.Fatalf("an empty update was mislabelled as a missing entry: %v", err)
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatalf("an empty update still wrote: %v", err)
	}
}

func TestUpdateReportsAMissingRowAsNotFound(t *testing.T) {
	db, mock := mockDB(t)
	mock.ExpectExec(normSQL("UPDATE storage_entries SET key=$1, updated_at=$2 WHERE id=$3 AND tenant_id=$4")).
		WillReturnResult(sqlmock.NewResult(0, 0))

	_, err := NewRepository(db).Update(context.Background(), "e-1", "t-1", map[string]interface{}{"key": "k2"})
	if !errors.Is(err, sentinel.NotFound) {
		t.Fatalf("error = %v, want sentinel.NotFound", err)
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatalf("a missing row still triggered the reload: %v", err)
	}
}

func TestUpdatePropagatesAnExecError(t *testing.T) {
	db, mock := mockDB(t)
	mock.ExpectExec(normSQL("UPDATE storage_entries SET key=$1, updated_at=$2 WHERE id=$3 AND tenant_id=$4")).
		WillReturnError(errors.New("connection refused"))

	_, err := NewRepository(db).Update(context.Background(), "e-1", "t-1", map[string]interface{}{"key": "k2"})
	if err == nil || !strings.Contains(err.Error(), "connection refused") {
		t.Fatalf("error = %v, want the exec error to be reported", err)
	}
	if errors.Is(err, sentinel.NotFound) {
		t.Fatalf("an exec error was collapsed into sentinel.NotFound: %v", err)
	}
}
