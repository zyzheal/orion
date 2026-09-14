package roweditor

import (
	"context"
	"database/sql"
	"fmt"
	"slices"
	"strings"
)

// Create inserts a new row into the target table and returns the persisted row.
func (e *RowEditor) Create(ctx context.Context, db DBOperations, tenantID string, row Row) (*Row, error) {
	if len(row) == 0 {
		return nil, ErrNoChanges
	}
	if err := e.validateRow(row); err != nil {
		return nil, fmt.Errorf("create row validation: %w", err)
	}

	// Build column/value list. buildInsertColumnArgs stamps tenant_id from
	// tenantID, so the caller cannot attribute the new row to a different
	// tenant by putting its own value in the row map.
	keys, vals, args := e.buildInsertColumnArgs(row, tenantID)
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

	rowsAffected, err := result.RowsAffected()
	if err != nil {
		return nil, fmt.Errorf("roweditor create: rows affected: %w", err)
	}
	if rowsAffected == 0 {
		return nil, fmt.Errorf("roweditor create: no rows inserted")
	}

	// Return the row as it was actually written, tenant stamp included, rather
	// than echoing the caller's input.
	inserted := make(Row, len(args))
	for k, v := range args {
		inserted[k] = v
	}
	return &inserted, nil
}

// Read retrieves a single row by primary key.  Returns ErrRowNotFound when
// the row does not exist or is soft-deleted.
func (e *RowEditor) Read(ctx context.Context, db DBOperations, tenantID, rowID string) (*Row, error) {
	if err := e.validateIDs([]string{rowID}); err != nil {
		return nil, err
	}

	query := buildSelectQuery(e.spec.TableName, e.spec.PrimaryKey, rowID, tenantID)

	// The query binds tenant_id only when tenantID is non-empty, so the argument
	// list must match. Passing the empty string anyway sent an argument to a
	// placeholder that does not exist, and Postgres rejects the statement.
	args := []any{rowID}
	if tenantID != "" {
		args = append(args, tenantID)
	}

	dest := make(Row)
	err := db.GetContext(ctx, dest, query, args...)
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

	// The SET clause is built before the WHERE clause because the WHERE
	// placeholders start after the ones the SET clause consumed.
	setClause, setArgs := buildUpdateSetClause(change.Columns, opts.Version, e.spec.VersionColumn)
	where, whereArgs, _ := buildWhere(
		e.spec.PrimaryKey,
		change.RowID,
		opts.TenantID,
		opts.Version,
		e.spec.VersionColumn,
		true, // include status!='deleted'
		len(setArgs)+1,
	)
	// New backing array: appending into setArgs would risk mutating the slice
	// buildUpdateSetClause handed over.
	allArgs := append(append([]any{}, setArgs...), whereArgs...)

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

	// The cell value owns $1, so the WHERE clause starts at $2.
	where, whereArgs, _ := buildWhere(
		e.spec.PrimaryKey,
		change.RowID,
		opts.TenantID,
		opts.Version,
		e.spec.VersionColumn,
		true,
		2,
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
		// base=1: SET status='deleted' binds no placeholder of its own.
		where, whereArgs, _ := buildWhere(
			e.spec.PrimaryKey,
			rowID,
			opts.TenantID,
			opts.Version,
			e.spec.VersionColumn,
			true,
			1,
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
		rowID,
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
	// The SET clause is built once for the whole batch. The version increment
	// belongs to the statement, not to the row: appending it inside the loop
	// bumped version by one per row of the batch.
	setClause, setArgs := buildUpdateSetClause(change.Columns, opts.Version, e.spec.VersionColumn)

	for _, rowID := range change.RowIDs {
		where, whereArgs, _ := buildWhere(
			e.spec.PrimaryKey,
			rowID,
			opts.TenantID,
			opts.Version,
			e.spec.VersionColumn,
			true,
			len(setArgs)+1,
		)
		query := fmt.Sprintf(
			"UPDATE %s SET %s WHERE %s",
			e.spec.TableName,
			setClause,
			where,
		)
		// Fresh slice per row: the args differ only in rowID, and reusing a
		// backing array across iterations would let a later row's id overwrite
		// an earlier one in place.
		allArgs := append(append([]any{}, setArgs...), whereArgs...)

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
		// Tenant stamping happens here for every row, the same way Create does
		// it, so a batch cannot smuggle rows into another tenant.
		keys, vals, args := e.buildInsertColumnArgs(row, tenantID)
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
		// base=1: SET status='deleted' binds no placeholder of its own.
		where, whereArgs, _ := buildWhere(
			e.spec.PrimaryKey,
			rowID,
			opts.TenantID,
			opts.Version,
			e.spec.VersionColumn,
			true,
			1,
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
//
// tenant_id is the editor's own bookkeeping column. A value the caller placed
// in the row map is discarded and replaced with tenantID, which is the value
// authenticated upstream. Without that the INSERT would have been written
// without a tenant at all while every read and update was tenant-scoped — the
// write side of a split-brain tenancy, letting a caller land rows into a
// tenant it does not belong to.
//
// Column order is sorted so the generated SQL is deterministic; map iteration
// order is not, and a non-deterministic INSERT would make the SQL assertions
// in the tests flaky.
func (e *RowEditor) buildInsertColumnArgs(row Row, tenantID string) (keys, vals string, args map[string]any) {
	args = make(map[string]any, len(row)+1)
	for k, v := range row {
		// tenant_id is the editor's bookkeeping column: a caller value is
		// discarded here and the authenticated tenant is stamped below.
		if k == TenantColumn {
			continue
		}
		c, declared := e.specColumn(k)
		// The validators refuse undeclared keys before they get here, so this is
		// the second check. Keeping it at the sink means a future caller that
		// reaches buildInsertColumnArgs without a validator still cannot name a
		// column the spec never declared.
		if !declared || c.ReadOnly {
			continue
		}
		args[k] = v
	}
	if tenantID != "" && !e.isReadOnly(TenantColumn) {
		args[TenantColumn] = tenantID
	}

	columnKeys := make([]string, 0, len(args))
	for k := range args {
		columnKeys = append(columnKeys, k)
	}
	slices.Sort(columnKeys)

	valPlaceholders := make([]string, 0, len(columnKeys))
	for _, k := range columnKeys {
		valPlaceholders = append(valPlaceholders, ":"+k)
	}
	return strings.Join(columnKeys, ", "), strings.Join(valPlaceholders, ", "), args
}

func (e *RowEditor) isReadOnly(column string) bool {
	c, ok := e.specColumn(column)
	return ok && c.ReadOnly
}
