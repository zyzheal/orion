package roweditor

import (
	"context"
	"database/sql"
	"fmt"
	"strings"
)

// Create inserts a new row into the target table and returns the persisted row.
func (e *RowEditor) Create(ctx context.Context, db DBOperations, tenantID string, row Row) (*Row, error) {
	if err := e.validateRow(row); err != nil {
		return nil, fmt.Errorf("create row validation: %w", err)
	}

	// Build column/value list.
	keys, vals, args := e.buildInsertColumnArgs(row)
	if len(keys) == 0 {
		return nil, ErrNoChanges
	}

	query := fmt.Sprintf(
		"INSERT INTO %s (%s) VALUES (%s)",
		e.spec.TableName,
		keys,
		vals,
	)

	result, err := db.NamedExecContext(ctx, query, args)
	if err != nil {
		return nil, fmt.Errorf("roweditor create: %w", err)
	}

	// Try to retrieve the last insert id; if not supported return the inserted row.
	rowsAffected, _ := result.RowsAffected()
	if rowsAffected == 0 {
		return nil, fmt.Errorf("roweditor create: no rows inserted")
	}

	return &row, nil
}

// Read retrieves a single row by primary key.  Returns ErrRowNotFound when
// the row does not exist or is soft-deleted.
func (e *RowEditor) Read(ctx context.Context, db DBOperations, tenantID, rowID string) (*Row, error) {
	if err := e.validateIDs([]string{rowID}); err != nil {
		return nil, err
	}

	query := buildSelectQuery(e.spec.TableName, e.spec.PrimaryKey, rowID, tenantID)

	dest := make(Row)
	err := db.GetContext(ctx, dest, query, rowID, tenantID)
	if err != nil {
		if err == sql.ErrNoRows {
			return nil, ErrRowNotFound
		}
		return nil, fmt.Errorf("roweditor read: %w", err)
	}

	return &dest, nil
}

// Update performs an inline edit on a single row.  It validates the change,
// applies optimistic locking (if a version is supplied), and bumps updated_at.
//
// Returns ErrOptimisticLock when the version guard fails.
func (e *RowEditor) Update(ctx context.Context, db DBOperations, opts EditOptions, change RowChange) (*Result, error) {
	if err := e.validateEdit(opts, change); err != nil {
		return nil, err
	}

	where, whereArgs, _ := buildWhere(
		e.spec.PrimaryKey,
		change.RowID,
		opts.TenantID,
		opts.Version,
		e.spec.VersionColumn,
		true, // include status!='deleted'
	)

	setClause, setArgs := buildSetClause(change.Columns)
	// Append updated_at bump.
	setClause += ", updated_at=now()"

	allArgs := append(setArgs, whereArgs...)
	if opts.Version > 0 && e.spec.VersionColumn != "" {
		// Bump version too.
		setClause = fmt.Sprintf("%s, %s=%s+1", setClause, e.spec.VersionColumn, e.spec.VersionColumn)
	}

	query := fmt.Sprintf(
		"UPDATE %s SET %s WHERE %s",
		e.spec.TableName,
		setClause,
		where,
	)

	result, err := db.ExecContext(ctx, query, allArgs...)
	if err != nil {
		return nil, fmt.Errorf("roweditor update: %w", err)
	}

	affected, _ := result.RowsAffected()
	if affected == 0 {
		if opts.Version > 0 {
			return nil, ErrOptimisticLock
		}
		return nil, ErrRowNotFound
	}

	return &Result{
		RowID:   change.RowID,
		Mode:    RowMode,
		Changed: int(affected),
	}, nil
}

// UpdateCell edits a single cell (one column) of a single row.  This is the
// entry point for cell-level inline editing.
func (e *RowEditor) UpdateCell(ctx context.Context, db DBOperations, opts EditOptions, change CellChange) (*Result, error) {
	if err := e.validateCell(change); err != nil {
		return nil, err
	}

	where, whereArgs, _ := buildWhere(
		e.spec.PrimaryKey,
		change.RowID,
		opts.TenantID,
		opts.Version,
		e.spec.VersionColumn,
		true,
	)

	setClause := fmt.Sprintf("%s=$1", change.Column)
	setArgs := []any{change.Value}

	// Append updated_at bump.
	setClause += ", updated_at=now()"

	allArgs := append(setArgs, whereArgs...)
	if opts.Version > 0 && e.spec.VersionColumn != "" {
		setClause = fmt.Sprintf("%s, %s=%s+1", setClause, e.spec.VersionColumn, e.spec.VersionColumn)
	}

	query := fmt.Sprintf(
		"UPDATE %s SET %s WHERE %s",
		e.spec.TableName,
		setClause,
		where,
	)

	result, err := db.ExecContext(ctx, query, allArgs...)
	if err != nil {
		return nil, fmt.Errorf("roweditor update cell: %w", err)
	}

	affected, _ := result.RowsAffected()
	if affected == 0 {
		if opts.Version > 0 {
			return nil, ErrOptimisticLock
		}
		return nil, ErrRowNotFound
	}

	return &Result{
		RowID:   change.RowID,
		Mode:    CellMode,
		Changed: 1,
	}, nil
}

// Delete soft-deletes a row (or hard-deletes if softDelete is false).  When
// softDelete is true the row's status is set to 'deleted'.
func (e *RowEditor) Delete(ctx context.Context, db DBOperations, opts EditOptions, rowID string, softDelete bool) (*Result, error) {
	if err := e.validateIDs([]string{rowID}); err != nil {
		return nil, err
	}

	if softDelete {
		where, whereArgs, _ := buildWhere(
			e.spec.PrimaryKey,
			rowID,
			opts.TenantID,
			opts.Version,
			e.spec.VersionColumn,
			true,
		)
		query := fmt.Sprintf(
			"UPDATE %s SET status='deleted', updated_at=now() WHERE %s",
			e.spec.TableName,
			where,
		)
		result, err := db.ExecContext(ctx, query, whereArgs...)
		if err != nil {
			return nil, fmt.Errorf("roweditor soft delete: %w", err)
		}
		affected, _ := result.RowsAffected()
		if affected == 0 {
			if opts.Version > 0 {
				return nil, ErrOptimisticLock
			}
			return nil, ErrRowNotFound
		}
		return &Result{
			RowID:   rowID,
			Mode:    RowMode,
			Changed: int(affected),
		}, nil
	}

	// Hard delete.
	query, args := buildDeleteQuery(
		e.spec.TableName,
		e.spec.PrimaryKey,
		opts.TenantID,
		opts.Version,
		e.spec.VersionColumn,
	)
	result, err := db.ExecContext(ctx, query, args...)
	if err != nil {
		return nil, fmt.Errorf("roweditor delete: %w", err)
	}
	affected, _ := result.RowsAffected()
	if affected == 0 {
		if opts.Version > 0 {
			return nil, ErrOptimisticLock
		}
		return nil, ErrRowNotFound
	}
	return &Result{
		RowID:   rowID,
		Mode:    RowMode,
		Changed: int(affected),
	}, nil
}

// BatchUpdate applies the same column changes to many rows atomically in a
// single transaction.  Returns a slice of Results, one per row.
func (e *RowEditor) BatchUpdate(ctx context.Context, db DBOperations, opts EditOptions, change BatchChange) ([]Result, error) {
	if err := e.validateBatch(change); err != nil {
		return nil, err
	}

	tx, err := db.BeginTxx(ctx, nil)
	if err != nil {
		return nil, fmt.Errorf("roweditor batch begin: %w", err)
	}
	defer tx.Rollback()

	var results []Result
	setClause, setArgs := buildSetClause(change.Columns)
	setClause += ", updated_at=now()"

	for _, rowID := range change.RowIDs {
		where, whereArgs, _ := buildWhere(
			e.spec.PrimaryKey,
			rowID,
			opts.TenantID,
			opts.Version,
			e.spec.VersionColumn,
			true,
		)
		if opts.Version > 0 && e.spec.VersionColumn != "" {
			setClause = fmt.Sprintf("%s, %s=%s+1", setClause, e.spec.VersionColumn, e.spec.VersionColumn)
		}
		query := fmt.Sprintf(
			"UPDATE %s SET %s WHERE %s",
			e.spec.TableName,
			setClause,
			where,
		)
		allArgs := append(setArgs, whereArgs...)

		result, err := tx.ExecContext(ctx, query, allArgs...)
		if err != nil {
			return nil, fmt.Errorf("roweditor batch update row %s: %w", rowID, err)
		}
		affected, _ := result.RowsAffected()
		results = append(results, Result{
			RowID:   rowID,
			Mode:    BatchMode,
			Changed: int(affected),
		})
	}

	if err := tx.Commit(); err != nil {
		return nil, fmt.Errorf("roweditor batch commit: %w", err)
	}

	return results, nil
}

// BatchCreate inserts many rows in a single transaction.  Returns the
// number of rows inserted and any error (the transaction is rolled back on
// failure).
func (e *RowEditor) BatchCreate(ctx context.Context, db DBOperations, tenantID string, rows []Row) (int, error) {
	if err := e.validateBatchRows(rows); err != nil {
		return 0, err
	}

	tx, err := db.BeginTxx(ctx, nil)
	if err != nil {
		return 0, fmt.Errorf("roweditor batch create begin: %w", err)
	}
	defer tx.Rollback()

	count := 0
	for _, row := range rows {
		keys, vals, args := e.buildInsertColumnArgs(row)
		if len(keys) == 0 {
			continue
		}
		query := fmt.Sprintf(
			"INSERT INTO %s (%s) VALUES (%s)",
			e.spec.TableName,
			keys,
			vals,
		)
		_, err := tx.NamedExecContext(ctx, query, args)
		if err != nil {
			return count, fmt.Errorf("roweditor batch create: %w", err)
		}
		count++
	}

	if err := tx.Commit(); err != nil {
		return count, fmt.Errorf("roweditor batch create commit: %w", err)
	}

	return count, nil
}

// BatchDelete soft-deletes many rows in a single transaction.
func (e *RowEditor) BatchDelete(ctx context.Context, db DBOperations, opts EditOptions, rowIDs []string) ([]Result, error) {
	if err := e.validateIDs(rowIDs); err != nil {
		return nil, err
	}

	tx, err := db.BeginTxx(ctx, nil)
	if err != nil {
		return nil, fmt.Errorf("roweditor batch delete begin: %w", err)
	}
	defer tx.Rollback()

	var results []Result
	for _, rowID := range rowIDs {
		where, whereArgs, _ := buildWhere(
			e.spec.PrimaryKey,
			rowID,
			opts.TenantID,
			opts.Version,
			e.spec.VersionColumn,
			true,
		)
		query := fmt.Sprintf(
			"UPDATE %s SET status='deleted', updated_at=now() WHERE %s",
			e.spec.TableName,
			where,
		)
		result, err := tx.ExecContext(ctx, query, whereArgs...)
		if err != nil {
			return nil, fmt.Errorf("roweditor batch delete row %s: %w", rowID, err)
		}
		affected, _ := result.RowsAffected()
		results = append(results, Result{
			RowID:   rowID,
			Mode:    BatchMode,
			Changed: int(affected),
		})
	}

	if err := tx.Commit(); err != nil {
		return nil, fmt.Errorf("roweditor batch delete commit: %w", err)
	}

	return results, nil
}

// buildInsertColumnArgs builds the column list, value placeholders, and args
// map for an INSERT statement.
func (e *RowEditor) buildInsertColumnArgs(row Row) (keys, vals string, args map[string]any) {
	columnKeys := make([]string, 0, len(row))
	valPlaceholders := make([]string, 0, len(row))
	args = make(map[string]any)

	for k, v := range row {
		// Skip read-only columns.
		if e.isReadOnly(k) {
			continue
		}
		columnKeys = append(columnKeys, k)
		valPlaceholders = append(valPlaceholders, fmt.Sprintf(":%s", k))
		args[k] = v
	}

	return strings.Join(columnKeys, ", "), strings.Join(valPlaceholders, ", "), args
}

func (e *RowEditor) isReadOnly(column string) bool {
	for _, c := range e.spec.Columns {
		if c.Name == column && c.ReadOnly {
			return true
		}
	}
	return false
}
