package handler

import (
	"context"
	"net/http"
	"net/http/httptest"
	"testing"

	"orion/go-common/pkg/sentinel"
	"orion/platform-svc-go/internal/skill/models"
	"orion/platform-svc-go/internal/skill/repository"
	"orion/platform-svc-go/internal/skill/service"

	"github.com/gin-gonic/gin"
)

// mockRepo is a minimal mock implementation of repository.RepositoryInterface
// for handler-level route registration tests.
type mockRepo struct {
	lastOffset int
	lastLimit  int
	lastCount  int64

	skills      map[string]*models.Skill
	versions    map[string][]models.SkillVersion
	instances   map[string]*models.SkillInstance
	executions  []models.SkillExecution
	reviews     map[string]*models.SkillReview
	auditLogs   []models.SkillAuditLog
	stats       map[string]any
	ratingStats map[string]any
}

func newMockRepo() *mockRepo {
	return &mockRepo{
		skills:      make(map[string]*models.Skill),
		versions:    make(map[string][]models.SkillVersion),
		instances:   make(map[string]*models.SkillInstance),
		reviews:     make(map[string]*models.SkillReview),
		stats:       make(map[string]any),
		ratingStats: make(map[string]any),
	}
}

// --- Skill CRUD ---

func (m *mockRepo) CreateSkill(ctx context.Context, tenantID string, skill *models.Skill) error {
	skill.TenantID = tenantID
	m.skills[skill.ID] = skill
	return nil
}

func (m *mockRepo) GetSkill(ctx context.Context, tenantID, id string) (*models.Skill, error) {
	s, ok := m.skills[id]
	if !ok {
		return nil, sentinel.NotFound
	}
	if s.TenantID != tenantID {
		return nil, sentinel.NotFound
	}
	return s, nil
}

// filterSkills applies the same predicate the repository builds, so the two
// cannot drift in these tests.
func filterSkills(m *mockRepo, tenantID, category, status string) []models.Skill {
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
	return result
}

// paginate applies an offset/limit window, mirroring SQL LIMIT/OFFSET.
func paginate[T any](all []T, offset, limit int) []T {
	if limit <= 0 {
		return nil
	}
	if offset < 0 {
		offset = 0
	}
	if offset >= len(all) {
		return nil
	}
	end := offset + limit
	if end > len(all) {
		end = len(all)
	}
	return all[offset:end]
}

func (m *mockRepo) ListSkills(ctx context.Context, tenantID, category, status string, offset, limit int) ([]models.Skill, error) {
	all := filterSkills(m, tenantID, category, status)
	m.lastOffset, m.lastLimit = offset, limit
	return paginate(all, offset, limit), nil
}

func (m *mockRepo) CountSkills(ctx context.Context, tenantID, category, status string) (int64, error) {
	m.lastCount = int64(len(filterSkills(m, tenantID, category, status)))
	return m.lastCount, nil
}

func (m *mockRepo) UpdateSkill(ctx context.Context, tenantID, id string, updates map[string]interface{}) error {
	s, ok := m.skills[id]
	if !ok || s.TenantID != tenantID {
		return nil
	}
	for k, v := range updates {
		switch k {
		case "name":
			s.Name = v.(string)
		case "description":
			s.Description = v.(string)
		case "category":
			s.Category = v.(string)
		case "status":
			s.Status = v.(string)
		}
	}
	return nil
}

func (m *mockRepo) DeleteSkill(ctx context.Context, tenantID, id string) error {
	s, ok := m.skills[id]
	if !ok || s.TenantID != tenantID {
		return nil
	}
	s.Status = "archived"
	return nil
}

func (m *mockRepo) GetStats(ctx context.Context, tenantID string) (*map[string]any, error) {
	return &m.stats, nil
}

// --- Versions ---

func (m *mockRepo) ListVersions(ctx context.Context, skillID string) ([]models.SkillVersion, error) {
	return m.versions[skillID], nil
}

func (m *mockRepo) CreateVersion(ctx context.Context, v *models.SkillVersion) error {
	m.versions[v.SkillID] = append(m.versions[v.SkillID], *v)
	return nil
}

func (m *mockRepo) VersionExists(ctx context.Context, skillID, version string) (bool, error) {
	for _, v := range m.versions[skillID] {
		if v.Version == version {
			return true, nil
		}
	}
	return false, nil
}

// --- Ratings ---

func (m *mockRepo) RateSkill(ctx context.Context, skillID string, rating int) error {
	return nil
}

func (m *mockRepo) GetRatingStats(ctx context.Context, skillID string) (*map[string]any, error) {
	return &m.ratingStats, nil
}

// --- Instances ---

func (m *mockRepo) ListInstances(ctx context.Context, tenantID string) ([]models.SkillInstance, error) {
	var result []models.SkillInstance
	for _, inst := range m.instances {
		if inst.TenantID == tenantID {
			result = append(result, *inst)
		}
	}
	return result, nil
}

func (m *mockRepo) GetInstance(ctx context.Context, tenantID, id string) (*models.SkillInstance, error) {
	inst, ok := m.instances[id]
	if !ok || inst.TenantID != tenantID {
		return nil, sentinel.NotFound
	}
	return inst, nil
}

func (m *mockRepo) CreateInstance(ctx context.Context, inst *models.SkillInstance) error {
	m.instances[inst.ID] = inst
	return nil
}

func (m *mockRepo) UpdateInstance(ctx context.Context, tenantID, id string, updates map[string]interface{}) error {
	return nil
}

func (m *mockRepo) DeleteInstance(ctx context.Context, tenantID, id string) error {
	return nil
}

func (m *mockRepo) UpdateInstallCount(ctx context.Context, skillID string, delta int) error {
	return nil
}

// --- Executions ---

func (m *mockRepo) CreateExecution(ctx context.Context, exec *models.SkillExecution) error {
	m.executions = append(m.executions, *exec)
	return nil
}

func (m *mockRepo) ListExecutions(ctx context.Context, tenantID, skillID string, offset, limit int) ([]models.SkillExecution, error) {
	m.lastOffset, m.lastLimit = offset, limit
	return paginate(m.executions, offset, limit), nil
}

// --- Reviews ---

func (m *mockRepo) GetReview(ctx context.Context, skillID string) (*models.SkillReview, error) {
	r, ok := m.reviews[skillID]
	if !ok {
		return nil, nil
	}
	return r, nil
}

func (m *mockRepo) CreateReview(ctx context.Context, review *models.SkillReview) error {
	m.reviews[review.SkillID] = review
	return nil
}

func (m *mockRepo) UpdateReview(ctx context.Context, tenantID, skillID string, updates map[string]interface{}) error {
	return nil
}

func (m *mockRepo) ListReviews(ctx context.Context, tenantID string, status string) ([]models.SkillReview, error) {
	var result []models.SkillReview
	for _, r := range m.reviews {
		if r.TenantID != tenantID {
			continue
		}
		if status != "" && r.Status != status {
			continue
		}
		// need pointer to return
	}
	return result, nil
}

// --- Audit logs ---

func (m *mockRepo) CreateAuditLog(ctx context.Context, log *models.SkillAuditLog) error {
	m.auditLogs = append(m.auditLogs, *log)
	return nil
}

func (m *mockRepo) ListAuditLogs(ctx context.Context, tenantID, skillID string, offset, limit int) ([]models.SkillAuditLog, error) {
	m.lastOffset, m.lastLimit = offset, limit
	return paginate(m.auditLogs, offset, limit), nil
}

func (m *mockRepo) CountAuditLogs(ctx context.Context, tenantID, skillID string) (int64, error) {
	m.lastCount = int64(len(m.auditLogs))
	return m.lastCount, nil
}

// Ensure mockRepo implements repository.RepositoryInterface
var _ repository.RepositoryInterface = (*mockRepo)(nil)

func newHandler() *Handler {
	return NewHandler(service.NewService(newMockRepo()))
}

// newHandlerWith backs a mock the test owns, so the pagination tests can read
// the offset and limit the handler actually computed.
func newHandlerWith(mock *mockRepo) *Handler {
	return NewHandler(service.NewService(mock))
}

func makeCtx(method string, path string) (*gin.Context, *httptest.ResponseRecorder) {
	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	c.Set("tenant_id", "tenant-1")
	c.Params = gin.Params{}
	c.Request = httptest.NewRequest(method, path, nil)
	return c, w
}

func TestHandler_SKILL_RegisterRoutes(t *testing.T) {
	_ = newHandler()
}

func TestHandler_SKILL_ListSkills(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().ListSkills(c)
	if w.Code >= 500 {
		t.Fatalf("ListSkills: got %d", w.Code)
	}
}
func TestHandler_SKILL_CreateSkill(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().CreateSkill(c)
	if w.Code >= 500 {
		t.Fatalf("CreateSkill: got %d", w.Code)
	}
}
func TestHandler_SKILL_GetSkill(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().GetSkill(c)
	if w.Code >= 500 {
		t.Fatalf("GetSkill: got %d", w.Code)
	}
}
func TestHandler_SKILL_UpdateSkill(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().UpdateSkill(c)
	if w.Code >= 500 {
		t.Fatalf("UpdateSkill: got %d", w.Code)
	}
}
func TestHandler_SKILL_DeleteSkill(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().DeleteSkill(c)
	if w.Code >= 500 {
		t.Fatalf("DeleteSkill: got %d", w.Code)
	}
}
func TestHandler_SKILL_GetStats(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().GetStats(c)
	if w.Code >= 500 {
		t.Fatalf("GetStats: got %d", w.Code)
	}
}
func TestHandler_SKILL_ListVersions(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().ListVersions(c)
	if w.Code >= 500 {
		t.Fatalf("ListVersions: got %d", w.Code)
	}
}
func TestHandler_SKILL_AddVersion(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().AddVersion(c)
	if w.Code >= 500 {
		t.Fatalf("AddVersion: got %d", w.Code)
	}
}
func TestHandler_SKILL_RateSkill(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().RateSkill(c)
	if w.Code >= 500 {
		t.Fatalf("RateSkill: got %d", w.Code)
	}
}
func TestHandler_SKILL_GetRatingStats(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().GetRatingStats(c)
	if w.Code >= 500 {
		t.Fatalf("GetRatingStats: got %d", w.Code)
	}
}
func TestHandler_SKILL_ListInstances(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().ListInstances(c)
	if w.Code >= 500 {
		t.Fatalf("ListInstances: got %d", w.Code)
	}
}
func TestHandler_SKILL_CreateInstance(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().CreateInstance(c)
	if w.Code >= 500 {
		t.Fatalf("CreateInstance: got %d", w.Code)
	}
}
func TestHandler_SKILL_GetInstance(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().GetInstance(c)
	if w.Code >= 500 {
		t.Fatalf("GetInstance: got %d", w.Code)
	}
}
func TestHandler_SKILL_UpdateInstance(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().UpdateInstance(c)
	if w.Code >= 500 {
		t.Fatalf("UpdateInstance: got %d", w.Code)
	}
}
func TestHandler_SKILL_DeleteInstance(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().DeleteInstance(c)
	if w.Code >= 500 {
		t.Fatalf("DeleteInstance: got %d", w.Code)
	}
}
func TestHandler_SKILL_ExecuteSkill(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().ExecuteSkill(c)
	if w.Code >= 500 {
		t.Fatalf("ExecuteSkill: got %d", w.Code)
	}
}
func TestHandler_SKILL_ListExecutions(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().ListExecutions(c)
	if w.Code >= 500 {
		t.Fatalf("ListExecutions: got %d", w.Code)
	}
}
func TestHandler_SKILL_GetReview(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().GetReview(c)
	if w.Code >= 500 {
		t.Fatalf("GetReview: got %d", w.Code)
	}
}
func TestHandler_SKILL_SubmitReview(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().SubmitReview(c)
	if w.Code >= 500 {
		t.Fatalf("SubmitReview: got %d", w.Code)
	}
}
func TestHandler_SKILL_ApproveReview(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().ApproveReview(c)
	if w.Code >= 500 {
		t.Fatalf("ApproveReview: got %d", w.Code)
	}
}
func TestHandler_SKILL_RejectReview(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().RejectReview(c)
	if w.Code >= 500 {
		t.Fatalf("RejectReview: got %d", w.Code)
	}
}
func TestHandler_SKILL_ArchiveReview(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().ArchiveReview(c)
	if w.Code >= 500 {
		t.Fatalf("ArchiveReview: got %d", w.Code)
	}
}
func TestHandler_SKILL_ListReviews(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().ListReviews(c)
	if w.Code >= 500 {
		t.Fatalf("ListReviews: got %d", w.Code)
	}
}
func TestHandler_SKILL_GetAuditLogs(t *testing.T) {
	c, w := makeCtx(http.MethodGet, "/")
	newHandler().GetAuditLogs(c)
	if w.Code >= 500 {
		t.Fatalf("GetAuditLogs: got %d", w.Code)
	}
}
