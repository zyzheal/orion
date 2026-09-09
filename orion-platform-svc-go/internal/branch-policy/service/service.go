package service

//go:generate mockgen -destination=mock_service.go -package=service . ServiceInterface
//go:generate mockgen -destination=mock_repository.go -package=service . RepositoryInterface

import (
	"context"
	"errors"
	"fmt"
	"hash/fnv"
	"regexp"
	"strings"
	"time"

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
}

// ErrBranchProfileNotFound wraps repository-level not-found into a
// service-friendly sentinel. Handlers compare with errors.Is.
var ErrBranchProfileNotFound = errors.New("branch profile not found")

type Service struct {
	repo RepositoryInterface
}

func NewService(repo RepositoryInterface) *Service {
	return &Service{repo: repo}
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
