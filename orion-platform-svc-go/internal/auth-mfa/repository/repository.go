package repository

import (
	internalrepo "orion/platform-svc-go/internal/repository"
	"context"
	"time"

	"orion/platform-svc-go/internal/auth-mfa/models"

	"orion/go-common/pkg/sentinel"

	"github.com/google/uuid"
	"github.com/jmoiron/sqlx"
)

type Repository struct {
	internalrepo.TenantAwareRepository[any]
	db *sqlx.DB
}

func NewRepository(db *sqlx.DB) *Repository {
	return &Repository{
		TenantAwareRepository: internalrepo.NewTenantAwareRepository(db),
		db:                    db,
	}
}

func (r *Repository) Create(ctx context.Context, device *models.MFADevice) error {
	device.ID = uuid.New().String()
	device.CreatedAt = time.Now().UTC()
	_, err := r.db.NamedExecContext(ctx, `INSERT INTO mfa_devices (id, tenant_id, user_id, type, secret, digits, period, issuer, label, status, created_at) VALUES (:id, :tenantId, :userId, :type, :secret, :digits, :period, :issuer, :label, :status, :createdAt)`, device)
	return err
}

func (r *Repository) GetByID(ctx context.Context, tenantID, id string) (*models.MFADevice, error) {
	var device models.MFADevice
	err := r.TenantAwareRepository.Get(ctx, &device, `SELECT * FROM mfa_devices WHERE id = $1 AND tenant_id = $2`, id, tenantID)
	if err != nil {
		return nil, sentinel.NotFound
	}
	return &device, nil
}

func (r *Repository) ListByUser(ctx context.Context, tenantID, userID string) ([]models.MFADevice, error) {
	var devices []models.MFADevice
	err := r.TenantAwareRepository.Select(ctx, &devices, `SELECT * FROM mfa_devices WHERE tenant_id = $1 AND user_id = $2 ORDER BY created_at DESC`, tenantID, userID)
	return devices, err
}

func (r *Repository) GetActiveDevice(ctx context.Context, tenantID, userID string) (*models.MFADevice, error) {
	var device models.MFADevice
	err := r.TenantAwareRepository.Get(ctx, &device, `SELECT * FROM mfa_devices WHERE tenant_id = $1 AND user_id = $2 AND status = 'active' LIMIT 1`, tenantID, userID)
	if err != nil {
		return nil, err
	}
	return &device, nil
}

func (r *Repository) UpdateStatus(ctx context.Context, tenantID, id, status string) error {
	_, err := r.TenantAwareRepository.Exec(ctx, `UPDATE mfa_devices SET status = $1 WHERE id = $2 AND tenant_id = $3`, status, id, tenantID)
	return err
}

func (r *Repository) Delete(ctx context.Context, tenantID, id string) (bool, error) {
	result, err := r.TenantAwareRepository.Exec(ctx, `DELETE FROM mfa_devices WHERE id = $1 AND tenant_id = $2`, id, tenantID)
	if err != nil {
		return false, err
	}
	rows, _ := result.RowsAffected()
	return rows > 0, nil
}
