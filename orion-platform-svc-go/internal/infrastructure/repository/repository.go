package repository

import (
	"context"
	"encoding/json"
	"errors"
	"time"

	"orion/platform-svc-go/internal/infrastructure/models"

	"github.com/google/uuid"
	"github.com/jmoiron/sqlx"
)

var (
	ErrConnectorNotFound = errors.New("connector not found")
	ErrSandboxNotFound   = errors.New("sandbox not found")
	ErrPolicyNotFound    = errors.New("network policy not found")
)

type Repository struct {
	db *sqlx.DB
}

func NewRepository(db *sqlx.DB) *Repository {
	return &Repository{db: db}
}

// --- Connector CRUD ---

func (r *Repository) CreateConnector(ctx context.Context, m *models.Connector) error {
	m.ID = uuid.New().String()
	m.CreatedAt = time.Now().UTC()
	m.UpdatedAt = time.Now().UTC()
	if m.Status == "" {
		m.Status = models.ConnectorStatusDisconnected
	}
	if m.TimeoutMs <= 0 {
		m.TimeoutMs = 5000
	}
	if m.MaxRetries <= 0 {
		m.MaxRetries = 3
	}
	query := `INSERT INTO infrastructure_connectors (id, tenant_id, type, name, endpoint, credentials, timeout_ms, max_retries, status, metadata, created_at, updated_at)
		VALUES (:id, :tenant_id, :type, :name, :endpoint, :credentials, :timeout_ms, :max_retries, :status, :metadata, :created_at, :updated_at)`
	_, err := r.db.NamedExecContext(ctx, query, m)
	return err
}

func (r *Repository) GetConnector(ctx context.Context, tenantID, id string) (*models.Connector, error) {
	var m models.Connector
	err := r.db.GetContext(ctx, &m,
		`SELECT * FROM infrastructure_connectors WHERE id=$1 AND tenant_id=$2`, id, tenantID)
	if err != nil {
		return nil, err
	}
	return &m, nil
}

func (r *Repository) ListConnectors(ctx context.Context, tenantID string, limit, offset int) ([]models.Connector, error) {
	if limit <= 0 {
		limit = 50
	}
	var items []models.Connector
	err := r.db.SelectContext(ctx, &items,
		`SELECT * FROM infrastructure_connectors WHERE tenant_id=$1 ORDER BY created_at DESC LIMIT $2 OFFSET $3`, tenantID, limit, offset)
	if err != nil {
		return nil, err
	}
	return items, nil
}

func (r *Repository) UpdateConnector(ctx context.Context, tenantID, id string, updates map[string]interface{}) error {
	updates["updated_at"] = time.Now().UTC()
	_, err := r.db.ExecContext(ctx,
		`UPDATE infrastructure_connectors SET updated_at=NOW() WHERE id=$1 AND tenant_id=$2`, id, tenantID)
	return err
}

func (r *Repository) UpdateConnectorStatus(ctx context.Context, tenantID, id string, status models.ConnectorStatus) error {
	_, err := r.db.ExecContext(ctx,
		`UPDATE infrastructure_connectors SET status=$1, updated_at=NOW() WHERE id=$2 AND tenant_id=$3`, status, id, tenantID)
	return err
}

func (r *Repository) DeleteConnector(ctx context.Context, tenantID, id string) error {
	result, err := r.db.ExecContext(ctx,
		`DELETE FROM infrastructure_connectors WHERE id=$1 AND tenant_id=$2`, id, tenantID)
	if err != nil {
		return err
	}
	n, _ := result.RowsAffected()
	if n == 0 {
		return ErrConnectorNotFound
	}
	return nil
}

// --- Connector health ---

func (r *Repository) GetHealthMetrics(ctx context.Context, tenantID, connectorID string) (*models.HealthMetrics, error) {
	var m models.HealthMetrics
	err := r.db.GetContext(ctx, &m,
		`SELECT * FROM connector_health_metrics WHERE connector_id=$1 AND tenant_id=$2`, connectorID, tenantID)
	if err != nil {
		return nil, err
	}
	return &m, nil
}

func (r *Repository) UpsertHealthMetrics(ctx context.Context, tenantID string, metrics models.HealthMetrics) error {
	_, err := r.db.NamedExecContext(ctx,
		`INSERT INTO connector_health_metrics (connector_id, tenant_id, status, last_ping_at, latency_ms, error_count, success_count)
		VALUES (:connector_id, :tenant_id, :status, :last_ping_at, :latency_ms, :error_count, :success_count)
		ON CONFLICT (connector_id, tenant_id) DO UPDATE SET
			status=EXCLUDED.status,
			last_ping_at=EXCLUDED.last_ping_at,
			latency_ms=EXCLUDED.latency_ms,
			error_count=EXCLUDED.error_count,
			success_count=EXCLUDED.success_count`,
		metrics)
	return err
}

func (r *Repository) ListAllHealthMetrics(ctx context.Context, tenantID string) ([]models.HealthMetrics, error) {
	var items []models.HealthMetrics
	err := r.db.SelectContext(ctx, &items,
		`SELECT * FROM connector_health_metrics WHERE tenant_id=$1 ORDER BY connector_id`, tenantID)
	return items, err
}

// --- Sandbox CRUD ---

func (r *Repository) CreateSandbox(ctx context.Context, tenantID string, m *models.SandboxInfo) error {
	m.ID = m.Name // use name as id
	m.CreatedAt = time.Now().UTC()
	m.UpdatedAt = time.Now().UTC()
	m.IsolationStatus = "isolated"
	query := `INSERT INTO infrastructure_sandboxes (id, tenant_id, name, namespace, isolation_status, network_policy_id, created_at, updated_at)
		VALUES (:id, :tenant_id, :name, :namespace, :isolation_status, :network_policy_id, :created_at, :updated_at)`
	_, err := r.db.NamedExecContext(ctx, query, m)
	return err
}

func (r *Repository) GetSandbox(ctx context.Context, tenantID, id string) (*models.SandboxInfo, error) {
	var m models.SandboxInfo
	err := r.db.GetContext(ctx, &m,
		`SELECT * FROM infrastructure_sandboxes WHERE id=$1 AND tenant_id=$2`, id, tenantID)
	if err != nil {
		return nil, err
	}
	return &m, nil
}

func (r *Repository) ListSandboxes(ctx context.Context, tenantID string, limit, offset int) ([]models.SandboxInfo, error) {
	if limit <= 0 {
		limit = 50
	}
	var items []models.SandboxInfo
	err := r.db.SelectContext(ctx, &items,
		`SELECT * FROM infrastructure_sandboxes WHERE tenant_id=$1 ORDER BY created_at DESC LIMIT $2 OFFSET $3`, tenantID, limit, offset)
	if err != nil {
		return nil, err
	}
	return items, nil
}

func (r *Repository) UpdateSandboxStatus(ctx context.Context, tenantID, id string, status string) error {
	_, err := r.db.ExecContext(ctx,
		`UPDATE infrastructure_sandboxes SET isolation_status=$1, updated_at=NOW() WHERE id=$2 AND tenant_id=$3`, status, id, tenantID)
	return err
}

// --- SandboxNetworkPolicy ---

func (r *Repository) CreateNetworkPolicy(ctx context.Context, tenantID string, m *models.SandboxNetworkPolicy) error {
	m.ID = uuid.New().String()
	m.CreatedAt = time.Now().UTC()
	m.UpdatedAt = time.Now().UTC()
	query := `INSERT INTO infrastructure_network_policies (id, sandbox_id, tenant_id, name, namespace, labels, annotations, ingress_rules, egress_rules, created_at, updated_at)
		VALUES (:id, :sandbox_id, :tenant_id, :name, :namespace, :labels, :annotations, :ingress_rules, :egress_rules, :created_at, :updated_at)`
	_, err := r.db.NamedExecContext(ctx, query, m)
	return err
}

func (r *Repository) GetNetworkPolicy(ctx context.Context, tenantID, id string) (*models.SandboxNetworkPolicy, error) {
	var m models.SandboxNetworkPolicy
	err := r.db.GetContext(ctx, &m,
		`SELECT * FROM infrastructure_network_policies WHERE id=$1 AND tenant_id=$2`, id, tenantID)
	if err != nil {
		return nil, err
	}
	return &m, nil
}

func (r *Repository) GetNetworkPolicyBySandbox(ctx context.Context, tenantID, sandboxID string) (*models.SandboxNetworkPolicy, error) {
	var m models.SandboxNetworkPolicy
	err := r.db.GetContext(ctx, &m,
		`SELECT * FROM infrastructure_network_policies WHERE sandbox_id=$1 AND tenant_id=$2 ORDER BY created_at ASC LIMIT 1`, sandboxID, tenantID)
	if err != nil {
		return nil, err
	}
	return &m, nil
}

func (r *Repository) ListNetworkPolicies(ctx context.Context, tenantID string) ([]models.SandboxNetworkPolicy, error) {
	var items []models.SandboxNetworkPolicy
	err := r.db.SelectContext(ctx, &items,
		`SELECT * FROM infrastructure_network_policies WHERE tenant_id=$1 ORDER BY created_at DESC`, tenantID)
	return items, err
}

func (r *Repository) UpdateNetworkPolicy(ctx context.Context, tenantID, id string, updates map[string]interface{}) error {
	updates["updated_at"] = time.Now().UTC()
	_, err := r.db.ExecContext(ctx,
		`UPDATE infrastructure_network_policies SET updated_at=NOW() WHERE id=$1 AND tenant_id=$2`, id, tenantID)
	return err
}

// --- Helper: JSON marshal for map fields ---

func marshalJSON(v any) (string, error) {
	if v == nil {
		return "", nil
	}
	b, err := json.Marshal(v)
	if err != nil {
		return "", err
	}
	return string(b), nil
}

// --- Sentinel error check ---

func IsNotFound(err error) bool {
	return errors.Is(err, ErrConnectorNotFound) || errors.Is(err, ErrSandboxNotFound) || errors.Is(err, ErrPolicyNotFound)
}
