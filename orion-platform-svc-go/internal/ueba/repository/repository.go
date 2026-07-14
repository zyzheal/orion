package repository

import (
	"context"
	"database/sql"
	"errors"
	"strconv"
	"time"

	"orion/platform-svc-go/internal/ueba/models"

	"github.com/google/uuid"
	"github.com/jmoiron/sqlx"
)

var ErrNotFound = errors.New("ueba record not found")

type Repository struct {
	db *sqlx.DB
}

func NewRepository(db *sqlx.DB) *Repository {
	return &Repository{db: db}
}

func (r *Repository) CreateAlert(ctx context.Context, tenantID string, req *models.CreateAlertRequest) (*models.UEBAAlert, error) {
	alert := &models.UEBAAlert{
		ID:          uuid.New().String(),
		TenantID:    tenantID,
		UserID:      req.UserID,
		EntityType:  req.EntityType,
		EntityID:    req.EntityID,
		EventType:   req.EventType,
		AnomalyType: req.AnomalyType,
		Description: req.Description,
		Evidence:    "[]",
		Status:      "open",
		Score:       0.5,
		Severity:    "medium",
		CreatedAt:   time.Now().UTC(),
	}
	if req.Severity != nil {
		alert.Severity = *req.Severity
	}
	_, err := r.db.ExecContext(ctx,
		`INSERT INTO ueba_alerts (id, tenant_id, user_id, entity_type, entity_id, event_type, severity, score, anomaly_type, description, evidence, status, created_at)
		 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)`,
		alert.ID, alert.TenantID, alert.UserID, alert.EntityType, alert.EntityID, alert.EventType,
		alert.Severity, alert.Score, alert.AnomalyType, alert.Description, alert.Evidence, alert.Status, alert.CreatedAt)
	return alert, err
}

func (r *Repository) GetAlertByID(ctx context.Context, id, tenantID string) (*models.UEBAAlert, error) {
	var alert models.UEBAAlert
	err := r.db.GetContext(ctx, &alert, `SELECT * FROM ueba_alerts WHERE id=$1 AND tenant_id=$2`, id, tenantID)
	if err != nil {
		return nil, err
	}
	return &alert, nil
}

func (r *Repository) ListAlerts(ctx context.Context, tenantID string, q models.ListAlertsQuery) ([]models.UEBAAlert, error) {
	if q.Limit <= 0 {
		q.Limit = 50
	}
	cond := `WHERE tenant_id = $1`
	args := []interface{}{tenantID}
	idx := 2
	if q.UserID != "" {
		cond += ` AND user_id = $` + strconv.Itoa(idx); args = append(args, q.UserID); idx++
	}
	if q.Status != "" {
		cond += ` AND status = $` + strconv.Itoa(idx); args = append(args, q.Status); idx++
	}
	if q.Severity != "" {
		cond += ` AND severity = $` + strconv.Itoa(idx); args = append(args, q.Severity); idx++
	}
	cond += ` ORDER BY created_at DESC LIMIT $` + strconv.Itoa(idx) + ` OFFSET $` + strconv.Itoa(idx+1)
	args = append(args, q.Limit, q.Offset)
	var alerts []models.UEBAAlert
	err := r.db.SelectContext(ctx, &alerts, `SELECT * FROM ueba_alerts `+cond, args...)
	return alerts, err
}

func (r *Repository) UpdateAlertStatus(ctx context.Context, id, tenantID, status string, reviewedAt *time.Time) error {
	_, err := r.db.ExecContext(ctx, `UPDATE ueba_alerts SET status=$1, reviewed_at=$2 WHERE id=$3 AND tenant_id=$4`,
		status, reviewedAt, id, tenantID)
	return err
}

func (r *Repository) ListProfiles(ctx context.Context, tenantID string) ([]models.UEBAProfile, error) {
	var profiles []models.UEBAProfile
	err := r.db.SelectContext(ctx, &profiles, `SELECT * FROM ueba_profiles WHERE tenant_id=$1 ORDER BY last_update_at DESC`, tenantID)
	return profiles, err
}

func (r *Repository) GetProfile(ctx context.Context, tenantID, entityID string) (*models.UEBAProfile, error) {
	var profile models.UEBAProfile
	err := r.db.GetContext(ctx, &profile, `SELECT * FROM ueba_profiles WHERE tenant_id=$1 AND entity_id=$2`, tenantID, entityID)
	if err != nil {
		return nil, err
	}
	return &profile, nil
}

func (r *Repository) SaveProfile(ctx context.Context, tenantID, userID, entityType, entityID, profileData string) error {
	now := time.Now().UTC()
	exists := false
	err := r.db.GetContext(ctx, &exists, `SELECT 1 FROM ueba_profiles WHERE tenant_id=$1 AND entity_id=$2`, tenantID, entityID)
	if errors.Is(err, sql.ErrNoRows) {
		_, err = r.db.ExecContext(ctx,
			`INSERT INTO ueba_profiles (id, tenant_id, user_id, entity_type, entity_id, profile_data, last_update_at, created_at)
			 VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
			uuid.New().String(), tenantID, userID, entityType, entityID, profileData, now, now)
	} else {
		_, err = r.db.ExecContext(ctx,
			`UPDATE ueba_profiles SET user_id=$1, entity_type=$2, profile_data=$3, last_update_at=$4 WHERE tenant_id=$5 AND entity_id=$6`,
			userID, entityType, profileData, now, tenantID, entityID)
	}
	return err
}
