// PGArtifactBus is the sqlx-backed implementation of ArtifactBus.
// Depends on migration 730 (pipeline_artifacts table).
package artifactbus

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"time"

	"github.com/google/uuid"
	"github.com/jmoiron/sqlx"
)

// PGArtifactBus persists artifacts to the pipeline_artifacts table.
// The zero value is not usable — call NewPGArtifactBus.
type PGArtifactBus struct {
	db      *sqlx.DB
	maxSize int64
}

// Compile-time assertion that PGArtifactBus satisfies ArtifactBus.
var _ ArtifactBus = (*PGArtifactBus)(nil)

// NewPGArtifactBus constructs a bus against the given DB. maxSize of
// zero (or negative) falls back to DefaultMaxSize.
func NewPGArtifactBus(db *sqlx.DB, maxSize int64) *PGArtifactBus {
	if maxSize <= 0 {
		maxSize = DefaultMaxSize
	}
	return &PGArtifactBus{db: db, maxSize: maxSize}
}

// Publish assigns derived fields and inserts the artifact row.
// Uses ON CONFLICT DO NOTHING to be idempotent on (run, stage, name)
// — matches the UNIQUE constraint in migration 730.
func (b *PGArtifactBus) Publish(ctx context.Context, a *Artifact) error {
	if a == nil {
		return errors.New("artifactbus: nil artifact")
	}
	if err := New(a, b.maxSize); err != nil {
		return err
	}
	if a.ID == "" {
		a.ID = uuid.NewString()
	}
	meta, err := EncodeMetadata(a.Metadata)
	if err != nil {
		return fmt.Errorf("artifactbus: encode metadata: %w", err)
	}

	const q = `
		INSERT INTO pipeline_artifacts
			(id, tenant_id, pipeline_run_id, stage_id, name,
			 content_type, size_bytes, content, checksum,
			 metadata, created_at, expires_at)
		VALUES
			(:id, :tenant_id, :pipeline_run_id, :stage_id, :name,
			 :content_type, :size_bytes, :content, :checksum,
			 :metadata, :created_at, :expires_at)
		ON CONFLICT (pipeline_run_id, stage_id, name) DO NOTHING`
	_, err = b.db.NamedExecContext(ctx, q, &artifactRow{
		ID:            a.ID,
		TenantID:      a.TenantID,
		PipelineRunID: a.PipelineRunID,
		StageID:       a.StageID,
		Name:          a.Name,
		ContentType:   a.ContentType,
		SizeBytes:     a.SizeBytes,
		Content:       a.Content,
		Checksum:      cloneChecksum(a.Checksum),
		Metadata:      meta,
		CreatedAt:     a.CreatedAt,
		ExpiresAt:     a.ExpiresAt,
	})
	return err
}

// Get fetches one artifact by (tenant, run, stage, name).
func (b *PGArtifactBus) Get(ctx context.Context, tenantID, pipelineRunID, stageID, name string) (*Artifact, error) {
	const q = `
		SELECT id, tenant_id, pipeline_run_id, stage_id, name,
		       content_type, size_bytes, content, checksum,
		       metadata, created_at, expires_at
		FROM pipeline_artifacts
		WHERE tenant_id = $1
		  AND pipeline_run_id = $2
		  AND stage_id = $3
		  AND name = $4
		LIMIT 1`
	row := &artifactRow{}
	err := b.db.QueryRowxContext(ctx, q, tenantID, pipelineRunID, stageID, name).StructScan(row)
	if errors.Is(err, sql.ErrNoRows) {
		return nil, ErrNotFound
	}
	if err != nil {
		return nil, fmt.Errorf("artifactbus: get: %w", err)
	}
	return artifactFromRow(row), nil
}

// List returns all artifacts for a pipeline run, ordered by created_at.
func (b *PGArtifactBus) List(ctx context.Context, tenantID, pipelineRunID string) ([]*Artifact, error) {
	const q = `
		SELECT id, tenant_id, pipeline_run_id, stage_id, name,
		       content_type, size_bytes, content, checksum,
		       metadata, created_at, expires_at
		FROM pipeline_artifacts
		WHERE tenant_id = $1
		  AND pipeline_run_id = $2
		ORDER BY created_at ASC, id ASC`
	rows, err := b.db.QueryxContext(ctx, q, tenantID, pipelineRunID)
	if err != nil {
		return nil, fmt.Errorf("artifactbus: list: %w", err)
	}
	defer rows.Close()

	out := []*Artifact{}
	for rows.Next() {
		row := &artifactRow{}
		if err := rows.StructScan(row); err != nil {
			return nil, fmt.Errorf("artifactbus: list scan: %w", err)
		}
		out = append(out, artifactFromRow(row))
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("artifactbus: list rows: %w", err)
	}
	return out, nil
}

// Delete removes the artifact with the given id (scoped to tenant).
// Returns ErrNotFound if no row was deleted.
func (b *PGArtifactBus) Delete(ctx context.Context, tenantID, id string) error {
	const q = `DELETE FROM pipeline_artifacts WHERE tenant_id = $1 AND id = $2`
	res, err := b.db.ExecContext(ctx, q, tenantID, id)
	if err != nil {
		return fmt.Errorf("artifactbus: delete: %w", err)
	}
	n, err := res.RowsAffected()
	if err != nil {
		return fmt.Errorf("artifactbus: delete rowsAffected: %w", err)
	}
	if n == 0 {
		return ErrNotFound
	}
	return nil
}

// Cleanup removes all expired artifacts. Returns the count of deleted
// rows. Safe to call on a schedule.
func (b *PGArtifactBus) Cleanup(ctx context.Context) (int, error) {
	const q = `DELETE FROM pipeline_artifacts WHERE expires_at < NOW()`
	res, err := b.db.ExecContext(ctx, q)
	if err != nil {
		return 0, fmt.Errorf("artifactbus: cleanup: %w", err)
	}
	n, err := res.RowsAffected()
	if err != nil {
		return 0, fmt.Errorf("artifactbus: cleanup rowsAffected: %w", err)
	}
	return int(n), nil
}

// artifactRow is the sqlx scan target. Column names must match the
// migration 730 schema exactly.
//
// Checksum is nullable in the schema (TEXT) but we always write it;
// *string lets the scan succeed against existing NULL rows and lets us
// pass a value when writing.
type artifactRow struct {
	ID            string    `db:"id"`
	TenantID      string    `db:"tenant_id"`
	PipelineRunID string    `db:"pipeline_run_id"`
	StageID       string    `db:"stage_id"`
	Name          string    `db:"name"`
	ContentType   string    `db:"content_type"`
	SizeBytes     int64     `db:"size_bytes"`
	Content       []byte    `db:"content"`
	Checksum      *string   `db:"checksum"`
	Metadata      []byte    `db:"metadata"`
	CreatedAt     time.Time `db:"created_at"`
	ExpiresAt     time.Time `db:"expires_at"`
}

// artifactFromRow converts a DB row to a public Artifact. Nil checksum
// is returned as "". Nil metadata is returned as nil map.
func artifactFromRow(r *artifactRow) *Artifact {
	cs := ""
	if r.Checksum != nil {
		cs = *r.Checksum
	}
	m, _ := DecodeMetadata(r.Metadata) // ignore error: metadata is written by us
	return &Artifact{
		ID:            r.ID,
		TenantID:      r.TenantID,
		PipelineRunID: r.PipelineRunID,
		StageID:       r.StageID,
		Name:          r.Name,
		ContentType:   r.ContentType,
		SizeBytes:     r.SizeBytes,
		Content:       r.Content,
		Checksum:      cs,
		Metadata:      m,
		CreatedAt:     r.CreatedAt,
		ExpiresAt:     r.ExpiresAt,
	}
}

// cloneChecksum returns a pointer to a copy of s, suitable for
// *string struct fields in NamedExec rows.
func cloneChecksum(s string) *string {
	v := s
	return &v
}
