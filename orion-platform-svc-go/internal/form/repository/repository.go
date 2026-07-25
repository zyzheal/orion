package repository

import (
	"context"
	"database/sql"
	"encoding/json"
	"errors"
	"fmt"
	"strings"
	"time"

	"orion/go-common/pkg/sentinel"
	"orion/platform-svc-go/internal/form/models"

	"github.com/google/uuid"
	"github.com/jmoiron/sqlx"
)

type Repository struct {
	db *sqlx.DB
}

func NewRepository(db *sqlx.DB) *Repository {
	return &Repository{db: db}
}

// --- Forms (FormDefinition) ---

func (r *Repository) CreateForm(ctx context.Context, tenantID string, req models.CreateFormRequest, layoutJSON, fieldsJSON string) (*models.FormDefinition, error) {
	id := uuid.New().String()
	now := time.Now().UTC()
	form := &models.FormDefinition{
		ID:          id,
		TenantID:    tenantID,
		Name:        req.Name,
		Code:        req.Code,
		Category:    req.Category,
		Description: req.Description,
		Layout:      layoutJSON,
		Fields:      fieldsJSON,
		Status:      "draft",
		Version:     1,
		CreatedAt:   now,
		UpdatedAt:   now,
	}
	_, err := r.db.NamedExecContext(ctx,
		`INSERT INTO forms (id, tenant_id, name, code, category, description, layout, fields, status, version, created_at, updated_at)
		 VALUES (:id, :tenantId, :name, :code, :category, :description, :layout, :fields, :status, :version, :createdAt, :updatedAt)`,
		form)
	return form, err
}

func (r *Repository) GetFormByID(ctx context.Context, tenantID, id string) (*models.FormDefinition, error) {
	var form models.FormDefinition
	err := r.db.GetContext(ctx, &form,
		`SELECT * FROM forms WHERE id=$1 AND tenant_id=$2`, id, tenantID)
	if errors.Is(err, sql.ErrNoRows) {
		return nil, sentinel.NotFound
	}
	return &form, err
}

func (r *Repository) GetFormByCode(ctx context.Context, tenantID, code string) (*models.FormDefinition, error) {
	var form models.FormDefinition
	err := r.db.GetContext(ctx, &form,
		`SELECT * FROM forms WHERE code=$1 AND tenant_id=$2 AND status='active'`, code, tenantID)
	if errors.Is(err, sql.ErrNoRows) {
		return nil, sentinel.NotFound
	}
	return &form, err
}

func (r *Repository) ListForms(ctx context.Context, tenantID, category string) ([]models.FormDefinition, error) {
	var forms []models.FormDefinition
	query := `SELECT * FROM forms WHERE tenant_id=$1`
	args := []interface{}{tenantID}
	if category != "" {
		query += ` AND category=$2`
		args = append(args, category)
	}
	query += ` ORDER BY created_at DESC`
	err := r.db.SelectContext(ctx, &forms, query, args...)
	return forms, err
}

func (r *Repository) UpdateForm(ctx context.Context, tenantID, id string, updates map[string]interface{}) (*models.FormDefinition, error) {
	if len(updates) == 0 {
		return nil, sentinel.NotFound
	}
	updates["updated_at"] = time.Now().UTC()
	setClauses := []string{}
	args := []interface{}{}
	i := 1
	for key, val := range updates {
		setClauses = append(setClauses, fmt.Sprintf("%s = $%d", key, i))
		args = append(args, val)
		i++
	}
	args = append(args, id, tenantID)
	query := fmt.Sprintf(`UPDATE forms SET %s WHERE id=$%d AND tenant_id=$%d`,
		strings.Join(setClauses, ", "), i, i+1)
	result, err := r.db.ExecContext(ctx, query, args...)
	if err != nil {
		return nil, err
	}
	n, _ := result.RowsAffected()
	if n == 0 {
		return nil, sentinel.NotFound
	}
	return r.GetFormByID(ctx, tenantID, id)
}

func (r *Repository) DeleteForm(ctx context.Context, tenantID, id string) error {
	result, err := r.db.ExecContext(ctx,
		`DELETE FROM forms WHERE id=$1 AND tenant_id=$2`, id, tenantID)
	if err != nil {
		return err
	}
	n, _ := result.RowsAffected()
	if n == 0 {
		return sentinel.NotFound
	}
	return nil
}

// --- FormFields ---

func (r *Repository) CreateFormField(ctx context.Context, tenantID string, formID string, field models.FormField) error {
	field.ID = uuid.New().String()
	field.FormID = formID
	now := time.Now().UTC()
	field.CreatedAt = now
	field.UpdatedAt = now
	_, err := r.db.NamedExecContext(ctx,
		`INSERT INTO form_fields (id, form_id, field_id, label, type, placeholder, required, visible, read_only, validation, options, default_value, dependency, priority, created_at, updated_at)
		 VALUES (:id, :formId, :fieldId, :label, :type, :placeholder, :required, :visible, :readOnly, :validation, :options, :defaultValue, :dependency, :priority, :createdAt, :updatedAt)`,
		field)
	return err
}

func (r *Repository) ListFieldsByFormID(ctx context.Context, tenantID, formID string) ([]models.FormField, error) {
	var fields []models.FormField
	err := r.db.SelectContext(ctx, &fields,
		`SELECT f.* FROM form_fields f JOIN forms fr ON f.form_id = fr.id
		 WHERE f.form_id=$1 AND fr.tenant_id=$2 ORDER BY f.priority ASC`,
		formID, tenantID)
	return fields, err
}

func (r *Repository) UpdateFormField(ctx context.Context, tenantID string, formID string, updates map[string]interface{}) (*models.FormField, error) {
	if len(updates) == 0 {
		return nil, sentinel.NotFound
	}
	updates["updated_at"] = time.Now().UTC()
	setClauses := []string{}
	args := []interface{}{}
	i := 1
	for key, val := range updates {
		setClauses = append(setClauses, fmt.Sprintf("%s = $%d", key, i))
		args = append(args, val)
		i++
	}
	args = append(args, formID, tenantID)
	query := fmt.Sprintf(`UPDATE form_fields SET %s WHERE id=$%d AND form_id IN
		 (SELECT id FROM forms WHERE tenant_id=$%d) RETURNING *`,
		strings.Join(setClauses, ", "), i, i+1)
	var field models.FormField
	err := r.db.GetContext(ctx, &field, query, args...)
	return &field, err
}

func (r *Repository) DeleteFormField(ctx context.Context, tenantID, formID, fieldID string) error {
	// fieldID here means the row's database ID
	result, err := r.db.ExecContext(ctx,
		`DELETE FROM form_fields WHERE id=$1 AND form_id IN (SELECT id FROM forms WHERE tenant_id=$2 AND id=$3)`,
		fieldID, tenantID, formID)
	if err != nil {
		return err
	}
	n, _ := result.RowsAffected()
	if n == 0 {
		return sentinel.NotFound
	}
	return nil
}

// --- FormSubmissions ---

func (r *Repository) CreateSubmission(ctx context.Context, tenantID, formID, submittedBy string, dataJSON, status string) (*models.FormSubmission, error) {
	id := uuid.New().String()
	now := time.Now().UTC()
	sub := &models.FormSubmission{
		ID:          id,
		TenantID:    tenantID,
		FormID:      formID,
		Data:        dataJSON,
		SubmittedBy: submittedBy,
		Status:      status,
		CreatedAt:   now,
		UpdatedAt:   now,
	}
	_, err := r.db.NamedExecContext(ctx,
		`INSERT INTO form_submissions (id, tenant_id, form_id, data, submitted_by, status, created_at, updated_at)
		 VALUES (:id, :tenantId, :formId, :data, :submittedBy, :status, :createdAt, :updatedAt)`,
		sub)
	return sub, err
}

func (r *Repository) GetSubmission(ctx context.Context, tenantID, id string) (*models.FormSubmission, error) {
	var sub models.FormSubmission
	err := r.db.GetContext(ctx, &sub,
		`SELECT * FROM form_submissions WHERE id=$1 AND tenant_id=$2`, id, tenantID)
	if errors.Is(err, sql.ErrNoRows) {
		return nil, sentinel.NotFound
	}
	return &sub, err
}

func (r *Repository) ListSubmissions(ctx context.Context, tenantID, formID string) ([]models.FormSubmission, error) {
	var subs []models.FormSubmission
	err := r.db.SelectContext(ctx, &subs,
		`SELECT * FROM form_submissions WHERE tenant_id=$1 AND form_id=$2 ORDER BY created_at DESC`,
		tenantID, formID)
	return subs, err
}

func (r *Repository) UpdateSubmissionStatus(ctx context.Context, tenantID, id, status string) (*models.FormSubmission, error) {
	_, err := r.db.ExecContext(ctx,
		`UPDATE form_submissions SET status=$1, updated_at=NOW() WHERE id=$2 AND tenant_id=$3`,
		status, id, tenantID)
	if err != nil {
		return nil, err
	}
	return r.GetSubmission(ctx, tenantID, id)
}

// marshalMap marshals a map[string]interface{} to JSON string.
func marshalMap(v map[string]interface{}) (string, error) {
	if v == nil {
		return "{}", nil
	}
	b, err := json.Marshal(v)
	if err != nil {
		return "", err
	}
	return string(b), nil
}
