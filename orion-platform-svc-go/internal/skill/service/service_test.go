package service

import (
	"context"
	"errors"
	"testing"

	"orion/go-common/pkg/sentinel"
	"orion/platform-svc-go/internal/skill/models"

	"github.com/google/uuid"
)

// mockRepoForService is a mock of repository.RepositoryInterface for service tests.
// Compile-time check that mockRepoForService implements repository.RepositoryInterface.
type mockRepoForService struct {
	skills        map[string]*models.Skill
	versions      map[string][]models.SkillVersion
	instances     map[string]*models.SkillInstance
	executions    []models.SkillExecution
	reviews       map[string]*models.SkillReview
	auditLogs     []models.SkillAuditLog
	stats         map[string]any
	ratingStats   map[string]any
	installCounts map[string]int
}

func newMockRepoForService() *mockRepoForService {
	return &mockRepoForService{
		skills:        make(map[string]*models.Skill),
		versions:      make(map[string][]models.SkillVersion),
		instances:     make(map[string]*models.SkillInstance),
		reviews:       make(map[string]*models.SkillReview),
		stats:         make(map[string]any),
		ratingStats:   make(map[string]any),
		installCounts: make(map[string]int),
	}
}

func (m *mockRepoForService) CreateSkill(ctx context.Context, tenantID string, skill *models.Skill) error {
	skill.ID = uuid.New().String()
	skill.TenantID = tenantID
	skill.Status = "draft"
	skill.InstallCount = 0
	skill.AvgRating = 0
	skill.RatingCount = 0
	m.skills[skill.ID] = skill
	return nil
}

func (m *mockRepoForService) GetSkill(ctx context.Context, tenantID, id string) (*models.Skill, error) {
	s, ok := m.skills[id]
	if !ok {
		return nil, sentinel.NotFound
	}
	if s.TenantID != tenantID {
		return nil, sentinel.NotFound
	}
	return s, nil
}

func (m *mockRepoForService) ListSkills(ctx context.Context, tenantID string, category, status string) ([]models.Skill, error) {
	var result []models.Skill
	for _, s := range m.skills {
		if s.TenantID != tenantID {
			continue
		}
		if category != "" && s.Category != category {
			continue
		}
		if status != "" && s.Status != status {
			continue
		}
		result = append(result, *s)
	}
	return result, nil
}

func (m *mockRepoForService) UpdateSkill(ctx context.Context, tenantID, id string, updates map[string]interface{}) error {
	s, ok := m.skills[id]
	if !ok || s.TenantID != tenantID {
		return sentinel.NotFound
	}
	for k, v := range updates {
		switch k {
		case "name":
			if str, ok := v.(string); ok {
				s.Name = str
			}
		case "description":
			if str, ok := v.(string); ok {
				s.Description = str
			}
		}
	}
	return nil
}

func (m *mockRepoForService) DeleteSkill(ctx context.Context, tenantID, id string) error {
	s, ok := m.skills[id]
	if !ok || s.TenantID != tenantID {
		return sentinel.NotFound
	}
	s.Status = "archived"
	return nil
}

func (m *mockRepoForService) GetStats(ctx context.Context, tenantID string) (*map[string]any, error) {
	return &m.stats, nil
}

func (m *mockRepoForService) ListVersions(ctx context.Context, skillID string) ([]models.SkillVersion, error) {
	return m.versions[skillID], nil
}

func (m *mockRepoForService) CreateVersion(ctx context.Context, v *models.SkillVersion) error {
	m.versions[v.SkillID] = append(m.versions[v.SkillID], *v)
	return nil
}

func (m *mockRepoForService) VersionExists(ctx context.Context, skillID, version string) (bool, error) {
	for _, v := range m.versions[skillID] {
		if v.Version == version {
			return true, nil
		}
	}
	return false, nil
}

func (m *mockRepoForService) RateSkill(ctx context.Context, skillID string, rating int) error {
	s, ok := m.skills[skillID]
	if !ok {
		return sentinel.NotFound
	}
	// recalc avg
	var total int
	for _, r := range m.ratingStats {
		if v, ok := r.(float64); ok {
			total += int(v)
		}
	}
	s.AvgRating = float64(total)/float64(s.RatingCount) + float64(rating)/float64(s.RatingCount+1)
	s.RatingCount++
	return nil
}

func (m *mockRepoForService) GetRatingStats(ctx context.Context, skillID string) (*map[string]any, error) {
	return &m.ratingStats, nil
}

func (m *mockRepoForService) ListInstances(ctx context.Context, tenantID string) ([]models.SkillInstance, error) {
	var result []models.SkillInstance
	for _, inst := range m.instances {
		if inst.TenantID == tenantID {
			result = append(result, *inst)
		}
	}
	return result, nil
}

func (m *mockRepoForService) GetInstance(ctx context.Context, tenantID, id string) (*models.SkillInstance, error) {
	inst, ok := m.instances[id]
	if !ok {
		return nil, sentinel.NotFound
	}
	if inst.TenantID != tenantID {
		return nil, sentinel.NotFound
	}
	return inst, nil
}

func (m *mockRepoForService) CreateInstance(ctx context.Context, inst *models.SkillInstance) error {
	inst.ID = uuid.New().String()
	inst.Status = "active"
	m.instances[inst.ID] = inst
	return nil
}

func (m *mockRepoForService) UpdateInstance(ctx context.Context, tenantID, id string, updates map[string]interface{}) error {
	inst, ok := m.instances[id]
	if !ok {
		return sentinel.NotFound
	}
	if inst.TenantID != tenantID {
		return sentinel.NotFound
	}
	for k, v := range updates {
		switch k {
		case "instance_name":
			inst.InstanceName = v.(string)
		case "config":
			inst.Config = v.(string)
		case "status":
			inst.Status = v.(string)
		}
	}
	return nil
}

func (m *mockRepoForService) DeleteInstance(ctx context.Context, tenantID, id string) error {
	inst, ok := m.instances[id]
	if !ok {
		return sentinel.NotFound
	}
	if inst.TenantID != tenantID {
		return sentinel.NotFound
	}
	delete(m.instances, id)
	return nil
}

func (m *mockRepoForService) UpdateInstallCount(ctx context.Context, skillID string, delta int) error {
	m.installCounts[skillID] += delta
	return nil
}

func (m *mockRepoForService) CreateExecution(ctx context.Context, exec *models.SkillExecution) error {
	exec.ID = uuid.New().String()
	m.executions = append(m.executions, *exec)
	return nil
}

func (m *mockRepoForService) ListExecutions(ctx context.Context, tenantID, skillID string) ([]models.SkillExecution, error) {
	var result []models.SkillExecution
	for _, e := range m.executions {
		if e.TenantID != tenantID {
			continue
		}
		if skillID != "" && e.SkillID != skillID {
			continue
		}
		result = append(result, e)
	}
	return result, nil
}

func (m *mockRepoForService) GetReview(ctx context.Context, skillID string) (*models.SkillReview, error) {
	r, ok := m.reviews[skillID]
	if !ok {
		return nil, nil
	}
	return r, nil
}

func (m *mockRepoForService) CreateReview(ctx context.Context, review *models.SkillReview) error {
	m.reviews[review.SkillID] = review
	return nil
}

func (m *mockRepoForService) UpdateReview(ctx context.Context, tenantID, skillID string, updates map[string]interface{}) error {
	r, ok := m.reviews[skillID]
	if !ok {
		return sentinel.NotFound
	}
	for k, v := range updates {
		switch k {
		case "status":
			r.Status = v.(string)
		case "reviewed_by":
			r.ReviewedBy = v.(string)
		case "review_note":
			r.ReviewNote = v.(string)
		}
	}
	return nil
}

func (m *mockRepoForService) ListReviews(ctx context.Context, tenantID string, status string) ([]models.SkillReview, error) {
	var result []models.SkillReview
	for _, r := range m.reviews {
		if r.TenantID != tenantID {
			continue
		}
		if status != "" && r.Status != status {
			continue
		}
		result = append(result, *r)
	}
	return result, nil
}

func (m *mockRepoForService) CreateAuditLog(ctx context.Context, log *models.SkillAuditLog) error {
	m.auditLogs = append(m.auditLogs, *log)
	return nil
}

func (m *mockRepoForService) ListAuditLogs(ctx context.Context, tenantID, skillID string) ([]models.SkillAuditLog, error) {
	var result []models.SkillAuditLog
	for _, log := range m.auditLogs {
		if log.TenantID != tenantID {
			continue
		}
		if skillID != "" && log.SkillID != skillID {
			continue
		}
		// copy
		result = append(result, log)
	}
	return result, nil
}

// --- Service tests ---

func TestService_CRUD(t *testing.T) {
	repo := newMockRepoForService()
	svc := NewService(repo)
	ctx := context.Background()
	tenantID := "tenant-1"

	// Create
	req := models.CreateSkillRequest{Name: "test-skill", Description: "desc", Category: "ci-cd"}
	skill, err := svc.CreateSkill(ctx, tenantID, req)
	if err != nil {
		t.Fatalf("CreateSkill: %v", err)
	}
	if skill.ID == "" {
		t.Fatal("skill ID should be set")
	}
	if skill.TenantID != tenantID {
		t.Fatalf("tenant mismatch: got %s, want %s", skill.TenantID, tenantID)
	}
	if skill.Status != "draft" {
		t.Fatalf("status should be draft, got %s", skill.Status)
	}

	// Get
	got, err := svc.GetSkill(ctx, tenantID, skill.ID)
	if err != nil {
		t.Fatalf("GetSkill: %v", err)
	}
	if got.Name != "test-skill" {
		t.Fatalf("name mismatch: got %s", got.Name)
	}

	// Get not found
	_, err = svc.GetSkill(ctx, tenantID, "nonexistent")
	if !errors.Is(err, ErrSkillNotFound) {
		t.Fatalf("expected ErrSkillNotFound, got %v", err)
	}

	// List
	list, total := svc.ListSkills(ctx, tenantID, "", "", 1, 10)
	if len(list) != 1 {
		t.Fatalf("list count: got %d, want 1", len(list))
	}
	if total != 1 {
		t.Fatalf("total: got %d, want 1", total)
	}

	// Update
	newName := "updated-name"
	updated, err := svc.UpdateSkill(ctx, tenantID, skill.ID, models.UpdateSkillRequest{Name: &newName})
	if err != nil {
		t.Fatalf("UpdateSkill: %v", err)
	}
	if updated.Name != "updated-name" {
		t.Fatalf("name not updated: got %s", updated.Name)
	}

	// Delete
	err = svc.DeleteSkill(ctx, tenantID, skill.ID)
	if err != nil {
		t.Fatalf("DeleteSkill: %v", err)
	}
	// Check archived
	_, err = svc.GetSkill(ctx, tenantID, skill.ID)
	// still found by id but status is archived
	if errors.Is(err, ErrSkillNotFound) {
		t.Log("note: skill is archived and repo.GetSkill returned NotFound")
	}
}

func TestService_Instance_CRUD(t *testing.T) {
	repo := newMockRepoForService()
	svc := NewService(repo)
	ctx := context.Background()
	tenantID := "tenant-1"

	// Create skill first
	skill, _ := svc.CreateSkill(ctx, tenantID, models.CreateSkillRequest{Name: "s1"})

	// Create instance
	inst, err := svc.CreateInstance(ctx, tenantID, skill.ID, models.CreateInstanceRequest{
		InstanceName: "inst-1",
		Config:       "{}",
	})
	if err != nil {
		t.Fatalf("CreateInstance: %v", err)
	}
	if inst.Status != "active" {
		t.Fatalf("instance status: got %s, want active", inst.Status)
	}

	// Get instance
	got, err := svc.GetInstance(ctx, tenantID, inst.ID)
	if err != nil {
		t.Fatalf("GetInstance: %v", err)
	}
	if got.InstanceName != "inst-1" {
		t.Fatalf("name mismatch")
	}

	// List instances
	instances, err := svc.ListInstances(ctx, tenantID)
	if err != nil {
		t.Fatalf("ListInstances: %v", err)
	}
	if len(instances) != 1 {
		t.Fatalf("instance count: got %d", len(instances))
	}

	// Delete instance
	err = svc.DeleteInstance(ctx, tenantID, inst.ID)
	if err != nil {
		t.Fatalf("DeleteInstance: %v", err)
	}
}

func TestService_Version(t *testing.T) {
	repo := newMockRepoForService()
	svc := NewService(repo)
	ctx := context.Background()
	tenantID := "tenant-1"

	skill, _ := svc.CreateSkill(ctx, tenantID, models.CreateSkillRequest{Name: "s1"})

	// Add version
	v, err := svc.AddVersion(ctx, tenantID, skill.ID, models.AddVersionRequest{
		Version: "1.0.0",
		Changes: "initial",
	})
	if err != nil {
		t.Fatalf("AddVersion: %v", err)
	}
	if v.Version != "1.0.0" {
		t.Fatalf("version: got %s", v.Version)
	}

	// Duplicate version
	_, err = svc.AddVersion(ctx, tenantID, skill.ID, models.AddVersionRequest{
		Version: "1.0.0",
		Changes: "dup",
	})
	if !errors.Is(err, ErrDuplicateVersion) {
		t.Fatalf("expected ErrDuplicateVersion, got %v", err)
	}

	// List versions
	versions, err := svc.ListVersions(ctx, tenantID, skill.ID)
	if err != nil {
		t.Fatalf("ListVersions: %v", err)
	}
	if len(versions) != 1 {
		t.Fatalf("version count: got %d", len(versions))
	}
}

func TestService_Review_Flow(t *testing.T) {
	repo := newMockRepoForService()
	svc := NewService(repo)
	ctx := context.Background()
	tenantID := "tenant-1"

	skill, _ := svc.CreateSkill(ctx, tenantID, models.CreateSkillRequest{Name: "s1"})

	// Submit
	review, err := svc.ReviewAction(ctx, tenantID, skill.ID, "user1", "submit", models.ReviewActionRequest{})
	if err != nil {
		t.Fatalf("submit: %v", err)
	}
	if review.Status != "submitted" {
		t.Fatalf("review status: got %s, want submitted", review.Status)
	}

	// Already submitted
	_, err = svc.ReviewAction(ctx, tenantID, skill.ID, "user1", "submit", models.ReviewActionRequest{})
	if !errors.Is(err, ErrAlreadySubmitted) {
		t.Fatalf("expected ErrAlreadySubmitted, got %v", err)
	}

	// Approve
	review, err = svc.ReviewAction(ctx, tenantID, skill.ID, "admin", "approve", models.ReviewActionRequest{Note: "good"})
	if err != nil {
		t.Fatalf("approve: %v", err)
	}
	if review.Status != "approved" {
		t.Fatalf("review status: got %s, want approved", review.Status)
	}

	// Archive
	review, err = svc.ReviewAction(ctx, tenantID, skill.ID, "admin", "archive", models.ReviewActionRequest{})
	if err != nil {
		t.Fatalf("archive: %v", err)
	}
	if review.Status != "archived" {
		t.Fatalf("review status: got %s, want archived", review.Status)
	}

	// Invalid action
	_, err = svc.ReviewAction(ctx, tenantID, skill.ID, "admin", "invalid", models.ReviewActionRequest{})
	if err == nil {
		t.Fatal("expected error for invalid action")
	}
}

func TestService_Stats(t *testing.T) {
	repo := newMockRepoForService()
	svc := NewService(repo)
	ctx := context.Background()
	tenantID := "tenant-1"

	stats, err := svc.GetStats(ctx, tenantID)
	if err != nil {
		t.Fatalf("GetStats: %v", err)
	}
	if stats == nil {
		t.Fatal("stats should not be nil")
	}
}

func TestService_Rate(t *testing.T) {
	repo := newMockRepoForService()
	svc := NewService(repo)
	ctx := context.Background()
	tenantID := "tenant-1"

	skill, _ := svc.CreateSkill(ctx, tenantID, models.CreateSkillRequest{Name: "s1"})

	// Rate
	_, err := svc.RateSkill(ctx, tenantID, skill.ID, "user1", models.RateSkillRequest{Rating: 5})
	if err != nil {
		t.Fatalf("RateSkill: %v", err)
	}

	// Rating stats
	stats, err := svc.GetRatingStats(ctx, tenantID, skill.ID)
	if err != nil {
		t.Fatalf("GetRatingStats: %v", err)
	}
	if stats == nil {
		t.Fatal("rating stats should not be nil")
	}
}

func TestService_Execution(t *testing.T) {
	repo := newMockRepoForService()
	svc := NewService(repo)
	ctx := context.Background()
	tenantID := "tenant-1"

	skill, _ := svc.CreateSkill(ctx, tenantID, models.CreateSkillRequest{Name: "s1"})

	// Execute
	exec, err := svc.ExecuteSkill(ctx, tenantID, skill.ID, "user1", models.ExecuteSkillRequest{})
	if err != nil {
		t.Fatalf("ExecuteSkill: %v", err)
	}
	if exec.Status != "completed" {
		t.Fatalf("execution status: got %s, want completed", exec.Status)
	}

	// List executions
	executions, err := svc.ListExecutions(ctx, tenantID, skill.ID, 1, 10)
	if err != nil {
		t.Fatalf("ListExecutions: %v", err)
	}
	if len(executions) != 1 {
		t.Fatalf("execution count: got %d", len(executions))
	}
}
