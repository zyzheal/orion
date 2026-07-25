// Package roweditor provides a generic, table-level Row Editor that supports
// inline cell/row editing, CRUD and batch operations, validation, and
// automatic rollback on transaction failure.
//
// It is intentionally dependency-light: it only needs a DB interface (from
// go-common/pkg/database) and works with any SQL database via sqlx.
package roweditor

import "errors"

var (
	// ErrRowNotFound is returned when the targeted row does not exist.
	ErrRowNotFound = errors.New("row not found")

	// ErrNoChanges is returned when an edit operation did not modify any values.
	ErrNoChanges = errors.New("no changes to apply")

	// ErrOptimisticLock is returned when the supplied version does not match
	// the current version of the row (concurrent-edit guard).
	ErrOptimisticLock = errors.New("optimistic lock: row has been modified")

	// ErrValidationError is returned when pre-save validation fails.
	ErrValidationError = errors.New("validation failed")

	// ErrReadOnlyField is returned when an attempt is made to edit a
	// read-only field.
	ErrReadOnlyField = errors.New("read-only field")
)
