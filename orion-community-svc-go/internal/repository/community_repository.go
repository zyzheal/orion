package repository

import (
	"context"
	"fmt"
	"strings"

	"orion/community-svc-go/internal/models"

	"github.com/jmoiron/sqlx"
)

type Repository struct {
	db *sqlx.DB
}

func NewRepository(db *sqlx.DB) *Repository {
	return &Repository{db: db}
}

// ============================================================
// Contributions
// ============================================================

func (r *Repository) CreateContribution(ctx context.Context, c *models.Contribution) error {
	_, err := r.db.ExecContext(ctx,
		`INSERT INTO contributions (id, tenant_id, user_id, type, title, description, repository, url, tags, status, created_at, updated_at)
		 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
		c.ID, c.TenantID, c.UserID, c.Type, c.Title, c.Description,
		c.Repository, c.URL, c.Tags, c.Status, c.CreatedAt, c.UpdatedAt,
	)
	return err
}

func (r *Repository) ListContributions(ctx context.Context, tenantID string, filters *models.ContributionFilters, offset, limit int) ([]models.Contribution, error) {
	query := `SELECT id, tenant_id, user_id, type, title, description, repository, url, tags, status, created_at, updated_at
		      FROM contributions WHERE tenant_id = $1`
	args := []interface{}{tenantID}
	argIdx := 2

	if filters != nil {
		if filters.Type != "" {
			query += fmt.Sprintf(" AND type = $%d", argIdx)
			args = append(args, filters.Type)
			argIdx++
		}
		if filters.Status != "" {
			query += fmt.Sprintf(" AND status = $%d", argIdx)
			args = append(args, filters.Status)
			argIdx++
		}
		if filters.UserID != "" {
			query += fmt.Sprintf(" AND user_id = $%d", argIdx)
			args = append(args, filters.UserID)
			argIdx++
		}
		if len(filters.Tags) > 0 {
			query += fmt.Sprintf(" AND tags ?| $%d", argIdx)
			args = append(args, filters.Tags)
			argIdx++
		}
	}

	query += fmt.Sprintf(" ORDER BY created_at DESC OFFSET $%d LIMIT $%d", argIdx, argIdx+1)
	args = append(args, offset, limit)

	var items []models.Contribution
	err := r.db.SelectContext(ctx, &items, query, args...)
	return items, err
}

func (r *Repository) CountContributions(ctx context.Context, tenantID string, filters *models.ContributionFilters) (int, error) {
	query := `SELECT COUNT(*) FROM contributions WHERE tenant_id = $1`
	args := []interface{}{tenantID}
	argIdx := 2

	if filters != nil {
		if filters.Type != "" {
			query += fmt.Sprintf(" AND type = $%d", argIdx)
			args = append(args, filters.Type)
			argIdx++
		}
		if filters.Status != "" {
			query += fmt.Sprintf(" AND status = $%d", argIdx)
			args = append(args, filters.Status)
			argIdx++
		}
		if filters.UserID != "" {
			query += fmt.Sprintf(" AND user_id = $%d", argIdx)
			args = append(args, filters.UserID)
			argIdx++
		}
		if len(filters.Tags) > 0 {
			query += fmt.Sprintf(" AND tags ?| $%d", argIdx)
			args = append(args, filters.Tags)
			argIdx++
		}
	}

	var count int
	err := r.db.GetContext(ctx, &count, query, args...)
	return count, err
}

func (r *Repository) GetContributionByID(ctx context.Context, tenantID, id string) (*models.Contribution, error) {
	var c models.Contribution
	err := r.db.GetContext(ctx, &c,
		`SELECT id, tenant_id, user_id, type, title, description, repository, url, tags, status, created_at, updated_at
		 FROM contributions WHERE id = $1 AND tenant_id = $2`, id, tenantID)
	if err != nil {
		return nil, err
	}
	return &c, nil
}

func (r *Repository) DeleteContribution(ctx context.Context, tenantID, id string) error {
	result, err := r.db.ExecContext(ctx,
		`DELETE FROM contributions WHERE id = $1 AND tenant_id = $2`, id, tenantID)
	if err != nil {
		return err
	}
	rows, _ := result.RowsAffected()
	if rows == 0 {
		return fmt.Errorf("contribution not found")
	}
	return nil
}

// ============================================================
// Best Practices
// ============================================================

func (r *Repository) CreateBestPractice(ctx context.Context, bp *models.BestPractice) error {
	_, err := r.db.ExecContext(ctx,
		`INSERT INTO best_practices (id, tenant_id, title, description, category, tags, content, author_id, author_name, status, votes, views, created_at, updated_at)
		 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)`,
		bp.ID, bp.TenantID, bp.Title, bp.Description, bp.Category,
		bp.Tags, bp.Content, bp.AuthorID, bp.AuthorName,
		bp.Status, bp.Votes, bp.Views, bp.CreatedAt, bp.UpdatedAt,
	)
	return err
}

func (r *Repository) ListBestPractices(ctx context.Context, tenantID string, filters *models.BestPracticeFilters, offset, limit int) ([]models.BestPractice, error) {
	query := `SELECT id, tenant_id, title, description, category, tags, content, author_id, author_name, status, votes, views, created_at, updated_at
		      FROM best_practices WHERE tenant_id = $1`
	args := []interface{}{tenantID}
	argIdx := 2

	if filters != nil {
		if filters.Category != "" {
			query += fmt.Sprintf(" AND category = $%d", argIdx)
			args = append(args, filters.Category)
			argIdx++
		}
		if filters.Status != "" {
			query += fmt.Sprintf(" AND status = $%d", argIdx)
			args = append(args, filters.Status)
			argIdx++
		}
		if filters.AuthorID != "" {
			query += fmt.Sprintf(" AND author_id = $%d", argIdx)
			args = append(args, filters.AuthorID)
			argIdx++
		}
		if len(filters.Tags) > 0 {
			query += fmt.Sprintf(" AND tags ?| $%d", argIdx)
			args = append(args, filters.Tags)
			argIdx++
		}
		if filters.Search != "" {
			search := "%" + strings.ToLower(filters.Search) + "%"
			query += fmt.Sprintf(" AND (LOWER(title) LIKE $%d OR LOWER(description) LIKE $%d)", argIdx, argIdx+1)
			args = append(args, search, search)
			argIdx += 2
		}
	}

	query += fmt.Sprintf(" ORDER BY votes DESC OFFSET $%d LIMIT $%d", argIdx, argIdx+1)
	args = append(args, offset, limit)

	var items []models.BestPractice
	err := r.db.SelectContext(ctx, &items, query, args...)
	return items, err
}

func (r *Repository) CountBestPractices(ctx context.Context, tenantID string, filters *models.BestPracticeFilters) (int, error) {
	query := `SELECT COUNT(*) FROM best_practices WHERE tenant_id = $1`
	args := []interface{}{tenantID}
	argIdx := 2

	if filters != nil {
		if filters.Category != "" {
			query += fmt.Sprintf(" AND category = $%d", argIdx)
			args = append(args, filters.Category)
			argIdx++
		}
		if filters.Status != "" {
			query += fmt.Sprintf(" AND status = $%d", argIdx)
			args = append(args, filters.Status)
			argIdx++
		}
		if filters.AuthorID != "" {
			query += fmt.Sprintf(" AND author_id = $%d", argIdx)
			args = append(args, filters.AuthorID)
			argIdx++
		}
		if len(filters.Tags) > 0 {
			query += fmt.Sprintf(" AND tags ?| $%d", argIdx)
			args = append(args, filters.Tags)
			argIdx++
		}
		if filters.Search != "" {
			search := "%" + strings.ToLower(filters.Search) + "%"
			query += fmt.Sprintf(" AND (LOWER(title) LIKE $%d OR LOWER(description) LIKE $%d)", argIdx, argIdx+1)
			args = append(args, search, search)
			argIdx += 2
		}
	}

	var count int
	err := r.db.GetContext(ctx, &count, query, args...)
	return count, err
}

func (r *Repository) GetBestPracticeByID(ctx context.Context, tenantID, id string) (*models.BestPractice, error) {
	var bp models.BestPractice
	err := r.db.GetContext(ctx, &bp,
		`SELECT id, tenant_id, title, description, category, tags, content, author_id, author_name, status, votes, views, created_at, updated_at
		 FROM best_practices WHERE id = $1 AND tenant_id = $2`, id, tenantID)
	if err != nil {
		return nil, err
	}
	return &bp, nil
}

func (r *Repository) IncrementBestPracticeViews(ctx context.Context, id string) error {
	_, err := r.db.ExecContext(ctx,
		`UPDATE best_practices SET views = views + 1, updated_at = NOW() WHERE id = $1`, id)
	return err
}

func (r *Repository) VoteBestPractice(ctx context.Context, id string, delta int) (*models.BestPractice, error) {
	_, err := r.db.ExecContext(ctx,
		`UPDATE best_practices SET votes = votes + $1, updated_at = NOW() WHERE id = $2`, delta, id)
	if err != nil {
		return nil, err
	}
	var bp models.BestPractice
	err = r.db.GetContext(ctx, &bp,
		`SELECT id, tenant_id, title, description, category, tags, content, author_id, author_name, status, votes, views, created_at, updated_at
		 FROM best_practices WHERE id = $1`, id)
	if err != nil {
		return nil, err
	}
	return &bp, nil
}

func (r *Repository) DeleteBestPractice(ctx context.Context, tenantID, id string) error {
	result, err := r.db.ExecContext(ctx,
		`DELETE FROM best_practices WHERE id = $1 AND tenant_id = $2`, id, tenantID)
	if err != nil {
		return err
	}
	rows, _ := result.RowsAffected()
	if rows == 0 {
		return fmt.Errorf("best practice not found")
	}
	return nil
}

// ============================================================
// Contributors (derived from contributions)
// ============================================================

func (r *Repository) ListContributors(ctx context.Context, tenantID string, limit int) ([]models.Contributor, error) {
	query := `
		SELECT
			c.user_id,
			'user-' || SUBSTRING(c.user_id FROM 1 FOR 8) AS username,
			COUNT(*) AS contributions,
			array_agg(DISTINCT c.type) AS types,
			MIN(c.created_at) AS joined_at,
			COUNT(*) FILTER (WHERE c.status = 'approved') * 10 AS reputation
		FROM contributions c
		WHERE c.tenant_id = $1
		GROUP BY c.user_id
		ORDER BY reputation DESC
		LIMIT $2`
	var items []models.Contributor
	err := r.db.SelectContext(ctx, &items, query, tenantID, limit)
	return items, err
}

func (r *Repository) GetContributor(ctx context.Context, tenantID, userID string) (*models.Contributor, error) {
	query := `
		SELECT
			c.user_id,
			'user-' || SUBSTRING(c.user_id FROM 1 FOR 8) AS username,
			COUNT(*) AS contributions,
			array_agg(DISTINCT c.type) AS types,
			MIN(c.created_at) AS joined_at,
			COUNT(*) FILTER (WHERE c.status = 'approved') * 10 AS reputation
		FROM contributions c
		WHERE c.tenant_id = $1 AND c.user_id = $2
		GROUP BY c.user_id`
	var contrib models.Contributor
	err := r.db.GetContext(ctx, &contrib, query, tenantID, userID)
	if err != nil {
		return nil, err
	}
	return &contrib, nil
}

// ============================================================
// Community Plugins
// ============================================================

func (r *Repository) CreatePlugin(ctx context.Context, p *models.CommunityPlugin) error {
	_, err := r.db.ExecContext(ctx,
		`INSERT INTO community_plugins (id, tenant_id, name, version, description, author, category, repository, compatibility, status, submitted_at)
		 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
		p.ID, p.TenantID, p.Name, p.Version, p.Description,
		p.Author, p.Category, p.Repository, p.Compatibility,
		p.Status, p.SubmittedAt,
	)
	return err
}

func (r *Repository) ListPlugins(ctx context.Context, tenantID string, filters *models.PluginFilters, offset, limit int) ([]models.CommunityPlugin, error) {
	query := `SELECT id, tenant_id, name, version, description, author, category, repository, compatibility, status, review_comment, submitted_at, reviewed_at
		      FROM community_plugins WHERE tenant_id = $1`
	args := []interface{}{tenantID}
	argIdx := 2

	if filters != nil {
		if filters.Category != "" {
			query += fmt.Sprintf(" AND category = $%d", argIdx)
			args = append(args, filters.Category)
			argIdx++
		}
		if filters.Status != "" {
			query += fmt.Sprintf(" AND status = $%d", argIdx)
			args = append(args, filters.Status)
			argIdx++
		}
		if filters.Author != "" {
			query += fmt.Sprintf(" AND author = $%d", argIdx)
			args = append(args, filters.Author)
			argIdx++
		}
	}

	query += fmt.Sprintf(" ORDER BY submitted_at DESC OFFSET $%d LIMIT $%d", argIdx, argIdx+1)
	args = append(args, offset, limit)

	var items []models.CommunityPlugin
	err := r.db.SelectContext(ctx, &items, query, args...)
	return items, err
}

func (r *Repository) CountPlugins(ctx context.Context, tenantID string, filters *models.PluginFilters) (int, error) {
	query := `SELECT COUNT(*) FROM community_plugins WHERE tenant_id = $1`
	args := []interface{}{tenantID}
	argIdx := 2

	if filters != nil {
		if filters.Category != "" {
			query += fmt.Sprintf(" AND category = $%d", argIdx)
			args = append(args, filters.Category)
			argIdx++
		}
		if filters.Status != "" {
			query += fmt.Sprintf(" AND status = $%d", argIdx)
			args = append(args, filters.Status)
			argIdx++
		}
		if filters.Author != "" {
			query += fmt.Sprintf(" AND author = $%d", argIdx)
			args = append(args, filters.Author)
			argIdx++
		}
	}

	var count int
	err := r.db.GetContext(ctx, &count, query, args...)
	return count, err
}

func (r *Repository) GetPluginByID(ctx context.Context, tenantID, id string) (*models.CommunityPlugin, error) {
	var p models.CommunityPlugin
	err := r.db.GetContext(ctx, &p,
		`SELECT id, tenant_id, name, version, description, author, category, repository, compatibility, status, review_comment, submitted_at, reviewed_at
		 FROM community_plugins WHERE id = $1 AND tenant_id = $2`, id, tenantID)
	if err != nil {
		return nil, err
	}
	return &p, nil
}

func (r *Repository) ReviewPlugin(ctx context.Context, id, status, comment string) (*models.CommunityPlugin, error) {
	_, err := r.db.ExecContext(ctx,
		`UPDATE community_plugins SET status = $1, review_comment = $2, reviewed_at = NOW() WHERE id = $3`,
		status, comment, id)
	if err != nil {
		return nil, err
	}
	var p models.CommunityPlugin
	err = r.db.GetContext(ctx, &p,
		`SELECT id, tenant_id, name, version, description, author, category, repository, compatibility, status, review_comment, submitted_at, reviewed_at
		 FROM community_plugins WHERE id = $1`, id)
	if err != nil {
		return nil, err
	}
	return &p, nil
}

// ============================================================
// Badges
// ============================================================

func (r *Repository) CreateBadge(ctx context.Context, b *models.Badge) error {
	_, err := r.db.ExecContext(ctx,
		`INSERT INTO badges (id, tenant_id, user_id, type, name, description, awarded_at)
		 VALUES ($1, $2, $3, $4, $5, $6, $7)`,
		b.ID, b.TenantID, b.UserID, b.Type, b.Name, b.Description, b.AwardedAt,
	)
	return err
}

func (r *Repository) ListUserBadges(ctx context.Context, userID string) ([]models.Badge, error) {
	var items []models.Badge
	err := r.db.SelectContext(ctx, &items,
		`SELECT id, tenant_id, user_id, type, name, description, awarded_at
		 FROM badges WHERE user_id = $1 ORDER BY awarded_at DESC`, userID)
	return items, err
}

func (r *Repository) ListUserBadgesByTenant(ctx context.Context, tenantID, userID string) ([]models.Badge, error) {
	var items []models.Badge
	err := r.db.SelectContext(ctx, &items,
		`SELECT id, tenant_id, user_id, type, name, description, awarded_at
		 FROM badges WHERE tenant_id = $1 AND user_id = $2 ORDER BY awarded_at DESC`, tenantID, userID)
	return items, err
}

// ============================================================
// Incentive Programs
// ============================================================

func (r *Repository) CreateIncentiveProgram(ctx context.Context, p *models.IncentiveProgram) error {
	_, err := r.db.ExecContext(ctx,
		`INSERT INTO incentive_programs (id, tenant_id, name, description, config, status, created_at, updated_at)
		 VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
		p.ID, p.TenantID, p.Name, p.Description, p.Config, p.Status, p.CreatedAt, p.UpdatedAt,
	)
	return err
}

func (r *Repository) ListIncentivePrograms(ctx context.Context, tenantID string) ([]models.IncentiveProgram, error) {
	var items []models.IncentiveProgram
	err := r.db.SelectContext(ctx, &items,
		`SELECT id, tenant_id, name, description, config, status, created_at, updated_at
		 FROM incentive_programs WHERE tenant_id = $1 ORDER BY created_at DESC`, tenantID)
	return items, err
}

func (r *Repository) GetIncentiveProgramByID(ctx context.Context, tenantID, id string) (*models.IncentiveProgram, error) {
	var p models.IncentiveProgram
	err := r.db.GetContext(ctx, &p,
		`SELECT id, tenant_id, name, description, config, status, created_at, updated_at
		 FROM incentive_programs WHERE id = $1 AND tenant_id = $2`, id, tenantID)
	if err != nil {
		return nil, err
	}
	return &p, nil
}

func (r *Repository) UpdateIncentiveProgramStatus(ctx context.Context, tenantID, id, status string) (*models.IncentiveProgram, error) {
	_, err := r.db.ExecContext(ctx,
		`UPDATE incentive_programs SET status = $1, updated_at = NOW() WHERE id = $2 AND tenant_id = $3`,
		status, id, tenantID)
	if err != nil {
		return nil, err
	}
	return r.GetIncentiveProgramByID(ctx, tenantID, id)
}

// ============================================================
// Mentorship Pairs
// ============================================================

func (r *Repository) CreateMentorshipPair(ctx context.Context, m *models.MentorshipPair) error {
	_, err := r.db.ExecContext(ctx,
		`INSERT INTO mentorship_pairs (id, tenant_id, mentor_id, mentee_id, status, assigned_at, goals)
		 VALUES ($1, $2, $3, $4, $5, $6, $7)`,
		m.ID, m.TenantID, m.MentorID, m.MenteeID, m.Status, m.AssignedAt, m.Goals,
	)
	return err
}

func (r *Repository) ListMentorshipPairs(ctx context.Context, tenantID string) ([]models.MentorshipPair, error) {
	var items []models.MentorshipPair
	err := r.db.SelectContext(ctx, &items,
		`SELECT id, tenant_id, mentor_id, mentee_id, status, assigned_at, goals
		 FROM mentorship_pairs WHERE tenant_id = $1 ORDER BY assigned_at DESC`, tenantID)
	return items, err
}

func (r *Repository) GetMentorshipPairByID(ctx context.Context, tenantID, id string) (*models.MentorshipPair, error) {
	var m models.MentorshipPair
	err := r.db.GetContext(ctx, &m,
		`SELECT id, tenant_id, mentor_id, mentee_id, status, assigned_at, goals
		 FROM mentorship_pairs WHERE id = $1 AND tenant_id = $2`, id, tenantID)
	if err != nil {
		return nil, err
	}
	return &m, nil
}

func (r *Repository) UpdateMentorshipPairStatus(ctx context.Context, tenantID, id, status string) (*models.MentorshipPair, error) {
	_, err := r.db.ExecContext(ctx,
		`UPDATE mentorship_pairs SET status = $1 WHERE id = $2 AND tenant_id = $3`,
		status, id, tenantID)
	if err != nil {
		return nil, err
	}
	return r.GetMentorshipPairByID(ctx, tenantID, id)
}
