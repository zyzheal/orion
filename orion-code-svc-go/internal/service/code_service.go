package service

import (
	"context"
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"regexp"
	"strings"
	"time"

	"orion/code-svc-go/internal/models"
	"orion/code-svc-go/internal/repository"

	"github.com/google/uuid"
)

var (
	ErrNotFound  = errors.New("not found")
	ErrForbidden = errors.New("forbidden")
	ErrInvalidInput = errors.New("invalid input")
)

// Service is the business logic layer for the code-svc microservice.
type Service struct {
	repo *repository.Repository
}

func NewService(repo *repository.Repository) *Service {
	return &Service{repo: repo}
}

// ==================== Code Repositories ====================

func (s *Service) CreateRepository(ctx context.Context, tenantID string, req *models.CreateCodeRepositoryRequest) (*models.CodeRepository, error) {
	repoType := req.RepoType
	if repoType == "" {
		repoType = "gitlab"
	}

	d := &models.CodeRepository{
		ID:            uuid.New().String(),
		TenantID:      tenantID,
		Name:          req.Name,
		RepoURL:       req.RepoURL,
		RepoType:      repoType,
		DefaultBranch: req.Branch,
		Branch:        req.Branch,
		IsPrivate:     true,
		CreatedAt:     time.Now(),
		UpdatedAt:     time.Now(),
	}
	if err := s.repo.Create(ctx, d); err != nil {
		return nil, fmt.Errorf("create repository: %w", err)
	}
	return d, nil
}

func (s *Service) ListRepositories(ctx context.Context, tenantID string, offset, limit int) ([]models.CodeRepository, error) {
	return s.repo.List(ctx, tenantID, offset, limit)
}

func (s *Service) GetRepository(ctx context.Context, tenantID, id string) (*models.CodeRepository, error) {
	d, err := s.repo.GetByID(ctx, tenantID, id)
	if err != nil {
		return nil, ErrNotFound
	}
	return d, nil
}

func (s *Service) UpdateRepository(ctx context.Context, tenantID, id string, req *models.UpdateCodeRepositoryRequest) error {
	if err := s.repo.Update(ctx, tenantID, id, req); err != nil {
		return ErrNotFound
	}
	return nil
}

func (s *Service) DeleteRepository(ctx context.Context, tenantID, id string) error {
	return s.repo.Delete(ctx, tenantID, id)
}

func (s *Service) CountRepositories(ctx context.Context, tenantID string) (int, error) {
	return s.repo.Count(ctx, tenantID)
}

// ==================== Webhook Processing ====================

// RegisterWebhookSecret stores the verification secret for a repository webhook.
func (s *Service) RegisterWebhookSecret(ctx context.Context, tenantID, repoID, secret string) error {
	return s.repo.UpsertWebhookSecret(ctx, tenantID, repoID, secret)
}

// VerifyWebhookSignature validates the webhook payload signature against the stored secret.
// Supports GitLab (X-Gitlab-Token simple comparison) and GitHub (X-Hub-Signature-256 HMAC-SHA256).
func (s *Service) VerifyWebhookSignature(ctx context.Context, repoID, payload string, headers map[string]string) (bool, error) {
	ws, err := s.repo.GetWebhookSecret(ctx, repoID)
	if err != nil {
		// No secret configured — allow the request.
		return true, nil
	}

	// GitLab simple token check.
	if token, ok := getHeader(headers, "X-Gitlab-Token"); ok {
		return token == ws.Secret, nil
	}

	// GitHub HMAC-SHA256 check.
	if sig, ok := getHeader(headers, "X-Hub-Signature-256"); ok {
		mac := hmac.New(sha256.New, []byte(ws.Secret))
		mac.Write([]byte(payload))
		expected := "sha256=" + hex.EncodeToString(mac.Sum(nil))
		return hmac.Equal([]byte(sig), []byte(expected)), nil
	}

	return false, nil
}

// ProcessWebhook handles an inbound webhook event: validates, normalises, logs, and returns a result.
func (s *Service) ProcessWebhook(ctx context.Context, tenantID string, req *models.WebhookProcessRequest, headers map[string]string) (*models.WebhookProcessResult, error) {
	// Detect repo type from headers/payload if not set.
	repoType := req.RepoType
	if repoType == "" {
		repoType = detectRepoType(headers, req.Payload)
	}

	// Signature verification.
	if req.RepositoryID != "" {
		payloadBytes, _ := json.Marshal(req.Payload)
		ok, err := s.VerifyWebhookSignature(ctx, req.RepositoryID, string(payloadBytes), headers)
		if err != nil {
			return &models.WebhookProcessResult{Success: false, Error: err.Error()}, nil
		}
		if !ok {
			return &models.WebhookProcessResult{Success: false, Error: "invalid webhook signature"}, nil
		}
	}

	// Map to unified event type.
	eventType := mapEventType(repoType, req.EventType, req.Payload)
	if eventType == "" {
		return &models.WebhookProcessResult{
			Success: false,
			Error:   fmt.Sprintf("unsupported event type: %s", req.EventType),
		}, nil
	}

	// Log the event.
	eventID := uuid.New().String()
	logEntry := &models.WebhookEventLog{
		ID:        uuid.New().String(),
		EventType: eventType,
		RepoType:  repoType,
		RepoName:  req.Repository,
		EventID:   eventID,
		Success:   true,
		TenantID:  tenantID,
	}
	_ = s.repo.CreateWebhookEventLog(ctx, logEntry)

	return &models.WebhookProcessResult{
		Success:   true,
		EventID:   eventID,
		EventType: eventType,
	}, nil
}

// ListWebhookEventLogs returns recent webhook event logs, optionally filtered.
func (s *Service) ListWebhookEventLogs(ctx context.Context, tenantID, eventType, repoType string, limit int) ([]models.WebhookEventLog, error) {
	if limit <= 0 || limit > 200 {
		limit = 50
	}
	return s.repo.ListWebhookEventLogs(ctx, tenantID, eventType, repoType, limit)
}

// ==================== Branch Policies ====================

// CreateBranchPolicy creates a new branch protection policy.
func (s *Service) CreateBranchPolicy(ctx context.Context, tenantID string, req *models.CreateBranchPolicyRequest) (*models.BranchPolicy, error) {
	// Convert approval rules to JSON array.
	approvalRules := make(models.JSONArray, len(req.ApprovalRules))
	for i, rule := range req.ApprovalRules {
		if rule.ID == "" {
			rule.ID = uuid.New().String()
		}
		approvalRules[i] = rule
	}

	requiredChecks := models.JSONArray{}
	for _, check := range req.RequiredChecks {
		requiredChecks = append(requiredChecks, check)
	}

	p := &models.BranchPolicy{
		ID:                 uuid.New().String(),
		TenantID:           tenantID,
		RepoID:             req.RepoID,
		BranchPattern:      req.BranchPattern,
		PreventForcePush:   boolPtr(req.PreventForcePush, false),
		PreventDeletion:    boolPtr(req.PreventDeletion, true),
		MergeStrategy:      defaultStr(req.MergeStrategy, "merge"),
		ApprovalRules:      approvalRules,
		RequiredChecks:     requiredChecks,
		RequireCodeOwners:  boolPtr(req.RequireCodeOwners, false),
		LinearHistory:      boolPtr(req.LinearHistory, false),
		AllowAdminOverride: boolPtr(req.AllowAdminOverride, false),
	}

	if err := s.repo.CreateBranchPolicy(ctx, p); err != nil {
		return nil, fmt.Errorf("create branch policy: %w", err)
	}
	return p, nil
}

// GetBranchPolicy fetches a single branch policy by ID.
func (s *Service) GetBranchPolicy(ctx context.Context, id string) (*models.BranchPolicy, error) {
	p, err := s.repo.GetBranchPolicyByID(ctx, id)
	if err != nil {
		return nil, ErrNotFound
	}
	return p, nil
}

// ListBranchPolicies returns all policies for a repository.
func (s *Service) ListBranchPolicies(ctx context.Context, tenantID, repoID string) ([]models.BranchPolicy, error) {
	return s.repo.ListBranchPoliciesByRepo(ctx, tenantID, repoID)
}

// ListAllBranchPolicies returns all policies across all repositories.
func (s *Service) ListAllBranchPolicies(ctx context.Context, tenantID string) ([]models.BranchPolicy, error) {
	return s.repo.ListAllBranchPolicies(ctx, tenantID)
}

// UpdateBranchPolicy modifies an existing branch policy.
func (s *Service) UpdateBranchPolicy(ctx context.Context, id string, req *models.UpdateBranchPolicyRequest) (*models.BranchPolicy, error) {
	var approvalRulesJSON models.JSONArray
	var requiredChecksJSON models.JSONArray

	if req.ApprovalRules != nil {
		approvalRulesJSON = make(models.JSONArray, len(req.ApprovalRules))
		for i, rule := range req.ApprovalRules {
			if rule.ID == "" {
				rule.ID = uuid.New().String()
			}
			approvalRulesJSON[i] = rule
		}
	}
	if req.RequiredChecks != nil {
		requiredChecksJSON = make(models.JSONArray, len(req.RequiredChecks))
		for i, check := range req.RequiredChecks {
			requiredChecksJSON[i] = check
		}
	}

	if err := s.repo.UpdateBranchPolicy(ctx, id, req, approvalRulesJSON, requiredChecksJSON); err != nil {
		return nil, ErrNotFound
	}
	return s.repo.GetBranchPolicyByID(ctx, id)
}

// DeleteBranchPolicy removes a branch policy by ID.
func (s *Service) DeleteBranchPolicy(ctx context.Context, id string) error {
	return s.repo.DeleteBranchPolicy(ctx, id)
}

// MatchBranchPolicy finds the most specific policy matching a branch name for a repo.
// Policies are sorted by pattern length (most specific first) and matched using glob rules.
func (s *Service) MatchBranchPolicy(ctx context.Context, tenantID, repoID, branchName string) (*models.BranchPolicy, error) {
	policies, err := s.repo.ListBranchPoliciesByRepo(ctx, tenantID, repoID)
	if err != nil {
		return nil, err
	}

	// Sort by specificity: longer patterns first.
	sortByPatternLength(policies)

	for _, p := range policies {
		if matchesGlobPattern(branchName, p.BranchPattern) {
			return &p, nil
		}
	}
	return nil, nil
}

// CheckMergeability verifies whether a PR can merge against the matching branch policy.
func (s *Service) CheckMergeability(ctx context.Context, tenantID, repoID string, req *models.PullRequestMergeCheckRequest) (*models.MergeCheckResult, error) {
	policy, err := s.MatchBranchPolicy(ctx, tenantID, repoID, req.TargetBranch)
	if err != nil {
		return nil, err
	}

	if policy == nil {
		return &models.MergeCheckResult{
			CanMerge: true,
			Warnings: []string{"no branch policy configured for this target branch"},
		}, nil
	}

	blocks := []models.MergeCheckBlock{}
	warnings := []string{}

	// Check approval rules.
	approvalBlocks := checkApprovals(policy, req.Approvals, req.Author)
	blocks = append(blocks, approvalBlocks...)

	// Check required CI/CD checks.
	checkBlocks := checkRequiredChecks(policy, req.CheckResults)
	blocks = append(blocks, checkBlocks...)

	// Check code owners requirement.
	if policy.RequireCodeOwners && !req.CodeOwnersApproved {
		blocks = append(blocks, models.MergeCheckBlock{
			Rule:     "code-owners",
			Reason:   "CODEOWNERS approval is required",
			Severity: "error",
		})
	}

	// Admin override.
	if req.IsAdmin && policy.AllowAdminOverride {
		errBlocks := filterErrorBlocks(blocks)
		if len(errBlocks) > 0 {
			warnings = append(warnings, fmt.Sprintf("admin override applied, bypassed %d blocking rule(s)", len(errBlocks)))
		}
		return &models.MergeCheckResult{
			CanMerge: true,
			Policy:   policy,
			Blocks:   filterBlocksBySeverity(blocks, "warning"),
			Warnings: warnings,
		}, nil
	}

	canMerge := !hasErrorBlocks(blocks)

	return &models.MergeCheckResult{
		CanMerge: canMerge,
		Policy:   policy,
		Blocks:   blocks,
		Warnings: warnings,
	}, nil
}

// CreateDefaultPolicies creates standard branch protection policies for common branch patterns.
func (s *Service) CreateDefaultPolicies(ctx context.Context, tenantID, repoID string) ([]models.BranchPolicy, error) {
	coreTeam := models.ApprovalRule{ID: uuid.New().String(), Name: "Core Team", RequiredApprovals: 2, Approvers: []string{"@team-core"}, AllowAuthorApproval: false, RequiredRoles: []string{"maintainer"}}
	releaseTeam := models.ApprovalRule{ID: uuid.New().String(), Name: "Release Team", RequiredApprovals: 1, Approvers: []string{"@team-release"}, AllowAuthorApproval: true}
	devTeam := models.ApprovalRule{ID: uuid.New().String(), Name: "Dev Team", RequiredApprovals: 1, Approvers: []string{"@team-dev"}, AllowAuthorApproval: true}

	boolTrue := true

	defaults := []models.CreateBranchPolicyRequest{
		{RepoID: repoID, BranchPattern: "main", PreventForcePush: &boolTrue, PreventDeletion: &boolTrue, MergeStrategy: "squash", ApprovalRules: []models.ApprovalRule{coreTeam}, RequiredChecks: []string{"ci/build", "ci/test", "ci/lint"}, RequireCodeOwners: &boolTrue, LinearHistory: &boolTrue, AllowAdminOverride: &boolTrue},
		{RepoID: repoID, BranchPattern: "master", PreventForcePush: &boolTrue, PreventDeletion: &boolTrue, MergeStrategy: "squash", ApprovalRules: []models.ApprovalRule{coreTeam}, RequiredChecks: []string{"ci/build", "ci/test", "ci/lint"}, RequireCodeOwners: &boolTrue, LinearHistory: &boolTrue, AllowAdminOverride: &boolTrue},
		{RepoID: repoID, BranchPattern: "release/**", PreventForcePush: &boolTrue, PreventDeletion: &boolTrue, MergeStrategy: "merge", ApprovalRules: []models.ApprovalRule{releaseTeam}, RequiredChecks: []string{"ci/build", "ci/test"}, AllowAdminOverride: &boolTrue},
		{RepoID: repoID, BranchPattern: "develop", PreventDeletion: &boolTrue, MergeStrategy: "squash", ApprovalRules: []models.ApprovalRule{devTeam}, RequiredChecks: []string{"ci/build"}},
	}

	created := []models.BranchPolicy{}
	for _, def := range defaults {
		p, err := s.CreateBranchPolicy(ctx, tenantID, &def)
		if err != nil {
			continue // skip duplicates
		}
		created = append(created, *p)
	}
	return created, nil
}

// ==================== Code Ownership ====================

// RegisterCodeOwnership parses and stores a CODEOWNERS file for a repository.
func (s *Service) RegisterCodeOwnership(ctx context.Context, tenantID, repoID, rawContent, filePath string) (*models.CodeOwnership, error) {
	if filePath == "" {
		filePath = ".github/CODEOWNERS"
	}

	rules, errs := parseCodeOwnersContent(rawContent)
	if len(errs) > 0 && len(rules) == 0 {
		return nil, fmt.Errorf("%w: %s", ErrInvalidInput, strings.Join(errs, "; "))
	}

	rulesJSON := make(models.JSONArray, len(rules))
	for i, rule := range rules {
		rulesJSON[i] = rule
	}

	co := &models.CodeOwnership{
		ID:         uuid.New().String(),
		TenantID:   tenantID,
		RepoID:     repoID,
		FilePath:   filePath,
		Rules:      rulesJSON,
		RawContent: rawContent,
	}

	if err := s.repo.UpsertCodeOwnership(ctx, co); err != nil {
		return nil, fmt.Errorf("upsert code ownership: %w", err)
	}
	return co, nil
}

// GetCodeOwnership retrieves the CODEOWNERS record for a repository.
func (s *Service) GetCodeOwnership(ctx context.Context, repoID string) (*models.CodeOwnership, error) {
	co, err := s.repo.GetCodeOwnership(ctx, repoID)
	if err != nil {
		return nil, ErrNotFound
	}
	return co, nil
}

// RemoveCodeOwnership deletes the CODEOWNERS record for a repository.
func (s *Service) RemoveCodeOwnership(ctx context.Context, repoID string) error {
	return s.repo.DeleteCodeOwnership(ctx, repoID)
}

// RecommendOwners returns the recommended reviewers for a set of file paths.
func (s *Service) RecommendOwners(ctx context.Context, repoID string, filePaths []string) ([]models.OwnerRecommendation, error) {
	co, err := s.repo.GetCodeOwnership(ctx, repoID)
	if err != nil {
		// No CODEOWNERS — return empty owners for each file.
		recs := make([]models.OwnerRecommendation, len(filePaths))
		for i, fp := range filePaths {
			recs[i] = models.OwnerRecommendation{FilePath: fp}
		}
		return recs, nil
	}

	var rules []models.OwnershipRule
	if err := json.Unmarshal([]byte(marshalJSON(co.Rules)), &rules); err != nil {
		return nil, fmt.Errorf("parse ownership rules: %w", err)
	}

	recs := make([]models.OwnerRecommendation, len(filePaths))
	for i, fp := range filePaths {
		matched := matchFileToRules(fp, rules)
		ownersSet := map[string]bool{}
		lastPattern := ""
		for _, rule := range matched {
			for _, o := range rule.Owners {
				ownersSet[o] = true
			}
			lastPattern = rule.Pattern
		}
		owners := make([]string, 0, len(ownersSet))
		for o := range ownersSet {
			owners = append(owners, o)
		}
		recs[i] = models.OwnerRecommendation{FilePath: fp, Owners: owners, MatchedPattern: lastPattern}
	}
	return recs, nil
}

// ==================== Commit Status ====================

// CreateCommitStatus creates a new commit status and returns the persisted record.
func (s *Service) CreateCommitStatus(ctx context.Context, tenantID, repoID string, req *models.CreateCommitStatusRequest) (*models.CommitStatus, error) {
	cs := &models.CommitStatus{
		ID:           uuid.New().String(),
		TenantID:     tenantID,
		RepositoryID: repoID,
		CommitSHA:    req.CommitSHA,
		State:        req.State,
		TargetURL:    req.TargetURL,
		Description:  req.Description,
		Context:      req.Context,
	}
	if err := s.repo.CreateCommitStatus(ctx, cs); err != nil {
		return nil, fmt.Errorf("create commit status: %w", err)
	}
	return cs, nil
}

// ListCommitStatuses returns all statuses for a commit, optionally filtered by context.
func (s *Service) ListCommitStatuses(ctx context.Context, tenantID, repoID, commitSHA, contextFilter string) ([]models.CommitStatus, error) {
	return s.repo.ListCommitStatuses(ctx, tenantID, repoID, commitSHA, contextFilter)
}

// UpdateCommitStatus updates the state of an existing commit status.
func (s *Service) UpdateCommitStatus(ctx context.Context, tenantID, repoID, commitSHA, contextName, state, description string) error {
	return s.repo.UpdateCommitStatus(ctx, tenantID, repoID, commitSHA, contextName, state, description)
}

// DeleteCommitStatus removes a commit status by context.
func (s *Service) DeleteCommitStatus(ctx context.Context, tenantID, repoID, commitSHA, contextName string) error {
	return s.repo.DeleteCommitStatus(ctx, tenantID, repoID, commitSHA, contextName)
}

// BatchCreateCommitStatuses inserts multiple commit statuses in one transaction.
func (s *Service) BatchCreateCommitStatuses(ctx context.Context, tenantID, repoID string, reqs []models.CreateCommitStatusRequest) error {
	statuses := make([]models.CommitStatus, len(reqs))
	for i, req := range reqs {
		statuses[i] = models.CommitStatus{
			ID:           uuid.New().String(),
			TenantID:     tenantID,
			RepositoryID: repoID,
			CommitSHA:    req.CommitSHA,
			State:        req.State,
			TargetURL:    req.TargetURL,
			Description:  req.Description,
			Context:      req.Context,
		}
	}
	return s.repo.BatchCreateCommitStatuses(ctx, statuses)
}

// CheckCommitReadiness verifies whether all required status checks have passed.
func (s *Service) CheckCommitReadiness(ctx context.Context, tenantID, repoID, commitSHA string) (*models.CommitReadiness, error) {
	statuses, err := s.repo.ListCommitStatuses(ctx, tenantID, repoID, commitSHA, "")
	if err != nil {
		return nil, err
	}

	failedContexts := []string{}
	for _, s := range statuses {
		if s.State != "success" {
			failedContexts = append(failedContexts, s.Context)
		}
	}

	return &models.CommitReadiness{
		Ready:          len(failedContexts) == 0,
		Statuses:       statuses,
		FailedContexts: failedContexts,
	}, nil
}

// ==================== Internal helpers ====================

// detectRepoType guesses the repository type from webhook headers and payload.
func detectRepoType(headers map[string]string, payload map[string]interface{}) string {
	if _, ok := getHeader(headers, "X-Gitlab-Token"); ok {
		return "gitlab"
	}
	if _, ok := payload["object_kind"]; ok {
		return "gitlab"
	}
	if _, ok := getHeader(headers, "X-Github-Event"); ok {
		return "github"
	}
	if _, ok := payload["pull_request"]; ok {
		return "github"
	}
	if _, ok := payload["change"]; ok {
		return "gerrit"
	}
	if t, ok := payload["type"]; ok {
		if ts, ok := t.(string); ok && strings.Contains(ts, "change") {
			return "gerrit"
		}
	}
	return "gitlab"
}

// mapEventType normalises vendor-specific event types into the unified set:
//   pr_opened, pr_merged, pr_closed, pr_updated, pr_reviewed, push
func mapEventType(repoType, rawEventType string, payload map[string]interface{}) string {
	switch repoType {
	case "gitlab":
		return mapGitLabEventType(payload)
	case "github":
		return mapGitHubEventType(payload)
	case "gerrit":
		return mapGerritEventType(payload)
	default:
		return ""
	}
}

func mapGitLabEventType(payload map[string]interface{}) string {
	kind, _ := payload["object_kind"].(string)
	switch kind {
	case "merge_request":
		attrs, _ := payload["object_attributes"].(map[string]interface{})
		action, _ := attrs["action"].(string)
		state, _ := attrs["state"].(string)
		switch action {
		case "open":
			return "pr_opened"
		case "merge":
			return "pr_merged"
		case "close":
			return "pr_closed"
		case "update":
			return "pr_updated"
		default:
			switch state {
			case "opened":
				return "pr_opened"
			case "merged":
				return "pr_merged"
			case "closed":
				return "pr_closed"
			default:
				return "pr_updated"
			}
		}
	case "push":
		return "push"
	case "note":
		return "pr_reviewed"
	}
	return ""
}

func mapGitHubEventType(payload map[string]interface{}) string {
	action, _ := payload["action"].(string)
	switch action {
	case "opened":
		return "pr_opened"
	case "edited", "synchronize":
		return "pr_updated"
	case "closed":
		pr, _ := payload["pull_request"].(map[string]interface{})
		if merged, _ := pr["merged"].(bool); merged {
			return "pr_merged"
		}
		return "pr_closed"
	case "review_requested", "review_submitted":
		return "pr_reviewed"
	}
	return ""
}

func mapGerritEventType(payload map[string]interface{}) string {
	t, _ := payload["type"].(string)
	if t == "" {
		t, _ = payload["eventType"].(string)
	}
	switch t {
	case "change-merged":
		return "pr_merged"
	case "change-abandoned":
		return "pr_closed"
	case "change-restored", "change-created":
		return "pr_opened"
	case "comment-added":
		return "pr_reviewed"
	case "ref-updated":
		return "push"
	case "patchset-created":
		return "pr_updated"
	}
	return ""
}

// getHeader does a case-insensitive header lookup.
func getHeader(headers map[string]string, key string) (string, bool) {
	lower := strings.ToLower(key)
	for k, v := range headers {
		if strings.ToLower(k) == lower {
			return v, true
		}
	}
	return "", false
}

// ==================== Branch pattern matching (ported from Node.js matchesPattern) ====================

// matchesGlobPattern performs glob-style branch name matching.
//   * matches any characters except /
//   ** matches any characters including /
//   ? matches a single character except /
func matchesGlobPattern(branchName, pattern string) bool {
	if branchName == pattern {
		return true
	}

	var regexStr strings.Builder
	i := 0
	for i < len(pattern) {
		ch := pattern[i]
		if ch == '*' && i+1 < len(pattern) && pattern[i+1] == '*' {
			regexStr.WriteString(".*")
			i += 2
			if i < len(pattern) && pattern[i] == '/' {
				i++
			}
		} else if ch == '*' {
			regexStr.WriteString("[^/]*")
			i++
		} else if ch == '?' {
			regexStr.WriteString("[^/]")
			i++
		} else {
			// Escape regex metacharacters.
			if strings.ContainsRune(".+^${}()|[]\\", rune(ch)) {
				regexStr.WriteByte('\\')
			}
			regexStr.WriteByte(ch)
			i++
		}
	}

	re, err := regexp.Compile("^" + regexStr.String() + "$")
	if err != nil {
		return false
	}
	return re.MatchString(branchName)
}

// sortByPatternLength sorts policies in-place by descending branch pattern length.
func sortByPatternLength(policies []models.BranchPolicy) {
	for i := 1; i < len(policies); i++ {
		for j := i; j > 0 && len(policies[j].BranchPattern) > len(policies[j-1].BranchPattern); j-- {
			policies[j], policies[j-1] = policies[j-1], policies[j]
		}
	}
}

// ==================== Mergeability helpers ====================

// checkApprovals validates approval requirements from the policy.
func checkApprovals(policy *models.BranchPolicy, approvals map[string]int, author string) []models.MergeCheckBlock {
	if approvals == nil {
		approvals = map[string]int{}
	}

	blocks := []models.MergeCheckBlock{}

	var rules []models.ApprovalRule
	if err := json.Unmarshal([]byte(marshalJSON(policy.ApprovalRules)), &rules); err != nil {
		return blocks
	}

	for _, rule := range rules {
		matchedApprovals := 0
		for _, approver := range rule.Approvers {
			if count, ok := approvals[approver]; ok {
				matchedApprovals += count
			}
		}

		// If no specific approvers matched, use total.
		if matchedApprovals == 0 {
			for _, count := range approvals {
				matchedApprovals += count
			}
		}

		// Subtract author's own approval if not allowed.
		if !rule.AllowAuthorApproval {
			if count, ok := approvals[author]; ok && count > 0 {
				matchedApprovals -= count
			}
		}

		if matchedApprovals < rule.RequiredApprovals {
			blocks = append(blocks, models.MergeCheckBlock{
				Rule:     fmt.Sprintf("approval-%s", rule.Name),
				Reason:   fmt.Sprintf("requires %d approvals from %s, got %d", rule.RequiredApprovals, rule.Name, matchedApprovals),
				Severity: "error",
			})
		}
	}
	return blocks
}

// checkRequiredChecks validates that all required CI/CD checks have passed.
func checkRequiredChecks(policy *models.BranchPolicy, checkResults map[string]string) []models.MergeCheckBlock {
	blocks := []models.MergeCheckBlock{}

	var checks []string
	if err := json.Unmarshal([]byte(marshalJSON(policy.RequiredChecks)), &checks); err != nil {
		return blocks
	}

	for _, checkName := range checks {
		result, ok := checkResults[checkName]
		if !ok {
			blocks = append(blocks, models.MergeCheckBlock{
				Rule:     fmt.Sprintf("check-%s", checkName),
				Reason:   fmt.Sprintf("required check %q has not been triggered", checkName),
				Severity: "error",
			})
		} else if result == "pending" {
			blocks = append(blocks, models.MergeCheckBlock{
				Rule:     fmt.Sprintf("check-%s", checkName),
				Reason:   fmt.Sprintf("required check %q is still running", checkName),
				Severity: "warning",
			})
		} else if result == "failure" {
			blocks = append(blocks, models.MergeCheckBlock{
				Rule:     fmt.Sprintf("check-%s", checkName),
				Reason:   fmt.Sprintf("required check %q failed", checkName),
				Severity: "error",
			})
		}
	}
	return blocks
}

func hasErrorBlocks(blocks []models.MergeCheckBlock) bool {
	for _, b := range blocks {
		if b.Severity == "error" {
			return true
		}
	}
	return false
}

func filterErrorBlocks(blocks []models.MergeCheckBlock) []models.MergeCheckBlock {
	result := []models.MergeCheckBlock{}
	for _, b := range blocks {
		if b.Severity == "error" {
			result = append(result, b)
		}
	}
	return result
}

func filterBlocksBySeverity(blocks []models.MergeCheckBlock, severity string) []models.MergeCheckBlock {
	result := []models.MergeCheckBlock{}
	for _, b := range blocks {
		if b.Severity == severity {
			result = append(result, b)
		}
	}
	return result
}

// ==================== CODEOWNERS parsing (ported from Node.js parseCodeOwnersContent) ====================

// parseCodeOwnersContent parses a CODEOWNERS file and returns ownership rules and errors.
func parseCodeOwnersContent(rawContent string) ([]models.OwnershipRule, []string) {
	rules := []models.OwnershipRule{}
	errs := []string{}

	lines := strings.Split(rawContent, "\n")
	for lineNum, line := range lines {
		line = strings.TrimSpace(line)
		if line == "" || strings.HasPrefix(line, "#") {
			continue
		}

		// Strip inline comment.
		commentIdx := findCommentIndex(line)
		content := line
		if commentIdx >= 0 {
			content = strings.TrimSpace(line[:commentIdx])
		}
		if content == "" {
			continue
		}

		parts := strings.Fields(content)
		if len(parts) < 2 {
			continue
		}

		pattern := parts[0]
		owners := []string{}
		for _, p := range parts[1:] {
			if strings.HasPrefix(p, "@") {
				owners = append(owners, strings.TrimPrefix(p, "@"))
			}
		}
		if len(owners) == 0 {
			continue
		}

		// Validate pattern.
		if valid, msg := validatePattern(pattern); !valid {
			errs = append(errs, fmt.Sprintf("line %d: invalid pattern %q: %s", lineNum+1, pattern, msg))
			continue
		}

		rules = append(rules, models.OwnershipRule{
			Pattern: pattern,
			Owners:  owners,
			Line:    lineNum + 1,
		})
	}
	return rules, errs
}

// matchFileToRules returns all rules whose pattern matches the given file path.
func matchFileToRules(filePath string, rules []models.OwnershipRule) []models.OwnershipRule {
	matched := []models.OwnershipRule{}
	for _, rule := range rules {
		if matchFilePattern(rule.Pattern, filePath) {
			matched = append(matched, rule)
		}
	}
	return matched
}

// matchFilePattern checks whether a CODEOWNERS pattern matches a file path.
func matchFilePattern(pattern, filePath string) bool {
	// Directory-only pattern (ends with /).
	if strings.HasSuffix(pattern, "/") {
		dirPath := strings.TrimSuffix(pattern, "/")
		if strings.HasPrefix(pattern, "/") {
			normalized := strings.TrimPrefix(dirPath, "/")
			return filePath == normalized || strings.HasPrefix(filePath, normalized+"/")
		}
		return strings.Contains(filePath, dirPath)
	}

	re := patternToRegex(pattern)
	return re.MatchString(filePath)
}

// patternToRegex converts a CODEOWNERS glob pattern to a regexp.
func patternToRegex(pattern string) *regexp.Regexp {
	regexStr := pattern
	if strings.HasPrefix(pattern, "/") {
		regexStr = "^" + pattern[1:]
	} else if strings.Contains(pattern, "/") {
		regexStr = "^" + pattern
	} else {
		regexStr = "(^|/)" + pattern + "$"
	}

	// Replace glob wildcards.
	regexStr = strings.ReplaceAll(regexStr, "**", "__DOUBLESTAR__")
	regexStr = strings.ReplaceAll(regexStr, "*", "[^/]*")
	regexStr = strings.ReplaceAll(regexStr, "__DOUBLESTAR__", ".*")

	re, err := regexp.Compile(regexStr)
	if err != nil {
		return regexp.MustCompile("^$") // never matches
	}
	return re
}

// validatePattern checks whether a CODEOWNERS pattern is syntactically valid.
func validatePattern(pattern string) (bool, string) {
	if pattern == "" {
		return false, "empty pattern"
	}
	if strings.ContainsAny(pattern, "<>|") {
		return false, "contains invalid characters"
	}
	if strings.Contains(pattern, "***") {
		return false, "invalid wildcard ***"
	}
	return true, ""
}

// findCommentIndex returns the index of the first unquoted '#' in the line, or -1.
func findCommentIndex(line string) int {
	inQuotes := false
	var quoteChar byte
	for i := 0; i < len(line); i++ {
		ch := line[i]
		if !inQuotes && (ch == '"' || ch == '\'') {
			inQuotes = true
			quoteChar = ch
		} else if inQuotes && ch == quoteChar {
			inQuotes = false
		} else if !inQuotes && ch == '#' {
			return i
		}
	}
	return -1
}

// ==================== Utility helpers ====================

func boolPtr(b *bool, defaultVal bool) bool {
	if b != nil {
		return *b
	}
	return defaultVal
}

func defaultStr(s, def string) string {
	if s != "" {
		return s
	}
	return def
}

// marshalJSON is a safe JSON marshal helper that returns "{}" on error.
func marshalJSON(v interface{}) string {
	b, err := json.Marshal(v)
	if err != nil {
		return "{}"
	}
	return string(b)
}
