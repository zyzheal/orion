package repository

import (
	"context"
	"database/sql"
	"fmt"
	"strings"
	"time"

	"orion/platform-svc-go/internal/team/models"

	"github.com/google/uuid"
	"github.com/jmoiron/sqlx"
)

type Repository struct {
	db *sqlx.DB
}

func NewRepository(db *sqlx.DB) *Repository {
	return &Repository{
		db: db,
	}
}

// ==================== Team CRUD ====================

// Create inserts a new team into the database
func (r *Repository) Create(ctx context.Context, m *models.Team) error {
	m.ID = uuid.New().String()
	m.CreatedAt = time.Now().UTC()
	m.UpdatedAt = time.Now().UTC()
	if m.TeamType == "" {
		m.TeamType = "functional"
	}
	query := `INSERT INTO teams (id, tenant_id, name, slug, description, team_type, parent_team_id, external_id, metadata, created_at, updated_at, created_by)
		VALUES (:id, :tenant_id, :name, :slug, :description, :team_type, :parent_team_id, :external_id, :metadata, :created_at, :updated_at, :created_by) RETURNING *`
	rows, err := r.db.NamedQueryContext(ctx, query, m)
	if err != nil {
		return err
	}
	defer rows.Close()
	if rows.Next() {
		return rows.Scan(&m.ID, &m.TenantID, &m.Name, &m.Slug, &m.Description, &m.TeamType,
			&m.ParentTeamID, &m.ExternalID, &m.Metadata, &m.CreatedAt, &m.UpdatedAt, &m.CreatedBy)
	}
	return fmt.Errorf("team not returned after insert")
}

// GetByID retrieves a team by ID within a tenant
func (r *Repository) GetByID(ctx context.Context, tenantID, id string) (*models.Team, error) {
	var m models.Team
	err := r.db.GetContext(ctx, &m, `SELECT * FROM teams WHERE id=$1 AND tenant_id=$2`, id, tenantID)
	if err != nil {
		if err == sql.ErrNoRows {
			return nil, fmt.Errorf("team not found: %w", err)
		}
		return nil, err
	}
	return &m, nil
}

// GetBySlug retrieves a team by slug within a tenant
func (r *Repository) GetBySlug(ctx context.Context, tenantID, slug string) (*models.Team, error) {
	var m models.Team
	err := r.db.GetContext(ctx, &m, `SELECT * FROM teams WHERE slug=$1 AND tenant_id=$2`, slug, tenantID)
	if err != nil {
		if err == sql.ErrNoRows {
			return nil, fmt.Errorf("team not found: %w", err)
		}
		return nil, err
	}
	return &m, nil
}

// List retrieves teams for a tenant with optional type filter and pagination
func (r *Repository) List(ctx context.Context, tenantID string, typeFilter *string, limit, offset int) ([]models.Team, error) {
	if limit <= 0 {
		limit = 50
	}
	if offset < 0 {
		offset = 0
	}

	conditions := []string{"tenant_id = $1"}
	args := []interface{}{tenantID}
	_ = args
	argIdx := 2

	if typeFilter != nil && *typeFilter != "" {
		conditions = append(conditions, fmt.Sprintf("team_type = $%d", argIdx))
		argIdx++
	}

	where := ""
	if len(conditions) > 1 {
		where = " WHERE " + strings.Join(conditions, " AND ")
	}

	var items []models.Team
	err := r.db.SelectContext(ctx, &items,
		fmt.Sprintf("SELECT * FROM teams%s ORDER BY created_at DESC LIMIT $%d OFFSET $%d", where, argIdx, argIdx+1),
		[]interface{}{tenantID, limit, offset}...,
	)
	if err != nil {
		return nil, err
	}
	return items, nil
}

// Update updates team fields by ID within a tenant
func (r *Repository) Update(ctx context.Context, tenantID, id string, updates map[string]interface{}) error {
	updates["updated_at"] = time.Now().UTC()

	// Check for parent_team_id circular reference
	if parentID, ok := updates["parent_team_id"]; ok && parentID != nil {
		parentIDStr, ok := parentID.(string)
		if ok && parentIDStr != "" {
			visited := make(map[string]bool)
			curr := parentIDStr
			for curr != "" && !visited[curr] {
				visited[curr] = true
				var parentParent sql.NullString
				err := r.db.GetContext(ctx, &parentParent,
					`SELECT parent_team_id FROM teams WHERE id=$1 AND tenant_id=$2`, curr, tenantID)
				if err != nil || !parentParent.Valid {
					return fmt.Errorf("parent team not found")
				}
				if curr == id {
					return fmt.Errorf("circular reference detected")
				}
				parentIDStr = parentParent.String
			}
		}
	}

	// Build SET clause dynamically
	setParts := []string{}
	args := []interface{}{}
	argIdx := 1
	for key, val := range updates {
		setParts = append(setParts, fmt.Sprintf("%s = $%d", key, argIdx))
		args = append(args, val)
		argIdx++
	}

	query := fmt.Sprintf("UPDATE teams SET %s WHERE id=$%d AND tenant_id=$%d",
		strings.Join(setParts, ", "), argIdx, argIdx+1)
	args = append(args, id, tenantID)

	result, err := r.db.ExecContext(ctx, query, args...)
	if err != nil {
		return err
	}
	rows, _ := result.RowsAffected()
	if rows == 0 {
		return fmt.Errorf("team not found: %s", id)
	}
	return nil
}

// Delete removes a team by ID within a tenant
func (r *Repository) Delete(ctx context.Context, tenantID, id string) error {
	_, err := r.db.ExecContext(ctx, `DELETE FROM teams WHERE id=$1 AND tenant_id=$2`, id, tenantID)
	return err
}

// GetOrphanedChildrenCount counts teams that have the given team as parent
func (r *Repository) GetOrphanedChildrenCount(ctx context.Context, tenantID, parentID string) (int64, error) {
	var count int64
	err := r.db.GetContext(ctx, &count, `SELECT COUNT(*) FROM teams WHERE parent_team_id=$1 AND tenant_id=$2`, parentID, tenantID)
	return count, err
}

// GetUserTeams retrieves all teams a user belongs to via team_members
func (r *Repository) GetUserTeams(ctx context.Context, userID, tenantID string) ([]models.Team, error) {
	var teams []models.Team
	err := r.db.SelectContext(ctx, &teams, `
		SELECT DISTINCT t.* FROM teams t
		JOIN team_members tm ON tm.team_id = t.id
		WHERE tm.user_id = $1 AND t.tenant_id = $2
		ORDER BY t.name`,
		userID, tenantID,
	)
	if err != nil {
		return nil, err
	}
	return teams, nil
}

// ==================== Team Members ====================

// AddMember adds or updates a team member
func (r *Repository) AddMember(ctx context.Context, m *models.TeamMember) error {
	if m.Role == "" {
		m.Role = "member"
	}
	m.ID = uuid.New().String()
	m.JoinedAt = time.Now().UTC()

	query := `INSERT INTO team_members (id, team_id, user_id, role, added_by, joined_at)
		VALUES ($1, $2, $3, $4, $5, $6)
		ON CONFLICT (team_id, user_id) DO UPDATE SET role = $4`
	_, err := r.db.ExecContext(ctx, query, m.ID, m.TeamID, m.UserID, m.Role, m.AddedBy, m.JoinedAt)
	return err
}

// RemoveMember removes a team member
func (r *Repository) RemoveMember(ctx context.Context, teamID, userID string) (bool, error) {
	result, err := r.db.ExecContext(ctx, `DELETE FROM team_members WHERE team_id=$1 AND user_id=$2`, teamID, userID)
	if err != nil {
		return false, err
	}
	rows, _ := result.RowsAffected()
	return rows > 0, nil
}

// GetMembers retrieves all members of a team
func (r *Repository) GetMembers(ctx context.Context, teamID string) ([]models.TeamMember, error) {
	var members []models.TeamMember
	err := r.db.SelectContext(ctx, &members, `SELECT * FROM team_members WHERE team_id=$1 ORDER BY role DESC, joined_at`, teamID)
	if err != nil {
		return nil, err
	}
	return members, nil
}

// UpdateMemberRole updates a member's role
func (r *Repository) UpdateMemberRole(ctx context.Context, teamID, userID, newRole string) error {
	_, err := r.db.ExecContext(ctx, `UPDATE team_members SET role=$1 WHERE team_id=$2 AND user_id=$3`, newRole, teamID, userID)
	return err
}

// ==================== Team Roles ====================

// AssignRole assigns a role to a team
func (r *Repository) AssignRole(ctx context.Context, teamID, roleName string, grantedBy *string) error {
	_, err := r.db.ExecContext(ctx, `
		INSERT INTO team_roles (id, team_id, role_name, granted_by)
		VALUES ($1, $2, $3, $4)
		ON CONFLICT (team_id, role_name) DO NOTHING`,
		uuid.New().String(), teamID, roleName, grantedBy)
	return err
}

// RemoveRole removes a role assignment from a team
func (r *Repository) RemoveRole(ctx context.Context, teamID, roleName string) (bool, error) {
	result, err := r.db.ExecContext(ctx, `DELETE FROM team_roles WHERE team_id=$1 AND role_name=$2`, teamID, roleName)
	if err != nil {
		return false, err
	}
	rows, _ := result.RowsAffected()
	return rows > 0, nil
}

// GetRoles retrieves all role assignments for a team
func (r *Repository) GetRoles(ctx context.Context, teamID string) ([]models.TeamRole, error) {
	var roles []models.TeamRole
	err := r.db.SelectContext(ctx, &roles, `SELECT * FROM team_roles WHERE team_id=$1`, teamID)
	if err != nil {
		return nil, err
	}
	return roles, nil
}
