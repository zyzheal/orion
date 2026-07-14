package repository

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"time"

	"orion/platform-svc-go/internal/service-registry/models"

	"github.com/google/uuid"
	"github.com/jmoiron/sqlx"
	"github.com/lib/pq"
)

// Repository provides data access for the service_registry table.
type Repository struct {
	db *sqlx.DB
}

// NewRepository creates a new Repository backed by sqlx.DB.
func NewRepository(db *sqlx.DB) *Repository {
	return &Repository{db: db}
}

// ListFilters holds optional query filters for listing services.
type ListFilters struct {
	ServiceName string // case-insensitive partial match on service_name
	Health      string // case-insensitive exact match on health_status
	Limit       int
	Offset      int
}

// Create inserts a new registered service, assigning id, status, health_status,
// timestamps, and default protocol/version when omitted.
func (r *Repository) Create(ctx context.Context, m *models.ServiceRegistry) error {
	m.ID = uuid.New().String()
	now := time.Now().UTC()
	m.RegisteredAt = now
	m.UpdatedAt = now
	m.Status = "registered"
	m.HealthStatus = "unknown"
	if m.Protocol == "" {
		m.Protocol = "http"
	}
	if m.Version == "" {
		m.Version = "1.0.0"
	}

	_, err := r.db.NamedExecContext(ctx,
		`INSERT INTO service_registry (id, tenant_id, service_id, service_name, service_url, protocol, version, status, health_status, metadata, registered_at, updated_at)
		 VALUES (:id, :tenant_id, :service_id, :service_name, :service_url, :protocol, :version, :status, :health_status, :metadata, :registered_at, :updated_at)`,
		m,
)
	return err
}

// GetByInternalID retrieves a service by its internal database id within a tenant.
func (r *Repository) GetByInternalID(ctx context.Context, tenantID, id string) (*models.ServiceRegistry, error) {
	var m models.ServiceRegistry
	err := r.db.GetContext(ctx, &m,
		`SELECT * FROM service_registry WHERE id = $1 AND tenant_id = $2`, id, tenantID)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, fmt.Errorf("service not found: %s", id)
		}
		return nil, err
	}
	return &m, nil
}

// FindByServiceID retrieves a service by its service_id within a tenant.
// Returns nil (not an error) when the service does not exist.
func (r *Repository) FindByServiceID(ctx context.Context, tenantID, serviceID string) (*models.ServiceRegistry, error) {
	var m models.ServiceRegistry
	err := r.db.GetContext(ctx, &m,
		`SELECT * FROM service_registry WHERE service_id = $1 AND tenant_id = $2 AND status != 'deregistered'`,
		serviceID, tenantID)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, nil
		}
		return nil, err
	}
	return &m, nil
}

// List retrieves tenant-scoped services with optional filters and pagination.
func (r *Repository) List(ctx context.Context, tenantID string, f *ListFilters) ([]models.ServiceRegistry, error) {
	limit := f.Limit
	if limit <= 0 {
		limit = 20
	}

	wheres := []string{"tenant_id = $1", "status != 'deregistered'"}
	params := []interface{}{tenantID}
	paramIdx := 2

	if f.ServiceName != "" {
		wheres = append(wheres, fmt.Sprintf("LOWER(service_name) LIKE LOWER($%d)", paramIdx))
		params = append(params, "%"+f.ServiceName+"%")
		paramIdx++
	}
	if f.Health != "" {
		wheres = append(wheres, fmt.Sprintf("LOWER(health_status) = LOWER($%d)", paramIdx))
		params = append(params, f.Health)
		paramIdx++
	}

	whereClause := joinWhere(wheres)
	query := fmt.Sprintf(`SELECT * FROM service_registry WHERE %s ORDER BY registered_at DESC LIMIT $%d OFFSET $%d`,
		whereClause, paramIdx, paramIdx+1)
	params = append(params, limit, f.Offset)

	var items []models.ServiceRegistry
	err := r.db.SelectContext(ctx, &items, query, params...)
	if err != nil {
		return nil, err
	}
	return items, nil
}

// Register creates a new service registration and returns the created entity.
// Returns an error containing "already registered" if the service_id already exists.
func (r *Repository) Register(ctx context.Context, tenantID, serviceID, serviceName, serviceURL, protocol, version string, metadata models.JSONB) (*models.ServiceRegistry, error) {
	m := &models.ServiceRegistry{
		TenantID:    tenantID,
		ServiceID:   serviceID,
		ServiceName: serviceName,
		ServiceURL:  serviceURL,
		Protocol:    protocol,
		Version:     version,
		Metadata:    metadata,
	}
	if m.Protocol == "" {
		m.Protocol = "http"
	}
	if m.Version == "" {
		m.Version = "1.0.0"
	}

	if err := r.Create(ctx, m); err != nil {
		if pqErr, ok := err.(*pq.Error); ok && pqErr.Code == "23505" {
			return nil, fmt.Errorf("service already registered: %s", serviceID)
		}
		return nil, err
	}
	return m, nil
}

// Deregister marks a service as deregistered by service_id.
func (r *Repository) Deregister(ctx context.Context, tenantID, serviceID string) error {
	now := time.Now().UTC()
	_, err := r.db.NamedExecContext(ctx,
		`UPDATE service_registry SET status = 'deregistered', deregistered_at = :now, updated_at = :now
		 WHERE service_id = :service_id AND tenant_id = :tenant_id AND status != 'deregistered'`,
		map[string]interface{}{
			"now":        now,
			"service_id": serviceID,
			"tenant_id":  tenantID,
		},
)
	if err != nil {
		return err
	}
	return nil
}

// RecordHeartbeat updates the last heartbeat time and health status.
func (r *Repository) RecordHeartbeat(ctx context.Context, tenantID, serviceID string) error {
	now := time.Now().UTC()
	_, err := r.db.NamedExecContext(ctx,
		`UPDATE service_registry SET last_heartbeat_at = :now, health_status = 'healthy', updated_at = :now
		 WHERE service_id = :service_id AND tenant_id = :tenant_id AND status != 'deregistered'`,
		map[string]interface{}{
			"now":        now,
			"service_id": serviceID,
			"tenant_id":  tenantID,
		},
)
	return err
}

// joinWhere joins WHERE clause parts with AND.
func joinWhere(parts []string) string {
	result := ""
	for i, p := range parts {
		if i > 0 {
			result += " AND "
		}
		result += p
	}
	return result
}
