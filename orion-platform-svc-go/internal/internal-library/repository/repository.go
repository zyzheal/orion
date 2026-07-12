package repository

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"strings"
	"time"

	"orion/platform-svc-go/internal/internal-library/models"

	"github.com/google/uuid"
	"github.com/jmoiron/sqlx"
)

type Repository struct {
	db *sqlx.DB
}

func NewRepository(db *sqlx.DB) *Repository {
	return &Repository{db: db}
}

// ---------------------------------------------------------------------------
// InternalLibrary CRUD
// ---------------------------------------------------------------------------

func (r *Repository) Create(ctx context.Context, m *models.InternalLibrary) error {
	m.ID = uuid.New().String()
	m.CreatedAt = time.Now().UTC()
	m.UpdatedAt = time.Now().UTC()
	if m.Status == "" {
		m.Status = "development"
	}
	_, err := r.db.NamedExecContext(ctx,
		`INSERT INTO internal_libraries (id, tenant_id, name, display_name, description, language, status, owner, repository, documentation, current_version, latest_stable_version, dependents_total, quality_test_coverage, quality_security_score, labels, annotations, created_at, updated_at) VALUES (:id, :tenant_id, :name, :display_name, :description, :language, :status, :owner, :repository, :documentation, :current_version, :latest_stable_version, :dependents_total, :quality_test_coverage, :quality_security_score, :labels, :annotations, :created_at, :updated_at)`, m)
	return err
}

func (r *Repository) GetByID(ctx context.Context, tenantID, id string) (*models.InternalLibrary, error) {
	var m models.InternalLibrary
	err := r.db.GetContext(ctx, &m, `SELECT * FROM internal_libraries WHERE id=$1 AND tenant_id=$2`, id, tenantID)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, fmt.Errorf("library not found: %w", ErrNotFound)
		}
		return nil, err
	}
	return &m, nil
}

func (r *Repository) GetByName(ctx context.Context, tenantID, name string) (*models.InternalLibrary, error) {
	var m models.InternalLibrary
	err := r.db.GetContext(ctx, &m, `SELECT * FROM internal_libraries WHERE name=$1 AND tenant_id=$2`, name, tenantID)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, fmt.Errorf("library not found: %w", ErrNotFound)
		}
		return nil, err
	}
	return &m, nil
}

func (r *Repository) List(ctx context.Context, tenantID string, limit, offset int) ([]models.InternalLibrary, error) {
	if limit <= 0 {
		limit = 50
	}
	var items []models.InternalLibrary
	err := r.db.SelectContext(ctx, &items, `SELECT * FROM internal_libraries WHERE tenant_id=$1 ORDER BY created_at DESC LIMIT $2 OFFSET $3`, tenantID, limit, offset)
	if err != nil {
		return nil, err
	}
	return items, nil
}

func (r *Repository) ListByLanguage(ctx context.Context, tenantID, language string, limit, offset int) ([]models.InternalLibrary, error) {
	if limit <= 0 {
		limit = 50
	}
	var items []models.InternalLibrary
	err := r.db.SelectContext(ctx, &items, `SELECT * FROM internal_libraries WHERE tenant_id=$1 AND language=$2 ORDER BY created_at DESC LIMIT $3 OFFSET $4`, tenantID, language, limit, offset)
	if err != nil {
		return nil, err
	}
	return items, nil
}

func (r *Repository) ListByOwner(ctx context.Context, tenantID, owner string, limit, offset int) ([]models.InternalLibrary, error) {
	if limit <= 0 {
		limit = 50
	}
	var items []models.InternalLibrary
	err := r.db.SelectContext(ctx, &items, `SELECT * FROM internal_libraries WHERE tenant_id=$1 AND owner=$2 ORDER BY created_at DESC LIMIT $3 OFFSET $4`, tenantID, owner, limit, offset)
	if err != nil {
		return nil, err
	}
	return items, nil
}

func (r *Repository) Update(ctx context.Context, tenantID, id string, updates map[string]interface{}) (*models.InternalLibrary, error) {
	updates["updated_at"] = time.Now().UTC()
	if len(updates) <= 1 { // only updated_at
		return nil, fmt.Errorf("no fields to update")
	}

	setParts := make([]string, 0, len(updates))
	args := make([]interface{}, 0, len(updates))
	argIdx := 1
	for k, v := range updates {
		setParts = append(setParts, fmt.Sprintf("%s=$%d", k, argIdx))
		args = append(args, v)
		argIdx++
	}
	args = append(args, id, tenantID)
	query := fmt.Sprintf(`UPDATE internal_libraries SET %s WHERE id=$%d AND tenant_id=$%d`, strings.Join(setParts, ", "), argIdx, argIdx+1)

	result, err := r.db.ExecContext(ctx, query, args...)
	if err != nil {
		return nil, err
	}
	rows, _ := result.RowsAffected()
	if rows == 0 {
		return nil, fmt.Errorf("library not found: %w", ErrNotFound)
	}
	return r.GetByID(ctx, tenantID, id)
}

func (r *Repository) UpdateStatus(ctx context.Context, tenantID, id, status string) (*models.InternalLibrary, error) {
	updates := map[string]interface{}{"status": status}
	return r.Update(ctx, tenantID, id, updates)
}

func (r *Repository) UpdateVersionFields(ctx context.Context, libraryID string, currentVersion string, stableVersion string) error {
	_, err := r.db.ExecContext(ctx, `UPDATE internal_libraries SET current_version=$1, latest_stable_version=$2, updated_at=NOW() WHERE id=$3`, currentVersion, stableVersion, libraryID)
	return err
}

func (r *Repository) UpdateDependentsStats(ctx context.Context, libraryID string, totalRepos, totalTeams, usingLatest, needingUpgrade int) error {
	_, err := r.db.ExecContext(ctx, `UPDATE internal_libraries SET dependents_total=$1, updated_at=NOW() WHERE id=$2`, totalRepos, libraryID)
	return err
}

func (r *Repository) Delete(ctx context.Context, tenantID, id string) error {
	result, err := r.db.ExecContext(ctx, `DELETE FROM internal_libraries WHERE id=$1 AND tenant_id=$2`, id, tenantID)
	if err != nil {
		return err
	}
	rows, _ := result.RowsAffected()
	if rows == 0 {
		return fmt.Errorf("library not found: %w", ErrNotFound)
	}
	return nil
}

// ---------------------------------------------------------------------------
// LibraryVersion
// ---------------------------------------------------------------------------

func (r *Repository) CreateVersion(ctx context.Context, v *models.LibraryVersion) error {
	v.ID = uuid.New().String()
	v.CreatedAt = time.Now().UTC()
	if v.Status == "" {
		v.Status = "stable"
	}
	_, err := r.db.NamedExecContext(ctx,
		`INSERT INTO library_versions (id, library_id, version, status, released_at, changelog, security_score, test_coverage, eol_date, deprecation_reason, migration_guide, artifact_id, created_at) VALUES (:id, :library_id, :version, :status, :released_at, :changelog, :security_score, :test_coverage, :eol_date, :deprecation_reason, :migration_guide, :artifact_id, :created_at)`, v)
	return err
}

func (r *Repository) VersionExists(ctx context.Context, libraryID, version string) (bool, error) {
	var count int
	err := r.db.GetContext(ctx, &count, `SELECT COUNT(*) FROM library_versions WHERE library_id=$1 AND version=$2`, libraryID, version)
	return count > 0, err
}

func (r *Repository) ListVersions(ctx context.Context, libraryID string) ([]models.LibraryVersion, error) {
	var items []models.LibraryVersion
	err := r.db.SelectContext(ctx, &items, `SELECT * FROM library_versions WHERE library_id=$1 ORDER BY created_at DESC`, libraryID)
	if err != nil {
		return nil, err
	}
	return items, nil
}

func (r *Repository) GetVersion(ctx context.Context, libraryID, version string) (*models.LibraryVersion, error) {
	var v models.LibraryVersion
	err := r.db.GetContext(ctx, &v, `SELECT * FROM library_versions WHERE library_id=$1 AND version=$2`, libraryID, version)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, fmt.Errorf("version not found: %w", ErrNotFound)
		}
		return nil, err
	}
	return &v, nil
}

func (r *Repository) DeprecateVersion(ctx context.Context, libraryID, version, reason, migrationGuide string, eolDate *time.Time) (*models.LibraryVersion, error) {
	_, err := r.db.ExecContext(ctx,
		`UPDATE library_versions SET status='deprecated', deprecation_reason=$1, eol_date=$2, migration_guide=$3 WHERE library_id=$4 AND version=$5`,
		reason, eolDate, migrationGuide, libraryID, version)
	if err != nil {
		return nil, err
	}
	return r.GetVersion(ctx, libraryID, version)
}

// ---------------------------------------------------------------------------
// LibraryDependent
// ---------------------------------------------------------------------------

func (r *Repository) ListDependents(ctx context.Context, libraryID string) ([]models.LibraryDependent, error) {
	var items []models.LibraryDependent
	err := r.db.SelectContext(ctx, &items, `SELECT * FROM library_dependents WHERE library_id=$1 ORDER BY repo_name`, libraryID)
	if err != nil {
		return nil, err
	}
	return items, nil
}

func (r *Repository) AddDependent(ctx context.Context, d *models.LibraryDependent) error {
	d.ID = uuid.New().String()
	d.CreatedAt = time.Now().UTC()
	t := time.Now().UTC(); d.LastUpdated = &t
	if d.UpgradeAvailable == false {
		d.UpgradeAvailable = false
	}
	_, err := r.db.NamedExecContext(ctx,
		`INSERT INTO library_dependents (id, library_id, repo_name, team_name, current_version, latest_compatible_version, upgrade_available, upgrade_type, last_updated, created_at) VALUES (:id, :library_id, :repo_name, :team_name, :current_version, :latest_compatible_version, :upgrade_available, :upgrade_type, :last_updated, :created_at) ON CONFLICT (library_id, repo_name) DO NOTHING`, d)
	if err != nil {
		return err
	}
	return nil
}

func (r *Repository) UpdateDependentVersion(ctx context.Context, libraryID, repoName, newVersion string, upgradeAvailable bool, upgradeType string) error {
	now := time.Now().UTC()
	_, err := r.db.ExecContext(ctx,
		`UPDATE library_dependents SET current_version=$1, upgrade_available=$2, upgrade_type=$3, last_updated=$4 WHERE library_id=$5 AND repo_name=$6`,
		newVersion, upgradeAvailable, upgradeType, now, libraryID, repoName)
	return err
}

func (r *Repository) CheckDependencies(ctx context.Context, repoName string) ([]models.DependencyCheckResult, error) {
	rows, err := r.db.QueryContext(ctx,
		`SELECT l.name AS library_name, d.current_version, l.latest_stable_version AS latest_version, l.status AS library_status, d.upgrade_type, l.quality_security_score FROM library_dependents d JOIN internal_libraries l ON d.library_id = l.id WHERE d.repo_name = $1`,
		repoName)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var results []models.DependencyCheckResult
	for rows.Next() {
		var cr models.DependencyCheckResult
		var libraryStatus string
		var securityScore sql.NullFloat64
		err := rows.Scan(&cr.LibraryName, &cr.CurrentVersion, &cr.LatestVersion, &libraryStatus, &cr.UpgradeType, &securityScore)
		if err != nil {
			return nil, err
		}

		if securityScore.Valid {
			cr.SecurityScore = &securityScore.Float64
		}

		if libraryStatus == "deprecated" {
			cr.Status = "deprecated"
		} else if cr.CurrentVersion != cr.LatestVersion {
			if cr.UpgradeType == "breaking" {
				cr.Status = "breaking_change"
			} else {
				cr.Status = "upgrade_available"
			}
		} else {
			cr.Status = "latest"
			cr.UpgradeType = ""
		}
		results = append(results, cr)
	}
	return results, nil
}

// ---------------------------------------------------------------------------
// Errors
// ---------------------------------------------------------------------------

var ErrNotFound = errors.New("not found")

func IsNotFound(err error) bool {
	return errors.Is(err, ErrNotFound)
}
