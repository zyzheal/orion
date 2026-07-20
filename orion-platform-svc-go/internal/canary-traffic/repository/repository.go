package repository

import (
	"context"
	"strconv"
	"strings"
	"time"

	"orion/platform-svc-go/internal/canary-traffic/models"

	"orion/go-common/pkg/sentinel"

	"github.com/google/uuid"
	"github.com/jmoiron/sqlx"
)

type Repository struct {
	db *sqlx.DB
}

func NewRepository(db *sqlx.DB) *Repository {
	return &Repository{db: db}
}

func (r *Repository) EnsureTable(ctx context.Context) error {
	_, err := r.db.ExecContext(ctx, `
	CREATE TABLE IF NOT EXISTS canary_traffic (
		id UUID PRIMARY KEY,
		tenant_id UUID NOT NULL,
		name VARCHAR(255) NOT NULL,
		service_name VARCHAR(255) DEFAULT '',
		strategy VARCHAR(32) DEFAULT 'linear',
		control_plane_url VARCHAR(1024) DEFAULT '',
		canary_url VARCHAR(1024) DEFAULT '',
		control_weight INTEGER DEFAULT 100,
		canary_weight INTEGER DEFAULT 0,
		target_weight INTEGER DEFAULT 100,
		status VARCHAR(32) DEFAULT 'ACTIVE',
		health_endpoint VARCHAR(1024) DEFAULT '',
		metrics_endpoint VARCHAR(1024) DEFAULT '',
		last_updated TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
		enabled BOOLEAN DEFAULT TRUE,
		created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
		updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
		UNIQUE(tenant_id, name)
	);
	CREATE INDEX IF NOT EXISTS idx_canary_traffic_tenant ON canary_traffic(tenant_id);
	`)
	return err
}

func (r *Repository) Create(ctx context.Context, tenantID string, cb *models.CanaryTraffic) error {
	cb.ID = uuid.New().String()
	cb.TenantID = tenantID
	cb.CreatedAt = time.Now().UTC()
	cb.UpdatedAt = cb.CreatedAt
	cb.LastUpdated = cb.CreatedAt
	cb.Status = models.StatusActive
	cb.Enabled = true
	if cb.Strategy == "" {
		cb.Strategy = "linear"
	}
	if cb.ControlWeight == 0 && cb.CanaryWeight == 0 {
		cb.ControlWeight = 100
		cb.CanaryWeight = 0
	}
	if cb.TargetWeight <= 0 {
		cb.TargetWeight = 100
	}
	_, err := r.db.NamedExecContext(ctx, `
		INSERT INTO canary_traffic (id, tenant_id, name, service_name, strategy, control_plane_url, canary_url,
			control_weight, canary_weight, target_weight, status, health_endpoint, metrics_endpoint,
			last_updated, enabled, created_at, updated_at)
		VALUES (:id, :tenant_id, :name, :service_name, :strategy, :control_plane_url, :canary_url,
			:control_weight, :canary_weight, :target_weight, :status, :health_endpoint, :metrics_endpoint,
			:last_updated, :enabled, :created_at, :updated_at)`,
		cb)
	return err
}

func (r *Repository) GetByID(ctx context.Context, id, tenantID string) (*models.CanaryTraffic, error) {
	var cb models.CanaryTraffic
	err := r.db.GetContext(ctx, &cb,
		`SELECT * FROM canary_traffic WHERE id = $1 AND tenant_id = $2`, id, tenantID)
	if err != nil {
		return nil, sentinel.NotFound
	}
	return &cb, nil
}

func (r *Repository) List(ctx context.Context, tenantID string) ([]models.CanaryTraffic, error) {
	var entities []models.CanaryTraffic
	err := r.db.SelectContext(ctx, &entities,
		`SELECT * FROM canary_traffic WHERE tenant_id = $1 ORDER BY created_at DESC`, tenantID)
	return entities, err
}

func (r *Repository) Update(ctx context.Context, id, tenantID string, attrs map[string]interface{}) (*models.CanaryTraffic, error) {
	if len(attrs) == 0 {
		return r.GetByID(ctx, id, tenantID)
	}
	attrs["updated_at"] = time.Now().UTC()
	attrs["last_updated"] = time.Now().UTC()
	set := make([]string, 0, len(attrs))
	args := make([]interface{}, 0, len(attrs)+2)
	i := 1
	for k, v := range attrs {
		set = append(set, k+"=$"+strconv.Itoa(i))
		args = append(args, v)
		i++
	}
	idIdx := i
	tenantIdx := i + 1
	args = append(args, id, tenantID)
	query := "UPDATE canary_traffic SET " + strings.Join(set, ", ") + " WHERE id=$" + strconv.Itoa(idIdx) + " AND tenant_id=$" + strconv.Itoa(tenantIdx)
	_, err := r.db.ExecContext(ctx, query, args...)
	if err != nil {
		return nil, err
	}
	return r.GetByID(ctx, id, tenantID)
}

func (r *Repository) Delete(ctx context.Context, id, tenantID string) (bool, error) {
	result, err := r.db.ExecContext(ctx,
		`DELETE FROM canary_traffic WHERE id=$1 AND tenant_id=$2`, id, tenantID)
	if err != nil {
		return false, err
	}
	n, _ := result.RowsAffected()
	return n > 0, nil
}
