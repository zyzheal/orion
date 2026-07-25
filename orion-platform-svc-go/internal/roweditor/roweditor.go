package roweditor

import (
	"fmt"
	"regexp"
	"slices"
	"strings"
	"sync"
	"time"
)

// Mode determines the granularity of an edit operation.
type Mode int

const (
	// CellMode edits a single cell (column) of a single row.
	CellMode Mode = iota

	// RowMode edits one or more columns of a single row atomically.
	RowMode

	// BatchMode applies the same operation across many rows.
	BatchMode
)

func (m Mode) String() string {
	switch m {
	case CellMode:
		return "cell"
	case RowMode:
		return "row"
	case BatchMode:
		return "batch"
	default:
		return "unknown"
	}
}

// validIdentifier guards against SQL injection in user-supplied table/column names.
// Matches safe SQL identifiers (alphanumeric + underscore, optionally dotted).
var validIdentifier = regexp.MustCompile(`^[a-zA-Z_][a-zA-Z0-9_]*(\.[a-zA-Z_][a-zA-Z0-9_]*)?$`)

func validateIdentifier(name string) error {
	if name == "" {
		return fmt.Errorf("identifier is empty")
	}
	if !validIdentifier.MatchString(name) {
		return fmt.Errorf("invalid SQL identifier: %q", name)
	}
	return nil
}

// validateIdentifiers validates a slice of identifiers and returns the first
// error.
func validateIdentifiers(names []string) error {
	for _, n := range names {
		if err := validateIdentifier(n); err != nil {
			return err
		}
	}
	return nil
}

// validateIdentifiersWithMsg validates a slice of identifiers and returns the
// first error with a human-friendly message.
func validateIdentifiersWithMsg(msg string, names []string) error {
	for _, n := range names {
		if err := validateIdentifier(n); err != nil {
			return fmt.Errorf("%s: %w", msg, err)
		}
	}
	return nil
}

// Row represents a single row in a table as a map of column name → value.
// It is the wire format between the editor and callers; the editor does not
// enforce schema — that is the caller's responsibility.
type Row map[string]any

// RowSpec describes the structure of the target table.
type RowSpec struct {
	// TableName is the target table in the database.
	TableName string

	// PrimaryKey is the name of the primary-key column (required for edit).
	PrimaryKey string

	// Columns lists all editable columns in the table.
	Columns []ColumnSpec

	// VersionColumn is the name of the version column used for optimistic
	// locking. Leave empty to disable version checks.
	VersionColumn string
}

// ColumnSpec describes a single column in the RowSpec.
type ColumnSpec struct {
	Name   string
	Type   string
	Nullable bool
	ReadOnly bool
	Unique   bool

	// Validate is an optional per-column validation hook.  It receives the
	// proposed value and must return nil when the value is acceptable.
	Validate func(any) error
}

// EditOptions holds parameters for an edit operation.
type EditOptions struct {
	// TenantID is the tenant under which the operation runs.  The editor appends
	// it to every query via a WHERE tenant_id = ... clause when the table
	// declares a tenant_id column (see RowSpec.Columns).
	TenantID string

	// Version is the expected version value for optimistic locking.  Only used
	// when RowSpec.VersionColumn is set.  Pass 0 to disable the check even when
	// a version column exists.
	Version int64
}

// Result holds the outcome of a single edit action.
type Result struct {
	// RowID is the primary-key value of the row that was acted on.
	RowID string

	// Mode is the mode under which the action ran.
	Mode Mode

	// Changed is the number of values that were actually updated.
	Changed int

	// Error is set when this action failed.
	Error error
}

// RowEditor is the main struct.  It ties together a RowSpec (target table +
// row operations) and validation rules, and exposes a CRUD + inline-edit API.
type RowEditor struct {
	spec RowSpec
	mu   sync.RWMutex
}

// NewRowEditor creates an editor for the given table spec.
func NewRowEditor(spec RowSpec) (*RowEditor, error) {
	if err := validateIdentifier(spec.TableName); err != nil {
		return nil, fmt.Errorf("row editor table name: %w", err)
	}
	if err := validateIdentifier(spec.PrimaryKey); err != nil {
		return nil, fmt.Errorf("row editor primary key: %w", err)
	}
	if len(spec.Columns) == 0 {
		return nil, fmt.Errorf("row editor: no columns defined")
	}
	if err := validateIdentifiers(spec.ColumnNames()); err != nil {
		return nil, fmt.Errorf("row editor column names: %w", err)
	}
	if spec.VersionColumn != "" {
		if err := validateIdentifier(spec.VersionColumn); err != nil {
			return nil, fmt.Errorf("row editor version column: %w", err)
		}
	}
	return &RowEditor{spec: spec}, nil
}

// Spec returns the spec associated with this editor.
func (e *RowEditor) Spec() RowSpec {
	return e.spec
}

// ColumnNames returns the set of column names in the RowSpec.
func (e *RowSpec) ColumnNames() []string {
	names := make([]string, 0, len(e.Columns))
	for _, c := range e.Columns {
		names = append(names, c.Name)
	}
	return names
}

// CellChange describes a single cell-level edit (table + row + column + value).
type CellChange struct {
	RowID  string
	Column string
	Value  any
}

// RowChange describes an edit on a full row (may contain several columns).
type RowChange struct {
	RowID   string
	Columns map[string]any
}

// BatchChange describes a batch edit: many rows with the same columns.
type BatchChange struct {
	RowIDs  []string
	Columns map[string]any
}

// validateRows validates a batch of rows against the editor's spec.
func (e *RowEditor) validateRows(rows []Row) []error {
	var errs []error
	for _, r := range rows {
		if err := e.validateRow(r); err != nil {
			errs = append(errs, err)
		}
	}
	return errs
}

// validateRow validates a single row against the editor's spec.
func (e *RowEditor) validateRow(row Row) error {
	if len(row) == 0 {
		return nil
	}
	for _, c := range e.spec.Columns {
		if c.ReadOnly {
			if _, ok := row[c.Name]; ok {
				return fmt.Errorf("%w: %s", ErrReadOnlyField, c.Name)
			}
		}
		if c.Validate != nil {
			if v, ok := row[c.Name]; ok {
				if err := c.Validate(v); err != nil {
					return fmt.Errorf("validateRow column %s: %w", c.Name, err)
				}
			}
		}
	}
	return nil
}

// validateBatchRows validates a slice of rows and returns the first error.
func (e *RowEditor) validateBatchRows(rows []Row) error {
	for _, r := range rows {
		if err := e.validateRow(r); err != nil {
			return err
		}
	}
	return nil
}

// validateIDs validates a slice of row IDs.
func (e *RowEditor) validateIDs(ids []string) error {
	if len(ids) == 0 {
		return fmt.Errorf("row editor: no row IDs provided")
	}
	return nil
}

// validateMode validates that the mode is one of the supported modes.
func (e *RowEditor) validateMode(mode Mode) error {
	switch mode {
	case CellMode, RowMode, BatchMode:
		return nil
	default:
		return fmt.Errorf("row editor: unknown mode %d", mode)
	}
}

// validateCell validates that a cell change references a known, writable column.
func (e *RowEditor) validateCell(change CellChange) error {
	if change.RowID == "" {
		return fmt.Errorf("row editor cell: row ID is empty")
	}
	if change.Column == "" {
		return fmt.Errorf("row editor cell: column is empty")
	}
	for _, c := range e.spec.Columns {
		if c.Name == change.Column {
			if c.ReadOnly {
				return fmt.Errorf("%w: %s", ErrReadOnlyField, c.Name)
			}
			if c.Validate != nil {
				if err := c.Validate(change.Value); err != nil {
					return fmt.Errorf("validateCell column %s: %w", c.Name, err)
				}
			}
			return nil
		}
	}
	return fmt.Errorf("row editor cell: unknown column %q", change.Column)
}

// validateEdit validates the edit options and row change.
func (e *RowEditor) validateEdit(opts EditOptions, change RowChange) error {
	if change.RowID == "" {
		return fmt.Errorf("row editor edit: row ID is empty")
	}
	if len(change.Columns) == 0 {
		return ErrNoChanges
	}
	for _, c := range e.spec.Columns {
		if v, ok := change.Columns[c.Name]; ok {
			if c.ReadOnly {
				return fmt.Errorf("%w: %s", ErrReadOnlyField, c.Name)
			}
			if c.Validate != nil {
				if err := c.Validate(v); err != nil {
					return fmt.Errorf("validateEdit column %s: %w", c.Name, err)
				}
			}
		}
	}
	return nil
}

// validateBatch validates the batch change.
func (e *RowEditor) validateBatch(change BatchChange) error {
	if len(change.RowIDs) == 0 {
		return fmt.Errorf("row editor batch: no row IDs provided")
	}
	if len(change.Columns) == 0 {
		return ErrNoChanges
	}
	for _, c := range e.spec.Columns {
		if v, ok := change.Columns[c.Name]; ok {
			if c.ReadOnly {
				return fmt.Errorf("%s: %w", c.Name, ErrReadOnlyField)
			}
			if c.Validate != nil {
				if err := c.Validate(v); err != nil {
					return fmt.Errorf("validateBatch column %s: %w", c.Name, err)
				}
			}
		}
	}
	return nil
}

// buildSetClause builds a SQL SET clause from a map of column → value.
// The returned slice "args" is ordered so that each $N maps to the corresponding
// value in args.
func buildSetClause(columns map[string]any) (string, []any) {
	// Preserve order so results are deterministic.
	keys := make([]string, 0, len(columns))
	for k := range columns {
		keys = append(keys, k)
	}
	slices.Sort(keys)

	clauses := make([]string, 0, len(keys))
	args := make([]any, 0, len(keys))
	for i, k := range keys {
		clauses = append(clauses, fmt.Sprintf("%s=$%d", k, i+1))
		args = append(args, columns[k])
	}
	return strings.Join(clauses, ", "), args
}

// buildWhere builds a WHERE clause and its args for the given row ID, tenant,
// optional version, and status filter.
//
// The placeholder index is returned so callers can offset further args
// ($1/$2/$3...).
func buildWhere(pk string, rowID, tenantID string, version int64, versionColumn string, includeStatus bool) (string, []any, int) {
	conds := []string{fmt.Sprintf("%s=$1", pk)}
	args := []any{rowID}
	idx := 2

	if tenantID != "" {
		conds = append(conds, fmt.Sprintf("tenant_id=$%d", idx))
		args = append(args, tenantID)
		idx++
	}
	if version > 0 && versionColumn != "" {
		conds = append(conds, fmt.Sprintf("%s=$%d", versionColumn, idx))
		args = append(args, version)
		idx++
	}
	if includeStatus {
		conds = append(conds, fmt.Sprintf("status!='deleted'"))
	}
	return strings.Join(conds, " AND "), args, idx
}

// buildSelectQuery builds a SELECT query that returns the row as a map.
// This is a helper for the inline-edit path; the caller is responsible for
// passing a destination.
func buildSelectQuery(table, pk string, rowID, tenantID string) string {
	conds := fmt.Sprintf("%s=$1", pk)
	if tenantID != "" {
		conds += " AND tenant_id=$2"
	}
	conds += " AND status!='deleted'"
	return fmt.Sprintf("SELECT * FROM %s WHERE %s", table, conds)
}

// buildDeleteQuery builds a DELETE query with optional tenant and version guard.
func buildDeleteQuery(table, pk, tenantID string, version int64, versionColumn string) (string, []any) {
	conds := fmt.Sprintf("%s=$1", pk)
	args := []any{}
	idx := 2

	if tenantID != "" {
		conds += fmt.Sprintf(" AND tenant_id=$%d", idx)
		args = append(args, tenantID)
		idx++
	}
	if version > 0 && versionColumn != "" {
		conds += fmt.Sprintf(" AND %s=$%d", versionColumn, idx)
		args = append(args, version)
		idx++
	}
	conds += " AND status!='deleted'"
	return fmt.Sprintf("DELETE FROM %s WHERE %s", table, conds), args
}

// buildVersionUpdate builds the SQL fragment that increments the version column
// and bumps updated_at for a given table.
func buildVersionUpdate(table, versionColumn string) string {
	return fmt.Sprintf("SET %s=%s+1, updated_at=now()", versionColumn, versionColumn)
}


// Now returns the current UTC time. It exists only so tests can stub it.
var Now = time.Now

// TimeFunc is the type of the Now function so it can be replaced in tests.
type TimeFunc func() time.Time

// Time returns the current UTC time using the configured TimeFunc.
func Time() time.Time {
	return Now().UTC()
}
