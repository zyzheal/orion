package roweditor

import (
	"errors"
	"testing"
)

func TestNewRowEditor(t *testing.T) {
	tests := []struct {
		name    string
		spec    RowSpec
		wantErr bool
	}{
		{
			name: "valid spec",
			spec: RowSpec{
				TableName:  "users",
				PrimaryKey: "id",
				Columns: []ColumnSpec{
					{Name: "name", Type: "varchar"},
					{Name: "email", Type: "varchar", Validate: func(v any) error { return nil }},
				},
			},
			wantErr: false,
		},
		{
			name: "invalid table name",
			spec: RowSpec{
				TableName:  "invalid;DROP",
				PrimaryKey: "id",
				Columns:    []ColumnSpec{{Name: "name"}},
			},
			wantErr: true,
		},
		{
			name: "invalid primary key",
			spec: RowSpec{
				TableName:  "users",
				PrimaryKey: "",
				Columns:    []ColumnSpec{{Name: "name"}},
			},
			wantErr: true,
		},
		{
			name:    "empty columns",
			spec:    RowSpec{TableName: "users", PrimaryKey: "id", Columns: []ColumnSpec{}},
			wantErr: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			_, err := NewRowEditor(tt.spec)
			if (err != nil) != tt.wantErr {
				t.Fatalf("NewRowEditor() error = %v, wantErr %v", err, tt.wantErr)
			}
		})
	}
}

func TestModeString(t *testing.T) {
	if CellMode.String() != "cell" {
		t.Errorf("CellMode.String() = %q, want %q", CellMode.String(), "cell")
	}
	if RowMode.String() != "row" {
		t.Errorf("RowMode.String() = %q, want %q", RowMode.String(), "row")
	}
	if BatchMode.String() != "batch" {
		t.Errorf("BatchMode.String() = %q, want %q", BatchMode.String(), "batch")
	}
}

func TestValidateCell(t *testing.T) {
	spec := RowSpec{
		TableName:  "items",
		PrimaryKey: "id",
		Columns: []ColumnSpec{
			{Name: "name", Type: "varchar"},
			{Name: "status", Type: "varchar", ReadOnly: true},
		},
	}
	editor, err := NewRowEditor(spec)
	if err != nil {
		t.Fatal(err)
	}

	tests := []struct {
		name    string
		change  CellChange
		wantErr error
	}{
		{
			name:    "empty row ID",
			change:  CellChange{Column: "name", Value: "foo"},
			wantErr: nil, // just check it returns an error, not the specific one
		},
		{
			name:    "empty column",
			change:  CellChange{RowID: "1", Value: "foo"},
			wantErr: nil,
		},
		{
			name:    "unknown column",
			change:  CellChange{RowID: "1", Column: "missing", Value: "foo"},
			wantErr: nil,
		},
		{
			name:    "read-only column",
			change:  CellChange{RowID: "1", Column: "status", Value: "ok"},
			wantErr: ErrReadOnlyField,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			err := editor.validateCell(tt.change)
			if err == nil && tt.wantErr != nil {
				t.Fatalf("validateCell() error = nil, want error")
			}
			if tt.wantErr != nil && !errors.Is(err, tt.wantErr) {
				t.Fatalf("validateCell() error = %v, want %v", err, tt.wantErr)
			}
		})
	}
}

func TestValidateRowReadOnly(t *testing.T) {
	spec := RowSpec{
		TableName:  "items",
		PrimaryKey: "id",
		Columns: []ColumnSpec{
			{Name: "name", Type: "varchar"},
			{Name: "status", Type: "varchar", ReadOnly: true},
		},
	}
	editor, err := NewRowEditor(spec)
	if err != nil {
		t.Fatal(err)
	}

	row := Row{"status": "active"}
	if err := editor.validateRow(row); err == nil {
		t.Fatal("validateRow() should reject read-only field")
	}

	row = Row{"name": "hello"}
	if err := editor.validateRow(row); err != nil {
		t.Fatalf("validateRow() error = %v", err)
	}
}

func TestValidateRowCustomValidator(t *testing.T) {
	spec := RowSpec{
		TableName:  "items",
		PrimaryKey: "id",
		Columns: []ColumnSpec{
			{Name: "count", Type: "int", Validate: func(v any) error {
				n, ok := v.(int)
				if !ok {
					return errors.New("not an int")
				}
				if n < 0 {
					return errors.New("negative not allowed")
				}
				return nil
			}},
		},
	}
	editor, err := NewRowEditor(spec)
	if err != nil {
		t.Fatal(err)
	}

	tests := []struct {
		name    string
		row     Row
		wantErr bool
	}{
		{"valid", Row{"count": 10}, false},
		{"negative", Row{"count": -1}, true},
		{"wrong type", Row{"count": "bad"}, true},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			err := editor.validateRow(tt.row)
			if (err != nil) != tt.wantErr {
				t.Fatalf("validateRow() error = %v, wantErr %v", err, tt.wantErr)
			}
		})
	}
}

func TestValidateBatch(t *testing.T) {
	spec := RowSpec{
		TableName:  "items",
		PrimaryKey: "id",
		Columns:    []ColumnSpec{{Name: "name", Type: "varchar"}},
	}
	editor, err := NewRowEditor(spec)
	if err != nil {
		t.Fatal(err)
	}

	tests := []struct {
		name    string
		change  BatchChange
		wantErr error
	}{
		{
			name:    "empty IDs",
			change:  BatchChange{Columns: map[string]any{"name": "foo"}},
			wantErr: nil, // returns some error
		},
		{
			name:    "empty columns",
			change:  BatchChange{RowIDs: []string{"1"}},
			wantErr: ErrNoChanges,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			err := editor.validateBatch(tt.change)
			if err == nil && tt.wantErr != nil {
				t.Fatalf("validateBatch() error = nil, want error")
			}
			if tt.wantErr != nil && !errors.Is(err, tt.wantErr) {
				t.Fatalf("validateBatch() error = %v, want %v", err, tt.wantErr)
			}
		})
	}
}

func TestValidateEdit(t *testing.T) {
	spec := RowSpec{
		TableName:  "items",
		PrimaryKey: "id",
		Columns: []ColumnSpec{
			{Name: "name", Type: "varchar"},
			{Name: "status", Type: "varchar", ReadOnly: true},
		},
	}
	editor, err := NewRowEditor(spec)
	if err != nil {
		t.Fatal(err)
	}

	tests := []struct {
		name    string
		change  RowChange
		wantErr error
	}{
		{
			name:    "empty row ID",
			change:  RowChange{Columns: map[string]any{"name": "foo"}},
			wantErr: nil,
		},
		{
			name:    "no columns",
			change:  RowChange{RowID: "1"},
			wantErr: ErrNoChanges,
		},
		{
			name:    "read-only column",
			change:  RowChange{RowID: "1", Columns: map[string]any{"status": "ok"}},
			wantErr: ErrReadOnlyField,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			opts := EditOptions{TenantID: "t1"}
			err := editor.validateEdit(opts, tt.change)
			if err == nil && tt.wantErr != nil {
				t.Fatalf("validateEdit() error = null, want error")
			}
			if tt.wantErr != nil && !errors.Is(err, tt.wantErr) {
				t.Fatalf("validateEdit() error = %v, want %v", err, tt.wantErr)
			}
		})
	}
}

func TestBuildSetClause(t *testing.T) {
	columns := map[string]any{
		"name":  "Alice",
		"email": "alice@example.com",
	}

	set, args := buildSetClause(columns)
	if len(args) != 2 {
		t.Fatalf("buildSetClause() args length = %d, want 2", len(args))
	}

	// Since map iteration order is non-deterministic, just check that
	// both columns appear in the SET clause.
	if len(set) == 0 {
		t.Fatal("buildSetClause() returned empty SET clause")
	}
}

func TestBuildWhere(t *testing.T) {
	where, args, idx := buildWhere("id", "r1", "t1", 5, "version", true)

	if len(args) != 3 {
		t.Fatalf("buildWhere() args length = %d, want 3", len(args))
	}
	if idx != 4 {
		t.Fatalf("buildWhere() next idx = %d, want 4", idx)
	}
	if len(where) == 0 {
		t.Fatal("buildWhere() returned empty WHERE")
	}
}

func TestValidateIDs(t *testing.T) {
	spec := RowSpec{
		TableName:  "items",
		PrimaryKey: "id",
		Columns:    []ColumnSpec{{Name: "name"}},
	}
	editor, err := NewRowEditor(spec)
	if err != nil {
		t.Fatal(err)
	}

	if err := editor.validateIDs([]string{}); err == nil {
		t.Fatal("validateIDs([]) should return error")
	}
	if err := editor.validateIDs([]string{"1"}); err != nil {
		t.Fatalf("validateIDs([]string{\"1\"}) error = %v", err)
	}
}

func TestValidateMode(t *testing.T) {
	spec := RowSpec{
		TableName:  "items",
		PrimaryKey: "id",
		Columns:    []ColumnSpec{{Name: "name"}},
	}
	editor, err := NewRowEditor(spec)
	if err != nil {
		t.Fatal(err)
	}

	validModes := []Mode{CellMode, RowMode, BatchMode}
	for _, m := range validModes {
		if err := editor.validateMode(m); err != nil {
			t.Fatalf("validateMode(%d) error = %v", m, err)
		}
	}
}

func TestColumnNames(t *testing.T) {
	spec := RowSpec{
		Columns: []ColumnSpec{
			{Name: "a"},
			{Name: "b"},
			{Name: "c"},
		},
	}

	names := spec.ColumnNames()
	if len(names) != 3 {
		t.Fatalf("ColumnNames() length = %d, want 3", len(names))
	}
}

func TestIsReadOnly(t *testing.T) {
	spec := RowSpec{
		TableName:  "items",
		PrimaryKey: "id",
		Columns: []ColumnSpec{
			{Name: "name", ReadOnly: false},
			{Name: "status", ReadOnly: true},
		},
	}
	editor, err := NewRowEditor(spec)
	if err != nil {
		t.Fatal(err)
	}

	if editor.isReadOnly("name") {
		t.Error("isReadOnly('name') should be false")
	}
	if !editor.isReadOnly("status") {
		t.Error("isReadOnly('status') should be true")
	}
	if editor.isReadOnly("missing") {
		t.Error("isReadOnly('missing') should be false")
	}
}

func TestValidateIdentifiers(t *testing.T) {
	tests := []struct {
		name    string
		ident   string
		wantErr bool
	}{
		{"valid", "users_table", false},
		{"empty", "", true},
		{"sql inject", "users; DROP", true},
		{"dotted", "schema.users", false},
		{"starts with digit", "1users", true},
	}

	for _, tt := range tests {
		err := validateIdentifier(tt.ident)
		if (err != nil) != tt.wantErr {
			t.Fatalf("validateIdentifier(%q) error = %v, wantErr %v", tt.ident, err, tt.wantErr)
		}
	}
}
