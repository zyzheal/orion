package repository

import (
	"context"
	"database/sql"
	"errors"
	"time"

	"orion/go-common/pkg/sentinel"
	"orion/platform-svc-go/internal/data-classification/models"

	"github.com/google/uuid"
	"github.com/jmoiron/sqlx"
)

type Repository struct {
	db *sqlx.DB
}

func NewRepository(db *sqlx.DB) *Repository {
	return &Repository{db: db}
}

func (r *Repository) CreateRule(ctx context.Context, tenantID string, req *models.CreateRuleRequest) (*models.ClassificationRule, error) {
	now := time.Now().UTC()
	rule := &models.ClassificationRule{
		ID:           uuid.New().String(),
		TenantID:     tenantID,
		Name:         req.Name,
		Description:  req.Description,
		Level:        req.Level,
		Pattern:      req.Pattern,
		ResourceType: req.ResourceType,
		Enabled:      true,
		CreatedAt:    now,
		UpdatedAt:    now,
	}
	_, err := r.db.NamedExecContext(ctx, `
		INSERT INTO classification_rules (id, tenant_id, name, description, level, pattern, resource_type, enabled, created_at, updated_at)
		VALUES (:id, :tenant_id, :name, :description, :level, :pattern, :resource_type, :enabled, :created_at, :updated_at)`,
		rule)
	return rule, err
}

func (r *Repository) ListRules(ctx context.Context, tenantID string) ([]models.ClassificationRule, error) {
	var items []models.ClassificationRule
	err := r.db.SelectContext(ctx, &items, `SELECT * FROM classification_rules WHERE tenant_id=$1 ORDER BY created_at DESC`, tenantID)
	if err != nil {
		return nil, err
	}
	if items == nil {
		items = []models.ClassificationRule{}
	}
	return items, nil
}

func (r *Repository) GetRule(ctx context.Context, tenantID, id string) (*models.ClassificationRule, error) {
	var rule models.ClassificationRule
	err := r.db.GetContext(ctx, &rule, `SELECT * FROM classification_rules WHERE id=$1 AND tenant_id=$2`, id, tenantID)
	if errors.Is(err, sql.ErrNoRows) {
		return nil, sentinel.NotFound
	}
	return &rule, err
}

func (r *Repository) DeleteRule(ctx context.Context, tenantID, id string) error {
	res, err := r.db.ExecContext(ctx, `DELETE FROM classification_rules WHERE id=$1 AND tenant_id=$2`, id, tenantID)
	if err != nil {
		return err
	}
	rows, _ := res.RowsAffected()
	if rows == 0 {
		return sentinel.NotFound
	}
	return nil
}

func (r *Repository) Classify(ctx context.Context, tenantID string, resource *models.ClassifiedResource) error {
	if resource.ID == "" {
		resource.ID = uuid.New().String()
	}
	resource.CreatedAt = time.Now().UTC()
	_, err := r.db.NamedExecContext(ctx, `
		INSERT INTO classified_resources (id, tenant_id, resource_id, resource_type, level, rule_id, classified_by, created_at)
		VALUES (:id, :tenant_id, :resource_id, :resource_type, :level, :rule_id, :classified_by, :created_at)
		ON CONFLICT (id) DO UPDATE SET level=EXCLUDED.level, rule_id=EXCLUDED.rule_id, classified_by=EXCLUDED.classified_by`,
		resource)
	return err
}

func (r *Repository) GetClassification(ctx context.Context, tenantID, resourceID string) (*models.ClassifiedResource, error) {
	var cr models.ClassifiedResource
	err := r.db.GetContext(ctx, &cr, `SELECT * FROM classified_resources WHERE resource_id=$1 AND tenant_id=$2 ORDER BY created_at DESC LIMIT 1`, resourceID, tenantID)
	if errors.Is(err, sql.ErrNoRows) {
		return nil, sentinel.NotFound
	}
	return &cr, err
}