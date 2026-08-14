package handler

import (
	"bytes"
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"orion/platform-svc-go/internal/incident/models"
	"orion/platform-svc-go/internal/incident/service"

	"github.com/gin-gonic/gin"
)

type fakeIncidentService struct {
	createCalled bool
	deleteCalled bool
	draftCalled  bool
}

func (f *fakeIncidentService) Create(ctx context.Context, tenantID string, req models.CreateIncidentRequest) (*models.Incident, error) {
	f.createCalled = true
	return &models.Incident{ID: "inc-1", Title: req.Title}, nil
}
func (f *fakeIncidentService) Get(ctx context.Context, tenantID string, id string) (*models.Incident, error) {
	return &models.Incident{ID: id}, nil
}
func (f *fakeIncidentService) List(ctx context.Context, tenantID string, q models.IncidentListQuery) (*models.IncidentListResult, error) {
	return &models.IncidentListResult{Incidents: []models.Incident{}, Total: 0}, nil
}
func (f *fakeIncidentService) Update(ctx context.Context, tenantID string, id string, req models.UpdateIncidentRequest) (*models.Incident, error) {
	return &models.Incident{ID: id}, nil
}
func (f *fakeIncidentService) Delete(ctx context.Context, tenantID string, id string) error {
	f.deleteCalled = true
	return nil
}
func (f *fakeIncidentService) GetStats(ctx context.Context, tenantID string) (*models.IncidentStats, error) {
	return &models.IncidentStats{}, nil
}
func (f *fakeIncidentService) UpdateStatus(ctx context.Context, tenantID string, id string, newStatus string, actorID string, reason string) (*models.Incident, error) {
	return &models.Incident{ID: id}, nil
}
func (f *fakeIncidentService) AssignCommander(ctx context.Context, tenantID string, id string, commanderID string) (*models.Incident, error) {
	return &models.Incident{ID: id}, nil
}
func (f *fakeIncidentService) Escalate(ctx context.Context, tenantID string, incidentID string, req models.EscalateRequest) error {
	return nil
}
func (f *fakeIncidentService) GetEscalations(ctx context.Context, tenantID string, incidentID string) ([]models.EscalationRecord, error) {
	return []models.EscalationRecord{}, nil
}
func (f *fakeIncidentService) CheckSlaBreach(ctx context.Context, tenantID string, incidentID string) (*models.SlaCheckResult, error) {
	return &models.SlaCheckResult{}, nil
}
func (f *fakeIncidentService) MarkSlaBreach(ctx context.Context, tenantID string, incidentID string) (*models.Incident, error) {
	return &models.Incident{ID: incidentID}, nil
}
func (f *fakeIncidentService) AddTimelineEvent(ctx context.Context, tenantID string, incidentID string, req models.AddTimelineEventRequest) (*models.TimelineEvent, error) {
	return &models.TimelineEvent{}, nil
}
func (f *fakeIncidentService) GetTimeline(ctx context.Context, tenantID string, incidentID string, q models.TimelineQuery) ([]models.TimelineEvent, error) {
	return []models.TimelineEvent{}, nil
}
func (f *fakeIncidentService) CreatePostmortem(ctx context.Context, tenantID string, incidentID string, req models.CreatePostmortemRequest) (*models.PostmortemRecord, error) {
	return &models.PostmortemRecord{ID: "pm-1"}, nil
}
func (f *fakeIncidentService) GetPostmortem(ctx context.Context, tenantID string, incidentID string) (*models.PostmortemRecord, error) {
	return &models.PostmortemRecord{ID: incidentID}, nil
}
func (f *fakeIncidentService) GeneratePostmortemDraft(ctx context.Context, tenantID string, incidentID string) (*models.PostmortemDraft, error) {
	f.draftCalled = true
	return &models.PostmortemDraft{IncidentID: incidentID, Title: "Draft", Summary: "auto-generated"}, nil
}
func (f *fakeIncidentService) UpdatePostmortem(ctx context.Context, tenantID string, incidentID string, req models.UpdatePostmortemRequest) (*models.PostmortemRecord, error) {
	return &models.PostmortemRecord{ID: incidentID}, nil
}
func (f *fakeIncidentService) PublishPostmortem(ctx context.Context, tenantID string, incidentID string, reviewedBy *string) (*models.PostmortemRecord, error) {
	return &models.PostmortemRecord{ID: incidentID}, nil
}
func (f *fakeIncidentService) ArchivePostmortem(ctx context.Context, tenantID string, incidentID string) (*models.PostmortemRecord, error) {
	return &models.PostmortemRecord{ID: incidentID}, nil
}
func (f *fakeIncidentService) GetKnowledgeRecommendations(ctx context.Context, tenantID string, incidentID string, limit int) (*models.KnowledgeRecommendationResult, error) {
	return &models.KnowledgeRecommendationResult{}, nil
}

var _ service.ServiceInterface = (*fakeIncidentService)(nil)

func newHandler() *Handler {
	return NewHandler(&service.Service{})
}

func makeCtxInc(method string, path string, body interface{}, params map[string]string) (*gin.Context, *httptest.ResponseRecorder) {
	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	c.Set("tenant_id", "tenant-1")
	buf := new(bytes.Buffer)
	if body != nil {
		json.NewEncoder(buf).Encode(body)
	}
	c.Request = httptest.NewRequest(method, path, buf)
	if params != nil {
		c.Params = gin.Params{}
		for k, v := range params {
			c.Params = append(c.Params, gin.Param{Key: k, Value: v})
		}
	}
	return c, w
}

func TestHandler_INCIDENT_RegisterRoutes(t *testing.T) {
	newHandler().RegisterRoutes(gin.New().Group("/api/v1"))
}

func TestHandler_INCIDENT_Create(t *testing.T) {
	fake := &fakeIncidentService{}
	h := NewHandler(fake)
	c, w := makeCtxInc(http.MethodPost, "/api/v1/incidents", models.CreateIncidentRequest{
		Title: "Test incident", Type: "outage", Severity: "high",
	}, nil)
	h.Create(c)
	if w.Code != http.StatusCreated && w.Code != http.StatusOK {
		t.Fatalf("Create: got %d", w.Code)
	}
	if !fake.createCalled {
		t.Fatal("Create service not called")
	}
}

func TestHandler_INCIDENT_Get(t *testing.T) {
	fake := &fakeIncidentService{}
	h := NewHandler(fake)
	c, w := makeCtxInc(http.MethodGet, "/api/v1/incidents/inc-1", nil, map[string]string{"id": "inc-1"})
	h.Get(c)
	if w.Code != http.StatusOK {
		t.Fatalf("Get: got %d", w.Code)
	}
}

func TestHandler_INCIDENT_List(t *testing.T) {
	fake := &fakeIncidentService{}
	h := NewHandler(fake)
	c, w := makeCtxInc(http.MethodGet, "/api/v1/incidents", nil, nil)
	h.List(c)
	if w.Code != http.StatusOK {
		t.Fatalf("List: got %d", w.Code)
	}
}

func TestHandler_INCIDENT_Update(t *testing.T) {
	fake := &fakeIncidentService{}
	h := NewHandler(fake)
	c, w := makeCtxInc(http.MethodPut, "/api/v1/incidents/inc-1", models.UpdateIncidentRequest{
		Title: strPtrInc("Updated"),
	}, map[string]string{"id": "inc-1"})
	h.Update(c)
	if w.Code != http.StatusOK {
		t.Fatalf("Update: got %d", w.Code)
	}
}

func TestHandler_INCIDENT_Delete(t *testing.T) {
	fake := &fakeIncidentService{}
	h := NewHandler(fake)
	c, w := makeCtxInc(http.MethodDelete, "/api/v1/incidents/inc-1", nil, map[string]string{"id": "inc-1"})
	h.Delete(c)
	if w.Code != http.StatusOK {
		t.Fatalf("Delete: got %d", w.Code)
	}
	if !fake.deleteCalled {
		t.Fatal("Delete service not called")
	}
}

func TestHandler_INCIDENT_GetStats(t *testing.T) {
	fake := &fakeIncidentService{}
	h := NewHandler(fake)
	c, w := makeCtxInc(http.MethodGet, "/api/v1/incidents/stats", nil, nil)
	h.GetStats(c)
	if w.Code != http.StatusOK {
		t.Fatalf("GetStats: got %d", w.Code)
	}
}

func TestHandler_INCIDENT_UpdateStatus(t *testing.T) {
	fake := &fakeIncidentService{}
	h := NewHandler(fake)
	c, w := makeCtxInc(http.MethodPatch, "/api/v1/incidents/inc-1/status", models.UpdateStatusRequest{Status: "mitigated"}, map[string]string{"id": "inc-1"})
	h.UpdateStatus(c)
	if w.Code != http.StatusOK {
		t.Fatalf("UpdateStatus: got %d", w.Code)
	}
}

func TestHandler_INCIDENT_AssignCommander(t *testing.T) {
	fake := &fakeIncidentService{}
	h := NewHandler(fake)
	c, w := makeCtxInc(http.MethodPatch, "/api/v1/incidents/inc-1/assign", models.AssignCommanderRequest{CommanderID: "u1"}, map[string]string{"id": "inc-1"})
	h.AssignCommander(c)
	if w.Code != http.StatusOK {
		t.Fatalf("AssignCommander: got %d", w.Code)
	}
}

func TestHandler_INCIDENT_Escalate(t *testing.T) {
	fake := &fakeIncidentService{}
	h := NewHandler(fake)
	c, w := makeCtxInc(http.MethodPost, "/api/v1/incidents/inc-1/escalate", models.EscalateRequest{ToLevel: 2, Reason: "need help", EscalatedBy: "u1"}, map[string]string{"id": "inc-1"})
	h.Escalate(c)
	if w.Code != http.StatusOK {
		t.Fatalf("Escalate: got %d", w.Code)
	}
}

func TestHandler_INCIDENT_GetEscalations(t *testing.T) {
	fake := &fakeIncidentService{}
	h := NewHandler(fake)
	c, w := makeCtxInc(http.MethodGet, "/api/v1/incidents/inc-1/escalations", nil, map[string]string{"id": "inc-1"})
	h.GetEscalations(c)
	if w.Code != http.StatusOK {
		t.Fatalf("GetEscalations: got %d", w.Code)
	}
}

func TestHandler_INCIDENT_CheckSla(t *testing.T) {
	fake := &fakeIncidentService{}
	h := NewHandler(fake)
	c, w := makeCtxInc(http.MethodGet, "/api/v1/incidents/inc-1/sla", nil, map[string]string{"id": "inc-1"})
	h.CheckSla(c)
	if w.Code != http.StatusOK {
		t.Fatalf("CheckSla: got %d", w.Code)
	}
}

func TestHandler_INCIDENT_MarkSlaBreach(t *testing.T) {
	fake := &fakeIncidentService{}
	h := NewHandler(fake)
	c, w := makeCtxInc(http.MethodPost, "/api/v1/incidents/inc-1/sla/breach", nil, map[string]string{"id": "inc-1"})
	h.MarkSlaBreach(c)
	if w.Code != http.StatusOK {
		t.Fatalf("MarkSlaBreach: got %d", w.Code)
	}
}

func TestHandler_INCIDENT_AddTimelineEvent(t *testing.T) {
	fake := &fakeIncidentService{}
	h := NewHandler(fake)
	c, w := makeCtxInc(http.MethodPost, "/api/v1/incidents/inc-1/timeline", models.AddTimelineEventRequest{EventType: "update", Content: "test"}, map[string]string{"id": "inc-1"})
	h.AddTimelineEvent(c)
	if w.Code != http.StatusOK && w.Code != http.StatusCreated {
		t.Fatalf("AddTimelineEvent: got %d", w.Code)
	}
}

func TestHandler_INCIDENT_GetTimeline(t *testing.T) {
	fake := &fakeIncidentService{}
	h := NewHandler(fake)
	c, w := makeCtxInc(http.MethodGet, "/api/v1/incidents/inc-1/timeline", nil, map[string]string{"id": "inc-1"})
	h.GetTimeline(c)
	if w.Code != http.StatusOK {
		t.Fatalf("GetTimeline: got %d", w.Code)
	}
}

func TestHandler_INCIDENT_CreatePostmortem(t *testing.T) {
	fake := &fakeIncidentService{}
	h := NewHandler(fake)
	c, w := makeCtxInc(http.MethodPost, "/api/v1/incidents/inc-1/postmortem", models.CreatePostmortemRequest{Summary: "test", RootCause: "outage"}, map[string]string{"id": "inc-1"})
	h.CreatePostmortem(c)
	if w.Code != http.StatusOK && w.Code != http.StatusCreated {
		t.Fatalf("CreatePostmortem: got %d", w.Code)
	}
}

func TestHandler_INCIDENT_GetPostmortem(t *testing.T) {
	fake := &fakeIncidentService{}
	h := NewHandler(fake)
	c, w := makeCtxInc(http.MethodGet, "/api/v1/incidents/inc-1/postmortem", nil, map[string]string{"id": "inc-1"})
	h.GetPostmortem(c)
	if w.Code != http.StatusOK {
		t.Fatalf("GetPostmortem: got %d", w.Code)
	}
}

func TestHandler_INCIDENT_GeneratePostmortemDraft(t *testing.T) {
	fake := &fakeIncidentService{}
	h := NewHandler(fake)
	c, w := makeCtxInc(http.MethodGet, "/api/v1/incidents/inc-1/postmortem/draft", nil, map[string]string{"id": "inc-1"})
	h.GeneratePostmortemDraft(c)
	if w.Code != http.StatusOK {
		t.Fatalf("GeneratePostmortemDraft: got %d", w.Code)
	}
	if !fake.draftCalled {
		t.Fatal("GeneratePostmortemDraft service not called")
	}
}

func TestHandler_INCIDENT_UpdatePostmortem(t *testing.T) {
	fake := &fakeIncidentService{}
	h := NewHandler(fake)
	c, w := makeCtxInc(http.MethodPut, "/api/v1/incidents/inc-1/postmortem", models.UpdatePostmortemRequest{Title: strPtrInc("Updated PM")}, map[string]string{"id": "inc-1"})
	h.UpdatePostmortem(c)
	if w.Code != http.StatusOK {
		t.Fatalf("UpdatePostmortem: got %d", w.Code)
	}
}

func TestHandler_INCIDENT_PublishPostmortem(t *testing.T) {
	fake := &fakeIncidentService{}
	h := NewHandler(fake)
	c, w := makeCtxInc(http.MethodPost, "/api/v1/incidents/inc-1/postmortem/publish", nil, map[string]string{"id": "inc-1"})
	h.PublishPostmortem(c)
	if w.Code != http.StatusOK {
		t.Fatalf("PublishPostmortem: got %d", w.Code)
	}
}

func TestHandler_INCIDENT_ArchivePostmortem(t *testing.T) {
	fake := &fakeIncidentService{}
	h := NewHandler(fake)
	c, w := makeCtxInc(http.MethodPost, "/api/v1/incidents/inc-1/postmortem/archive", nil, map[string]string{"id": "inc-1"})
	h.ArchivePostmortem(c)
	if w.Code != http.StatusOK {
		t.Fatalf("ArchivePostmortem: got %d", w.Code)
	}
}

func TestHandler_INCIDENT_GetKnowledgeRecommendations(t *testing.T) {
	fake := &fakeIncidentService{}
	h := NewHandler(fake)
	c, w := makeCtxInc(http.MethodGet, "/api/v1/incidents/inc-1/knowledge", nil, map[string]string{"id": "inc-1"})
	h.GetKnowledgeRecommendations(c)
	if w.Code != http.StatusOK {
		t.Fatalf("GetKnowledgeRecommendations: got %d", w.Code)
	}
}

func strPtrInc(s string) *string { return &s }
