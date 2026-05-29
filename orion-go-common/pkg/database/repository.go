package database

import (
	"context"
	"fmt"

	"github.com/jmoiron/sqlx"
)

// BaseRepository provides common database operations for all repositories.
// Embed this in service-specific repositories.
type BaseRepository struct {
	db *sqlx.DB
}

// NewBaseRepository creates a new BaseRepository.
func NewBaseRepository(db *sqlx.DB) BaseRepository {
	return BaseRepository{db: db}
}

// DB returns the underlying sqlx.DB.
func (r *BaseRepository) DB() *sqlx.DB {
	return r.db
}

// Exists checks if a row exists in the given table matching the WHERE clause.
func (r *BaseRepository) Exists(ctx context.Context, table, where string, args ...interface{}) (bool, error) {
	var exists bool
	query := fmt.Sprintf("SELECT EXISTS(SELECT 1 FROM %s WHERE %s)", table, where)
	err := r.db.GetContext(ctx, &exists, query, args...)
	return exists, err
}

// Count returns the count of rows matching the WHERE clause.
func (r *BaseRepository) Count(ctx context.Context, table, where string, args ...interface{}) (int, error) {
	var count int
	query := fmt.Sprintf("SELECT COUNT(*) FROM %s WHERE %s", table, where)
	err := r.db.GetContext(ctx, &count, query, args...)
	return count, err
}

// SoftDelete sets status='deleted' and updated_at=now() for the given row.
func (r *BaseRepository) SoftDelete(ctx context.Context, table, id string) error {
	query := fmt.Sprintf("UPDATE %s SET status = 'deleted', updated_at = now() WHERE id = $1", table)
	_, err := r.db.ExecContext(ctx, query, id)
	return err
}

// UpdateStatus updates the status column for the given row.
func (r *BaseRepository) UpdateStatus(ctx context.Context, table, id, status string) error {
	query := fmt.Sprintf("UPDATE %s SET status = $1, updated_at = now() WHERE id = $2", table)
	_, err := r.db.ExecContext(ctx, query, status, id)
	return err
}

// Tx executes fn within a database transaction.
func (r *BaseRepository) Tx(ctx context.Context, fn func(tx *sqlx.Tx) error) error {
	tx, err := r.db.BeginTxx(ctx, nil)
	if err != nil {
		return fmt.Errorf("failed to begin transaction: %w", err)
	}

	if err := fn(tx); err != nil {
		tx.Rollback()
		return err
	}

	return tx.Commit()
}
