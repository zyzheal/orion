package repository

import (
	"context"
	"database/sql"
	"fmt"
	"math"
	"strings"

	"orion/platform-svc-go/internal/plugin-marketplace/models"

	"github.com/google/uuid"
	"github.com/jmoiron/sqlx"
)

// Repository handles all database operations for the plugin marketplace.
type Repository struct {
	db *sqlx.DB
}

// NewRepository creates a new Repository backed by the given sqlx.DB.
func NewRepository(db *sqlx.DB) *Repository {
	return &Repository{db: db}
}

// --- Plugins ---

// CreatePlugin inserts a new plugin and returns it with the generated id.
func (r *Repository) CreatePlugin(ctx context.Context, p *models.Plugin) error {
	p.ID = uuid.New().String()
	now := "EXTRACT(EPOCH FROM now())::bigint"
	_, err := r.db.NamedExecContext(ctx,
		`INSERT INTO plugin_marketplace (id, tenant_id, name, description, author, category,
		   version, tags, icon_url, repository_url, documentation_url, price_cents,
		   main_entry, code, dependencies, platform_api_version, permissions, config_schema,
		   verified, rating_avg, rating_count, download_count, status, created_at, updated_at)
		 VALUES (:id, :tenantId, :name, :description, :author, :category,
		   :version, :tags::jsonb, :iconUrl, :repositoryUrl, :documentationUrl, :priceCents,
		   :mainEntry, :code, :dependencies::jsonb, :platformApiVersion, :permissions::jsonb, :configSchema::jsonb,
		   :verified, :ratingAvg, :ratingCount, :downloadCount, :status, `+now+`, `+now+`)`,
		p)
	return err
}

// GetPlugin retrieves a plugin by its id.
func (r *Repository) GetPlugin(ctx context.Context, id string) (*models.Plugin, error) {
	var p models.Plugin
	err := r.db.GetContext(ctx, &p,
		`SELECT * FROM plugin_marketplace WHERE id=$1`, id)
	if err != nil {
		return nil, err
	}
	return &p, nil
}

// List returns paginated plugins with filters.
func (r *Repository) List(ctx context.Context, filter *models.ListPluginFilter) ([]models.Plugin, error) {
	where, args := buildPluginWhere(filter)
	argIdx := len(args) + 1
	where += fmt.Sprintf(" ORDER BY download_count DESC, created_at DESC LIMIT $%d OFFSET $%d", argIdx, argIdx+1)
	args = append(args, defaultLimit(filter.Limit), defaultOffset(filter.Offset))

	var plugins []models.Plugin
	err := r.db.SelectContext(ctx, &plugins, fmt.Sprintf(`SELECT * FROM plugin_marketplace %s`, where), args...)
	return plugins, err
}

// Count returns the total number of plugins matching the filter.
func (r *Repository) Count(ctx context.Context, filter *models.ListPluginFilter) (int64, error) {
	where, args := buildPluginWhere(filter)
	var total int64
	err := r.db.GetContext(ctx, &total, fmt.Sprintf(`SELECT COUNT(*) FROM plugin_marketplace %s`, where), args...)
	return total, err
}

// IncrementDownloadCount bumps the download count for a plugin.
func (r *Repository) IncrementDownloadCount(ctx context.Context, id string) error {
	_, err := r.db.ExecContext(ctx,
		`UPDATE plugin_marketplace SET download_count = download_count + 1,
		   updated_at = EXTRACT(EPOCH FROM now())::bigint WHERE id=$1`,
		id)
	return err
}

// UpdateRating recalculates and sets the average rating for a plugin.
func (r *Repository) UpdateRating(ctx context.Context, pluginID string) error {
	_, err := r.db.ExecContext(ctx,
		`UPDATE plugin_marketplace
		   SET rating_avg = COALESCE((
			   SELECT ROUND(AVG(rating)::numeric, 2) FROM plugin_reviews WHERE plugin_id=$1
		   ), 0),
			   rating_count = (
			   SELECT COUNT(*) FROM plugin_reviews WHERE plugin_id=$1
		   ),
		   updated_at = EXTRACT(EPOCH FROM now())::bigint
		   WHERE id=$1`,
		pluginID)
	return err
}

// DecrementDownloadCount reduces the download count for a plugin (uninstall).
func (r *Repository) DecrementDownloadCount(ctx context.Context, id string) error {
	_, err := r.db.ExecContext(ctx,
		`UPDATE plugin_marketplace SET download_count = GREATEST(download_count - 1, 0),
		   updated_at = EXTRACT(EPOCH FROM now())::bigint WHERE id=$1`,
		id)
	return err
}

// --- Reviews ---

// CreateReview inserts a review record and returns it.
func (r *Repository) CreateReview(ctx context.Context, rev *models.PluginReview) error {
	rev.ID = uuid.New().String()
	now := "EXTRACT(EPOCH FROM now())::bigint"
	_, err := r.db.NamedExecContext(ctx,
		`INSERT INTO plugin_reviews (id, plugin_id, tenant_id, user_id, rating, comment, created_at)
		   VALUES (:id, :pluginId, :tenantId, :userId, :rating, :comment, `+now+`)`,
		rev)
	return err
}

// GetReviewsByPluginID returns all reviews for a plugin.
func (r *Repository) GetReviewsByPluginID(ctx context.Context, pluginID string) ([]models.PluginReview, error) {
	var reviews []models.PluginReview
	err := r.db.SelectContext(ctx, &reviews,
		`SELECT * FROM plugin_reviews WHERE plugin_id=$1 ORDER BY created_at DESC`,
		pluginID)
	return reviews, err
}

// UpdateReview updates an existing review by plugin_id and user_id.
func (r *Repository) UpdateReview(ctx context.Context, pluginID string, userID string, rating int16, comment string) error {
	_, err := r.db.ExecContext(ctx,
		`UPDATE plugin_reviews SET rating=$1, comment=$2
		   WHERE plugin_id=$3 AND user_id=$4`,
		rating, comment, pluginID, userID)
	return err
}

// --- Quality Scores ---

// UpsertQualityScore inserts or updates a quality score.
func (r *Repository) UpsertQualityScore(ctx context.Context, qs *models.QualityScore) error {
	now := "EXTRACT(EPOCH FROM now())::bigint"
	_, err := r.db.NamedExecContext(ctx,
		`INSERT INTO plugin_quality_scores (plugin_id, score, code_quality, security,
		   completeness, performance, documentation, computed_at)
		   VALUES (:pluginId, :score, :codeQuality, :security, :completeness,
		   :performance, :documentation, `+now+`)
		   ON CONFLICT (plugin_id) DO UPDATE SET
		   score=EXCLUDED.score, code_quality=EXCLUDED.code_quality,
		   security=EXCLUDED.security, completeness=EXCLUDED.completeness,
		   performance=EXCLUDED.performance, documentation=EXCLUDED.documentation,
		   computed_at=EXCLUDED.computed_at`,
		qs)
	return err
}

// GetQualityScore retrieves the computed quality score for a plugin.
func (r *Repository) GetQualityScore(ctx context.Context, pluginID string) (*models.QualityScore, error) {
	var qs models.QualityScore
	err := r.db.GetContext(ctx, &qs,
		`SELECT * FROM plugin_quality_scores WHERE plugin_id=$1`, pluginID)
	if err != nil {
		return nil, err
	}
	return &qs, nil
}

// --- Stats ---

// GetStats returns aggregated marketplace statistics.
func (r *Repository) GetStats(ctx context.Context) (*models.PluginStats, error) {
	stats := &models.PluginStats{PluginsByCategory: make(map[string]int64)}

	var total int64
	err := r.db.GetContext(ctx, &total,
		`SELECT COUNT(*) FROM plugin_marketplace WHERE status = $1`, models.PluginStatusActive)
	if err != nil {
		return nil, err
	}
	stats.TotalPlugins = total

	var installs int64
	err = r.db.GetContext(ctx, &installs,
		`SELECT COALESCE(SUM(download_count), 0) FROM plugin_marketplace WHERE status = $1`, models.PluginStatusActive)
	if err != nil {
		return nil, err
	}
	stats.TotalInstalls = installs

	// Average rating across all active plugins
	avgRatingVal := sql.NullFloat64{}
	err = r.db.GetContext(ctx, &avgRatingVal,
		`SELECT AVG(rating_avg) FROM plugin_marketplace WHERE status = $1 AND rating_avg IS NOT NULL`, models.PluginStatusActive)
	if err != nil {
		return nil, err
	}
	if avgRatingVal.Valid {
		stats.AverageRating = math.Round(avgRatingVal.Float64*10) / 10
	} else {
		stats.AverageRating = 0
	}

	var catRows []struct {
		Category string `db:"category"`
		Count    int64  `db:"count"`
	}
	err = r.db.SelectContext(ctx, &catRows,
		`SELECT COALESCE(category, 'uncategorized') AS category, COUNT(*) AS count
		   FROM plugin_marketplace WHERE status = $1 GROUP BY category`, models.PluginStatusActive)
	if err != nil {
		return nil, err
	}
	for _, row := range catRows {
		stats.PluginsByCategory[row.Category] = row.Count
	}

	return stats, nil
}

// --- Helpers ---

func buildPluginWhere(filter *models.ListPluginFilter) (string, []interface{}) {
	where := "WHERE status = $1"
	args := []interface{}{models.PluginStatusActive}
	argIdx := 2

	if filter != nil {
		if filter.Category != nil && *filter.Category != "" {
			where += fmt.Sprintf(" AND category = $%d", argIdx)
			args = append(args, *filter.Category)
			argIdx++
		}
		if filter.Verified != nil {
			where += fmt.Sprintf(" AND verified = $%d", argIdx)
			args = append(args, *filter.Verified)
			argIdx++
		}
		if filter.Search != nil && *filter.Search != "" {
			where += fmt.Sprintf(" AND (LOWER(name) LIKE $%d OR LOWER(COALESCE(description,'')) LIKE $%d OR tags::text LIKE $%d)",
				argIdx, argIdx+1, argIdx+2)
			pat := "%" + strings.ToLower(*filter.Search) + "%"
			args = append(args, pat, pat, "%"+strings.ToLower(*filter.Search)+"%")
			argIdx += 3
		}
	}
	return where, args
}

func defaultLimit(p *int) int {
	if p != nil && *p > 0 {
		return *p
	}
	return 20
}

func defaultOffset(p *int) int {
	if p != nil && *p > 0 {
		return *p
	}
	return 0
}
