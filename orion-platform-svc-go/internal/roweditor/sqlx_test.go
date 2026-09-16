package roweditor

import (
	"context"
	"errors"
	"strings"
	"testing"

	"github.com/DATA-DOG/go-sqlmock"
	"github.com/jmoiron/sqlx"
)

// newMockDriverEditor wires Read to a real sqlx connection over sqlmock. The
// strictDB doubles in this package decide the destination themselves, so they
// cannot express a destination that the real driver refuses. This one does:
// DBFromGoCommon is the same adapter the server constructs, and it has to run
// against a connection that behaves like lib/pq.
func newMockDriverEditor(t *testing.T) (*RowEditor, *DBFromGoCommon, sqlmock.Sqlmock) {
	t.Helper()
	db, mock, err := sqlmock.New(sqlmock.QueryMatcherOption(sqlmock.QueryMatcherRegexp))
	if err != nil {
		t.Fatalf("sqlmock: %v", err)
	}
	t.Cleanup(func() { _ = db.Close() })
	return mustEditor(t, simpleSpec()), NewDBFromGoCommon(sqlx.NewDb(db, "postgres")), mock
}

// A SELECT * row must come back keyed by column name, with every column the
// driver reports present. lib/pq decodes character columns to []byte, so those
// must be converted to string: left as []byte, encoding/json base64s them and
// the row endpoint answers with unreadable values.
func TestReadScansEveryColumnFromTheDriver(t *testing.T) {
	ed, dbOps, mock := newMockDriverEditor(t)
	mock.ExpectQuery(`SELECT \* FROM items`).
		WillReturnRows(sqlmock.NewRows([]string{"id", "name", "version", "flag", "tags"}).
			AddRow("r1", []byte("hello"), 3, true, nil))

	row, err := ed.Read(context.Background(), dbOps, "", "r1")
	if err != nil {
		t.Fatalf("Read() error = %v", err)
	}
	if row == nil {
		t.Fatal("Read returned a nil row without an error")
	}
	if got := (*row)["id"]; got != "r1" {
		t.Fatalf("id = %v (type %T)", got, got)
	}
	if got := (*row)["name"]; got != "hello" {
		t.Fatalf("name = %v (type %T), want the string the driver returned", got, got)
	}
	if got := (*row)["version"]; got != int64(3) {
		t.Fatalf("version = %v (type %T)", got, got)
	}
	if got := (*row)["flag"]; got != true {
		t.Fatalf("flag = %v (type %T)", got, got)
	}
	// A NULL column has to survive as nil: SELECT * returns whatever the table
	// holds, including empty columns.
	if got := (*row)["tags"]; got != nil {
		t.Fatalf("tags = %v (type %T), want nil for a NULL column", got, got)
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatalf("unexpected SQL: %v", err)
	}
}

// A statement that matches no row is "row not found", not an empty row. An
// empty row with a nil error would have answered the endpoint 200 with no data.
func TestReadReturnsErrRowNotFoundWhenNoRowMatches(t *testing.T) {
	ed, dbOps, mock := newMockDriverEditor(t)
	mock.ExpectQuery(`SELECT \* FROM items`).
		WillReturnRows(sqlmock.NewRows([]string{"id", "name", "version"}))

	row, err := ed.Read(context.Background(), dbOps, "", "missing")
	if err == nil {
		t.Fatal("Read() returned no error for a row that does not exist")
	}
	if row != nil {
		t.Fatalf("Read returned %+v with an error", *row)
	}
	if !errors.Is(err, ErrRowNotFound) {
		t.Fatalf("err = %v, want ErrRowNotFound", err)
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatalf("unexpected SQL: %v", err)
	}
}

// A driver failure is not a missing row. Mapping it to ErrRowNotFound would have
// the handler answer 404 for a broken database.
func TestReadWrapsQueryFailureWithoutMappingToNotFound(t *testing.T) {
	ed, dbOps, mock := newMockDriverEditor(t)
	mock.ExpectQuery(`SELECT \* FROM items`).WillReturnError(sqlmock.ErrCancelled)

	row, err := ed.Read(context.Background(), dbOps, "", "r1")
	if err == nil {
		t.Fatal("Read() returned no error for a failed query")
	}
	if row != nil {
		t.Fatalf("Read returned %+v with an error", *row)
	}
	if errors.Is(err, ErrRowNotFound) {
		t.Fatalf("a driver failure was reported as a missing row: %v", err)
	}
	if !strings.Contains(err.Error(), "roweditor read:") {
		t.Fatalf("err = %q, want the roweditor read context", err.Error())
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatalf("unexpected SQL: %v", err)
	}
}
