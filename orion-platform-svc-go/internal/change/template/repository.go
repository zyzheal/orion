// SQLx-backed repository for the ADR-015 three-layer Change model.
//
// Depends on migrations 755 (change_templates), 756 (change_sops),
// 757 (change_sop_steps), and 758 (tickets change_template_id).
//
// Concurrency: all methods are tenant-scoped via the tenant_id column.
// UPDATE methods on SOP/Step take an optional expectedVersion for
// optimistic-lock semantics (ADR-010 方案 C style).
package template

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"time"

	"github.com/jmoiron/sqlx"
)

// ErrNotFound is returned when a requested row does not exist.
var ErrNotFound = errors.New("change/template: not found")

// ErrVersionMismatch is returned when an optimistic-lock UPDATE finds the
// row's version differs from expectedVersion.
var ErrVersionMismatch = errors.New("change/template: version mismatch")

// ErrDuplicate is returned when a UNIQUE constraint violation occurs on
// tenant-scoped create (e.g. two templates with the same name in one tenant).
var ErrDuplicate = errors.New("change/template: duplicate")

// Repository defines the persistence contract for the ChangeTemplate model.
// Interface-first so service/handler can be tested with a mock.
type Repository interface {
	// --- Templates ---
	CreateTemplate(ctx context.Context, tenantID string, req *CreateChangeTemplateRequest, createdBy string) (*ChangeTemplate, error)
	GetTemplate(ctx context.Context, tenantID, id string) (*ChangeTemplate, error)
	ListTemplates(ctx context.Context, tenantID string, onlyActive bool) ([]*ChangeTemplate, error)
	UpdateTemplate(ctx context.Context, tenantID, id string, req *UpdateChangeTemplateRequest) (*ChangeTemplate, error)
	DeleteTemplate(ctx context.Context, tenantID, id string) (bool, error)

	// --- SOPs ---
	CreateSOP(ctx context.Context, tenantID string, req *CreateChangeSOPRequest, createdBy string) (*ChangeSOP, error)
	GetSOP(ctx context.Context, tenantID, id string) (*ChangeSOP, error)
	GetSOPDetail(ctx context.Context, tenantID, id string) (*SOPDetail, error)
	ListSOPs(ctx context.Context, tenantID, templateID string, onlyActive bool) ([]*ChangeSOP, error)
	UpdateSOP(ctx context.Context, tenantID, id string, req *UpdateChangeSOPRequest) (*ChangeSOP, error)
	DeleteSOP(ctx context.Context, tenantID, id string) (bool, error)

	// --- Steps ---
	CreateStep(ctx context.Context, tenantID string, req *CreateChangeSopStepRequest, createdBy string) (*ChangeSopStep, error)
	GetStep(ctx context.Context, tenantID, id string) (*ChangeSopStep, error)
	ListSteps(ctx context.Context, tenantID, sopID string) ([]*ChangeSopStep, error)
	UpdateStep(ctx context.Context, tenantID, id string, req *UpdateChangeSopStepRequest) (*ChangeSopStep, error)
	DeleteStep(ctx context.Context, tenantID, id string) (bool, error)
}

// PostgresRepository is the sqlx-backed implementation of Repository.
// Zero value is not usable — call NewPostgresRepository.
type PostgresRepository struct {
	db *sqlx.DB
}

// Compile-time assertion.
var _ Repository = (*PostgresRepository)(nil)

// NewPostgresRepository constructs a Repository backed by the given *sqlx.DB.
// db must not be nil.
func NewPostgresRepository(db *sqlx.DB) *PostgresRepository {
	if db == nil {
		return nil
	}
	return &PostgresRepository{db: db}
}

// --- Row scan targets ---

type templateRow struct {
	ID           string    `db:"id"`
	TenantID     string    `db:"tenant_id"`
	Name         string    `db:"name"`
	Description  *string   `db:"description"`
	IsActive     bool      `db:"is_active"`
	Authority    string    `db:"authority"`
	TemplateType string    `db:"template_type"`
	TeamUUID     *string   `db:"team_uuid"`
	CreatedBy    string    `db:"created_by"`
	CreatedAt    time.Time `db:"created_at"`
	UpdatedAt    time.Time `db:"updated_at"`
}

type sopRow struct {
	ID          string    `db:"id"`
	TenantID    string    `db:"tenant_id"`
	TemplateID  string    `db:"template_id"`
	Name        string    `db:"name"`
	Description *string   `db:"description"`
	IsActive    bool      `db:"is_active"`
	Authority   string    `db:"authority"`
	SOPType     string    `db:"sop_type"`
	TeamUUID    *string   `db:"team_uuid"`
	Version     int32     `db:"version"`
	CreatedBy   string    `db:"created_by"`
	CreatedAt   time.Time `db:"created_at"`
	UpdatedAt   time.Time `db:"updated_at"`
}

type stepRow struct {
	ID              string     `db:"id"`
	TenantID        string     `db:"tenant_id"`
	SOPID           string     `db:"sop_id"`
	Code            string     `db:"code"`
	Name            string     `db:"name"`
	Content         *string    `db:"content"`
	PlanStartDate   *time.Time `db:"plan_start_date"`
	StartTimeWindow *string    `db:"start_time_window"`
	EndTimeWindow   *string    `db:"end_time_window"`
	Worker          *string    `db:"worker"`
	FileIDs         []byte     `db:"file_ids"`
	SortOrder       int32      `db:"sort_order"`
	Version         int32      `db:"version"`
	CreatedBy       string     `db:"created_by"`
	CreatedAt       time.Time  `db:"created_at"`
	UpdatedAt       time.Time  `db:"updated_at"`
}

// --- Row-to-model conversions ---

func (r templateRow) toModel() *ChangeTemplate {
	return &ChangeTemplate{
		ID:           r.ID,
		TenantID:     r.TenantID,
		Name:         r.Name,
		Description:  r.Description,
		IsActive:     r.IsActive,
		Authority:    Authority(r.Authority),
		TemplateType: TemplateType(r.TemplateType),
		TeamUUID:     r.TeamUUID,
		CreatedBy:    r.CreatedBy,
		CreatedAt:    r.CreatedAt,
		UpdatedAt:    r.UpdatedAt,
	}
}

func (r sopRow) toModel() *ChangeSOP {
	return &ChangeSOP{
		ID:         r.ID,
		TenantID:   r.TenantID,
		TemplateID: r.TemplateID,
		Name:       r.Name,
		Description: r.Description,
		IsActive:   r.IsActive,
		Authority:  Authority(r.Authority),
		SOPType:    TemplateType(r.SOPType),
		TeamUUID:   r.TeamUUID,
		Version:    r.Version,
		CreatedBy:  r.CreatedBy,
		CreatedAt:  r.CreatedAt,
		UpdatedAt:  r.UpdatedAt,
	}
}

// fileIDsDecoder is a decode hook so []byte -> []string via JSON.
// The repository handles JSONB <-> []string inline to keep models simple.

func (r stepRow) toModel(fileIDs []string) *ChangeSopStep {
	return &ChangeSopStep{
		ID:              r.ID,
		TenantID:        r.TenantID,
		SOPID:           r.SOPID,
		Code:            r.Code,
		Name:            r.Name,
		Content:         r.Content,
		PlanStartDate:   r.PlanStartDate,
		StartTimeWindow: r.StartTimeWindow,
		EndTimeWindow:   r.EndTimeWindow,
		Worker:          r.Worker,
		FileIDs:         fileIDs,
		SortOrder:       r.SortOrder,
		Version:         r.Version,
		CreatedBy:       r.CreatedBy,
		CreatedAt:       r.CreatedAt,
		UpdatedAt:       r.UpdatedAt,
	}
}

// --- Template methods ---

func (r *PostgresRepository) CreateTemplate(ctx context.Context, tenantID string, req *CreateChangeTemplateRequest, createdBy string) (*ChangeTemplate, error) {
	if req == nil {
		return nil, errors.New("change/template: nil request")
	}
	authority := AuthorityPublic
	if req.Authority != "" {
		authority = req.Authority
	}
	tt := TemplateTypeStandard
	if req.TemplateType != "" {
		tt = req.TemplateType
	}
	isActive := true
	if req.IsActive != nil {
		isActive = *req.IsActive
	}

	const q = `
		INSERT INTO change_templates
			(tenant_id, name, description, is_active, authority,
			 template_type, team_uuid, created_by, updated_at)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())
		RETURNING id, tenant_id, name, description, is_active, authority,
				  template_type, team_uuid, created_by, created_at, updated_at`
	row := templateRow{}
	err := r.db.QueryRowxContext(ctx, q,
		tenantID, req.Name, nullString(req.Description), isActive,
		authority, tt, nullString(req.TeamUUID), createdBy,
	).StructScan(&row)
	if err != nil {
		if isUniqueViolation(err) {
			return nil, ErrDuplicate
		}
		return nil, fmt.Errorf("change/template: create: %w", err)
	}
	return row.toModel(), nil
}

func (r *PostgresRepository) GetTemplate(ctx context.Context, tenantID, id string) (*ChangeTemplate, error) {
	const q = `
		SELECT id, tenant_id, name, description, is_active, authority,
			   template_type, team_uuid, created_by, created_at, updated_at
		FROM change_templates
		WHERE tenant_id = $1 AND id = $2`
	row := templateRow{}
	err := r.db.QueryRowxContext(ctx, q, tenantID, id).StructScan(&row)
	if errors.Is(err, sql.ErrNoRows) {
		return nil, ErrNotFound
	}
	if err != nil {
		return nil, fmt.Errorf("change/template: get: %w", err)
	}
	return row.toModel(), nil
}

func (r *PostgresRepository) ListTemplates(ctx context.Context, tenantID string, onlyActive bool) ([]*ChangeTemplate, error) {
	q := `
		SELECT id, tenant_id, name, description, is_active, authority,
			   template_type, team_uuid, created_by, created_at, updated_at
		FROM change_templates
		WHERE tenant_id = $1`
	args := []any{tenantID}
	if onlyActive {
		q += " AND is_active = TRUE"
	}
	q += " ORDER BY created_at DESC, id DESC"

	rows, err := r.db.QueryxContext(ctx, q, args...)
	if err != nil {
		return nil, fmt.Errorf("change/template: list: %w", err)
	}
	defer rows.Close()

	out := make([]*ChangeTemplate, 0)
	for rows.Next() {
		row := templateRow{}
		if err := rows.StructScan(&row); err != nil {
			return nil, fmt.Errorf("change/template: list scan: %w", err)
		}
		out = append(out, row.toModel())
	}
	return out, rows.Err()
}

func (r *PostgresRepository) UpdateTemplate(ctx context.Context, tenantID, id string, req *UpdateChangeTemplateRequest) (*ChangeTemplate, error) {
	if req == nil {
		return nil, errors.New("change/template: nil request")
	}
	setClauses := []string{"updated_at = NOW()"}
	args := make([]any, 0, 6)
	argN := 1
	if req.Name != nil {
		setClauses = append(setClauses, fmt.Sprintf("name = $%d", argN))
		args = append(args, *req.Name)
		argN++
	}
	if req.Description != nil {
		setClauses = append(setClauses, fmt.Sprintf("description = $%d", argN))
		args = append(args, *req.Description)
		argN++
	}
	if req.IsActive != nil {
		setClauses = append(setClauses, fmt.Sprintf("is_active = $%d", argN))
		args = append(args, *req.IsActive)
		argN++
	}
	if req.Authority != nil {
		setClauses = append(setClauses, fmt.Sprintf("authority = $%d", argN))
		args = append(args, *req.Authority)
		argN++
	}
	if req.TemplateType != nil {
		setClauses = append(setClauses, fmt.Sprintf("template_type = $%d", argN))
		args = append(args, *req.TemplateType)
		argN++
	}
	if req.TeamUUID != nil {
		setClauses = append(setClauses, fmt.Sprintf("team_uuid = $%d", argN))
		args = append(args, *req.TeamUUID)
		argN++
	}

	args = append(args, tenantID, id)
	q := fmt.Sprintf(
		`UPDATE change_templates SET %s
		 WHERE tenant_id = $%d AND id = $%d
		 RETURNING id, tenant_id, name, description, is_active, authority,
				   template_type, team_uuid, created_by, created_at, updated_at`,
		joinComma(setClauses), argN+1, argN+2,
	)

	row := templateRow{}
	err := r.db.QueryRowxContext(ctx, q, args...).StructScan(&row)
	if errors.Is(err, sql.ErrNoRows) {
		return nil, ErrNotFound
	}
	if err != nil {
		if isUniqueViolation(err) {
			return nil, ErrDuplicate
		}
		return nil, fmt.Errorf("change/template: update: %w", err)
	}
	return row.toModel(), nil
}

func (r *PostgresRepository) DeleteTemplate(ctx context.Context, tenantID, id string) (bool, error) {
	const q = `DELETE FROM change_templates WHERE tenant_id = $1 AND id = $2`
	res, err := r.db.ExecContext(ctx, q, tenantID, id)
	if err != nil {
		return false, fmt.Errorf("change/template: delete: %w", err)
	}
	n, err := res.RowsAffected()
	if err != nil {
		return false, fmt.Errorf("change/template: delete rowsAffected: %w", err)
	}
	return n > 0, nil
}

// --- Helpers ---

// nullString returns nil when s is nil, otherwise &s (for nullable columns).
func nullString(s *string) *string {
	return s
}

// joinComma joins a list of SQL SET clauses with commas.
func joinComma(parts []string) string {
	out := ""
	for i, p := range parts {
		if i > 0 {
			out += ", "
		}
		out += p
	}
	return out
}

// isUniqueViolation detects Postgres SQLSTATE 23505 (unique_violation).
// The pgx driver wraps this as *pgconn.PgError; we accept the interface
// to avoid a hard import.
func isUniqueViolation(err error) bool {
	if err == nil {
		return false
	}
	// pgx error type has Code() method returning SQLSTATE.
	if ce, ok := err.(interface{ Code() string }); ok {
		return ce.Code() == "23505"
	}
	// Fallback: string match on the standard pg error prefix.
	return err.Error() != "" && containsUniqueViolation(err.Error())
}

func containsUniqueViolation(msg string) bool {
	// Postgres standard message: 'duplicate key value violates unique constraint "..."'.
	const marker = "duplicate key value violates unique constraint"
	return indexOf(msg, marker) >= 0
}

func indexOf(hay, needle string) int {
	if needle == "" {
		return 0
	}
	for i := 0; i+len(needle) <= len(hay); i++ {
		if hay[i:i+len(needle)] == needle {
			return i
		}
	}
	return -1
}
