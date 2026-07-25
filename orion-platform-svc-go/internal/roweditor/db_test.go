package roweditor

import (
	"context"
	"database/sql"
	"errors"
	"sync"
	"testing"

	"github.com/jmoiron/sqlx"
)

// mockDB implements DBOperations for testing row operations.
type mockDB struct {
	mu sync.Mutex

	// rows simulates a simple in-memory table: pk -> map[string]any
	rows map[string]map[string]any

	// autoVersion: if true, bump a "version" column on every update
	autoVersion bool

	// lastSQL stores the last query string for assertion
	lastSQL string
	lastArgs []any

	// errToReturn is returned by the next DB call
	errToReturn error

	// lastResult captures the last result's RowsAffected
	rowsAffected int64
}

func newMockDB() *mockDB {
	return &mockDB{rows: map[string]map[string]any{}}
}

func (m *mockDB) insert(row map[string]any) {
	m.mu.Lock()
	defer m.mu.Unlock()
	pk := row["id"].(string)
	m.rows[pk] = row
}

func (m *mockDB) ExecContext(ctx context.Context, query string, args ...any) (sql.Result, error) {
	m.mu.Lock()
	defer m.mu.Unlock()

	m.lastSQL = query
	m.lastArgs = args

	if m.errToReturn != nil {
		err := m.errToReturn
		m.errToReturn = nil
		return nil, err
	}

	// Parse the WHERE id=... to find which row we're touching.
	// We keep it simple: extract the first $1 value as the row ID.
	rowID := args[0].(string)

	// Detect whether this is an UPDATE or a DELETE.
	lower := query
	// For our purposes just count: if "SET" is present it's an update.
	if contains(lower, "SET") {
		if m.rows[rowID] == nil {
			m.rowsAffected = 0
			return &mockResult{}, nil
		}
		m.rowsAffected = 1
		// Update: apply the SET columns from args[1..N] (before the where).
		// Our SetClause builder uses positional $N for columns.
		// For mock purposes we just record it.
		if m.autoVersion && m.rows[rowID] != nil {
			if v, ok := m.rows[rowID]["version"]; ok {
				m.rows[rowID]["version"] = v.(int) + 1
			}
		}
		return &mockResult{}, nil
	}
	// DELETE
	if m.rows[rowID] == nil {
		m.rowsAffected = 0
		return &mockResult{}, nil
	}
	delete(m.rows, rowID)
	m.rowsAffected = 1
	return &mockResult{}, nil
}

func (m *mockDB) GetContext(ctx context.Context, dest any, query string, args ...any) error {
	m.mu.Lock()
	defer m.mu.Unlock()

	m.lastSQL = query
	m.lastArgs = args

	if m.errToReturn != nil {
		err := m.errToReturn
		m.errToReturn = nil
		return err
	}

	// dest is *Row (a *map[string]any)
	ptr, ok := dest.(*Row)
	if !ok {
		ptr, ok = dest.(*map[string]any)
		if !ok {
			return errors.New("mock: dest must be *Row or *map[string]any")
		}
	}

	rowID := args[0].(string)
	if r, ok := m.rows[rowID]; ok {
		*ptr = r
		return nil
	}
	return sql.ErrNoRows
}

func (m *mockDB) SelectContext(ctx context.Context, dest any, query string, args ...any) error {
	m.mu.Lock()
	defer m.mu.Unlock()

	m.lastSQL = query
	m.lastArgs = args

	if m.errToReturn != nil {
		err := m.errToReturn
		m.errToReturn = nil
		return err
	}
	// Not used in current operations, so just return no rows.
	return nil
}

func (m *mockDB) NamedExecContext(ctx context.Context, query string, arg any) (sql.Result, error) {
	m.mu.Lock()
	defer m.mu.Unlock()

	m.lastSQL = query
	m.lastArgs = nil

	if m.errToReturn != nil {
		err := m.errToReturn
		m.errToReturn = nil
		return nil, err
	}

	// For INSERT: parse the struct/map and create a row.
	if m.autoVersion {
		// Ensure version field exists.
		if argMap, ok := arg.(map[string]any); ok {
			if _, ok := argMap["version"]; !ok {
				argMap["version"] = 1
			}
		}
	}
	// Store the inserted row for later reads.
	if row, ok := arg.(map[string]any); ok {
		pk := row["id"].(string)
		m.rows[pk] = row
		m.rowsAffected = 1
		return &mockResult{}, nil
	}
	m.rowsAffected = 1
	return &mockResult{}, nil
}

func (m *mockDB) BeginTxx(ctx context.Context, cfg *sql.TxOptions) (*sqlx.Tx, error) {
	if m.errToReturn != nil {
		err := m.errToReturn
		m.errToReturn = nil
		return nil, err
	}
	return nil, nil // Batch operations are not fully mocked here
}

func (m *mockDB) Clear() {
	m.mu.Lock()
	defer m.mu.Unlock()
	m.lastSQL = ""
	m.lastArgs = nil
	m.rowsAffected = 0
}

type mockResult struct {
	rowsAffected int64
}

func (r *mockResult) LastInsertId() (int64, error) {
	return 0, sql.ErrNoRows
}

func (r *mockResult) RowsAffected() (int64, error) {
	return r.rowsAffected, nil
}

func contains(s, substr string) bool {
	return len(s) >= len(substr) && findSubstring(s, substr)
}

func findSubstring(s, substr string) bool {
	for i := 0; i <= len(s)-len(substr); i++ {
		if s[i:i+len(substr)] == substr {
			return true
		}
	}
	return false
}

func TestCreate(t *testing.T) {
	db := newMockDB()
	db.autoVersion = true

	spec := RowSpec{
		TableName:  "items",
		PrimaryKey: "id",
		Columns: []ColumnSpec{
			{Name: "id", Type: "uuid"},
			{Name: "name", Type: "varchar"},
			{Name: "version", Type: "int"},
		},
	}
	editor, err := NewRowEditor(spec)
	if err != nil {
		t.Fatal(err)
	}

	row := Row{
		"id":    "r1",
		"name":  "item1",
		"tenant_id": "t1",
	}

	created, err := editor.Create(context.Background(), db, "t1", row)
	if err != nil {
		t.Fatalf("Create() error = %v", err)
	}
	if created == nil {
		t.Fatal("Create() returned nil row")
	}
	if (*created)["name"] != "item1" {
		t.Fatalf("Create() row.name = %v, want item1", (*created)["name"])
	}
}

func TestRead(t *testing.T) {
	db := newMockDB()
	db.insert(map[string]any{
		"id":   "r1",
		"name": "hello",
	})

	spec := RowSpec{
		TableName:  "items",
		PrimaryKey: "id",
		Columns:    []ColumnSpec{{Name: "name"}},
	}
	editor, err := NewRowEditor(spec)
	if err != nil {
		t.Fatal(err)
	}

	row, err := editor.Read(context.Background(), db, "t1", "r1")
	if err != nil {
		t.Fatalf("Read() error = %v", err)
	}
	if row == nil {
		t.Fatal("Read() returned nil")
	}
	if (*row)["name"] != "hello" {
		t.Fatalf("Read() name = %v, want hello", (*row)["name"])
	}
}

func TestReadNotFound(t *testing.T) {
	db := newMockDB()

	spec := RowSpec{
		TableName:  "items",
		PrimaryKey: "id",
		Columns:    []ColumnSpec{{Name: "name"}},
	}
	editor, err := NewRowEditor(spec)
	if err != nil {
		t.Fatal(err)
	}

	_, err = editor.Read(context.Background(), db, "t1", "missing")
	if !errors.Is(err, ErrRowNotFound) {
		t.Fatalf("Read() error = %v, want ErrRowNotFound", err)
	}
}

func TestValidateIdentifiersWithMsg(t *testing.T) {
	err := validateIdentifiersWithMsg("test", []string{"bad;drop"})
	if err == nil {
		t.Fatal("validateIdentifiersWithMsg() should return error for invalid identifier")
	}
	err = validateIdentifiersWithMsg("test", []string{"good_col"})
	if err != nil {
		t.Fatalf("validateIdentifiersWithMsg() error = %v", err)
	}
}
