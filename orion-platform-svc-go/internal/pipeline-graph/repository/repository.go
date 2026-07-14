package repository

import (
	"context"
	"errors"
	"time"

	"github.com/jmoiron/sqlx"
)

var ErrNotFound = errors.New("not found")

// PipelineDefinition is the database model for the pipeline_definitions table.
type PipelineDefinition struct {
	ID          string    `db:"id" json:"id"`
	TenantID    string    `db:"tenant_id" json:"tenantId"`
	Name        string    `db:"name" json:"name"`
	YamlContent string    `db:"yaml_content" json:"yamlContent"`
	Status      string    `db:"status" json:"status"`
	CreatedAt   time.Time `db:"created_at" json:"createdAt"`
	UpdatedAt   time.Time `db:"updated_at" json:"updatedAt"`
}

type Repository struct {
	db *sqlx.DB
}

func NewRepository(db *sqlx.DB) *Repository {
	return &Repository{db: db}
}

// GetPipelineByID retrieves a pipeline definition by its ID without tenant scoping,
// used to build the graph for the frontend DAG editor.
func (r *Repository) GetPipelineByID(ctx context.Context, id string) (*PipelineDefinition, error) {
	var def PipelineDefinition
	err := r.db.GetContext(ctx, &def, `SELECT * FROM pipeline_definitions WHERE id=$1`, id)
	if err != nil {
		return nil, err
	}
	return &def, nil
}