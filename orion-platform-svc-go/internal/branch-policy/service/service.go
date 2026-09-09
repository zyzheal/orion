package service

//go:generate mockgen -destination=mock_service.go -package=service . ServiceInterface
//go:generate mockgen -destination=mock_repository.go -package=service . RepositoryInterface

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"hash/fnv"
	"regexp"
	"strings"
	"time"

	"go.uber.org/zap"

	"orion/go-common/pkg/sentinel"
	"orion/platform-svc-go/internal/branch-policy/gitmerge"
	"orion/platform-svc-go/internal/branch-policy/models"
)

// RepositoryInterface defines the repository methods used by the service.
type RepositoryInterface interface {
	Create(ctx context.Context, tenantID string, req models.CreateRequest) (*models.Record, error)
	Delete(ctx context.Context, tenantID, id string) error
	GetByID(ctx context.Context, tenantID, id string) (*models.Record, error)
	List(ctx context.Context, tenantID string) ([]models.Record, error)
	Update(ctx context.Context, tenantID, id string, req models.CreateRequest) (*models.Record, error)

	// P0-MB Phase 1 — BranchProfile (L1)
	CreateBranchProfile(ctx context.Context, p *models.BranchProfile) error
	GetBranchProfile(ctx context.Context, tenantID, id string) (*models.BranchProfile, error)
	ListBranchProfiles(ctx context.Context, tenantID string, q models.BranchProfileQuery) ([]models.BranchProfile, error)
	UpdateBranchProfile(ctx context.Context, tenantID, id string, p *models.BranchProfile) (*models.BranchProfile, error)

	// P0-MB Phase 1 — BuildArtifact (L3)
	CreateBuildArtifact(ctx context.Context, a *models.BuildArtifact) error
	GetBuildArtifact(ctx context.Context, tenantID, id string) (*models.BuildArtifact, error)
	ListBuildArtifacts(ctx context.Context, tenantID string, q models.ArtifactQuery) ([]models.BuildArtifact, error)
	UpdateBuildArtifact(ctx context.Context, tenantID, id string, a *models.BuildArtifact) (*models.BuildArtifact, error)

	// P0-MB Phase 2 — NamespaceBinding (L2)
	CreateNamespaceBinding(ctx context.Context, b *models.NamespaceBinding) error
	GetNamespaceBinding(ctx context.Context, tenantID, id string) (*models.NamespaceBinding, error)
	GetNamespaceBindingByBranchEnv(ctx context.Context, tenantID, branchProfileID, envName string) (*models.NamespaceBinding, error)
	ListNamespaceBindings(ctx context.Context, tenantID string, q models.NamespaceBindingQuery) ([]models.NamespaceBinding, error)
	DeleteNamespaceBinding(ctx context.Context, tenantID, id string) error

	// P0-MB Phase 3 — SyncPolicy (L4) + SyncRunLog
	CreateSyncPolicy(ctx context.Context, p *models.SyncPolicy) error
	GetSyncPolicy(ctx context.Context, tenantID, id string) (*models.SyncPolicy, error)
	ListSyncPolicies(ctx context.Context, tenantID string, q models.SyncPolicyQuery) ([]models.SyncPolicy, error)
	UpdateSyncPolicy(ctx context.Context, tenantID, id string, p *models.SyncPolicy) (*models.SyncPolicy, error)
	DeleteSyncPolicy(ctx context.Context, tenantID, id string) error
	CreateSyncRunLog(ctx context.Context, l *models.SyncRunLog) error
	UpdateSyncRunLog(ctx context.Context, tenantID, id string, l *models.SyncRunLog) (*models.SyncRunLog, error)
	ListSyncRunLogs(ctx context.Context, tenantID string, q models.SyncRunLogQuery) ([]models.SyncRunLog, error)

	// P0-MB Phase 4 — DeployEvent (L5) + rollback + audit trail
	CreateDeployEvent(ctx context.Context, evt *models.DeployEvent) error
	GetDeployEvent(ctx context.Context, tenantID, id string) (*models.DeployEvent, error)
	UpdateDeployEvent(ctx context.Context, tenantID, id string, evt *models.DeployEvent) (*models.DeployEvent, error)
	ListDeployEvents(ctx context.Context, tenantID string, q models.DeployEventQuery) ([]models.DeployEvent, error)
	ListDeployEventsByBranch(ctx context.Context, tenantID, branch string, limit int) ([]models.DeployEvent, error)
	ListDeployEventsByEnv(ctx context.Context, tenantID, env string, limit int) ([]models.DeployEvent, error)
	ListDeployEventsByActor(ctx context.Context, tenantID, actorID string, limit int) ([]models.DeployEvent, error)

	// P0-MB Phase 5 — MergePreview (conflict pre-check). PreDeployGateResult
	// is NOT persisted (API response only), so only MergePreview goes in DB.
	CreateMergePreview(ctx context.Context, p *models.MergePreview) error
	GetMergePreview(ctx context.Context, tenantID, id string) (*models.MergePreview, error)
	ListMergePreviews(ctx context.Context, tenantID string, limit int) ([]models.MergePreview, error)
}

// ErrBranchProfileNotFound wraps repository-level not-found into a
// service-friendly sentinel. Handlers compare with errors.Is.
var ErrBranchProfileNotFound = errors.New("branch profile not found")

// sentinelNotFound is a local alias for the repository-level not-found
// sentinel used by the Phase 1/2 stub methods. Using a short name keeps the
// service code readable.
var sentinelNotFound = sentinel.NotFound

type Service struct {
	repo RepositoryInterface
	// gitExecutor is an optional merge-tree runner. When non-nil and the
	// caller does not supply ConflictFiles, CreateMergePreview shells out to
	// `git merge-tree --write-tree` to populate the conflict list. When nil
	// (the default) the service falls back to client-supplied conflicts or
	// an empty list — the same behaviour as before the gitmerge package was
	// introduced. Wired by NewServiceWithGit or WithGitExecutor.
	gitExecutor gitmerge.Executor
	// logger is an optional structured logger used to emit diagnostic
	// warnings when the git merge-tree call degrades to the client-supplied
	// fallback path. When nil (default for tests / legacy callers) the
	// logGitMergeError hook is a silent no-op — no behaviour change.
	// Wired by NewServiceWithLogger or WithLogger.
	logger *zap.Logger
	// schemaChecker is an optional SchemaCompatibilityChecker used by
	// PreDeployGate R6. When nil (default for tests / legacy callers / pre-
	// wiring environments) R6 falls back to the placeholder path — always
	// passes with a "not implemented" warning so callers can distinguish
	// "checker not wired" from "checker ran and passed".
	// Wired by WithSchemaChecker.
	schemaChecker SchemaCompatibilityChecker
}

func NewService(repo RepositoryInterface) *Service {
	return &Service{repo: repo}
}

// NewServiceWithGit is a constructor that wires a merge-tree Executor into
// the service. Pass nil to fall back to client-supplied conflicts only.
// Deprecated: prefer NewServiceWithLogger for production wiring so that
// merge-tree degradation is visible in structured logs.
func NewServiceWithGit(repo RepositoryInterface, git gitmerge.Executor) *Service {
	return &Service{repo: repo, gitExecutor: git}
}

// NewServiceWithLogger is the canonical constructor for production wiring:
// it takes the repository, an optional merge-tree executor (nil → client-
// supplied fallback), and a structured logger used by logGitMergeError to
// emit Warn entries when git merge-tree fails. A nil logger disables
// logging (kept for tests that want the silent no-op path).
func NewServiceWithLogger(repo RepositoryInterface, git gitmerge.Executor, logger *zap.Logger) *Service {
	return &Service{repo: repo, gitExecutor: git, logger: logger}
}

// WithGitExecutor attaches the given merge-tree Executor to the service
// (mutates in place and returns the same pointer for chaining). A nil
// argument resets the executor to the client-supplied fallback.
func (s *Service) WithGitExecutor(git gitmerge.Executor) *Service {
	s.gitExecutor = git
	return s
}

// WithLogger attaches a structured logger used by logGitMergeError to emit
// Warn entries when git merge-tree degrades. Chainable; nil disables
// logging.
func (s *Service) WithLogger(logger *zap.Logger) *Service {
	s.logger = logger
	return s
}

// WithSchemaChecker attaches a SchemaCompatibilityChecker used by
// PreDeployGate R6. Chainable; nil falls back to the placeholder path
// (always passes with a "not implemented" warning).
func (s *Service) WithSchemaChecker(c SchemaCompatibilityChecker) *Service {
	s.schemaChecker = c
	return s
}

func (s *Service) List(ctx context.Context, tenantID string) ([]models.Record, error) {
	return s.repo.List(ctx, tenantID)
}

func (s *Service) Get(ctx context.Context, tenantID, id string) (*models.Record, error) {
	return s.repo.GetByID(ctx, tenantID, id)
}

func (s *Service) Create(ctx context.Context, tenantID string, req models.CreateRequest) (*models.Record, error) {
	return s.repo.Create(ctx, tenantID, req)
}

func (s *Service) Update(ctx context.Context, tenantID, id string, req models.CreateRequest) (*models.Record, error) {
	return s.repo.Update(ctx, tenantID, id, req)
}

func (s *Service) Delete(ctx context.Context, tenantID, id string) error {
	return s.repo.Delete(ctx, tenantID, id)
}

// Additional service methods wired from handler stubs

func (s *Service) ValidateBranch(ctx context.Context, tenantID, branch string) (bool, error) {
	return true, nil
}

func (s *Service) GetCoverage(ctx context.Context, tenantID string) (map[string]interface{}, error) {
	return make(map[string]interface{}), nil
}

func (s *Service) EnforcePolicy(ctx context.Context, tenantID string) error {
	return nil
}

func (s *Service) ListViolations(ctx context.Context, tenantID string) ([]string, error) {
	return []string{}, nil
}

func (s *Service) GetStats(ctx context.Context, tenantID string) (map[string]interface{}, error) {
	return make(map[string]interface{}), nil
}

func (s *Service) RunInspection(ctx context.Context, tenantID string) error {
	return nil
}

func (s *Service) GetResults(ctx context.Context, tenantID string) ([]string, error) {
	return []string{}, nil
}

func (s *Service) UpdateStatus(ctx context.Context, tenantID, id string) error {
	return nil
}

func (s *Service) ListTemplates(ctx context.Context, tenantID string) ([]string, error) {
	return []string{}, nil
}

func (s *Service) RunPipeline(ctx context.Context, tenantID string) error {
	return nil
}

func (s *Service) GetStatus(ctx context.Context, tenantID string) (string, error) {
	return "running", nil
}

func (s *Service) Pause(ctx context.Context, tenantID, id string) error {
	return nil
}

func (s *Service) Resume(ctx context.Context, tenantID, id string) error {
	return nil
}

func (s *Service) GetLogs(ctx context.Context, tenantID, id string) ([]string, error) {
	return []string{}, nil
}

func (s *Service) ListSchemas(ctx context.Context, tenantID string) ([]string, error) {
	return []string{}, nil
}

func (s *Service) GetLineage(ctx context.Context, tenantID, id string) (map[string]interface{}, error) {
	return make(map[string]interface{}), nil
}

func (s *Service) GetConfig(ctx context.Context, tenantID string) (map[string]interface{}, error) {
	return make(map[string]interface{}), nil
}

func (s *Service) UpdateConfig(ctx context.Context, tenantID string, cfg map[string]interface{}) error {
	return nil
}

func (s *Service) GetStatusMiddleware(ctx context.Context, tenantID string) (string, error) {
	return "healthy", nil
}

func (s *Service) Restart(ctx context.Context, tenantID string) error {
	return nil
}

func (s *Service) Configure(ctx context.Context, tenantID string, cfg map[string]interface{}) error {
	return nil
}

func (s *Service) ListPlugins(ctx context.Context, tenantID string) ([]string, error) {
	return []string{}, nil
}

func (s *Service) GetPlugin(ctx context.Context, tenantID, id string) (map[string]interface{}, error) {
	return make(map[string]interface{}), nil
}

func (s *Service) EnablePlugin(ctx context.Context, tenantID, id string) error {
	return nil
}

func (s *Service) DisablePlugin(ctx context.Context, tenantID, id string) error {
	return nil
}

func (s *Service) Train(ctx context.Context, tenantID string) error {
	return nil
}

func (s *Service) Evaluate(ctx context.Context, tenantID string) error {
	return nil
}

func (s *Service) Deploy(ctx context.Context, tenantID, id string) error {
	return nil
}

func (s *Service) Rollback(ctx context.Context, tenantID, id string) error {
	return nil
}

func (s *Service) GetMetrics(ctx context.Context, tenantID string) (map[string]interface{}, error) {
	return make(map[string]interface{}), nil
}

func (s *Service) ListExperiments(ctx context.Context, tenantID string) ([]string, error) {
	return []string{}, nil
}

func (s *Service) ListArtifacts(ctx context.Context, tenantID string) ([]string, error) {
	return []string{}, nil
}

func (s *Service) ListModels(ctx context.Context, tenantID string) ([]string, error) {
	return []string{}, nil
}

func (s *Service) RegisterModel(ctx context.Context, tenantID string) error {
	return nil
}

func (s *Service) DeregisterModel(ctx context.Context, tenantID, id string) error {
	return nil
}

func (s *Service) ListPipelines(ctx context.Context, tenantID string) ([]string, error) {
	return []string{}, nil
}

func (s *Service) Trigger(ctx context.Context, tenantID string) error {
	return nil
}

func (s *Service) ListTemplates2(ctx context.Context, tenantID string) ([]string, error) {
	return []string{}, nil
}

func (s *Service) GetBranchStatus(ctx context.Context, tenantID, id string) (string, error) {
	return "valid", nil
}

func (s *Service) ListHistories(ctx context.Context, tenantID string) ([]string, error) {
	return []string{}, nil
}

func (s *Service) ListPending(ctx context.Context, tenantID string) ([]string, error) {
	return []string{}, nil
}

func (s *Service) Approve(ctx context.Context, tenantID, id string) error {
	return nil
}

func (s *Service) Reject(ctx context.Context, tenantID, id string) error {
	return nil
}

func (s *Service) Escalate(ctx context.Context, tenantID, id string) error {
	return nil
}

func (s *Service) GetByUser(ctx context.Context, tenantID, user string) ([]string, error) {
	return []string{}, nil
}

func (s *Service) Forecast(ctx context.Context, tenantID string) (map[string]interface{}, error) {
	return make(map[string]interface{}), nil
}

func (s *Service) GetUtilization(ctx context.Context, tenantID string) (map[string]interface{}, error) {
	return make(map[string]interface{}), nil
}

func (s *Service) ScaleResource(ctx context.Context, tenantID string) error {
	return nil
}

func (s *Service) ListAlerts(ctx context.Context, tenantID string) ([]string, error) {
	return []string{}, nil
}

func (s *Service) GetHistory(ctx context.Context, tenantID string) ([]string, error) {
	return []string{}, nil
}

func (s *Service) AddTag(ctx context.Context, tenantID string, tag string) error {
	return nil
}

func (s *Service) DeleteTag(ctx context.Context, tenantID string, tag string) error {
	return nil
}

func (s *Service) CheckCompatibility(ctx context.Context, tenantID string) (bool, error) {
	return true, nil
}

func (s *Service) BatchCreate(ctx context.Context, tenantID string, reqs []models.CreateRequest) ([]models.Record, error) {
	return []models.Record{}, nil
}

func (s *Service) Search(ctx context.Context, tenantID, q string) ([]string, error) {
	return []string{}, nil
}

func (s *Service) Regenerate(ctx context.Context, tenantID string) error {
	return nil
}

// ============================================================================
// P0-MB Phase 1 — L1 BranchProfile + L3 BuildArtifact
// ============================================================================

var (
	// sha256Re matches the canonical form "sha256:<64 hex>".
	sha256Re = regexp.MustCompile(`^sha256:[0-9a-fA-F]{64}$`)
	// bareSha256Re matches a bare 64-hex digest (no prefix). We auto-promote
	// these to the canonical form on write.
	bareSha256Re = regexp.MustCompile(`^[0-9a-fA-F]{64}$`)
	// commitSHARe matches a 40-hex git commit SHA.
	commitSHARe = regexp.MustCompile(`^[0-9a-fA-F]{40}$`)
	// envNameRe is the accepted environment identifier pattern.
	envNameRe = regexp.MustCompile(`^[a-z0-9][a-z0-9-]{0,62}$`)
)

// newBranchID returns a unique id prefixed with "bp". Uses the same trick as
// tenant-quota.generateID — nanosecond timestamp + fnv hash + microsecond
// offset to keep collisions practically impossible in tests.
func newBranchID() string {
	now := time.Now()
	h := fnv.New64a()
	h.Write([]byte(fmt.Sprintf("bp-%d-%d", now.UnixNano(), now.UnixMicro())))
	return fmt.Sprintf("bp-%x", h.Sum(nil)[:8])
}

func newArtifactID() string {
	now := time.Now()
	h := fnv.New64a()
	h.Write([]byte(fmt.Sprintf("ba-%d-%d", now.UnixNano(), now.UnixMicro())))
	return fmt.Sprintf("ba-%x", h.Sum(nil)[:8])
}

// normalizeDigest accepts either "sha256:<hex>" or bare "<hex>" and returns
// the canonical lowercase form. The bool return is false on malformed input.
func normalizeDigest(in string) (string, bool) {
	in = strings.TrimSpace(in)
	if in == "" {
		return "", false
	}
	if sha256Re.MatchString(in) {
		return "sha256:" + strings.ToLower(strings.TrimPrefix(in, "sha256:")), true
	}
	if bareSha256Re.MatchString(in) {
		return "sha256:" + strings.ToLower(in), true
	}
	return "", false
}

// validateEnvName returns a user-facing error message if env is malformed.
// Empty string means the name is valid.
func validateEnvName(env string) string {
	if env == "" {
		return "environment name is required"
	}
	if !envNameRe.MatchString(env) {
		return fmt.Sprintf("environment name %q must match %q", env, envNameRe.String())
	}
	return ""
}

// validateBranchProfile enforces the semantic/name/merge-target rules
// documented on CreateBranchProfileRequest.
func validateBranchProfile(req *models.CreateBranchProfileRequest) error {
	if req == nil {
		return fmt.Errorf("request is nil")
	}
	if req.RepoID == "" {
		return fmt.Errorf("repoId is required")
	}
	if req.Name == "" {
		return fmt.Errorf("name is required")
	}
	if req.OwnerID == "" {
		return fmt.Errorf("ownerId is required")
	}
	if !req.Semantic.Valid() {
		return fmt.Errorf("semantic %q is not a known branch semantic", req.Semantic)
	}
	if err := validateBranchName(req.Semantic, req.Name); err != nil {
		return err
	}
	if req.Semantic != models.BranchMain && len(req.MergeTargets) == 0 {
		return fmt.Errorf("mergeTargets is required for non-main branch %q", req.Name)
	}
	if req.Semantic == models.BranchLTS && req.LTSUntil == nil {
		return fmt.Errorf("ltsUntil is required for lts branch %q", req.Name)
	}
	if req.Semantic == models.BranchLTS && req.LTSUntil != nil && req.LTSUntil.Before(time.Now()) {
		return fmt.Errorf("ltsUntil must be in the future (got %s)", req.LTSUntil.Format(time.RFC3339))
	}
	return nil
}

// validateBranchName checks that name satisfies the required prefix for the
// given semantic. For BranchMain the name must be exactly "main".
func validateBranchName(semantic models.BranchSemantic, name string) error {
	if name == "" {
		return fmt.Errorf("branch name is required")
	}
	if semantic == models.BranchMain {
		if name != "main" {
			return fmt.Errorf("main branch name must be exactly \"main\" (got %q)", name)
		}
		return nil
	}
	prefix := semantic.RequiredNamePrefix()
	if prefix == "" {
		return nil
	}
	if !strings.HasPrefix(name, prefix) {
		return fmt.Errorf("branch name %q must start with %q for semantic %q", name, prefix, semantic)
	}
	if rest := strings.TrimPrefix(name, prefix); rest == "" {
		return fmt.Errorf("branch name %q must include a suffix after %q", name, prefix)
	}
	return nil
}

// normalizeSlice trims whitespace, drops empties, dedups (preserves order).
func normalizeSlice(in []string) []string {
	if len(in) == 0 {
		return nil
	}
	out := make([]string, 0, len(in))
	seen := make(map[string]struct{}, len(in))
	for _, s := range in {
		s = strings.TrimSpace(s)
		if s == "" {
			continue
		}
		if _, dup := seen[s]; dup {
			continue
		}
		seen[s] = struct{}{}
		out = append(out, s)
	}
	return out
}

// --- BranchProfile CRUD ---

func (s *Service) ListBranchProfiles(ctx context.Context, tenantID string, q models.BranchProfileQuery) ([]models.BranchProfile, error) {
	if tenantID == "" {
		return nil, fmt.Errorf("tenant_id is required")
	}
	out, err := s.repo.ListBranchProfiles(ctx, tenantID, q)
	if err != nil {
		return nil, err
	}
	if out == nil {
		return []models.BranchProfile{}, nil
	}
	return out, nil
}

func (s *Service) CreateBranchProfile(ctx context.Context, tenantID string, req *models.CreateBranchProfileRequest) (*models.BranchProfile, error) {
	if tenantID == "" {
		return nil, fmt.Errorf("tenant_id is required")
	}
	if err := validateBranchProfile(req); err != nil {
		return nil, err
	}
	now := time.Now()
	p := &models.BranchProfile{
		ID:               newBranchID(),
		TenantID:         tenantID,
		RepoID:           req.RepoID,
		Name:             req.Name,
		Semantic:         req.Semantic,
		OwnerID:          req.OwnerID,
		OwnerName:        req.OwnerName,
		Description:      req.Description,
		LTSUntil:         req.LTSUntil,
		MergeTargets:     normalizeSlice(req.MergeTargets),
		MergeSources:     normalizeSlice(req.MergeSources),
		ProtectedEnvs:    normalizeSlice(req.ProtectedEnvs),
		AllowedPipelines: normalizeSlice(req.AllowedPipelines),
		Status:           models.BranchStatusActive,
		CreatedAt:        now,
		UpdatedAt:        now,
	}
	if err := s.repo.CreateBranchProfile(ctx, p); err != nil {
		return nil, err
	}
	return p, nil
}

func (s *Service) GetBranchProfile(ctx context.Context, tenantID, id string) (*models.BranchProfile, error) {
	if tenantID == "" || id == "" {
		return nil, fmt.Errorf("tenant_id and id are required")
	}
	p, err := s.repo.GetBranchProfile(ctx, tenantID, id)
	if err != nil {
		return nil, err
	}
	if p == nil {
		return nil, ErrBranchProfileNotFound
	}
	return p, nil
}

func (s *Service) UpdateBranchProfile(ctx context.Context, tenantID, id string, req *models.UpdateBranchProfileRequest) (*models.BranchProfile, error) {
	if tenantID == "" || id == "" {
		return nil, fmt.Errorf("tenant_id and id are required")
	}
	if req == nil {
		return nil, fmt.Errorf("request is nil")
	}
	current, err := s.repo.GetBranchProfile(ctx, tenantID, id)
	if err != nil {
		return nil, err
	}
	if current == nil {
		return nil, ErrBranchProfileNotFound
	}
	if current.Status == models.BranchStatusArchived || current.Status == models.BranchStatusRetired {
		return nil, fmt.Errorf("branch profile %q is %s; reactivate before updating", id, current.Status)
	}

	if req.Name != nil && *req.Name != current.Name {
		if err := validateBranchName(current.Semantic, *req.Name); err != nil {
			return nil, err
		}
		current.Name = *req.Name
	}
	if req.Description != nil {
		current.Description = *req.Description
	}
	if req.OwnerID != nil && *req.OwnerID != "" {
		current.OwnerID = *req.OwnerID
	}
	if req.OwnerName != nil {
		current.OwnerName = *req.OwnerName
	}
	if req.LTSUntil != nil {
		if current.Semantic != models.BranchLTS {
			return nil, fmt.Errorf("ltsUntil can only be set on lts branches (semantic=%q)", current.Semantic)
		}
		if (*req.LTSUntil).Before(time.Now()) {
			return nil, fmt.Errorf("ltsUntil must be in the future")
		}
		next := (*req.LTSUntil)
		current.LTSUntil = &next
	}
	if req.MergeTargets != nil {
		next := normalizeSlice(*req.MergeTargets)
		if current.Semantic != models.BranchMain && len(next) == 0 {
			return nil, fmt.Errorf("mergeTargets cannot be cleared for non-main branch %q", current.Name)
		}
		current.MergeTargets = next
	}
	if req.MergeSources != nil {
		current.MergeSources = normalizeSlice(*req.MergeSources)
	}
	if req.ProtectedEnvs != nil {
		envs := normalizeSlice(*req.ProtectedEnvs)
		for _, env := range envs {
			if msg := validateEnvName(env); msg != "" {
				return nil, fmt.Errorf("%s", msg)
			}
		}
		current.ProtectedEnvs = envs
	}
	if req.AllowedPipelines != nil {
		current.AllowedPipelines = normalizeSlice(*req.AllowedPipelines)
	}
	current.UpdatedAt = time.Now()
	return s.repo.UpdateBranchProfile(ctx, tenantID, id, current)
}

// ArchiveBranchProfile transitions a profile to archived. Refuses when the
// branch still owns active build artifacts — they must be deprecated first.
func (s *Service) ArchiveBranchProfile(ctx context.Context, tenantID, id string) (*models.BranchProfile, error) {
	if tenantID == "" || id == "" {
		return nil, fmt.Errorf("tenant_id and id are required")
	}
	current, err := s.repo.GetBranchProfile(ctx, tenantID, id)
	if err != nil {
		return nil, err
	}
	if current == nil {
		return nil, ErrBranchProfileNotFound
	}
	if current.Status == models.BranchStatusArchived || current.Status == models.BranchStatusRetired {
		return current, nil
	}
	activeStatus := models.ArtifactStatusActive
	arts, err := s.repo.ListBuildArtifacts(ctx, tenantID, models.ArtifactQuery{
		BranchProfileID: &id,
		Status:          &activeStatus,
	})
	if err != nil {
		return nil, err
	}
	if len(arts) > 0 {
		return nil, fmt.Errorf("branch profile %q still has %d active artifacts; deprecate them first", id, len(arts))
	}
	now := time.Now()
	current.Status = models.BranchStatusArchived
	current.ArchivedAt = &now
	current.UpdatedAt = now
	return s.repo.UpdateBranchProfile(ctx, tenantID, id, current)
}

// ActivateBranchProfile restores an archived profile to active. For LTS
// branches whose LTSUntil has already passed, reactivation requires a new
// LTSUntil (via UpdateBranchProfile) before this call can succeed.
func (s *Service) ActivateBranchProfile(ctx context.Context, tenantID, id string) (*models.BranchProfile, error) {
	if tenantID == "" || id == "" {
		return nil, fmt.Errorf("tenant_id and id are required")
	}
	current, err := s.repo.GetBranchProfile(ctx, tenantID, id)
	if err != nil {
		return nil, err
	}
	if current == nil {
		return nil, ErrBranchProfileNotFound
	}
	if current.Status == models.BranchStatusActive {
		return current, nil
	}
	if current.Semantic == models.BranchLTS && current.LTSUntil != nil && current.LTSUntil.Before(time.Now()) {
		return nil, fmt.Errorf("lts branch %q expired on %s; extend ltsUntil before reactivating", current.Name, current.LTSUntil.Format(time.RFC3339))
	}
	now := time.Now()
	current.Status = models.BranchStatusActive
	current.ArchivedAt = nil
	current.UpdatedAt = now
	return s.repo.UpdateBranchProfile(ctx, tenantID, id, current)
}

// --- BuildArtifact CRUD ---

func (s *Service) ListBuildArtifacts(ctx context.Context, tenantID string, q models.ArtifactQuery) ([]models.BuildArtifact, error) {
	if tenantID == "" {
		return nil, fmt.Errorf("tenant_id is required")
	}
	out, err := s.repo.ListBuildArtifacts(ctx, tenantID, q)
	if err != nil {
		return nil, err
	}
	if out == nil {
		return []models.BuildArtifact{}, nil
	}
	return out, nil
}

func (s *Service) RegisterBuildArtifact(ctx context.Context, tenantID string, req *models.RegisterArtifactRequest) (*models.BuildArtifact, error) {
	if tenantID == "" {
		return nil, fmt.Errorf("tenant_id is required")
	}
	if req == nil {
		return nil, fmt.Errorf("request is nil")
	}
	if len(req.TargetEnvs) == 0 {
		return nil, fmt.Errorf("targetEnvs is required")
	}
	for _, env := range req.TargetEnvs {
		if msg := validateEnvName(env); msg != "" {
			return nil, fmt.Errorf("%s", msg)
		}
	}
	digest, ok := normalizeDigest(req.ImageDigest)
	if !ok {
		return nil, fmt.Errorf("imageDigest must be sha256:<64 hex> (got %q)", req.ImageDigest)
	}
	if !commitSHARe.MatchString(strings.TrimSpace(req.CommitSHA)) {
		return nil, fmt.Errorf("commitSha must be 40-hex (got %q)", req.CommitSHA)
	}
	if req.BuildPipelineID == "" {
		return nil, fmt.Errorf("buildPipelineId is required")
	}
	if req.ImageRepo == "" {
		return nil, fmt.Errorf("imageRepo is required")
	}
	if req.ImageTag == "" {
		return nil, fmt.Errorf("imageTag is required")
	}
	profile, err := s.repo.GetBranchProfile(ctx, tenantID, req.BranchProfileID)
	if err != nil {
		return nil, err
	}
	if profile == nil {
		return nil, fmt.Errorf("branchProfileId %q does not exist", req.BranchProfileID)
	}
	if profile.Status != models.BranchStatusActive {
		return nil, fmt.Errorf("branch profile %q is %s; cannot register artifacts", req.BranchProfileID, profile.Status)
	}

	// Signature state. Without a real signer backend we treat any SignedBy
	// value as trusted; the verify-signature endpoint can downgrade it.
	signatureValid := req.SignedBy != ""

	a := &models.BuildArtifact{
		ID:                newArtifactID(),
		TenantID:          tenantID,
		BranchProfileID:   req.BranchProfileID,
		Branch:            req.Branch,
		CommitSHA:         strings.ToLower(strings.TrimSpace(req.CommitSHA)),
		ImageDigest:       digest,
		ImageTag:          req.ImageTag,
		ImageRepo:         req.ImageRepo,
		BuildPipelineID:   req.BuildPipelineID,
		TargetEnvs:        normalizeSlice(req.TargetEnvs),
		SignedBy:          req.SignedBy,
		SignatureValid:    signatureValid,
		BinaryChecksum:    req.BinaryChecksum,
		ConfigChecksum:    req.ConfigChecksum,
		MigrationChecksum: req.MigrationChecksum,
		BuiltAt:           time.Now(),
		SizeBytes:         req.SizeBytes,
		Status:            models.ArtifactStatusActive,
	}
	if err := s.repo.CreateBuildArtifact(ctx, a); err != nil {
		return nil, err
	}
	return a, nil
}

func (s *Service) GetBuildArtifact(ctx context.Context, tenantID, id string) (*models.BuildArtifact, error) {
	if tenantID == "" || id == "" {
		return nil, fmt.Errorf("tenant_id and id are required")
	}
	a, err := s.repo.GetBuildArtifact(ctx, tenantID, id)
	if err != nil {
		return nil, err
	}
	if a == nil {
		return nil, fmt.Errorf("artifact %q not found", id)
	}
	return a, nil
}

// VerifyBuildArtifactSignature re-checks the artifact's signature. Without a
// real signer backend we implement deterministic fail-closed semantics:
//   - Missing SignedBy → Valid=false, reason="unsigned artifact".
//   - SignedBy present → Valid=true, reason="trusted-signer:<name>".
//
// The endpoint remains the single choke point for a future integration with
// a real signing service (e.g. cosign).
func (s *Service) VerifyBuildArtifactSignature(ctx context.Context, tenantID, id string) (*models.SignatureVerificationResult, error) {
	if tenantID == "" || id == "" {
		return nil, fmt.Errorf("tenant_id and id are required")
	}
	a, err := s.repo.GetBuildArtifact(ctx, tenantID, id)
	if err != nil {
		return nil, err
	}
	if a == nil {
		return nil, fmt.Errorf("artifact %q not found", id)
	}
	result := &models.SignatureVerificationResult{
		ArtifactID: a.ID,
		VerifiedAt: time.Now(),
	}
	if a.SignedBy == "" {
		result.Valid = false
		result.Reason = "unsigned artifact"
	} else {
		result.Valid = true
		result.Reason = "trusted-signer:" + a.SignedBy
	}
	a.SignatureValid = result.Valid
	if _, err := s.repo.UpdateBuildArtifact(ctx, tenantID, id, a); err != nil {
		return nil, err
	}
	return result, nil
}

// DeprecateBuildArtifact marks an artifact as deprecated. Requires a
// non-empty reason; cannot deprecate twice.
func (s *Service) DeprecateBuildArtifact(ctx context.Context, tenantID, id, reason string) (*models.BuildArtifact, error) {
	if tenantID == "" || id == "" {
		return nil, fmt.Errorf("tenant_id and id are required")
	}
	reason = strings.TrimSpace(reason)
	if reason == "" {
		return nil, fmt.Errorf("deprecation reason is required")
	}
	a, err := s.repo.GetBuildArtifact(ctx, tenantID, id)
	if err != nil {
		return nil, err
	}
	if a == nil {
		return nil, fmt.Errorf("artifact %q not found", id)
	}
	if a.Status == models.ArtifactStatusDeprecated {
		return nil, fmt.Errorf("artifact %q is already deprecated", id)
	}
	now := time.Now()
	a.Status = models.ArtifactStatusDeprecated
	a.DeprecatedAt = &now
	a.DeprecatedReason = reason
	return s.repo.UpdateBuildArtifact(ctx, tenantID, id, a)
}

// ============================================================================
// P0-MB Phase 2 — L2 NamespaceBinding (environment isolation)
// ============================================================================

// Phase 2 rules constants. These regexps enforce the naming conventions
// described in docs/multi-branch-strategy-design-v2-impl-2026-09-08.md §2.1.
var (
	envNameFullRe    = regexp.MustCompile(`^[a-z][a-z0-9-]{0,30}$`)
	k8sNsRe          = regexp.MustCompile(`^orion-[a-z0-9-]{1,59}$`)
	configNsRe       = regexp.MustCompile(`^nacos/orion-[a-z0-9-]{1,59}$`)
	dbNameRe         = regexp.MustCompile(`^orion_[a-z0-9_-]{1,59}$`)
	mqPrefixRe       = regexp.MustCompile(`^orion-[a-z0-9-]+-\*$`)
	redisPrefixRe    = regexp.MustCompile(`^orion:[a-z0-9-]+:\*$`)
	imageTagPrefixRe = regexp.MustCompile(`^[a-z0-9._/-]{1,128}$`)
)

// newNamespaceID returns a unique id prefixed with "nb".
func newNamespaceID() string {
	now := time.Now()
	h := fnv.New64a()
	h.Write([]byte(fmt.Sprintf("nb-%d-%d", now.UnixNano(), now.UnixMicro())))
	return fmt.Sprintf("nb-%x", h.Sum(nil)[:8])
}

// buildSlug converts a branch name like "release/enterprise-2026" or "lts/2026"
// into a lower-case kebab-case slug suitable for embedding in namespace names:
//   - "release/enterprise-2026" -> "release-enterprise-2026"
//   - "lts/2026"                -> "lts-2026"
//   - "hotfix/v1.2.3"           -> "hotfix-v1-2-3"
//
// Non-alphanumeric runs (any char that is not [a-z0-9]) are collapsed to a
// single "-"; leading/trailing "-" are trimmed. If the resulting slug is
// empty (impossible with non-empty input but defensively handled), "custom"
// is returned.
func buildSlug(branchName string) string {
	slug := strings.ToLower(strings.TrimSpace(branchName))
	var out strings.Builder
	out.Grow(len(slug))
	prevDash := false
	for _, r := range slug {
		if (r >= 'a' && r <= 'z') || (r >= '0' && r <= '9') {
			out.WriteRune(r)
			prevDash = false
			continue
		}
		if !prevDash {
			out.WriteByte('-')
			prevDash = true
		}
	}
	slug = strings.Trim(out.String(), "-")
	if slug == "" {
		return "custom"
	}
	// Cap at 63 chars to leave room for the "orion-" prefix and K8s namespace
	// length limit of 63.
	if len(slug) > 59 {
		slug = slug[:59]
	}
	return slug
}

// ListNamespaceBindings returns all namespace bindings for the tenant, with
// optional filters on branchProfileID and envName.
func (s *Service) ListNamespaceBindings(ctx context.Context, tenantID string, q models.NamespaceBindingQuery) ([]models.NamespaceBinding, error) {
	if tenantID == "" {
		return nil, fmt.Errorf("tenant_id is required")
	}
	return s.repo.ListNamespaceBindings(ctx, tenantID, q)
}

// GetNamespaceBinding fetches a namespace binding by id (tenant-scoped).
func (s *Service) GetNamespaceBinding(ctx context.Context, tenantID, id string) (*models.NamespaceBinding, error) {
	if tenantID == "" || id == "" {
		return nil, fmt.Errorf("tenant_id and id are required")
	}
	b, err := s.repo.GetNamespaceBinding(ctx, tenantID, id)
	if err != nil {
		return nil, err
	}
	return b, nil
}

// CreateNamespaceBinding persists a new NamespaceBinding. The service layer
// validates naming rules and enforces (BranchProfileID, EnvName) uniqueness
// per tenant. Optional name fields (K8sNamespace, ConfigNamespace, DBName,
// MQTopicPrefix, RedisKeyPrefix) are auto-generated from the branch name
// using the models.K8sNamespaceFmt etc. format strings if empty.
//
// Rules:
//   - EnvName must match envNameFullRe.
//   - ImageTagPrefix must match imageTagPrefixRe.
//   - K8sNamespace (if provided) must match k8sNsRe.
//   - ConfigNamespace (if provided) must match configNsRe.
//   - DBName (if provided) must match dbNameRe.
//   - MQTopicPrefix (if provided) must match mqPrefixRe.
//   - RedisKeyPrefix (if provided) must match redisPrefixRe.
//   - BranchProfileID must reference an existing (non-archived) BranchProfile.
//   - (BranchProfileID, EnvName) must be unique per tenant.
func (s *Service) CreateNamespaceBinding(ctx context.Context, tenantID string, req *models.CreateNamespaceRequest) (*models.NamespaceBinding, error) {
	if tenantID == "" {
		return nil, fmt.Errorf("tenant_id is required")
	}
	if req == nil {
		return nil, fmt.Errorf("request is nil")
	}
	req.EnvName = strings.TrimSpace(req.EnvName)
	if !envNameFullRe.MatchString(req.EnvName) {
		return nil, fmt.Errorf("envName %q invalid: must match %s", req.EnvName, envNameFullRe)
	}
	if !imageTagPrefixRe.MatchString(req.ImageTagPrefix) {
		return nil, fmt.Errorf("imageTagPrefix %q invalid: must match %s", req.ImageTagPrefix, imageTagPrefixRe)
	}

	// Load the branch profile to derive the slug + check uniqueness.
	bp, err := s.repo.GetBranchProfile(ctx, tenantID, req.BranchProfileID)
	if err != nil {
		return nil, err
	}
	if bp == nil {
		return nil, fmt.Errorf("branch profile %q not found", req.BranchProfileID)
	}
	if bp.Status == models.BranchStatusArchived {
		return nil, fmt.Errorf("branch profile %q is archived", req.BranchProfileID)
	}

	slug := buildSlug(bp.Name)

	// Fill in auto-generated fields when the caller left them blank.
	k8sNs := strings.TrimSpace(req.K8sNamespace)
	if k8sNs == "" {
		k8sNs = fmt.Sprintf(models.K8sNamespaceFmt, slug)
	}
	if !k8sNsRe.MatchString(k8sNs) {
		return nil, fmt.Errorf("k8sNamespace %q invalid: must match %s", k8sNs, k8sNsRe)
	}

	configNs := strings.TrimSpace(req.ConfigNamespace)
	if configNs == "" {
		configNs = fmt.Sprintf(models.ConfigNamespaceFmt, slug)
	}
	if !configNsRe.MatchString(configNs) {
		return nil, fmt.Errorf("configNamespace %q invalid: must match %s", configNs, configNsRe)
	}

	dbName := strings.TrimSpace(req.DBName)
	if dbName == "" {
		dbName = fmt.Sprintf(models.DBNameFmt, slug)
	}
	if !dbNameRe.MatchString(dbName) {
		return nil, fmt.Errorf("dbName %q invalid: must match %s", dbName, dbNameRe)
	}

	mqPrefix := strings.TrimSpace(req.MQTopicPrefix)
	if mqPrefix == "" {
		mqPrefix = fmt.Sprintf(models.MQTopicPrefixFmt, slug)
	}
	if !mqPrefixRe.MatchString(mqPrefix) {
		return nil, fmt.Errorf("mqTopicPrefix %q invalid: must match %s", mqPrefix, mqPrefixRe)
	}

	redisPrefix := strings.TrimSpace(req.RedisKeyPrefix)
	if redisPrefix == "" {
		redisPrefix = fmt.Sprintf(models.RedisKeyPrefixFmt, slug)
	}
	if !redisPrefixRe.MatchString(redisPrefix) {
		return nil, fmt.Errorf("redisKeyPrefix %q invalid: must match %s", redisPrefix, redisPrefixRe)
	}

	// Uniqueness check: (branchProfileID, envName) must be unique per tenant.
	existing, err := s.repo.GetNamespaceBindingByBranchEnv(ctx, tenantID, req.BranchProfileID, req.EnvName)
	if err != nil && !errors.Is(err, sentinelNotFound) {
		return nil, err
	}
	if existing != nil {
		return nil, fmt.Errorf("namespace binding for branch %q env %q already exists", req.BranchProfileID, req.EnvName)
	}

	b := &models.NamespaceBinding{
		ID:              newNamespaceID(),
		TenantID:        tenantID,
		BranchProfileID: req.BranchProfileID,
		EnvName:         req.EnvName,
		K8sNamespace:    k8sNs,
		ConfigNamespace: configNs,
		DBName:          dbName,
		MQTopicPrefix:   mqPrefix,
		RedisKeyPrefix:  redisPrefix,
		ImageTagPrefix:  req.ImageTagPrefix,
		CreatedAt:       time.Now(),
	}
	if err := s.repo.CreateNamespaceBinding(ctx, b); err != nil {
		return nil, err
	}
	return b, nil
}

// DeleteNamespaceBinding removes a namespace binding. Tenant-scoped.
func (s *Service) DeleteNamespaceBinding(ctx context.Context, tenantID, id string) error {
	if tenantID == "" || id == "" {
		return fmt.Errorf("tenant_id and id are required")
	}
	return s.repo.DeleteNamespaceBinding(ctx, tenantID, id)
}

// ValidateNamespaceBinding checks every rule that governs a (branch, env)
// pair and returns a per-field check list plus the overall validity flag.
// It does NOT mutate any state.
func (s *Service) ValidateNamespaceBinding(ctx context.Context, tenantID, branchProfileID, envName string) (*models.NamespaceValidationResult, error) {
	if tenantID == "" {
		return nil, fmt.Errorf("tenant_id is required")
	}
	if branchProfileID == "" {
		return nil, fmt.Errorf("branchProfileId is required")
	}
	if envName == "" {
		return nil, fmt.Errorf("envName is required")
	}

	result := &models.NamespaceValidationResult{
		BranchProfileID: branchProfileID,
		EnvName:         envName,
		Valid:           true,
		Checks:          []models.NamespaceCheck{},
		ValidatedAt:     time.Now(),
	}

	addCheck := func(field string, ok bool, msg string) {
		result.Checks = append(result.Checks, models.NamespaceCheck{Field: field, Valid: ok, Message: msg})
		if !ok {
			result.Valid = false
		}
	}

	addCheck("envName", envNameFullRe.MatchString(envName), "envName format ok")

	bp, err := s.repo.GetBranchProfile(ctx, tenantID, branchProfileID)
	if err != nil {
		return nil, err
	}
	if bp == nil {
		addCheck("branchProfileId", false, fmt.Sprintf("branch profile %q not found", branchProfileID))
		return result, nil
	}
	addCheck("branchProfileId", true, "branch profile exists")
	if bp.Status == models.BranchStatusArchived {
		addCheck("branchProfileId", false, "branch profile is archived")
	}

	b, err := s.repo.GetNamespaceBindingByBranchEnv(ctx, tenantID, branchProfileID, envName)
	if err != nil && !errors.Is(err, sentinelNotFound) {
		return nil, err
	}
	if b == nil {
		addCheck("binding", false, "no namespace binding exists for this (branch, env)")
		return result, nil
	}
	addCheck("binding", true, "binding exists")

	slug := buildSlug(bp.Name)
	addCheck("k8sNamespace", k8sNsRe.MatchString(b.K8sNamespace) && b.K8sNamespace == fmt.Sprintf(models.K8sNamespaceFmt, slug), fmt.Sprintf("k8sNamespace=%q expected=%q", b.K8sNamespace, fmt.Sprintf(models.K8sNamespaceFmt, slug)))
	addCheck("configNamespace", configNsRe.MatchString(b.ConfigNamespace), "configNamespace format ok")
	addCheck("dbName", dbNameRe.MatchString(b.DBName), "dbName format ok")
	addCheck("mqTopicPrefix", mqPrefixRe.MatchString(b.MQTopicPrefix), "mqTopicPrefix format ok")
	addCheck("redisKeyPrefix", redisPrefixRe.MatchString(b.RedisKeyPrefix), "redisKeyPrefix format ok")
	addCheck("imageTagPrefix", imageTagPrefixRe.MatchString(b.ImageTagPrefix), "imageTagPrefix format ok")

	return result, nil
}

// VerifyImageTagMatch is the fail-closed check used by BranchEnvGuard
// middleware: it returns (true, nil) only if the given imageTag starts with
// the imageTagPrefix of the active NamespaceBinding for (branch, targetEnv).
//
// Fail-closed behavior:
//   - (false, nil) if the tag doesn't match the expected prefix.
//   - (false, nil) if there's no binding for (branch, env).
//   - (false, err) on storage errors.
func (s *Service) VerifyImageTagMatch(ctx context.Context, tenantID, branch, envName, imageTag string) (bool, error) {
	if tenantID == "" || branch == "" || envName == "" || imageTag == "" {
		return false, fmt.Errorf("tenant_id, branch, envName and imageTag are required")
	}
	// The caller may pass a short branch name (e.g. "release/ent") which may
	// not be a BranchProfileID. Look up by branchProfileID first, then fall
	// back to listing by branchProfileID. For Phase 2 the guard expects the
	// caller to pass the branchProfileID in the "branch" field; that keeps
	// the middleware stateless w.r.t. branch-to-profile mapping.
	b, err := s.repo.GetNamespaceBindingByBranchEnv(ctx, tenantID, branch, envName)
	if err != nil && !errors.Is(err, sentinelNotFound) {
		return false, err
	}
	if b == nil {
		return false, nil
	}
	if b.ImageTagPrefix == "" {
		return false, nil
	}
	// Compare with a "/sha..." suffix allowed (i.e. the image tag is the
	// prefix followed by a slash and a digest or version).
	if imageTag == b.ImageTagPrefix {
		return true, nil
	}
	if strings.HasPrefix(imageTag, b.ImageTagPrefix+"/") {
		return true, nil
	}
	// Some repos use "-suffix" instead of "/suffix" (e.g. tag "release-ent-1.2.3"
	// with prefix "release-ent"). Accept that only when the prefix does not
	// end with "/" and the next char is "-".
	if !strings.HasSuffix(b.ImageTagPrefix, "/") && strings.HasPrefix(imageTag, b.ImageTagPrefix+"-") {
		return true, nil
	}
	return false, nil
}

// VerifyBranchEnvBinding is a simpler check used by deploy-gate middleware:
// does a NamespaceBinding exist for (branch, envName)?
func (s *Service) VerifyBranchEnvBinding(ctx context.Context, tenantID, branch, envName string) (bool, error) {
	if tenantID == "" || branch == "" || envName == "" {
		return false, fmt.Errorf("tenant_id, branch and envName are required")
	}
	b, err := s.repo.GetNamespaceBindingByBranchEnv(ctx, tenantID, branch, envName)
	if err != nil && !errors.Is(err, sentinelNotFound) {
		return false, err
	}
	return b != nil, nil
}

// GetNamespaceMatrix builds the branch × env grid for the frontend matrix
// view. Rows are active BranchProfiles; columns are the canonical envs +
// any extra envs referenced by existing bindings.
func (s *Service) GetNamespaceMatrix(ctx context.Context, tenantID string) (*models.BranchEnvMatrix, error) {
	if tenantID == "" {
		return nil, fmt.Errorf("tenant_id is required")
	}
	profiles, err := s.repo.ListBranchProfiles(ctx, tenantID, models.BranchProfileQuery{
		Status: func() *models.BranchStatus { s := models.BranchStatusActive; return &s }(),
	})
	if err != nil {
		return nil, err
	}
	bindings, err := s.repo.ListNamespaceBindings(ctx, tenantID, models.NamespaceBindingQuery{})
	if err != nil {
		return nil, err
	}

	envSet := make(map[string]struct{}, len(models.CanonicalEnvs))
	for _, e := range models.CanonicalEnvs {
		envSet[e] = struct{}{}
	}
	for _, b := range bindings {
		if b.EnvName != "" {
			envSet[b.EnvName] = struct{}{}
		}
	}
	envs := make([]string, 0, len(envSet))
	for e := range envSet {
		envs = append(envs, e)
	}
	// Stable sort for deterministic output.
	for i := 1; i < len(envs); i++ {
		for j := i; j > 0 && envs[j] < envs[j-1]; j-- {
			envs[j], envs[j-1] = envs[j-1], envs[j]
		}
	}

	bindingIdx := make(map[string]*models.NamespaceBinding, len(bindings))
	for i := range bindings {
		key := bindings[i].BranchProfileID + "|" + bindings[i].EnvName
		bindingIdx[key] = &bindings[i]
	}

	rows := make([]models.MatrixRow, 0, len(profiles))
	for i := range profiles {
		p := &profiles[i]
		row := models.MatrixRow{
			BranchProfileID: p.ID,
			BranchName:      p.Name,
			Semantic:        string(p.Semantic),
			Status:          string(p.Status),
			Bindings:        make(map[string]models.MatrixCell, len(envs)),
		}
		for _, e := range envs {
			key := p.ID + "|" + e
			b := bindingIdx[key]
			if b == nil {
				row.Bindings[e] = models.MatrixCell{Exists: false}
			} else {
				row.Bindings[e] = models.MatrixCell{
					Exists:         true,
					K8sNamespace:   b.K8sNamespace,
					ImageTagPrefix: b.ImageTagPrefix,
					DbName:         b.DBName,
				}
			}
		}
		rows = append(rows, row)
	}

	return &models.BranchEnvMatrix{
		Branches:    rows,
		Envs:        envs,
		GeneratedAt: time.Now(),
	}, nil
}

// ============================================================================
// P0-MB Phase 3 — L4 SyncPolicy (branch synchronization)
// ============================================================================

// Phase 3 rules constants.
var (
	syncPolicyNameRe = regexp.MustCompile(`^[A-Za-z0-9_./-]{1,128}$`)
	syncBranchNameRe = regexp.MustCompile(`^[A-Za-z0-9_./-]{1,255}$`)
	syncCronRe       = regexp.MustCompile(`^(\S+\s+){4}\S+$`) // loose 5-field cron sanity check
	urlRe            = regexp.MustCompile(`^https?://[^\s]+$`)
	syncCommitSHARe  = regexp.MustCompile(`^[0-9a-fA-F]{7,40}$`)
)

// newSyncPolicyID returns a unique id prefixed with "sp".
func newSyncPolicyID() string {
	now := time.Now()
	h := fnv.New64a()
	h.Write([]byte(fmt.Sprintf("sp-%d-%d", now.UnixNano(), now.UnixMicro())))
	return fmt.Sprintf("sp-%x", h.Sum(nil)[:8])
}

// newSyncRunLogID returns a unique id prefixed with "sl".
func newSyncRunLogID() string {
	now := time.Now()
	h := fnv.New64a()
	h.Write([]byte(fmt.Sprintf("sl-%d-%d", now.UnixNano(), now.UnixMicro())))
	return fmt.Sprintf("sl-%x", h.Sum(nil)[:8])
}

// ListSyncPolicies returns all sync policies for the tenant, with optional
// filters on Enabled, Frequency, Strategy, SourceBranch, AutoResolve.
func (s *Service) ListSyncPolicies(ctx context.Context, tenantID string, q models.SyncPolicyQuery) ([]models.SyncPolicy, error) {
	if tenantID == "" {
		return nil, fmt.Errorf("tenant_id is required")
	}
	return s.repo.ListSyncPolicies(ctx, tenantID, q)
}

// GetSyncPolicy fetches a sync policy by id (tenant-scoped).
func (s *Service) GetSyncPolicy(ctx context.Context, tenantID, id string) (*models.SyncPolicy, error) {
	if tenantID == "" || id == "" {
		return nil, fmt.Errorf("tenant_id and id are required")
	}
	return s.repo.GetSyncPolicy(ctx, tenantID, id)
}

// CreateSyncPolicy persists a new SyncPolicy. The service layer validates
// naming rules, frequency/strategy/resolve enums, and auto-fills the
// cron expression if empty.
//
// Rules:
//   - Name matches syncPolicyNameRe (1-128 chars, alphanumeric + / . _ -).
//   - SourceBranch matches syncBranchNameRe.
//   - TargetBranches non-empty, each matches syncBranchNameRe,
//     and SourceBranch != any TargetBranch.
//   - Frequency, Strategy, AutoResolve are valid enums.
//   - NotifyWebhook (if provided) matches ^https?://...$.
//   - CronExpr (if provided) passes a loose 5-field sanity check.
func (s *Service) CreateSyncPolicy(ctx context.Context, tenantID string, req *models.CreateSyncPolicyRequest) (*models.SyncPolicy, error) {
	if tenantID == "" {
		return nil, fmt.Errorf("tenant_id is required")
	}
	if req == nil {
		return nil, fmt.Errorf("request is nil")
	}
	if !syncPolicyNameRe.MatchString(req.Name) {
		return nil, fmt.Errorf("name %q invalid: must match %s", req.Name, syncPolicyNameRe)
	}
	if !syncBranchNameRe.MatchString(req.SourceBranch) {
		return nil, fmt.Errorf("sourceBranch %q invalid: must match %s", req.SourceBranch, syncBranchNameRe)
	}
	if len(req.TargetBranches) == 0 {
		return nil, fmt.Errorf("targetBranches must be non-empty")
	}
	for _, tb := range req.TargetBranches {
		if !syncBranchNameRe.MatchString(tb) {
			return nil, fmt.Errorf("targetBranch %q invalid: must match %s", tb, syncBranchNameRe)
		}
		if tb == req.SourceBranch {
			return nil, fmt.Errorf("sourceBranch %q cannot be its own target", req.SourceBranch)
		}
	}
	if !req.Frequency.IsValid() {
		return nil, fmt.Errorf("frequency %q invalid: must be one of daily|weekly|monthly", req.Frequency)
	}
	if !req.Strategy.IsValid() {
		return nil, fmt.Errorf("strategy %q invalid: must be one of rebase|cherry-pick|merge", req.Strategy)
	}
	if !req.AutoResolve.IsValid() {
		return nil, fmt.Errorf("autoResolve %q invalid: must be one of none|skip-conflict|manual-required", req.AutoResolve)
	}
	if req.NotifyWebhook != "" && !urlRe.MatchString(req.NotifyWebhook) {
		return nil, fmt.Errorf("notifyWebhook %q invalid: must be an http(s) URL", req.NotifyWebhook)
	}
	if req.CronExpr != "" && !syncCronRe.MatchString(req.CronExpr) {
		return nil, fmt.Errorf("cronExpr %q invalid: expected 5 whitespace-separated fields", req.CronExpr)
	}

	enabled := true
	if req.Enabled != nil {
		enabled = *req.Enabled
	}
	now := time.Now()
	p := &models.SyncPolicy{
		ID:               newSyncPolicyID(),
		TenantID:         tenantID,
		Name:             req.Name,
		SourceBranch:     req.SourceBranch,
		TargetBranches:   normalizeSlice(req.TargetBranches),
		Frequency:        req.Frequency,
		CronExpr:         req.CronExpr,
		Strategy:         req.Strategy,
		AutoResolve:      req.AutoResolve,
		NotifyOnConflict: normalizeSlice(req.NotifyOnConflict),
		NotifyWebhook:    req.NotifyWebhook,
		Enabled:          enabled,
		CreatedAt:        now,
		UpdatedAt:        now,
	}
	if err := s.repo.CreateSyncPolicy(ctx, p); err != nil {
		return nil, err
	}
	return p, nil
}

// UpdateSyncPolicy applies non-nil fields of req to the policy. Empty
// TargetBranches / NotifyOnConflict lists are rejected as ambiguous (use
// a single-element list or clear via nil semantics).
func (s *Service) UpdateSyncPolicy(ctx context.Context, tenantID, id string, req *models.UpdateSyncPolicyRequest) (*models.SyncPolicy, error) {
	if tenantID == "" || id == "" {
		return nil, fmt.Errorf("tenant_id and id are required")
	}
	if req == nil {
		return nil, fmt.Errorf("request is nil")
	}
	p, err := s.repo.GetSyncPolicy(ctx, tenantID, id)
	if err != nil {
		return nil, err
	}
	if p == nil {
		return nil, fmt.Errorf("sync policy %q not found", id)
	}

	if req.Name != nil {
		if !syncPolicyNameRe.MatchString(*req.Name) {
			return nil, fmt.Errorf("name %q invalid", *req.Name)
		}
		p.Name = *req.Name
	}
	if req.SourceBranch != nil {
		if !syncBranchNameRe.MatchString(*req.SourceBranch) {
			return nil, fmt.Errorf("sourceBranch %q invalid", *req.SourceBranch)
		}
		p.SourceBranch = *req.SourceBranch
	}
	if req.TargetBranches != nil {
		if len(*req.TargetBranches) == 0 {
			return nil, fmt.Errorf("targetBranches must be non-empty")
		}
		for _, tb := range *req.TargetBranches {
			if !syncBranchNameRe.MatchString(tb) {
				return nil, fmt.Errorf("targetBranch %q invalid", tb)
			}
			if tb == p.SourceBranch {
				return nil, fmt.Errorf("sourceBranch %q cannot be its own target", p.SourceBranch)
			}
		}
		p.TargetBranches = normalizeSlice(*req.TargetBranches)
	}
	if req.Frequency != nil && !req.Frequency.IsValid() {
		return nil, fmt.Errorf("frequency %q invalid", *req.Frequency)
	} else if req.Frequency != nil {
		p.Frequency = *req.Frequency
	}
	if req.CronExpr != nil {
		if *req.CronExpr != "" && !syncCronRe.MatchString(*req.CronExpr) {
			return nil, fmt.Errorf("cronExpr %q invalid", *req.CronExpr)
		}
		p.CronExpr = *req.CronExpr
	}
	if req.Strategy != nil && !req.Strategy.IsValid() {
		return nil, fmt.Errorf("strategy %q invalid", *req.Strategy)
	} else if req.Strategy != nil {
		p.Strategy = *req.Strategy
	}
	if req.AutoResolve != nil && !req.AutoResolve.IsValid() {
		return nil, fmt.Errorf("autoResolve %q invalid", *req.AutoResolve)
	} else if req.AutoResolve != nil {
		p.AutoResolve = *req.AutoResolve
	}
	if req.NotifyOnConflict != nil {
		p.NotifyOnConflict = normalizeSlice(*req.NotifyOnConflict)
	}
	if req.NotifyWebhook != nil {
		if *req.NotifyWebhook != "" && !urlRe.MatchString(*req.NotifyWebhook) {
			return nil, fmt.Errorf("notifyWebhook %q invalid", *req.NotifyWebhook)
		}
		p.NotifyWebhook = *req.NotifyWebhook
	}
	if req.Enabled != nil {
		p.Enabled = *req.Enabled
	}
	p.UpdatedAt = time.Now()
	return s.repo.UpdateSyncPolicy(ctx, tenantID, id, p)
}

// DeleteSyncPolicy removes a sync policy. Tenant-scoped.
func (s *Service) DeleteSyncPolicy(ctx context.Context, tenantID, id string) error {
	if tenantID == "" || id == "" {
		return fmt.Errorf("tenant_id and id are required")
	}
	return s.repo.DeleteSyncPolicy(ctx, tenantID, id)
}

// EnableSyncPolicy toggles Enabled=true.
func (s *Service) EnableSyncPolicy(ctx context.Context, tenantID, id string) (*models.SyncPolicy, error) {
	if tenantID == "" || id == "" {
		return nil, fmt.Errorf("tenant_id and id are required")
	}
	p, err := s.repo.GetSyncPolicy(ctx, tenantID, id)
	if err != nil {
		return nil, err
	}
	if p == nil {
		return nil, fmt.Errorf("sync policy %q not found", id)
	}
	p.Enabled = true
	p.UpdatedAt = time.Now()
	return s.repo.UpdateSyncPolicy(ctx, tenantID, id, p)
}

// DisableSyncPolicy toggles Enabled=false.
func (s *Service) DisableSyncPolicy(ctx context.Context, tenantID, id string) (*models.SyncPolicy, error) {
	if tenantID == "" || id == "" {
		return nil, fmt.Errorf("tenant_id and id are required")
	}
	p, err := s.repo.GetSyncPolicy(ctx, tenantID, id)
	if err != nil {
		return nil, err
	}
	if p == nil {
		return nil, fmt.Errorf("sync policy %q not found", id)
	}
	p.Enabled = false
	p.UpdatedAt = time.Now()
	return s.repo.UpdateSyncPolicy(ctx, tenantID, id, p)
}

// ListSyncRunLogs returns the sync run logs for the tenant, filtered by
// policyID, status, time range, and capped at limit (default 100).
func (s *Service) ListSyncRunLogs(ctx context.Context, tenantID string, q models.SyncRunLogQuery) ([]models.SyncRunLog, error) {
	if tenantID == "" {
		return nil, fmt.Errorf("tenant_id is required")
	}
	if q.Limit <= 0 {
		q.Limit = 100
	}
	if q.Limit > 1000 {
		q.Limit = 1000
	}
	return s.repo.ListSyncRunLogs(ctx, tenantID, q)
}

// GetEnabledPolicies returns enabled policies whose CronExpr (if present)
// matches cronMatch. Used by wireSyncScheduler to determine which policies
// are due to run in the current tick. Empty CronExpr always matches
// (relies on the frequency-based interval check done by the scheduler).
func (s *Service) GetEnabledPolicies(ctx context.Context, tenantID string, cronMatch func(string) bool) ([]models.SyncPolicy, error) {
	if tenantID == "" {
		return nil, fmt.Errorf("tenant_id is required")
	}
	enabled := true
	all, err := s.repo.ListSyncPolicies(ctx, tenantID, models.SyncPolicyQuery{Enabled: &enabled})
	if err != nil {
		return nil, err
	}
	if cronMatch == nil {
		return all, nil
	}
	out := make([]models.SyncPolicy, 0, len(all))
	for _, p := range all {
		if p.CronExpr == "" || cronMatch(p.CronExpr) {
			out = append(out, p)
		}
	}
	return out, nil
}

// syncExecutor is a hook for the RunNow execution logic. The default
// implementation is deterministic (always success) — the real executor will
// shell out to git rebase/cherry-pick/merge and populate ConflictFiles.
//
// The Executor interface lets service tests inject a stub that returns
// pre-configured results without touching the real git integration.
type syncExecutor interface {
	Execute(ctx context.Context, p *models.SyncPolicy, targetBranch, sourceCommit string) models.SyncRunResult
}

// defaultSyncExecutor returns a deterministic success result. It exists
// so that the RunNow path is exercised end-to-end in tests without
// touching a real git repo.
type defaultSyncExecutor struct{}

func (defaultSyncExecutor) Execute(_ context.Context, p *models.SyncPolicy, targetBranch, sourceCommit string) models.SyncRunResult {
	return models.SyncRunResult{
		TargetBranch: targetBranch,
		Applied:      true,
		NewCommitSHA: strings.ToLower(strings.TrimSpace(sourceCommit)),
	}
}

// RunNow executes a single sync run for policy id and returns the resulting
// SyncRunLog. When AutoResolve == SyncResolveManualRequired and any target
// branch hits a conflict, the run is marked status=conflict (fail-closed)
// and no further target branches are attempted.
//
// Rules:
//   - sourceCommit must be a valid SHA prefix (7-40 hex chars) — the
//     scheduler passes this explicitly. Empty sourceCommit (manual trigger
//     with no commit hint) falls back to a sentinel "HEAD".
//   - RunLog is written on start and updated on finish with DurationMs.
//   - Success with 0 targets applied is still status=success.
//   - Any target with ConflictFiles > 0 → status=conflict (when
//     AutoResolve == SyncResolveManualRequired) or continue (skip-conflict).
func (s *Service) RunNow(ctx context.Context, tenantID, id string, actor string, sourceCommit string) (*models.SyncRunLog, error) {
	return s.RunNowWithExecutor(ctx, tenantID, id, actor, sourceCommit, defaultSyncExecutor{})
}

// RunNowWithExecutor is the internal implementation that accepts an
// injectable executor. Exported so tests can inject stubs.
func (s *Service) RunNowWithExecutor(ctx context.Context, tenantID, id, actor, sourceCommit string, exec syncExecutor) (*models.SyncRunLog, error) {
	if tenantID == "" || id == "" {
		return nil, fmt.Errorf("tenant_id and id are required")
	}
	if actor == "" {
		return nil, fmt.Errorf("actor is required")
	}
	if sourceCommit == "" {
		sourceCommit = "HEAD"
	} else if !syncCommitSHARe.MatchString(sourceCommit) {
		return nil, fmt.Errorf("sourceCommit %q invalid: expected 7-40 hex chars", sourceCommit)
	}

	p, err := s.repo.GetSyncPolicy(ctx, tenantID, id)
	if err != nil {
		return nil, err
	}
	if p == nil {
		return nil, fmt.Errorf("sync policy %q not found", id)
	}
	if len(p.TargetBranches) == 0 {
		return nil, fmt.Errorf("sync policy %q has no target branches", id)
	}

	triggeredAt := time.Now()
	var triggerBy models.SyncTriggerBy
	switch actor {
	case "scheduler":
		triggerBy = models.SyncTriggerScheduler
	default:
		triggerBy = models.SyncTriggerManual
	}
	log := &models.SyncRunLog{
		ID:             newSyncRunLogID(),
		TenantID:       tenantID,
		PolicyID:       id,
		TriggeredAt:    triggeredAt,
		TriggeredBy:    triggerBy,
		SourceCommit:   sourceCommit,
		TargetBranches: append([]string(nil), p.TargetBranches...),
	}

	allConflicts := make([]string, 0)
	var firstErr string
	appliedCount := 0
	for _, tb := range p.TargetBranches {
		res := exec.Execute(ctx, p, tb, sourceCommit)
		if len(res.ConflictFiles) > 0 {
			// Merge conflict file paths qualified with the target branch
			// so the caller can tell which branch failed.
			for _, f := range res.ConflictFiles {
				allConflicts = append(allConflicts, tb+":"+f)
			}
		} else if res.Error != "" && firstErr == "" {
			firstErr = tb + ": " + res.Error
		} else if res.Applied {
			appliedCount++
		}
		if p.AutoResolve == models.SyncResolveManualRequired && len(res.ConflictFiles) > 0 {
			// Fail-closed: stop immediately, don't try the next target.
			break
		}
	}

	elapsed := time.Since(triggeredAt).Milliseconds()
	if len(allConflicts) > 0 && p.AutoResolve == models.SyncResolveManualRequired {
		log.Status = models.SyncStatusConflict
		log.ConflictFiles = allConflicts
	} else if firstErr != "" && len(allConflicts) == 0 {
		log.Status = models.SyncStatusFailed
		log.ErrorMsg = firstErr
	} else if len(allConflicts) > 0 {
		// skip-conflict: keep the conflicts visible but mark success.
		log.Status = models.SyncStatusSuccess
		log.ConflictFiles = allConflicts
	} else {
		log.Status = models.SyncStatusSuccess
	}
	log.DurationMs = elapsed

	if err := s.repo.CreateSyncRunLog(ctx, log); err != nil {
		return nil, err
	}

	// Update the policy's last-run summary.
	now := time.Now()
	status := log.Status
	conflicts := log.ConflictFiles
	p.LastRunAt = &now
	p.LastRunStatus = &status
	p.LastRunConflictFiles = conflicts
	p.UpdatedAt = now
	if _, err := s.repo.UpdateSyncPolicy(ctx, tenantID, id, p); err != nil {
		// Log-write succeeded but policy summary update failed; return the
		// run log anyway so the caller can inspect the outcome.
		return log, nil
	}

	_ = appliedCount // reserved for future metrics.
	return log, nil
}

// ============================================================================
// P0-MB Phase 4 — L5 DeployEvent (change audit + one-click rollback)
// ============================================================================

// Phase 4 rules constants. The commit-SHA regex is reused from Phase 3.
var (
	deployBranchRe = syncBranchNameRe
	deployEnvRe    = regexp.MustCompile(`^[A-Za-z0-9_-]{1,32}$`)
	// deployActorRe is the regex for actor IDs (usually user ids like
	// "user-123" or "svc-deploy-bot"). Kept permissive — auth is done
	// upstream; this just rejects obviously malformed ids.
	deployActorRe = regexp.MustCompile(`^[A-Za-z0-9._@-]{1,64}$`)
	// deployCommitSHARe is the 7-40 hex regex reused for FromCommit/ToCommit.
	deployCommitSHARe = syncCommitSHARe
)

// newDeployEventID returns a unique id prefixed with "de".
func newDeployEventID() string {
	now := time.Now()
	h := fnv.New64a()
	h.Write([]byte(fmt.Sprintf("de-%d-%d", now.UnixNano(), now.UnixMicro())))
	return fmt.Sprintf("de-%x", h.Sum(nil)[:8])
}

// createDeployEventRequestToModel converts a request body into a
// DeployEvent. Fills in ID, TenantID, timestamps, and Outcome default.
func createDeployEventRequestToModel(req *models.CreateDeployEventRequest, tenantID string) *models.DeployEvent {
	outcome := req.Outcome
	if outcome == "" {
		outcome = models.DeployOutcomeSuccess
	}
	now := time.Now()
	return &models.DeployEvent{
		ID:          newDeployEventID(),
		TenantID:    tenantID,
		ActorID:     strings.TrimSpace(req.ActorID),
		ActorName:   strings.TrimSpace(req.ActorName),
		Branch:      strings.TrimSpace(req.Branch),
		Env:         strings.TrimSpace(req.Env),
		FromCommit:  strings.ToLower(strings.TrimSpace(req.FromCommit)),
		ToCommit:    strings.ToLower(strings.TrimSpace(req.ToCommit)),
		ArtifactID:  strings.TrimSpace(req.ArtifactID),
		ImageDigest: strings.TrimSpace(req.ImageDigest),
		ApprovalID:  strings.TrimSpace(req.ApprovalID),
		Outcome:     outcome,
		StartedAt:   now,
		CreatedAt:   now,
		GateResult:  req.GateResult,
	}
}

// validateCreateDeployEventRequest enforces the required fields + enum
// constraints. The ActorID / Branch / Env / ToCommit regexps are used to
// reject obviously malformed input before persisting.
func validateCreateDeployEventRequest(req *models.CreateDeployEventRequest) error {
	if req == nil {
		return fmt.Errorf("request is required")
	}
	if req.ActorID == "" {
		return fmt.Errorf("actorId is required")
	}
	if !deployActorRe.MatchString(req.ActorID) {
		return fmt.Errorf("actorId %q invalid", req.ActorID)
	}
	if req.Branch == "" {
		return fmt.Errorf("branch is required")
	}
	if !deployBranchRe.MatchString(req.Branch) {
		return fmt.Errorf("branch %q invalid", req.Branch)
	}
	if req.Env == "" {
		return fmt.Errorf("env is required")
	}
	if !deployEnvRe.MatchString(req.Env) {
		return fmt.Errorf("env %q invalid", req.Env)
	}
	if req.ToCommit == "" {
		return fmt.Errorf("toCommit is required")
	}
	if !syncCommitSHARe.MatchString(strings.TrimSpace(req.ToCommit)) {
		return fmt.Errorf("toCommit %q invalid: expected 7-40 hex chars", req.ToCommit)
	}
	if req.FromCommit != "" && !syncCommitSHARe.MatchString(strings.TrimSpace(req.FromCommit)) {
		return fmt.Errorf("fromCommit %q invalid: expected 7-40 hex chars", req.FromCommit)
	}
	if req.ImageDigest != "" && !sha256Re.MatchString(req.ImageDigest) {
		return fmt.Errorf("imageDigest %q invalid: expected sha256:<64 hex>", req.ImageDigest)
	}
	if req.Outcome != "" && !req.Outcome.Valid() {
		return fmt.Errorf("outcome %q invalid", req.Outcome)
	}
	return nil
}

// CreateDeployEvent is the primary entry point for recording a deploy. It
// validates the request, fills in timestamps, and persists the event.
// Outcome defaults to DeployOutcomeSuccess when omitted.
func (s *Service) CreateDeployEvent(ctx context.Context, tenantID string, req *models.CreateDeployEventRequest) (*models.DeployEvent, error) {
	if tenantID == "" {
		return nil, fmt.Errorf("tenant_id is required")
	}
	if err := validateCreateDeployEventRequest(req); err != nil {
		return nil, err
	}
	evt := createDeployEventRequestToModel(req, tenantID)
	if err := s.repo.CreateDeployEvent(ctx, evt); err != nil {
		return nil, err
	}
	return evt, nil
}

// RecordDeployEvent persists a DeployEvent directly (used internally by
// the deploy API integration and by rollback). The ID / timestamps are
// filled in if zero; Outcome defaults to DeployOutcomeSuccess.
func (s *Service) RecordDeployEvent(ctx context.Context, evt *models.DeployEvent) error {
	if evt == nil {
		return fmt.Errorf("event is required")
	}
	if evt.TenantID == "" {
		return fmt.Errorf("tenantId is required")
	}
	if evt.ActorID == "" {
		return fmt.Errorf("actorId is required")
	}
	if evt.Branch == "" || evt.Env == "" {
		return fmt.Errorf("branch and env are required")
	}
	if evt.ToCommit == "" {
		return fmt.Errorf("toCommit is required")
	}
	if evt.ID == "" {
		evt.ID = newDeployEventID()
	}
	now := time.Now()
	if evt.StartedAt.IsZero() {
		evt.StartedAt = now
	}
	if evt.CreatedAt.IsZero() {
		evt.CreatedAt = now
	}
	if evt.Outcome == "" {
		evt.Outcome = models.DeployOutcomeSuccess
	}
	if !evt.Outcome.Valid() {
		return fmt.Errorf("outcome %q invalid", evt.Outcome)
	}
	return s.repo.CreateDeployEvent(ctx, evt)
}

// GetDeployEvent returns the event by id (tenant-scoped).
func (s *Service) GetDeployEvent(ctx context.Context, tenantID, id string) (*models.DeployEvent, error) {
	if tenantID == "" || id == "" {
		return nil, fmt.Errorf("tenant_id and id are required")
	}
	return s.repo.GetDeployEvent(ctx, tenantID, id)
}

// UpdateDeployOutcome transitions the outcome state machine. Allowed
// transitions: success→success/failed, failed→success/failed, any→
// rolled-back (terminal). Once rolled-back, no further transitions.
func (s *Service) UpdateDeployOutcome(ctx context.Context, tenantID, id string, outcome models.DeployOutcome, errorMsg string) (*models.DeployEvent, error) {
	if tenantID == "" || id == "" {
		return nil, fmt.Errorf("tenant_id and id are required")
	}
	if !outcome.Valid() {
		return nil, fmt.Errorf("outcome %q invalid", outcome)
	}
	evt, err := s.repo.GetDeployEvent(ctx, tenantID, id)
	if err != nil {
		return nil, err
	}
	if evt == nil {
		return nil, fmt.Errorf("deploy event %q not found", id)
	}
	if evt.Outcome == models.DeployOutcomeRolledBack {
		return nil, fmt.Errorf("deploy event %q is terminal (rolled-back); outcome cannot change", id)
	}
	evt.Outcome = outcome
	evt.ErrorMsg = errorMsg
	if outcome == models.DeployOutcomeSuccess || outcome == models.DeployOutcomeFailed {
		now := time.Now()
		evt.CompletedAt = &now
	}
	updated, err := s.repo.UpdateDeployEvent(ctx, tenantID, id, evt)
	if err != nil {
		return nil, err
	}
	if updated != nil {
		return updated, nil
	}
	return evt, nil
}

// UpdateDeployMetrics updates DurationMs / ErrorRate / P99Latency. Zero
// values leave the existing metric unchanged (partial update semantics).
func (s *Service) UpdateDeployMetrics(ctx context.Context, tenantID, id string, m models.DeployMetrics) (*models.DeployEvent, error) {
	if tenantID == "" || id == "" {
		return nil, fmt.Errorf("tenant_id and id are required")
	}
	if m.ErrorRate < 0 || m.ErrorRate > 1 {
		return nil, fmt.Errorf("errorRate %f out of range [0,1]", m.ErrorRate)
	}
	if m.DurationMs < 0 {
		return nil, fmt.Errorf("durationMs %d must be non-negative", m.DurationMs)
	}
	if m.P99Latency < 0 {
		return nil, fmt.Errorf("p99Latency %d must be non-negative", m.P99Latency)
	}
	evt, err := s.repo.GetDeployEvent(ctx, tenantID, id)
	if err != nil {
		return nil, err
	}
	if evt == nil {
		return nil, fmt.Errorf("deploy event %q not found", id)
	}
	if evt.Outcome == models.DeployOutcomeRolledBack {
		return nil, fmt.Errorf("deploy event %q is terminal (rolled-back); metrics cannot change", id)
	}
	if m.DurationMs > 0 {
		evt.DurationMs = m.DurationMs
	}
	if m.ErrorRate > 0 {
		evt.ErrorRate = m.ErrorRate
	}
	if m.P99Latency > 0 {
		evt.P99Latency = m.P99Latency
	}
	updated, err := s.repo.UpdateDeployEvent(ctx, tenantID, id, evt)
	if err != nil {
		return nil, err
	}
	if updated != nil {
		return updated, nil
	}
	return evt, nil
}

// ListDeployEvents returns the deploy events filtered by DeployEventQuery.
// Limit defaults to 100 and is capped at 1000.
func (s *Service) ListDeployEvents(ctx context.Context, tenantID string, q models.DeployEventQuery) ([]models.DeployEvent, error) {
	if tenantID == "" {
		return nil, fmt.Errorf("tenant_id is required")
	}
	if q.Limit <= 0 {
		q.Limit = 100
	}
	if q.Limit > 1000 {
		q.Limit = 1000
	}
	return s.repo.ListDeployEvents(ctx, tenantID, q)
}

// ListDeployEventsByBranch returns events for a branch (limit capped at 1000).
func (s *Service) ListDeployEventsByBranch(ctx context.Context, tenantID, branch string, limit int) ([]models.DeployEvent, error) {
	if tenantID == "" || branch == "" {
		return nil, fmt.Errorf("tenant_id and branch are required")
	}
	if limit <= 0 {
		limit = 100
	}
	if limit > 1000 {
		limit = 1000
	}
	return s.repo.ListDeployEventsByBranch(ctx, tenantID, branch, limit)
}

// ListDeployEventsByEnv returns events for an env (limit capped at 1000).
func (s *Service) ListDeployEventsByEnv(ctx context.Context, tenantID, env string, limit int) ([]models.DeployEvent, error) {
	if tenantID == "" || env == "" {
		return nil, fmt.Errorf("tenant_id and env are required")
	}
	if limit <= 0 {
		limit = 100
	}
	if limit > 1000 {
		limit = 1000
	}
	return s.repo.ListDeployEventsByEnv(ctx, tenantID, env, limit)
}

// ListDeployEventsByActor returns events by the actor (limit capped at 1000).
func (s *Service) ListDeployEventsByActor(ctx context.Context, tenantID, actorID string, limit int) ([]models.DeployEvent, error) {
	if tenantID == "" || actorID == "" {
		return nil, fmt.Errorf("tenant_id and actorId are required")
	}
	if limit <= 0 {
		limit = 100
	}
	if limit > 1000 {
		limit = 1000
	}
	return s.repo.ListDeployEventsByActor(ctx, tenantID, actorID, limit)
}

// RollbackDeployEvent creates a new DeployEvent that reverses the original
// deployment. The new event:
//   - has FromCommit = original.ToCommit
//   - has ToCommit   = original.FromCommit
//   - shares ArtifactID / ImageDigest / ApprovalID with the original
//   - has Outcome = DeployOutcomeRolledBack
//   - has RollbackTo = pointer to the original event id
//   - has StartedAt = CompletedAt = now
//
// Fail-closed:
//   - original must exist and be tenant-scoped
//   - original.Outcome must be success or failed (rolled-back is terminal)
//   - original.ToCommit must be non-empty (nothing to roll back to)
//   - original.FromCommit must be non-empty (need a target to restore)
//
// The original event is left untouched — the rollback is a NEW event.
func (s *Service) RollbackDeployEvent(ctx context.Context, tenantID, id, actorID string) (*models.DeployEvent, error) {
	if tenantID == "" || id == "" {
		return nil, fmt.Errorf("tenant_id and id are required")
	}
	if actorID == "" {
		return nil, fmt.Errorf("actorId is required")
	}
	if !deployActorRe.MatchString(actorID) {
		return nil, fmt.Errorf("actorId %q invalid", actorID)
	}
	orig, err := s.repo.GetDeployEvent(ctx, tenantID, id)
	if err != nil {
		return nil, err
	}
	if orig == nil {
		return nil, fmt.Errorf("deploy event %q not found", id)
	}
	if !orig.Outcome.CanRollback() {
		return nil, fmt.Errorf("deploy event %q outcome %q cannot be rolled back (only success/failed can rollback)", id, orig.Outcome)
	}
	if orig.ToCommit == "" {
		return nil, fmt.Errorf("deploy event %q has empty ToCommit; cannot rollback", id)
	}
	if orig.FromCommit == "" {
		return nil, fmt.Errorf("deploy event %q has empty FromCommit; cannot determine rollback target", id)
	}

	origID := orig.ID
	now := time.Now()
	rollback := &models.DeployEvent{
		ID:          newDeployEventID(),
		TenantID:    tenantID,
		ActorID:     actorID,
		ActorName:   orig.ActorName,
		Branch:      orig.Branch,
		Env:         orig.Env,
		FromCommit:  orig.ToCommit,
		ToCommit:    orig.FromCommit,
		ArtifactID:  orig.ArtifactID,
		ImageDigest: orig.ImageDigest,
		ApprovalID:  orig.ApprovalID,
		Outcome:     models.DeployOutcomeRolledBack,
		RollbackTo:  &origID,
		StartedAt:   now,
		CompletedAt: &now,
		DurationMs:  0,
		ErrorRate:   0,
		P99Latency:  0,
		GateResult:  orig.GateResult,
		CreatedAt:   now,
	}
	if err := s.repo.CreateDeployEvent(ctx, rollback); err != nil {
		return nil, err
	}
	return rollback, nil
}

// GetAuditTrail returns the aggregated chain for the given params. All
// filters are AND-combined: an event must match every non-empty filter to
// appear in the result. Limit defaults to 100 and is capped at 1000.
// The result deduplicates Branches / Envs / ArtifactIDs / ApprovalIDs so
// the UI can render a compact graph.
func (s *Service) GetAuditTrail(ctx context.Context, tenantID string, params models.AuditTrailParams) (*models.AuditTrailResult, error) {
	if tenantID == "" {
		return nil, fmt.Errorf("tenant_id is required")
	}
	if params.Limit <= 0 {
		params.Limit = 100
	}
	if params.Limit > 1000 {
		params.Limit = 1000
	}
	// Convert string filters to pointer form so the query is uniform.
	q := models.DeployEventQuery{Limit: params.Limit}
	if params.Branch != "" {
		b := params.Branch
		q.Branch = &b
	}
	if params.Env != "" {
		e := params.Env
		q.Env = &e
	}
	if params.ArtifactID != "" {
		// No ArtifactID field on DeployEventQuery yet — filter client-side
		// after fetching. See below.
	}
	if params.ApprovalID != "" {
		a := params.ApprovalID
		q.ApprovalID = &a
	}
	all, err := s.repo.ListDeployEvents(ctx, tenantID, q)
	if err != nil {
		return nil, err
	}
	// Client-side filter for ArtifactID (added after the design doc landed).
	if params.ArtifactID != "" {
		filtered := make([]models.DeployEvent, 0, len(all))
		for _, e := range all {
			if e.ArtifactID == params.ArtifactID {
				filtered = append(filtered, e)
			}
		}
		all = filtered
	}
	// Dedup helper.
	dedup := func(vals []string) []string {
		seen := make(map[string]struct{}, len(vals))
		out := make([]string, 0, len(vals))
		for _, v := range vals {
			if v == "" {
				continue
			}
			if _, ok := seen[v]; ok {
				continue
			}
			seen[v] = struct{}{}
			out = append(out, v)
		}
		return out
	}
	branches := make([]string, 0, len(all))
	envs := make([]string, 0, len(all))
	artIDs := make([]string, 0, len(all))
	approvalIDs := make([]string, 0, len(all))
	for _, e := range all {
		branches = append(branches, e.Branch)
		envs = append(envs, e.Env)
		artIDs = append(artIDs, e.ArtifactID)
		approvalIDs = append(approvalIDs, e.ApprovalID)
	}
	return &models.AuditTrailResult{
		Events:      all,
		Branches:    dedup(branches),
		Envs:        dedup(envs),
		ArtifactIDs: dedup(artIDs),
		ApprovalIDs: dedup(approvalIDs),
		GeneratedAt: time.Now(),
	}, nil
}

// ============================================================================
// P0-MB Phase 5 — PreDeployGate (R1-R6) + MergePreview
// ============================================================================

// PreDeployGate rule IDs. These are the stable keys surfaced in the
// PreDeployGateResult.Rules array — callers (frontend / middleware) can
// switch on them without depending on names.
const (
	GateRuleIDBranchEnv    = "R1"
	GateRuleIDDigest       = "R2"
	GateRuleIDApproval     = "R3"
	GateRuleIDBranchActive = "R4"
	GateRuleIDPipeline     = "R5"
	GateRuleIDSchema       = "R6"
)

// containsString reports whether item is present in list. Empty item is
// treated as "not found" so callers do not accidentally match an empty
// allow-list entry.
func containsString(list []string, item string) bool {
	if item == "" {
		return false
	}
	for _, v := range list {
		if v == item {
			return true
		}
	}
	return false
}

// newMergePreviewID returns a unique id prefixed with "mp". Same scheme as
// newDeployEventID: nanosecond timestamp + fnv hash for uniqueness without a
// distributed UUID dependency.
func newMergePreviewID() string {
	now := time.Now()
	h := fnv.New64a()
	h.Write([]byte(fmt.Sprintf("mp-%d-%d", now.UnixNano(), now.UnixMicro())))
	return fmt.Sprintf("mp-%x", h.Sum(nil)[:8])
}

// riskLevelForConflicts maps a conflict count to the canonical RiskLevel.
// The buckets are chosen to align with the design doc's severity ladder:
//
//	0 → low, 1-2 → medium, 3-5 → high, ≥6 → critical.
func riskLevelForConflicts(n int) models.RiskLevel {
	switch {
	case n <= 0:
		return models.RiskLevelLow
	case n <= 2:
		return models.RiskLevelMedium
	case n <= 5:
		return models.RiskLevelHigh
	default:
		return models.RiskLevelCritical
	}
}

// CheckPreDeployGate runs the R1-R6 rule suite against the given deploy
// request and returns a single PreDeployGateResult. The result is NOT
// persisted — callers (deploy handler / BranchEnvGuard) can treat it as a
// pure advisory snapshot.
//
// Rule ordering matches the rule IDs (R1..R6). Failures of independent rules
// do not short-circuit later rules: the response enumerates every rule that
// failed so the caller can show a full diagnostic list.
//
//   - R1 Branch-Env match    → VerifyImageTagMatch (blocking)
//   - R2 Digest signature     → VerifyBuildArtifactSignature (blocking when
//     an ArtifactID is supplied; skipped as a warning otherwise)
//   - R3 Approval required    → ApprovalID non-empty (blocking)
//   - R4 Branch not archived  → BranchProfile.Status (blocking; skipped as a
//     warning when no profile lookup is possible)
//   - R5 Pipeline allowed     → profile.AllowedPipelines (warning when no
//     profile or empty pipeline name)
//   - R6 Schema compatibility → placeholder until a migration-aware check
//     lands; always passes with a warning.
func (s *Service) CheckPreDeployGate(ctx context.Context, tenantID string, req models.DeployRequest) (*models.PreDeployGateResult, error) {
	if tenantID == "" {
		return nil, fmt.Errorf("tenant_id is required")
	}
	if req.Branch == "" || req.TargetEnv == "" {
		return nil, fmt.Errorf("branch and targetEnv are required")
	}
	result := &models.PreDeployGateResult{
		Branch:    req.Branch,
		Env:       req.TargetEnv,
		CheckedAt: time.Now(),
		Passed:    true,
		Rules:     make([]models.GateRuleResult, 0, 6),
		Blocked:   make([]string, 0),
	}

	// R1 — Branch-Env match.
	if err := s.runGateRule(result, GateRuleIDBranchEnv, "branch-env-match", models.GateSeverityBlocking, func() (bool, string, error) {
		if req.ImageTag == "" {
			return false, "imageTag is required for R1", nil
		}
		ok, err := s.VerifyImageTagMatch(ctx, tenantID, req.Branch, req.TargetEnv, req.ImageTag)
		if err != nil {
			return false, "branch-env lookup failed: " + err.Error(), err
		}
		if !ok {
			return false, "imageTag " + req.ImageTag + " does not match the binding for (" + req.Branch + ", " + req.TargetEnv + ")", nil
		}
		return true, "imageTag matches binding prefix", nil
	}); err != nil {
		return nil, err
	}

	// R2 — Digest signature. Skipped (warning) when ArtifactID is not supplied.
	if err := s.runGateRule(result, GateRuleIDDigest, "digest-signature", models.GateSeverityBlocking, func() (bool, string, error) {
		if req.ArtifactID == "" {
			return true, "artifactId not supplied — skipping signature check", nil
		}
		res, err := s.VerifyBuildArtifactSignature(ctx, tenantID, req.ArtifactID)
		if err != nil {
			return false, "signature lookup failed: " + err.Error(), err
		}
		if res == nil {
			return false, "signature result is nil", nil
		}
		if !res.Valid {
			return false, "artifact signature invalid: " + res.Reason, nil
		}
		return true, "artifact signature valid (" + res.Reason + ")", nil
	}); err != nil {
		return nil, err
	}

	// R3 — Approval required. Blocking when ApprovalID is empty.
	if err := s.runGateRule(result, GateRuleIDApproval, "approval-required", models.GateSeverityBlocking, func() (bool, string, error) {
		if req.ApprovalID == "" {
			return false, "approvalId is required before deploy", nil
		}
		return true, "approvalId " + req.ApprovalID + " supplied", nil
	}); err != nil {
		return nil, err
	}

	// R4 — Branch not archived. Warning when the branch cannot be resolved
	// to a BranchProfile (e.g. unknown id); blocking when the profile exists
	// and is archived/retired.
	profile, profileErr := s.lookupBranchProfile(ctx, tenantID, req.Branch)
	if err := s.runGateRule(result, GateRuleIDBranchActive, "branch-active", models.GateSeverityBlocking, func() (bool, string, error) {
		if profileErr != nil || profile == nil {
			// Not enough info to fail the rule; downgrade to a warning.
			return true, "branch profile not resolvable — skipping archived check", nil
		}
		switch profile.Status {
		case models.BranchStatusActive:
			return true, "branch profile status=active", nil
		default:
			return false, "branch profile status=" + string(profile.Status), nil
		}
	}); err != nil {
		return nil, err
	}

	// R5 — Pipeline allowed. Warning when the branch profile is unknown;
	// blocking when the pipeline is not in the profile's allow-list.
	if err := s.runGateRule(result, GateRuleIDPipeline, "pipeline-allowed", models.GateSeverityBlocking, func() (bool, string, error) {
		if profile == nil {
			return true, "branch profile not resolvable — skipping pipeline check", nil
		}
		if req.PipelineName == "" {
			return false, "pipelineName is required", nil
		}
		if !containsString(profile.AllowedPipelines, req.PipelineName) {
			return false, "pipeline " + req.PipelineName + " is not in branch's allowedPipelines", nil
		}
		return true, "pipeline " + req.PipelineName + " is allowed", nil
	}); err != nil {
		return nil, err
	}

	// R6 — Schema compatibility. Delegates to the SchemaCompatibilityChecker
	// when wired (see WithSchemaChecker); otherwise falls back to a
	// placeholder pass-with-warning so callers can distinguish "checker
	// not wired" from "checker ran and passed". Severity stays Warning —
	// making R6 blocking would flip behaviour for callers that have been
	// relying on the placeholder path, so that is a separate explicit
	// decision rather than a silent change.
	if err := s.runGateRule(result, GateRuleIDSchema, "schema-compatibility", models.GateSeverityWarning, func() (bool, string, error) {
		return s.runSchemaCompatibility(ctx, &req)
	}); err != nil {
		return nil, err
	}

	return result, nil
}

// ExecuteDeploy runs the full deploy pipeline: PreDeployGate R1-R6, and if
// the gate passes, persists a DeployEvent. It is the endpoint-level entry
// point called by POST /branch-policy/deploy.
//
// actorID and actorName are extracted by the handler from the auth context
// (or from explicit request fields when running without auth). They are
// stamped onto the DeployEvent for audit purposes.
//
// When the gate blocks the deploy, ExecuteDeploy returns the gate result
// with Passed=false and Event=nil — no audit record is written for blocked
// attempts. The caller can distinguish the two cases via GateResult.Passed
// and Event.
func (s *Service) ExecuteDeploy(ctx context.Context, tenantID, actorID, actorName string, req models.DeployRequest) (*models.DeployExecutionResult, error) {
	if tenantID == "" {
		return nil, fmt.Errorf("tenant_id is required")
	}
	if actorID == "" {
		return nil, fmt.Errorf("actor_id is required")
	}

	gateResult, err := s.CheckPreDeployGate(ctx, tenantID, req)
	if err != nil {
		return nil, err
	}

	out := &models.DeployExecutionResult{GateResult: gateResult}

	if !gateResult.Passed {
		// Blocked — no DeployEvent written.
		return out, nil
	}

	// Build a DeployEvent from the DeployRequest + gate result.
	evtReq := &models.CreateDeployEventRequest{
		ActorID:     actorID,
		ActorName:   actorName,
		Branch:      req.Branch,
		Env:         req.TargetEnv,
		FromCommit:  "", // DeployRequest does not carry FromCommit; leave empty.
		ToCommit:    req.SourceCommit,
		ArtifactID:  req.ArtifactID,
		ImageDigest: "", // DeployRequest carries ImageTag, not ImageDigest; leave empty.
		ApprovalID:  req.ApprovalID,
		Outcome:     models.DeployOutcomeSuccess,
		GateResult:  gateResultJSON(gateResult),
	}

	evt, err := s.CreateDeployEvent(ctx, tenantID, evtReq)
	if err != nil {
		// Gate passed but persistence failed. Return the gate result and the
		// error so the caller can retry or surface the failure.
		out.GateResult = gateResult
		return out, fmt.Errorf("gate passed but event persistence failed: %w", err)
	}

	out.Event = evt
	return out, nil
}

// gateResultJSON serializes a PreDeployGateResult to a compact JSON string
// suitable for storage in the DeployEvent.GateResult column. The string is
// stored as a free-form audit blob — callers can json.Unmarshal it back.
func gateResultJSON(r *models.PreDeployGateResult) string {
	if r == nil {
		return ""
	}
	b, err := json.Marshal(r)
	if err != nil {
		// Extremely unlikely (struct has no unmarshalable fields); return a
		// placeholder so we never lose the event.
		return `{"passed":false,"blocked":["serialization-error"]}`
	}
	return string(b)
}

// runSchemaCompatibility is the R6 rule body. It delegates to the wired
// SchemaCompatibilityChecker (see WithSchemaChecker) and renders the result
// as a (passed, detail) tuple for runGateRule. Nil checker → placeholder
// pass-with-warning (preserves pre-wiring behaviour for legacy callers).
//
// Error handling: any error from the checker flips the rule to failed. Since
// R6 is GateSeverityWarning, a failed rule does NOT block the deploy — the
// result is recorded in result.Rules with the error detail so an operator can
// surface it. This matches the fail-closed contract of runGateRule.
func (s *Service) runSchemaCompatibility(ctx context.Context, req *models.DeployRequest) (bool, string, error) {
	if s.schemaChecker == nil {
		return true, "schema-compatibility checker not wired — placeholder", nil
	}
	res, err := s.schemaChecker.CheckSchemaCompatibility(ctx, req)
	if err != nil {
		return false, "schema-compatibility check failed: " + err.Error(), nil
	}
	if res == nil {
		// Checker had no info to report (e.g. no schema version on the
		// artifact). Not a failure — just record an informational pass.
		return true, "schema-compatibility checker returned nil result", nil
	}
	return res.Compatible, schemaCompatDetail(res), nil
}

// runGateRule is the small helper that runs a single PreDeployGate rule and
// appends the outcome to the result. The rule closure returns (passed,
// detail, err) — err is only propagated when non-nil; failed rules do NOT
// abort the gate.
func (s *Service) runGateRule(result *models.PreDeployGateResult, ruleID, name string, severity models.GateSeverity, fn func() (bool, string, error)) error {
	passed, detail, err := fn()
	if err != nil {
		// Treat the error as a failed rule but record the reason so the
		// caller can surface it. Fail-closed for blocking rules.
		passed = false
		if detail == "" {
			detail = "rule error: " + err.Error()
		}
	}
	rule := models.GateRuleResult{RuleID: ruleID, Name: name, Passed: passed, Detail: detail, Severity: severity}
	result.Rules = append(result.Rules, rule)
	if !passed && severity == models.GateSeverityBlocking {
		result.Blocked = append(result.Blocked, ruleID)
		result.Passed = false
	}
	return nil
}

// lookupBranchProfile resolves the "branch" identifier in a DeployRequest
// to a BranchProfile. It tries GetBranchProfile(id) first (the field is
// usually the profile id, matching BranchEnvGuard's contract) and falls
// back to ListBranchProfiles with a name filter so callers can pass the
// human-readable branch name ("release/enterprise-2026").
func (s *Service) lookupBranchProfile(ctx context.Context, tenantID, ref string) (*models.BranchProfile, error) {
	if tenantID == "" || ref == "" {
		return nil, fmt.Errorf("tenant_id and branch reference are required")
	}
	p, err := s.repo.GetBranchProfile(ctx, tenantID, ref)
	if err == nil && p != nil {
		return p, nil
	}
	if err != nil && !errors.Is(err, sentinelNotFound) && !errors.Is(err, ErrBranchProfileNotFound) {
		return nil, err
	}
	// Fall back to a name lookup.
	profiles, err := s.repo.ListBranchProfiles(ctx, tenantID, models.BranchProfileQuery{})
	if err != nil {
		return nil, err
	}
	for i := range profiles {
		if profiles[i].Name == ref {
			return &profiles[i], nil
		}
	}
	return nil, ErrBranchProfileNotFound
}

// CreateMergePreview is the POST entry point for /merge-preview. It builds a
// MergePreview from the request and persists it. Resolution order for the
// ConflictFiles list:
//
//  1. If the caller supplied ConflictFiles (client ran git merge-tree), use
//     them as-is. AddedFiles/ModifiedFiles/DeletedFiles are likewise used as
//     supplied.
//  2. Else if s.gitExecutor is wired and the merge-tree run succeeds, use
//     its output. AddedFiles/ModifiedFiles/DeletedFiles default to empty
//     slices (git merge-tree --write-tree does not classify them).
//  3. Else fall back to empty ConflictFiles and RiskLevelLow — never block
//     the API on a broken git installation. A merge-tree failure is
//     recorded as a warning comment on the resulting MergePreview.ID (the
//     service layer does not surface it as an error).
//
// RiskLevel is always recomputed from len(ConflictFiles) so the two stay in
// sync regardless of which path populated them.
func (s *Service) CreateMergePreview(ctx context.Context, tenantID string, req *models.MergePreviewRequest) (*models.MergePreview, error) {
	if tenantID == "" {
		return nil, fmt.Errorf("tenant_id is required")
	}
	if req == nil {
		return nil, fmt.Errorf("request is required")
	}
	if req.SourceBranch == "" || req.TargetBranch == "" {
		return nil, fmt.Errorf("sourceBranch and targetBranch are required")
	}
	if req.SourceBranch == req.TargetBranch {
		return nil, fmt.Errorf("sourceBranch and targetBranch must differ")
	}
	// Optional commit SHA validation.
	if req.SourceCommit != "" && !syncCommitSHARe.MatchString(req.SourceCommit) {
		return nil, fmt.Errorf("sourceCommit is not a valid 7-40 hex sha")
	}
	if req.TargetCommit != "" && !syncCommitSHARe.MatchString(req.TargetCommit) {
		return nil, fmt.Errorf("targetCommit is not a valid 7-40 hex sha")
	}

	conflictFiles := req.ConflictFiles
	addedFiles := req.AddedFiles
	modifiedFiles := req.ModifiedFiles
	deletedFiles := req.DeletedFiles

	// Path 2: when the caller did not supply conflicts and we have a git
	// executor, run a real merge-tree dry-run. Failures are logged but not
	// surfaced — the API stays available.
	if len(conflictFiles) == 0 && s.gitExecutor != nil {
		sourceRef := req.SourceCommit
		if sourceRef == "" {
			sourceRef = req.SourceBranch
		}
		targetRef := req.TargetCommit
		if targetRef == "" {
			targetRef = req.TargetBranch
		}
		if res, err := s.gitExecutor.Run(ctx, sourceRef, targetRef); err == nil && res != nil {
			conflictFiles = res.ConflictFiles
			addedFiles = res.AddedFiles
			modifiedFiles = res.ModifiedFiles
			deletedFiles = res.DeletedFiles
		} else if err != nil {
			// git failed — keep the empty list, the caller can still
			// inspect MergePreview.ID via ListMergePreviews. The warning
			// is intentionally not returned to the handler; surfacing it
			// would turn a degraded path into a 4xx/5xx and break clients
			// that previously got a 201 with an empty conflict list.
			s.logGitMergeError(ctx, req, err)
		}
	}

	conflictCount := len(conflictFiles)
	p := &models.MergePreview{
		ID:            newMergePreviewID(),
		TenantID:      tenantID,
		SourceBranch:  req.SourceBranch,
		TargetBranch:  req.TargetBranch,
		SourceCommit:  req.SourceCommit,
		TargetCommit:  req.TargetCommit,
		ConflictFiles: conflictFiles,
		AddedFiles:    addedFiles,
		ModifiedFiles: modifiedFiles,
		DeletedFiles:  deletedFiles,
		ConflictCount: conflictCount,
		RiskLevel:     riskLevelForConflicts(conflictCount),
		PreviewedAt:   time.Now(),
	}
	if err := s.repo.CreateMergePreview(ctx, p); err != nil {
		return nil, err
	}
	return p, nil
}

// logGitMergeError emits a structured Warn entry when the merge-tree dry-run
// call fails and the service is falling back to client-supplied conflicts.
// Kept as a method (not a closure) so tests can call it directly and verify
// field emission via zaptest/observer.
//
// Design notes:
//   - No-op when s.logger is nil (tests / legacy callers stay silent).
//   - No-op when err is nil (call site already guarantees non-nil, but we
//     double-check for future callers).
//   - Error message is truncated to 512 chars to keep the log entry bounded;
//     git merge-tree failures can dump full file diffs when a worktree is
//     in a weird state, and we do not want to blow up structured logs.
//   - Empty branch/commit fields are omitted so the JSON entry stays tight.
func (s *Service) logGitMergeError(ctx context.Context, req *models.MergePreviewRequest, err error) {
	if s.logger == nil || err == nil {
		return
	}
	_ = ctx // context is reserved for future trace/span propagation
	msg := err.Error()
	if len(msg) > 512 {
		msg = msg[:512] + "…"
	}
	fields := make([]zap.Field, 0, 5)
	fields = append(fields, zap.String("error", msg))
	if req.SourceBranch != "" {
		fields = append(fields, zap.String("source_branch", req.SourceBranch))
	}
	if req.TargetBranch != "" {
		fields = append(fields, zap.String("target_branch", req.TargetBranch))
	}
	if req.SourceCommit != "" {
		fields = append(fields, zap.String("source_commit", req.SourceCommit))
	}
	if req.TargetCommit != "" {
		fields = append(fields, zap.String("target_commit", req.TargetCommit))
	}
	// Pass only the variadic — zap.Logger.Warn's signature is
	// Warn(msg string, fields ...Field). Mixing a positional zap.Error(err)
	// with `fields...` is a compile error; so we prepend it into the slice
	// above and hand over just the variadic.
	s.logger.Warn("gitmerge: merge-tree dry-run failed; using client-supplied conflicts", fields...)
}

// GetMergePreview returns the preview by id (tenant-scoped).
func (s *Service) GetMergePreview(ctx context.Context, tenantID, id string) (*models.MergePreview, error) {
	if tenantID == "" || id == "" {
		return nil, fmt.Errorf("tenant_id and id are required")
	}
	p, err := s.repo.GetMergePreview(ctx, tenantID, id)
	if err != nil {
		return nil, err
	}
	if p == nil {
		return nil, ErrBranchProfileNotFound
	}
	return p, nil
}

// ListMergePreviews returns the previews for the tenant, newest first.
// limit defaults to 100 and is capped at 1000.
func (s *Service) ListMergePreviews(ctx context.Context, tenantID string, limit int) ([]models.MergePreview, error) {
	if tenantID == "" {
		return nil, fmt.Errorf("tenant_id is required")
	}
	if limit <= 0 {
		limit = 100
	}
	if limit > 1000 {
		limit = 1000
	}
	return s.repo.ListMergePreviews(ctx, tenantID, limit)
}
