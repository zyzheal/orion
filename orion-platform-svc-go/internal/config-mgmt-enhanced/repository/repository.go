package repository

import (
	"context"
	"encoding/json"
	"fmt"
	"strings"
	"time"

	"orion/platform-svc-go/internal/config-mgmt-enhanced/models"

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

func (r *Repository) Create(ctx context.Context, entity *models.ConfigMgmt) error {
	entity.ID = uuid.New().String()
	now := time.Now().UTC()
	entity.CreatedAt = now
	entity.UpdatedAt = now
	_, err := r.db.NamedExecContext(ctx,
		"INSERT INTO config_mgmt (id, tenant_id, name, created_at, updated_at) VALUES (:id, :tenantId, :name, :createdAt, :updatedAt)",
		entity)
	return err
}

func (r *Repository) GetByID(ctx context.Context, id, tenantID string) (*models.ConfigMgmt, error) {
	var entity models.ConfigMgmt
	err := r.db.GetContext(ctx, &entity, "SELECT * FROM config_mgmt WHERE id=$1 AND tenant_id=$2", id, tenantID)
	if err != nil {
		return nil, err
	}
	return &entity, nil
}

func (r *Repository) List(ctx context.Context, tenantID string) ([]models.ConfigMgmt, error) {
	var entities []models.ConfigMgmt
	err := r.db.SelectContext(ctx, &entities, "SELECT * FROM config_mgmt WHERE tenant_id=$1 ORDER BY created_at DESC", tenantID)
	if err != nil {
		return nil, err
	}
	return entities, nil
}

func (r *Repository) Update(ctx context.Context, id, tenantID string, attrs map[string]interface{}) (*models.ConfigMgmt, error) {
	if len(attrs) == 0 {
		return nil, sentinel.NotFound
	}
	attrs["updated_at"] = time.Now().UTC()
	set := make([]string, 0, len(attrs))
	args := make([]interface{}, 0, len(attrs)+2)
	i := 1
	for k, v := range attrs {
		set = append(set, fmt.Sprintf("%s=$%d", k, i))
		args = append(args, v)
		i++
	}
	idIdx := i
	tenantIdx := i + 1
	args = append(args, id, tenantID)
	query := fmt.Sprintf("UPDATE config_mgmt SET %s WHERE id=$%d AND tenant_id=$%d", strings.Join(set, ", "), idIdx, tenantIdx)
	result, err := r.db.ExecContext(ctx, query, args...)
	if err != nil {
		return nil, err
	}
	n, _ := result.RowsAffected()
	if n == 0 {
		return nil, sentinel.NotFound
	}
	return r.GetByID(ctx, id, tenantID)
}

func (r *Repository) Delete(ctx context.Context, id, tenantID string) (bool, error) {
	result, err := r.db.ExecContext(ctx, "DELETE FROM config_mgmt WHERE id=$1 AND tenant_id=$2", id, tenantID)
	if err != nil {
		return false, err
	}
	n, _ := result.RowsAffected()
	return n > 0, nil
}

// ==================== Change Request Repository ====================

func (r *Repository) CreateChangeRequest(ctx context.Context, cr *models.ChangeRequest) error {
	cr.ID = uuid.New().String()
	now := time.Now().UTC()
	cr.CreatedAt = now
	cr.UpdatedAt = now
	approvalsJSON := "[]"
	if cr.ApprovalsList != nil {
		b, err := json.Marshal(cr.ApprovalsList)
		if err != nil {
			return err
		}
		approvalsJSON = string(b)
	}
	if cr.Approvals == "" {
		cr.Approvals = approvalsJSON
	}
	_, err := r.db.NamedExecContext(ctx,
		"INSERT INTO config_change_requests (id, tenant_id, config_key, config_group, environment, change_type, old_value, new_value, reason, risk_level, requester, status, execution_plan, rollback_plan, approvals, required_approvals, executed_at, executed_by, approved_at, approved_by, rolled_back_at, rolled_back_by, created_at, updated_at) VALUES (:id, :tenantId, :configKey, :configGroup, :environment, :changeType, :oldValue, :newValue, :reason, :riskLevel, :requester, :status, :executionPlan, :rollbackPlan, :approvals, :requiredApprovals, :executedAt, :executedBy, :approvedAt, :approvedBy, :rolledBackAt, :rolledBackBy, :createdAt, :updatedAt)",
		cr)
	return err
}

func (r *Repository) GetChangeRequest(ctx context.Context, id, tenantID string) (*models.ChangeRequest, error) {
	var cr models.ChangeRequest
	err := r.db.GetContext(ctx, &cr, "SELECT * FROM config_change_requests WHERE id=$1 AND tenant_id=$2", id, tenantID)
	if err != nil {
		return nil, err
	}
	return r.deserializeApprovals(&cr)
}

func (r *Repository) ListChangeRequests(ctx context.Context, tenantID string, filter *models.ChangeHistoryFilter) ([]models.ChangeRequest, error) {
	query := "SELECT * FROM config_change_requests WHERE tenant_id=$1"
	args := []interface{}{tenantID}
	argCount := 1
	if filter != nil {
		if filter.Status != "" {
			argCount++
			args = append(args, string(filter.Status))
			query += fmt.Sprintf(" AND status=$%d", argCount)
		}
		if filter.ConfigKey != "" {
			argCount++
			args = append(args, filter.ConfigKey)
			query += fmt.Sprintf(" AND config_key=$%d", argCount)
		}
		if filter.ConfigGroup != "" {
			argCount++
			args = append(args, filter.ConfigGroup)
			query += fmt.Sprintf(" AND config_group=$%d", argCount)
		}
		if filter.Environment != "" {
			argCount++
			args = append(args, filter.Environment)
			query += fmt.Sprintf(" AND environment=$%d", argCount)
		}
		if filter.Requester != "" {
			argCount++
			args = append(args, filter.Requester)
			query += fmt.Sprintf(" AND requester=$%d", argCount)
		}
		if filter.RiskLevel != "" {
			argCount++
			args = append(args, filter.RiskLevel)
			query += fmt.Sprintf(" AND risk_level=$%d", argCount)
		}
	}
	query += " ORDER BY created_at DESC"
	var crs []models.ChangeRequest
	err := r.db.SelectContext(ctx, &crs, query, args...)
	if err != nil {
		return nil, err
	}
	return crs, nil
}

func (r *Repository) UpdateChangeRequest(ctx context.Context, id, tenantID string, attrs map[string]interface{}) (*models.ChangeRequest, error) {
	if len(attrs) == 0 {
		return nil, sentinel.NotFound
	}
	attrs["updated_at"] = time.Now().UTC()
	set := make([]string, 0, len(attrs))
	args := make([]interface{}, 0, len(attrs)+2)
	i := 1
	for k, v := range attrs {
		set = append(set, fmt.Sprintf("%s=$%d", k, i))
		args = append(args, v)
		i++
	}
	idIdx := i
	tenantIdx := i + 1
	args = append(args, id, tenantID)
	query := fmt.Sprintf("UPDATE config_change_requests SET %s WHERE id=$%d AND tenant_id=$%d", strings.Join(set, ", "), idIdx, tenantIdx)
	result, err := r.db.ExecContext(ctx, query, args...)
	if err != nil {
		return nil, err
	}
	n, _ := result.RowsAffected()
	if n == 0 {
		return nil, sentinel.NotFound
	}
	return r.GetChangeRequest(ctx, id, tenantID)
}

func (r *Repository) DeleteChangeRequest(ctx context.Context, id, tenantID string) (bool, error) {
	result, err := r.db.ExecContext(ctx, "DELETE FROM config_change_requests WHERE id=$1 AND tenant_id=$2", id, tenantID)
	if err != nil {
		return false, err
	}
	n, _ := result.RowsAffected()
	return n > 0, nil
}

func (r *Repository) deserializeApprovals(cr *models.ChangeRequest) (*models.ChangeRequest, error) {
	cr.ApprovalsList = nil
	if cr.Approvals != "" && cr.Approvals != "[]" {
		var list []models.ApprovalRecord
		err := json.Unmarshal([]byte(cr.Approvals), &list)
		if err == nil {
			cr.ApprovalsList = list
		}
	}
	return cr, nil
}

// ==================== Change History Repository ====================

func (r *Repository) GetChangeHistory(ctx context.Context, changeRequestID, tenantID string) ([]models.ChangeHistory, error) {
	var histories []models.ChangeHistory
	err := r.db.SelectContext(ctx, &histories,
		"SELECT * FROM config_change_history WHERE change_request_id=$1 AND tenant_id=$2 ORDER BY created_at ASC",
		changeRequestID, tenantID)
	if err != nil {
		return nil, err
	}
	if histories == nil {
		histories = []models.ChangeHistory{}
	}
	return histories, nil
}

func (r *Repository) AddChangeHistory(ctx context.Context, h *models.ChangeHistory) error {
	h.ID = uuid.New().String()
	now := time.Now().UTC()
	h.CreatedAt = now
	_, err := r.db.NamedExecContext(ctx,
		"INSERT INTO config_change_history (id, tenant_id, change_request_id, config_key, config_group, environment, action, actor, old_value, new_value, notes, created_at) VALUES (:id, :tenantId, :changeRequestId, :configKey, :configGroup, :environment, :action, :actor, :oldValue, :newValue, :notes, :createdAt)",
		h)
	return err
}

// ==================== Drift Report Repository ====================

func (r *Repository) CreateDriftReport(ctx context.Context, dr *models.DriftReport) error {
	dr.ID = uuid.New().String()
	now := time.Now().UTC()
	dr.DetectedAt = now
	dr.LastCheckedAt = now
	dr.CreatedAt = now
	driftItemsJSON := "[]"
	if dr.DriftItemsList != nil {
		b, err := json.Marshal(dr.DriftItemsList)
		if err != nil {
			return err
		}
		driftItemsJSON = string(b)
	}
	dr.DriftItems = driftItemsJSON
	remediationLogJSON := "[]"
	if dr.RemediationLogList != nil {
		b, err := json.Marshal(dr.RemediationLogList)
		if err == nil {
			remediationLogJSON = string(b)
		}
	}
	dr.RemediationLog = remediationLogJSON
	_, err := r.db.NamedExecContext(ctx,
		"INSERT INTO config_drift_reports (id, tenant_id, config_group, drift_status, expected_config, actual_config, drift_items, total_drifts, critical_drifts, auto_remediation_enabled, remediation_log, detected_at, last_checked_at, created_at) VALUES (:id, :tenantId, :configGroup, :driftStatus, :expectedConfig, :actualConfig, :driftItems, :totalDrifts, :criticalDrifts, :autoRemediationEnabled, :remediationLog, :detectedAt, :lastCheckedAt, :createdAt)",
		dr)
	return err
}

func (r *Repository) GetDriftReport(ctx context.Context, id, tenantID string) (*models.DriftReport, error) {
	var dr models.DriftReport
	err := r.db.GetContext(ctx, &dr, "SELECT * FROM config_drift_reports WHERE id=$1 AND tenant_id=$2", id, tenantID)
	if err != nil {
		return nil, err
	}
	return r.deserializeDriftReport(&dr)
}

func (r *Repository) UpdateDriftReport(ctx context.Context, id, tenantID string, attrs map[string]interface{}) (*models.DriftReport, error) {
	if len(attrs) == 0 {
		return nil, sentinel.NotFound
	}
	attrs["updated_at"] = time.Now().UTC()
	set := make([]string, 0, len(attrs))
	args := make([]interface{}, 0, len(attrs)+2)
	i := 1
	for k, v := range attrs {
		set = append(set, fmt.Sprintf("%s=$%d", k, i))
		args = append(args, v)
		i++
	}
	idIdx := i
	tenantIdx := i + 1
	args = append(args, id, tenantID)
	query := fmt.Sprintf("UPDATE config_drift_reports SET %s WHERE id=$%d AND tenant_id=$%d", strings.Join(set, ", "), idIdx, tenantIdx)
	result, err := r.db.ExecContext(ctx, query, args...)
	if err != nil {
		return nil, err
	}
	n, _ := result.RowsAffected()
	if n == 0 {
		return nil, sentinel.NotFound
	}
	return r.GetDriftReport(ctx, id, tenantID)
}

func (r *Repository) deserializeDriftReport(dr *models.DriftReport) (*models.DriftReport, error) {
	dr.DriftItemsList = nil
	if dr.DriftItems != "" && dr.DriftItems != "[]" {
		var list []models.DriftItem
		err := json.Unmarshal([]byte(dr.DriftItems), &list)
		if err == nil {
			dr.DriftItemsList = list
		}
	}
	dr.RemediationLogList = nil
	if dr.RemediationLog != "" && dr.RemediationLog != "[]" {
		var list []models.RemediationEntry
		err := json.Unmarshal([]byte(dr.RemediationLog), &list)
		if err == nil {
			dr.RemediationLogList = list
		}
	}
	if dr.ExpectedConfig != "" {
		var m map[string]interface{}
		if err := json.Unmarshal([]byte(dr.ExpectedConfig), &m); err == nil {
			dr.ExpectedConfigData = m
		}
	}
	if dr.ActualConfig != "" {
		var m map[string]interface{}
		if err := json.Unmarshal([]byte(dr.ActualConfig), &m); err == nil {
			dr.ActualConfigData = m
		}
	}
	return dr, nil
}
