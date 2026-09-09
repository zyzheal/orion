package repository

import (
	"context"
	"database/sql"
	"encoding/json"
	"errors"
	"fmt"
	"strings"
	"time"

	"orion/platform-svc-go/internal/branch-policy/models"

	"github.com/jmoiron/sqlx"
	"orion/go-common/pkg/sentinel"
)

type Repository struct {
	db *sqlx.DB
}

func NewRepository(db *sqlx.DB) *Repository {
	return &Repository{db: db}
}

func (r *Repository) List(ctx context.Context, tenantID string) ([]models.Record, error) {
	var records []models.Record
	err := r.db.SelectContext(ctx, &records, "SELECT * FROM branch-policys WHERE tenant_id=$1", tenantID)
	return records, err
}

func (r *Repository) GetByID(ctx context.Context, tenantID, id string) (*models.Record, error) {
	var record models.Record
	err := r.db.GetContext(ctx, &record, "SELECT * FROM branch-policys WHERE id=$1 AND tenant_id=$2", id, tenantID)
	if errors.Is(err, sql.ErrNoRows) {
		return nil, sentinel.NotFound
	}
	return &record, err
}

func (r *Repository) Create(ctx context.Context, tenantID string, req models.CreateRequest) (*models.Record, error) {
	return nil, sentinel.NotFound
}

func (r *Repository) Update(ctx context.Context, tenantID, id string, req models.CreateRequest) (*models.Record, error) {
	return nil, sentinel.NotFound
}

func (r *Repository) Delete(ctx context.Context, tenantID, id string) error {
	return sentinel.NotFound
}

// --- JSON []string column helpers ---
//
// The multi-branch tables store []string columns as JSON TEXT (DEFAULT '[]').
// sqlx does not convert []string automatically, so repository maps the slice
// to/from a JSON string at the boundary.

func marshalStrings(s []string) (string, error) {
	if s == nil {
		s = []string{}
	}
	b, err := json.Marshal(s)
	if err != nil {
		return "", err
	}
	return string(b), nil
}

func unmarshalStrings(s string) ([]string, error) {
	if s == "" {
		return []string{}, nil
	}
	var out []string
	if err := json.Unmarshal([]byte(s), &out); err != nil {
		return nil, err
	}
	if out == nil {
		out = []string{}
	}
	return out, nil
}

// --- DB row representations ([]string columns stored as TEXT) ---

type branchProfileRow struct {
	ID               string                `db:"id"`
	TenantID         string                `db:"tenant_id"`
	RepoID           string                `db:"repo_id"`
	Name             string                `db:"name"`
	Semantic         models.BranchSemantic `db:"semantic"`
	OwnerID          string                `db:"owner_id"`
	OwnerName        string                `db:"owner_name"`
	Description      string                `db:"description"`
	LTSUntil         *time.Time            `db:"lts_until"`
	MergeTargets     string                `db:"merge_targets"`
	MergeSources     string                `db:"merge_sources"`
	ProtectedEnvs    string                `db:"protected_envs"`
	AllowedPipelines string                `db:"allowed_pipelines"`
	Status           models.BranchStatus   `db:"status"`
	CreatedAt        time.Time             `db:"created_at"`
	UpdatedAt        time.Time             `db:"updated_at"`
	ArchivedAt       *time.Time            `db:"archived_at"`
}

func branchProfileRowFromModel(p *models.BranchProfile) (branchProfileRow, error) {
	mergeTargets, err := marshalStrings(p.MergeTargets)
	if err != nil {
		return branchProfileRow{}, err
	}
	mergeSources, err := marshalStrings(p.MergeSources)
	if err != nil {
		return branchProfileRow{}, err
	}
	protectedEnvs, err := marshalStrings(p.ProtectedEnvs)
	if err != nil {
		return branchProfileRow{}, err
	}
	allowedPipelines, err := marshalStrings(p.AllowedPipelines)
	if err != nil {
		return branchProfileRow{}, err
	}
	return branchProfileRow{
		ID: p.ID, TenantID: p.TenantID, RepoID: p.RepoID, Name: p.Name,
		Semantic: p.Semantic, OwnerID: p.OwnerID, OwnerName: p.OwnerName,
		Description: p.Description, LTSUntil: p.LTSUntil,
		MergeTargets: mergeTargets, MergeSources: mergeSources,
		ProtectedEnvs: protectedEnvs, AllowedPipelines: allowedPipelines,
		Status: p.Status, CreatedAt: p.CreatedAt, UpdatedAt: p.UpdatedAt,
		ArchivedAt: p.ArchivedAt,
	}, nil
}

func (row branchProfileRow) toModel() (*models.BranchProfile, error) {
	mergeTargets, err := unmarshalStrings(row.MergeTargets)
	if err != nil {
		return nil, err
	}
	mergeSources, err := unmarshalStrings(row.MergeSources)
	if err != nil {
		return nil, err
	}
	protectedEnvs, err := unmarshalStrings(row.ProtectedEnvs)
	if err != nil {
		return nil, err
	}
	allowedPipelines, err := unmarshalStrings(row.AllowedPipelines)
	if err != nil {
		return nil, err
	}
	return &models.BranchProfile{
		ID: row.ID, TenantID: row.TenantID, RepoID: row.RepoID, Name: row.Name,
		Semantic: row.Semantic, OwnerID: row.OwnerID, OwnerName: row.OwnerName,
		Description: row.Description, LTSUntil: row.LTSUntil,
		MergeTargets: mergeTargets, MergeSources: mergeSources,
		ProtectedEnvs: protectedEnvs, AllowedPipelines: allowedPipelines,
		Status: row.Status, CreatedAt: row.CreatedAt, UpdatedAt: row.UpdatedAt,
		ArchivedAt: row.ArchivedAt,
	}, nil
}

type buildArtifactRow struct {
	ID                string                     `db:"id"`
	TenantID          string                     `db:"tenant_id"`
	BranchProfileID   string                     `db:"branch_profile_id"`
	Branch            string                     `db:"branch"`
	CommitSHA         string                     `db:"commit_sha"`
	ImageDigest       string                     `db:"image_digest"`
	ImageTag          string                     `db:"image_tag"`
	ImageRepo         string                     `db:"image_repo"`
	BuildPipelineID   string                     `db:"build_pipeline_id"`
	TargetEnvs        string                     `db:"target_envs"`
	SignedBy          string                     `db:"signed_by"`
	SignatureValid    bool                       `db:"signature_valid"`
	BinaryChecksum    string                     `db:"binary_checksum"`
	ConfigChecksum    string                     `db:"config_checksum"`
	MigrationChecksum string                     `db:"migration_checksum"`
	BuiltAt           time.Time                  `db:"built_at"`
	SizeBytes         int64                      `db:"size_bytes"`
	Status            models.BuildArtifactStatus `db:"status"`
	DeprecatedAt      *time.Time                 `db:"deprecated_at"`
	DeprecatedReason  string                     `db:"deprecated_reason"`
}

func buildArtifactRowFromModel(a *models.BuildArtifact) (buildArtifactRow, error) {
	targetEnvs, err := marshalStrings(a.TargetEnvs)
	if err != nil {
		return buildArtifactRow{}, err
	}
	return buildArtifactRow{
		ID: a.ID, TenantID: a.TenantID, BranchProfileID: a.BranchProfileID,
		Branch: a.Branch, CommitSHA: a.CommitSHA, ImageDigest: a.ImageDigest,
		ImageTag: a.ImageTag, ImageRepo: a.ImageRepo, BuildPipelineID: a.BuildPipelineID,
		TargetEnvs: targetEnvs, SignedBy: a.SignedBy, SignatureValid: a.SignatureValid,
		BinaryChecksum: a.BinaryChecksum, ConfigChecksum: a.ConfigChecksum,
		MigrationChecksum: a.MigrationChecksum, BuiltAt: a.BuiltAt, SizeBytes: a.SizeBytes,
		Status: a.Status, DeprecatedAt: a.DeprecatedAt, DeprecatedReason: a.DeprecatedReason,
	}, nil
}

func (row buildArtifactRow) toModel() (*models.BuildArtifact, error) {
	targetEnvs, err := unmarshalStrings(row.TargetEnvs)
	if err != nil {
		return nil, err
	}
	return &models.BuildArtifact{
		ID: row.ID, TenantID: row.TenantID, BranchProfileID: row.BranchProfileID,
		Branch: row.Branch, CommitSHA: row.CommitSHA, ImageDigest: row.ImageDigest,
		ImageTag: row.ImageTag, ImageRepo: row.ImageRepo, BuildPipelineID: row.BuildPipelineID,
		TargetEnvs: targetEnvs, SignedBy: row.SignedBy, SignatureValid: row.SignatureValid,
		BinaryChecksum: row.BinaryChecksum, ConfigChecksum: row.ConfigChecksum,
		MigrationChecksum: row.MigrationChecksum, BuiltAt: row.BuiltAt, SizeBytes: row.SizeBytes,
		Status: row.Status, DeprecatedAt: row.DeprecatedAt, DeprecatedReason: row.DeprecatedReason,
	}, nil
}

type syncPolicyRow struct {
	ID                   string                `db:"id"`
	TenantID             string                `db:"tenant_id"`
	Name                 string                `db:"name"`
	SourceBranch         string                `db:"source_branch"`
	TargetBranches       string                `db:"target_branches"`
	Frequency            models.SyncFrequency  `db:"frequency"`
	CronExpr             string                `db:"cron_expr"`
	Strategy             models.SyncStrategy   `db:"strategy"`
	AutoResolve          models.SyncResolve    `db:"auto_resolve"`
	NotifyOnConflict     string                `db:"notify_on_conflict"`
	NotifyWebhook        string                `db:"notify_webhook"`
	Enabled              bool                  `db:"enabled"`
	LastRunAt            *time.Time            `db:"last_run_at"`
	LastRunStatus        *models.SyncRunStatus `db:"last_run_status"`
	LastRunConflictFiles string                `db:"last_run_conflict_files"`
	ChangeManagementID   string                `db:"change_management_id"`
	CreatedAt            time.Time             `db:"created_at"`
	UpdatedAt            time.Time             `db:"updated_at"`
}

func syncPolicyRowFromModel(p *models.SyncPolicy) (syncPolicyRow, error) {
	targetBranches, err := marshalStrings(p.TargetBranches)
	if err != nil {
		return syncPolicyRow{}, err
	}
	notifyOnConflict, err := marshalStrings(p.NotifyOnConflict)
	if err != nil {
		return syncPolicyRow{}, err
	}
	lastRunConflictFiles, err := marshalStrings(p.LastRunConflictFiles)
	if err != nil {
		return syncPolicyRow{}, err
	}
	return syncPolicyRow{
		ID: p.ID, TenantID: p.TenantID, Name: p.Name, SourceBranch: p.SourceBranch,
		TargetBranches: targetBranches, Frequency: p.Frequency, CronExpr: p.CronExpr,
		Strategy: p.Strategy, AutoResolve: p.AutoResolve,
		NotifyOnConflict: notifyOnConflict, NotifyWebhook: p.NotifyWebhook,
		Enabled: p.Enabled, LastRunAt: p.LastRunAt, LastRunStatus: p.LastRunStatus,
		LastRunConflictFiles: lastRunConflictFiles, ChangeManagementID: p.ChangeManagementID,
		CreatedAt: p.CreatedAt, UpdatedAt: p.UpdatedAt,
	}, nil
}

func (row syncPolicyRow) toModel() (*models.SyncPolicy, error) {
	targetBranches, err := unmarshalStrings(row.TargetBranches)
	if err != nil {
		return nil, err
	}
	notifyOnConflict, err := unmarshalStrings(row.NotifyOnConflict)
	if err != nil {
		return nil, err
	}
	lastRunConflictFiles, err := unmarshalStrings(row.LastRunConflictFiles)
	if err != nil {
		return nil, err
	}
	return &models.SyncPolicy{
		ID: row.ID, TenantID: row.TenantID, Name: row.Name, SourceBranch: row.SourceBranch,
		TargetBranches: targetBranches, Frequency: row.Frequency, CronExpr: row.CronExpr,
		Strategy: row.Strategy, AutoResolve: row.AutoResolve,
		NotifyOnConflict: notifyOnConflict, NotifyWebhook: row.NotifyWebhook,
		Enabled: row.Enabled, LastRunAt: row.LastRunAt, LastRunStatus: row.LastRunStatus,
		LastRunConflictFiles: lastRunConflictFiles, ChangeManagementID: row.ChangeManagementID,
		CreatedAt: row.CreatedAt, UpdatedAt: row.UpdatedAt,
	}, nil
}

type syncRunLogRow struct {
	ID             string               `db:"id"`
	TenantID       string               `db:"tenant_id"`
	PolicyID       string               `db:"policy_id"`
	TriggeredAt    time.Time            `db:"triggered_at"`
	TriggeredBy    models.SyncTriggerBy `db:"triggered_by"`
	SourceCommit   string               `db:"source_commit"`
	TargetBranches string               `db:"target_branches"`
	Status         models.SyncRunStatus `db:"status"`
	ConflictFiles  string               `db:"conflict_files"`
	ErrorMsg       string               `db:"error_msg"`
	DurationMs     int64                `db:"duration_ms"`
	ChangeID       string               `db:"change_id"`
}

func syncRunLogRowFromModel(l *models.SyncRunLog) (syncRunLogRow, error) {
	targetBranches, err := marshalStrings(l.TargetBranches)
	if err != nil {
		return syncRunLogRow{}, err
	}
	conflictFiles, err := marshalStrings(l.ConflictFiles)
	if err != nil {
		return syncRunLogRow{}, err
	}
	return syncRunLogRow{
		ID: l.ID, TenantID: l.TenantID, PolicyID: l.PolicyID, TriggeredAt: l.TriggeredAt,
		TriggeredBy: l.TriggeredBy, SourceCommit: l.SourceCommit,
		TargetBranches: targetBranches, Status: l.Status, ConflictFiles: conflictFiles,
		ErrorMsg: l.ErrorMsg, DurationMs: l.DurationMs, ChangeID: l.ChangeID,
	}, nil
}

func (row syncRunLogRow) toModel() (*models.SyncRunLog, error) {
	targetBranches, err := unmarshalStrings(row.TargetBranches)
	if err != nil {
		return nil, err
	}
	conflictFiles, err := unmarshalStrings(row.ConflictFiles)
	if err != nil {
		return nil, err
	}
	return &models.SyncRunLog{
		ID: row.ID, TenantID: row.TenantID, PolicyID: row.PolicyID, TriggeredAt: row.TriggeredAt,
		TriggeredBy: row.TriggeredBy, SourceCommit: row.SourceCommit,
		TargetBranches: targetBranches, Status: row.Status, ConflictFiles: conflictFiles,
		ErrorMsg: row.ErrorMsg, DurationMs: row.DurationMs, ChangeID: row.ChangeID,
	}, nil
}

type mergePreviewRow struct {
	ID            string           `db:"id"`
	TenantID      string           `db:"tenant_id"`
	SourceBranch  string           `db:"source_branch"`
	TargetBranch  string           `db:"target_branch"`
	SourceCommit  string           `db:"source_commit"`
	TargetCommit  string           `db:"target_commit"`
	ConflictFiles string           `db:"conflict_files"`
	AddedFiles    string           `db:"added_files"`
	ModifiedFiles string           `db:"modified_files"`
	DeletedFiles  string           `db:"deleted_files"`
	ConflictCount int              `db:"conflict_count"`
	RiskLevel     models.RiskLevel `db:"risk_level"`
	PreviewedAt   time.Time        `db:"previewed_at"`
}

func mergePreviewRowFromModel(p *models.MergePreview) (mergePreviewRow, error) {
	conflictFiles, err := marshalStrings(p.ConflictFiles)
	if err != nil {
		return mergePreviewRow{}, err
	}
	addedFiles, err := marshalStrings(p.AddedFiles)
	if err != nil {
		return mergePreviewRow{}, err
	}
	modifiedFiles, err := marshalStrings(p.ModifiedFiles)
	if err != nil {
		return mergePreviewRow{}, err
	}
	deletedFiles, err := marshalStrings(p.DeletedFiles)
	if err != nil {
		return mergePreviewRow{}, err
	}
	return mergePreviewRow{
		ID: p.ID, TenantID: p.TenantID, SourceBranch: p.SourceBranch, TargetBranch: p.TargetBranch,
		SourceCommit: p.SourceCommit, TargetCommit: p.TargetCommit, ConflictFiles: conflictFiles,
		AddedFiles: addedFiles, ModifiedFiles: modifiedFiles, DeletedFiles: deletedFiles,
		ConflictCount: p.ConflictCount, RiskLevel: p.RiskLevel, PreviewedAt: p.PreviewedAt,
	}, nil
}

func (row mergePreviewRow) toModel() (*models.MergePreview, error) {
	conflictFiles, err := unmarshalStrings(row.ConflictFiles)
	if err != nil {
		return nil, err
	}
	addedFiles, err := unmarshalStrings(row.AddedFiles)
	if err != nil {
		return nil, err
	}
	modifiedFiles, err := unmarshalStrings(row.ModifiedFiles)
	if err != nil {
		return nil, err
	}
	deletedFiles, err := unmarshalStrings(row.DeletedFiles)
	if err != nil {
		return nil, err
	}
	return &models.MergePreview{
		ID: row.ID, TenantID: row.TenantID, SourceBranch: row.SourceBranch, TargetBranch: row.TargetBranch,
		SourceCommit: row.SourceCommit, TargetCommit: row.TargetCommit, ConflictFiles: conflictFiles,
		AddedFiles: addedFiles, ModifiedFiles: modifiedFiles, DeletedFiles: deletedFiles,
		ConflictCount: row.ConflictCount, RiskLevel: row.RiskLevel, PreviewedAt: row.PreviewedAt,
	}, nil
}

// --- P0-MB Phase 1 — BranchProfile (L1) + BuildArtifact (L3) ---

func (r *Repository) CreateBranchProfile(ctx context.Context, p *models.BranchProfile) error {
	row, err := branchProfileRowFromModel(p)
	if err != nil {
		return err
	}
	_, err = r.db.NamedExecContext(ctx, `INSERT INTO branch_profiles
		(id, tenant_id, repo_id, name, semantic, owner_id, owner_name, description,
		 lts_until, merge_targets, merge_sources, protected_envs, allowed_pipelines,
		 status, created_at, updated_at, archived_at)
		VALUES (:id, :tenant_id, :repo_id, :name, :semantic, :owner_id, :owner_name, :description,
		 :lts_until, :merge_targets, :merge_sources, :protected_envs, :allowed_pipelines,
		 :status, :created_at, :updated_at, :archived_at)`, row)
	return err
}

func (r *Repository) GetBranchProfile(ctx context.Context, tenantID, id string) (*models.BranchProfile, error) {
	var row branchProfileRow
	err := r.db.GetContext(ctx, &row, `SELECT * FROM branch_profiles WHERE id=$1 AND tenant_id=$2`, id, tenantID)
	if errors.Is(err, sql.ErrNoRows) {
		return nil, sentinel.NotFound
	}
	if err != nil {
		return nil, err
	}
	return row.toModel()
}

func (r *Repository) ListBranchProfiles(ctx context.Context, tenantID string, q models.BranchProfileQuery) ([]models.BranchProfile, error) {
	if q.Page <= 0 {
		q.Page = 1
	}
	if q.Limit <= 0 {
		q.Limit = 100
	}
	if q.Limit > 1000 {
		q.Limit = 1000
	}

	var where strings.Builder
	var args []interface{}
	where.WriteString("WHERE tenant_id = $1")
	args = append(args, tenantID)
	argIdx := 2

	if q.Status != nil {
		where.WriteString(fmt.Sprintf(" AND status = $%d", argIdx))
		args = append(args, *q.Status)
		argIdx++
	}
	if q.Semantic != nil {
		where.WriteString(fmt.Sprintf(" AND semantic = $%d", argIdx))
		args = append(args, *q.Semantic)
		argIdx++
	}
	if q.RepoID != nil {
		where.WriteString(fmt.Sprintf(" AND repo_id = $%d", argIdx))
		args = append(args, *q.RepoID)
		argIdx++
	}
	if q.OwnerID != nil {
		where.WriteString(fmt.Sprintf(" AND owner_id = $%d", argIdx))
		args = append(args, *q.OwnerID)
		argIdx++
	}

	query := fmt.Sprintf(`SELECT * FROM branch_profiles %s ORDER BY created_at DESC LIMIT $%d OFFSET $%d`,
		where.String(), argIdx, argIdx+1)
	args = append(args, q.Limit, (q.Page-1)*q.Limit)

	var rows []branchProfileRow
	if err := r.db.SelectContext(ctx, &rows, query, args...); err != nil {
		return nil, err
	}
	out := make([]models.BranchProfile, 0, len(rows))
	for i := range rows {
		m, err := rows[i].toModel()
		if err != nil {
			return nil, err
		}
		out = append(out, *m)
	}
	return out, nil
}

func (r *Repository) UpdateBranchProfile(ctx context.Context, tenantID, id string, p *models.BranchProfile) (*models.BranchProfile, error) {
	row, err := branchProfileRowFromModel(p)
	if err != nil {
		return nil, err
	}
	result, err := r.db.NamedExecContext(ctx, `UPDATE branch_profiles SET
		repo_id = :repo_id, name = :name, semantic = :semantic, owner_id = :owner_id,
		owner_name = :owner_name, description = :description, lts_until = :lts_until,
		merge_targets = :merge_targets, merge_sources = :merge_sources,
		protected_envs = :protected_envs, allowed_pipelines = :allowed_pipelines,
		status = :status, updated_at = :updated_at, archived_at = :archived_at
		WHERE id = :id AND tenant_id = :tenant_id`, row)
	if err != nil {
		return nil, err
	}
	n, _ := result.RowsAffected()
	if n == 0 {
		return nil, sentinel.NotFound
	}
	return p, nil
}

func (r *Repository) CreateBuildArtifact(ctx context.Context, a *models.BuildArtifact) error {
	row, err := buildArtifactRowFromModel(a)
	if err != nil {
		return err
	}
	_, err = r.db.NamedExecContext(ctx, `INSERT INTO build_artifacts
		(id, tenant_id, branch_profile_id, branch, commit_sha, image_digest, image_tag,
		 image_repo, build_pipeline_id, target_envs, signed_by, signature_valid,
		 binary_checksum, config_checksum, migration_checksum, built_at, size_bytes,
		 status, deprecated_at, deprecated_reason)
		VALUES (:id, :tenant_id, :branch_profile_id, :branch, :commit_sha, :image_digest, :image_tag,
		 :image_repo, :build_pipeline_id, :target_envs, :signed_by, :signature_valid,
		 :binary_checksum, :config_checksum, :migration_checksum, :built_at, :size_bytes,
		 :status, :deprecated_at, :deprecated_reason)`, row)
	return err
}

func (r *Repository) GetBuildArtifact(ctx context.Context, tenantID, id string) (*models.BuildArtifact, error) {
	var row buildArtifactRow
	err := r.db.GetContext(ctx, &row, `SELECT * FROM build_artifacts WHERE id=$1 AND tenant_id=$2`, id, tenantID)
	if errors.Is(err, sql.ErrNoRows) {
		return nil, sentinel.NotFound
	}
	if err != nil {
		return nil, err
	}
	return row.toModel()
}

func (r *Repository) ListBuildArtifacts(ctx context.Context, tenantID string, q models.ArtifactQuery) ([]models.BuildArtifact, error) {
	if q.Page <= 0 {
		q.Page = 1
	}
	if q.Limit <= 0 {
		q.Limit = 100
	}
	if q.Limit > 1000 {
		q.Limit = 1000
	}

	var where strings.Builder
	var args []interface{}
	where.WriteString("WHERE tenant_id = $1")
	args = append(args, tenantID)
	argIdx := 2

	if q.BranchProfileID != nil {
		where.WriteString(fmt.Sprintf(" AND branch_profile_id = $%d", argIdx))
		args = append(args, *q.BranchProfileID)
		argIdx++
	}
	if q.Branch != nil {
		where.WriteString(fmt.Sprintf(" AND branch = $%d", argIdx))
		args = append(args, *q.Branch)
		argIdx++
	}
	if q.CommitSHA != nil {
		where.WriteString(fmt.Sprintf(" AND commit_sha = $%d", argIdx))
		args = append(args, *q.CommitSHA)
		argIdx++
	}
	if q.Status != nil {
		where.WriteString(fmt.Sprintf(" AND status = $%d", argIdx))
		args = append(args, *q.Status)
		argIdx++
	}
	if q.SignatureValid != nil {
		where.WriteString(fmt.Sprintf(" AND signature_valid = $%d", argIdx))
		args = append(args, *q.SignatureValid)
		argIdx++
	}

	query := fmt.Sprintf(`SELECT * FROM build_artifacts %s ORDER BY built_at DESC LIMIT $%d OFFSET $%d`,
		where.String(), argIdx, argIdx+1)
	args = append(args, q.Limit, (q.Page-1)*q.Limit)

	var rows []buildArtifactRow
	if err := r.db.SelectContext(ctx, &rows, query, args...); err != nil {
		return nil, err
	}
	out := make([]models.BuildArtifact, 0, len(rows))
	for i := range rows {
		m, err := rows[i].toModel()
		if err != nil {
			return nil, err
		}
		out = append(out, *m)
	}
	return out, nil
}

func (r *Repository) UpdateBuildArtifact(ctx context.Context, tenantID, id string, a *models.BuildArtifact) (*models.BuildArtifact, error) {
	row, err := buildArtifactRowFromModel(a)
	if err != nil {
		return nil, err
	}
	result, err := r.db.NamedExecContext(ctx, `UPDATE build_artifacts SET
		branch_profile_id = :branch_profile_id, branch = :branch, commit_sha = :commit_sha,
		image_digest = :image_digest, image_tag = :image_tag, image_repo = :image_repo,
		build_pipeline_id = :build_pipeline_id, target_envs = :target_envs,
		signed_by = :signed_by, signature_valid = :signature_valid,
		binary_checksum = :binary_checksum, config_checksum = :config_checksum,
		migration_checksum = :migration_checksum, built_at = :built_at,
		size_bytes = :size_bytes, status = :status, deprecated_at = :deprecated_at,
		deprecated_reason = :deprecated_reason
		WHERE id = :id AND tenant_id = :tenant_id`, row)
	if err != nil {
		return nil, err
	}
	n, _ := result.RowsAffected()
	if n == 0 {
		return nil, sentinel.NotFound
	}
	return a, nil
}

// --- P0-MB Phase 2 — NamespaceBinding (L2) ---

func (r *Repository) CreateNamespaceBinding(ctx context.Context, b *models.NamespaceBinding) error {
	_, err := r.db.NamedExecContext(ctx, `INSERT INTO namespace_bindings
		(id, tenant_id, branch_profile_id, env_name, k8s_namespace, config_namespace,
		 db_name, mq_topic_prefix, redis_key_prefix, image_tag_prefix, created_at)
		VALUES (:id, :tenant_id, :branch_profile_id, :env_name, :k8s_namespace, :config_namespace,
		 :db_name, :mq_topic_prefix, :redis_key_prefix, :image_tag_prefix, :created_at)`, b)
	return err
}

func (r *Repository) GetNamespaceBinding(ctx context.Context, tenantID, id string) (*models.NamespaceBinding, error) {
	var b models.NamespaceBinding
	err := r.db.GetContext(ctx, &b, `SELECT * FROM namespace_bindings WHERE id=$1 AND tenant_id=$2`, id, tenantID)
	if errors.Is(err, sql.ErrNoRows) {
		return nil, sentinel.NotFound
	}
	return &b, err
}

func (r *Repository) GetNamespaceBindingByBranchEnv(ctx context.Context, tenantID, branchProfileID, envName string) (*models.NamespaceBinding, error) {
	var b models.NamespaceBinding
	err := r.db.GetContext(ctx, &b,
		`SELECT * FROM namespace_bindings WHERE tenant_id=$1 AND branch_profile_id=$2 AND env_name=$3`,
		tenantID, branchProfileID, envName)
	if errors.Is(err, sql.ErrNoRows) {
		return nil, sentinel.NotFound
	}
	return &b, err
}

func (r *Repository) ListNamespaceBindings(ctx context.Context, tenantID string, q models.NamespaceBindingQuery) ([]models.NamespaceBinding, error) {
	if q.Page <= 0 {
		q.Page = 1
	}
	if q.Limit <= 0 {
		q.Limit = 100
	}
	if q.Limit > 1000 {
		q.Limit = 1000
	}

	var where strings.Builder
	var args []interface{}
	where.WriteString("WHERE tenant_id = $1")
	args = append(args, tenantID)
	argIdx := 2

	if q.BranchProfileID != nil {
		where.WriteString(fmt.Sprintf(" AND branch_profile_id = $%d", argIdx))
		args = append(args, *q.BranchProfileID)
		argIdx++
	}
	if q.EnvName != nil {
		where.WriteString(fmt.Sprintf(" AND env_name = $%d", argIdx))
		args = append(args, *q.EnvName)
		argIdx++
	}

	query := fmt.Sprintf(`SELECT * FROM namespace_bindings %s ORDER BY created_at DESC LIMIT $%d OFFSET $%d`,
		where.String(), argIdx, argIdx+1)
	args = append(args, q.Limit, (q.Page-1)*q.Limit)

	var bindings []models.NamespaceBinding
	err := r.db.SelectContext(ctx, &bindings, query, args...)
	return bindings, err
}

func (r *Repository) DeleteNamespaceBinding(ctx context.Context, tenantID, id string) error {
	result, err := r.db.ExecContext(ctx, `DELETE FROM namespace_bindings WHERE id=$1 AND tenant_id=$2`, id, tenantID)
	if err != nil {
		return err
	}
	n, _ := result.RowsAffected()
	if n == 0 {
		return sentinel.NotFound
	}
	return nil
}

// --- P0-MB Phase 3 — SyncPolicy (L4) + SyncRunLog ---

func (r *Repository) CreateSyncPolicy(ctx context.Context, p *models.SyncPolicy) error {
	row, err := syncPolicyRowFromModel(p)
	if err != nil {
		return err
	}
	_, err = r.db.NamedExecContext(ctx, `INSERT INTO sync_policies
		(id, tenant_id, name, source_branch, target_branches, frequency, cron_expr,
		 strategy, auto_resolve, notify_on_conflict, notify_webhook, enabled,
		 last_run_at, last_run_status, last_run_conflict_files, change_management_id,
		 created_at, updated_at)
		VALUES (:id, :tenant_id, :name, :source_branch, :target_branches, :frequency, :cron_expr,
		 :strategy, :auto_resolve, :notify_on_conflict, :notify_webhook, :enabled,
		 :last_run_at, :last_run_status, :last_run_conflict_files, :change_management_id,
		 :created_at, :updated_at)`, row)
	return err
}

func (r *Repository) GetSyncPolicy(ctx context.Context, tenantID, id string) (*models.SyncPolicy, error) {
	var row syncPolicyRow
	err := r.db.GetContext(ctx, &row, `SELECT * FROM sync_policies WHERE id=$1 AND tenant_id=$2`, id, tenantID)
	if errors.Is(err, sql.ErrNoRows) {
		return nil, sentinel.NotFound
	}
	if err != nil {
		return nil, err
	}
	return row.toModel()
}

func (r *Repository) ListSyncPolicies(ctx context.Context, tenantID string, q models.SyncPolicyQuery) ([]models.SyncPolicy, error) {
	var where strings.Builder
	var args []interface{}
	where.WriteString("WHERE tenant_id = $1")
	args = append(args, tenantID)
	argIdx := 2

	if q.Enabled != nil {
		where.WriteString(fmt.Sprintf(" AND enabled = $%d", argIdx))
		args = append(args, *q.Enabled)
		argIdx++
	}
	if q.Frequency != nil {
		where.WriteString(fmt.Sprintf(" AND frequency = $%d", argIdx))
		args = append(args, *q.Frequency)
		argIdx++
	}
	if q.Strategy != nil {
		where.WriteString(fmt.Sprintf(" AND strategy = $%d", argIdx))
		args = append(args, *q.Strategy)
		argIdx++
	}
	if q.SourceBranch != nil {
		where.WriteString(fmt.Sprintf(" AND source_branch = $%d", argIdx))
		args = append(args, *q.SourceBranch)
		argIdx++
	}
	if q.AutoResolve != nil {
		where.WriteString(fmt.Sprintf(" AND auto_resolve = $%d", argIdx))
		args = append(args, *q.AutoResolve)
		argIdx++
	}

	query := fmt.Sprintf(`SELECT * FROM sync_policies %s ORDER BY created_at DESC`, where.String())
	var rows []syncPolicyRow
	if err := r.db.SelectContext(ctx, &rows, query, args...); err != nil {
		return nil, err
	}
	out := make([]models.SyncPolicy, 0, len(rows))
	for i := range rows {
		m, err := rows[i].toModel()
		if err != nil {
			return nil, err
		}
		out = append(out, *m)
	}
	return out, nil
}

func (r *Repository) UpdateSyncPolicy(ctx context.Context, tenantID, id string, p *models.SyncPolicy) (*models.SyncPolicy, error) {
	row, err := syncPolicyRowFromModel(p)
	if err != nil {
		return nil, err
	}
	result, err := r.db.NamedExecContext(ctx, `UPDATE sync_policies SET
		name = :name, source_branch = :source_branch, target_branches = :target_branches,
		frequency = :frequency, cron_expr = :cron_expr, strategy = :strategy,
		auto_resolve = :auto_resolve, notify_on_conflict = :notify_on_conflict,
		notify_webhook = :notify_webhook, enabled = :enabled, last_run_at = :last_run_at,
		last_run_status = :last_run_status, last_run_conflict_files = :last_run_conflict_files,
		change_management_id = :change_management_id, updated_at = :updated_at
		WHERE id = :id AND tenant_id = :tenant_id`, row)
	if err != nil {
		return nil, err
	}
	n, _ := result.RowsAffected()
	if n == 0 {
		return nil, sentinel.NotFound
	}
	return p, nil
}

func (r *Repository) DeleteSyncPolicy(ctx context.Context, tenantID, id string) error {
	result, err := r.db.ExecContext(ctx, `DELETE FROM sync_policies WHERE id=$1 AND tenant_id=$2`, id, tenantID)
	if err != nil {
		return err
	}
	n, _ := result.RowsAffected()
	if n == 0 {
		return sentinel.NotFound
	}
	return nil
}

func (r *Repository) CreateSyncRunLog(ctx context.Context, l *models.SyncRunLog) error {
	row, err := syncRunLogRowFromModel(l)
	if err != nil {
		return err
	}
	_, err = r.db.NamedExecContext(ctx, `INSERT INTO sync_run_logs
		(id, tenant_id, policy_id, triggered_at, triggered_by, source_commit,
		 target_branches, status, conflict_files, error_msg, duration_ms, change_id)
		VALUES (:id, :tenant_id, :policy_id, :triggered_at, :triggered_by, :source_commit,
		 :target_branches, :status, :conflict_files, :error_msg, :duration_ms, :change_id)`, row)
	return err
}

func (r *Repository) UpdateSyncRunLog(ctx context.Context, tenantID, id string, l *models.SyncRunLog) (*models.SyncRunLog, error) {
	row, err := syncRunLogRowFromModel(l)
	if err != nil {
		return nil, err
	}
	result, err := r.db.NamedExecContext(ctx, `UPDATE sync_run_logs SET
		policy_id = :policy_id, triggered_at = :triggered_at, triggered_by = :triggered_by,
		source_commit = :source_commit, target_branches = :target_branches,
		status = :status, conflict_files = :conflict_files, error_msg = :error_msg,
		duration_ms = :duration_ms, change_id = :change_id
		WHERE id = :id AND tenant_id = :tenant_id`, row)
	if err != nil {
		return nil, err
	}
	n, _ := result.RowsAffected()
	if n == 0 {
		return nil, sentinel.NotFound
	}
	return l, nil
}

func (r *Repository) ListSyncRunLogs(ctx context.Context, tenantID string, q models.SyncRunLogQuery) ([]models.SyncRunLog, error) {
	if q.Limit <= 0 {
		q.Limit = 100
	}
	if q.Limit > 1000 {
		q.Limit = 1000
	}

	var where strings.Builder
	var args []interface{}
	where.WriteString("WHERE tenant_id = $1")
	args = append(args, tenantID)
	argIdx := 2

	if q.PolicyID != nil {
		where.WriteString(fmt.Sprintf(" AND policy_id = $%d", argIdx))
		args = append(args, *q.PolicyID)
		argIdx++
	}
	if q.Status != nil {
		where.WriteString(fmt.Sprintf(" AND status = $%d", argIdx))
		args = append(args, *q.Status)
		argIdx++
	}
	if q.From != nil {
		where.WriteString(fmt.Sprintf(" AND triggered_at >= $%d", argIdx))
		args = append(args, *q.From)
		argIdx++
	}
	if q.To != nil {
		where.WriteString(fmt.Sprintf(" AND triggered_at <= $%d", argIdx))
		args = append(args, *q.To)
		argIdx++
	}

	query := fmt.Sprintf(`SELECT * FROM sync_run_logs %s ORDER BY triggered_at DESC LIMIT $%d`, where.String(), argIdx)
	args = append(args, q.Limit)

	var rows []syncRunLogRow
	if err := r.db.SelectContext(ctx, &rows, query, args...); err != nil {
		return nil, err
	}
	out := make([]models.SyncRunLog, 0, len(rows))
	for i := range rows {
		m, err := rows[i].toModel()
		if err != nil {
			return nil, err
		}
		out = append(out, *m)
	}
	return out, nil
}

// --- P0-MB Phase 4 — DeployEvent (L5) + rollback + audit trail ---

func (r *Repository) CreateDeployEvent(ctx context.Context, evt *models.DeployEvent) error {
	_, err := r.db.NamedExecContext(ctx, `INSERT INTO deploy_events
		(id, tenant_id, actor_id, actor_name, branch, env, from_commit, to_commit,
		 artifact_id, image_digest, approval_id, outcome, rollback_to, duration_ms,
		 error_rate, p99_latency, started_at, completed_at, gate_result, error_msg, created_at)
		VALUES (:id, :tenant_id, :actor_id, :actor_name, :branch, :env, :from_commit, :to_commit,
		 :artifact_id, :image_digest, :approval_id, :outcome, :rollback_to, :duration_ms,
		 :error_rate, :p99_latency, :started_at, :completed_at, :gate_result, :error_msg, :created_at)`, evt)
	return err
}

func (r *Repository) GetDeployEvent(ctx context.Context, tenantID, id string) (*models.DeployEvent, error) {
	var evt models.DeployEvent
	err := r.db.GetContext(ctx, &evt, `SELECT * FROM deploy_events WHERE id=$1 AND tenant_id=$2`, id, tenantID)
	if errors.Is(err, sql.ErrNoRows) {
		return nil, sentinel.NotFound
	}
	return &evt, err
}

func (r *Repository) UpdateDeployEvent(ctx context.Context, tenantID, id string, evt *models.DeployEvent) (*models.DeployEvent, error) {
	result, err := r.db.NamedExecContext(ctx, `UPDATE deploy_events SET
		actor_id = :actor_id, actor_name = :actor_name, branch = :branch, env = :env,
		from_commit = :from_commit, to_commit = :to_commit, artifact_id = :artifact_id,
		image_digest = :image_digest, approval_id = :approval_id, outcome = :outcome,
		rollback_to = :rollback_to, duration_ms = :duration_ms, error_rate = :error_rate,
		p99_latency = :p99_latency, started_at = :started_at, completed_at = :completed_at,
		gate_result = :gate_result, error_msg = :error_msg, created_at = :created_at
		WHERE id = :id AND tenant_id = :tenant_id`, evt)
	if err != nil {
		return nil, err
	}
	n, _ := result.RowsAffected()
	if n == 0 {
		return nil, sentinel.NotFound
	}
	return evt, nil
}

func (r *Repository) ListDeployEvents(ctx context.Context, tenantID string, q models.DeployEventQuery) ([]models.DeployEvent, error) {
	if q.Limit <= 0 {
		q.Limit = 100
	}
	if q.Limit > 1000 {
		q.Limit = 1000
	}

	var where strings.Builder
	var args []interface{}
	where.WriteString("WHERE tenant_id = $1")
	args = append(args, tenantID)
	argIdx := 2

	if q.Branch != nil {
		where.WriteString(fmt.Sprintf(" AND branch = $%d", argIdx))
		args = append(args, *q.Branch)
		argIdx++
	}
	if q.Env != nil {
		where.WriteString(fmt.Sprintf(" AND env = $%d", argIdx))
		args = append(args, *q.Env)
		argIdx++
	}
	if q.ActorID != nil {
		where.WriteString(fmt.Sprintf(" AND actor_id = $%d", argIdx))
		args = append(args, *q.ActorID)
		argIdx++
	}
	if q.ApprovalID != nil {
		where.WriteString(fmt.Sprintf(" AND approval_id = $%d", argIdx))
		args = append(args, *q.ApprovalID)
		argIdx++
	}
	if q.Outcome != nil {
		where.WriteString(fmt.Sprintf(" AND outcome = $%d", argIdx))
		args = append(args, *q.Outcome)
		argIdx++
	}
	if q.From != nil {
		where.WriteString(fmt.Sprintf(" AND started_at >= $%d", argIdx))
		args = append(args, *q.From)
		argIdx++
	}
	if q.To != nil {
		where.WriteString(fmt.Sprintf(" AND started_at <= $%d", argIdx))
		args = append(args, *q.To)
		argIdx++
	}

	query := fmt.Sprintf(`SELECT * FROM deploy_events %s ORDER BY started_at DESC LIMIT $%d`, where.String(), argIdx)
	args = append(args, q.Limit)

	var events []models.DeployEvent
	err := r.db.SelectContext(ctx, &events, query, args...)
	return events, err
}

func (r *Repository) ListDeployEventsByBranch(ctx context.Context, tenantID, branch string, limit int) ([]models.DeployEvent, error) {
	if limit <= 0 {
		limit = 100
	}
	if limit > 1000 {
		limit = 1000
	}
	var events []models.DeployEvent
	err := r.db.SelectContext(ctx, &events,
		`SELECT * FROM deploy_events WHERE tenant_id=$1 AND branch=$2 ORDER BY started_at DESC LIMIT $3`,
		tenantID, branch, limit)
	return events, err
}

func (r *Repository) ListDeployEventsByEnv(ctx context.Context, tenantID, env string, limit int) ([]models.DeployEvent, error) {
	if limit <= 0 {
		limit = 100
	}
	if limit > 1000 {
		limit = 1000
	}
	var events []models.DeployEvent
	err := r.db.SelectContext(ctx, &events,
		`SELECT * FROM deploy_events WHERE tenant_id=$1 AND env=$2 ORDER BY started_at DESC LIMIT $3`,
		tenantID, env, limit)
	return events, err
}

func (r *Repository) ListDeployEventsByActor(ctx context.Context, tenantID, actorID string, limit int) ([]models.DeployEvent, error) {
	if limit <= 0 {
		limit = 100
	}
	if limit > 1000 {
		limit = 1000
	}
	var events []models.DeployEvent
	err := r.db.SelectContext(ctx, &events,
		`SELECT * FROM deploy_events WHERE tenant_id=$1 AND actor_id=$2 ORDER BY started_at DESC LIMIT $3`,
		tenantID, actorID, limit)
	return events, err
}

// --- P0-MB Phase 5 — MergePreview (conflict pre-check). PreDeployGateResult
// is NOT persisted (API response only), so only MergePreview goes in DB. ---

func (r *Repository) CreateMergePreview(ctx context.Context, p *models.MergePreview) error {
	row, err := mergePreviewRowFromModel(p)
	if err != nil {
		return err
	}
	_, err = r.db.NamedExecContext(ctx, `INSERT INTO merge_previews
		(id, tenant_id, source_branch, target_branch, source_commit, target_commit,
		 conflict_files, added_files, modified_files, deleted_files, conflict_count,
		 risk_level, previewed_at)
		VALUES (:id, :tenant_id, :source_branch, :target_branch, :source_commit, :target_commit,
		 :conflict_files, :added_files, :modified_files, :deleted_files, :conflict_count,
		 :risk_level, :previewed_at)`, row)
	return err
}

func (r *Repository) GetMergePreview(ctx context.Context, tenantID, id string) (*models.MergePreview, error) {
	var row mergePreviewRow
	err := r.db.GetContext(ctx, &row, `SELECT * FROM merge_previews WHERE id=$1 AND tenant_id=$2`, id, tenantID)
	if errors.Is(err, sql.ErrNoRows) {
		return nil, sentinel.NotFound
	}
	if err != nil {
		return nil, err
	}
	return row.toModel()
}

func (r *Repository) ListMergePreviews(ctx context.Context, tenantID string, limit int) ([]models.MergePreview, error) {
	if limit <= 0 {
		limit = 100
	}
	if limit > 1000 {
		limit = 1000
	}
	var rows []mergePreviewRow
	if err := r.db.SelectContext(ctx, &rows,
		`SELECT * FROM merge_previews WHERE tenant_id=$1 ORDER BY previewed_at DESC LIMIT $2`,
		tenantID, limit); err != nil {
		return nil, err
	}
	out := make([]models.MergePreview, 0, len(rows))
	for i := range rows {
		m, err := rows[i].toModel()
		if err != nil {
			return nil, err
		}
		out = append(out, *m)
	}
	return out, nil
}
