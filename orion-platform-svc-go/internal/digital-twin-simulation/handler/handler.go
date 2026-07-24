package handler

import (
	"context"

	"orion/go-common/pkg/auth"
	"orion/platform-svc-go/internal/digital-twin-simulation/models"
	dt_service "orion/platform-svc-go/internal/digital-twin-simulation/service"

	"github.com/gin-gonic/gin"
	"orion/platform-svc-go/internal/middleware"
	"go.opentelemetry.io/otel"
)

// Service defines the contract the handler needs from the service layer.
type Service interface {
	CreateTwin(ctx context.Context, tenantID string, req models.CreateTwinRequest) (*models.DigitalTwin, error)
	ListTwins(ctx context.Context, tenantID string, q models.ListQuery) ([]models.DigitalTwin, int64, error)
	GetTwin(ctx context.Context, tenantID, id string) (*models.DigitalTwin, error)
	UpdateTwin(ctx context.Context, tenantID, id string, req models.UpdateTwinRequest) (*models.DigitalTwin, error)
	DeleteTwin(ctx context.Context, tenantID, id string) error
	SyncTwin(ctx context.Context, tenantID, id string) (*models.DigitalTwin, error)
	GetState(ctx context.Context, twinID string) (*dt_service.TwinStateResponse, error)
	Simulate(ctx context.Context, tenantID, twinID string, req models.SimulateRequest) (*models.Simulation, error)
	ListSimulations(ctx context.Context, twinID string, q models.ListQuery) ([]models.Simulation, int64, error)
	GetComparison(ctx context.Context, twinID string) (*dt_service.TwinComparison, error)
	Predict(ctx context.Context, twinID string, req models.PredictRequest) (*dt_service.PredictionResult, error)
}

// Handler wires Gin routes to the Digital Twin simulation service.
type Handler struct {
	svc Service
}

// NewHandler constructs a handler.
func NewHandler(svc *dt_service.Service) *Handler {
	return &Handler{svc: svc}
}

// RegisterRoutes registers all digital-twin simulation endpoints.
// Mirrors the 12 routes from the TS source (digital-twin.routes.ts).
func (h *Handler) RegisterRoutes(rg *gin.RouterGroup) {
	dt := rg.Group("/digital-twin")

	// GET  /api/v1/digital-twin                — list twins
	dt.GET("", auth.RequirePermission("digital_twin", "read"), h.ListTwins)
	// POST /api/v1/digital-twin                — create twin
	dt.POST("", auth.RequirePermission("digital_twin", "write"), h.CreateTwin)
	// GET  /api/v1/digital-twin/:id            — get twin detail
	dt.GET("/:id", auth.RequirePermission("digital_twin", "read"), h.GetTwin)
	// PUT  /api/v1/digital-twin/:id            — update twin config
	dt.PUT("/:id", auth.RequirePermission("digital_twin", "write"), h.UpdateTwin)
	// DELETE /api/v1/digital-twin/:id          — delete twin
	dt.DELETE("/:id", auth.RequirePermission("digital_twin", "delete"), h.DeleteTwin)
	// POST /api/v1/digital-twin/:id/sync       — sync real environment state
	dt.POST("/:id/sync", auth.RequirePermission("digital_twin", "write"), h.SyncTwin)
	// GET  /api/v1/digital-twin/:id/state      — get twin state
	dt.GET("/:id/state", auth.RequirePermission("digital_twin", "read"), h.GetState)
	// POST /api/v1/digital-twin/:id/simulate   — run simulation
	dt.POST("/:id/simulate", auth.RequirePermission("digital_twin", "write"), h.Simulate)
	// GET  /api/v1/digital-twin/:id/simulations — simulation history
	dt.GET("/:id/simulations", auth.RequirePermission("digital_twin", "read"), h.ListSimulations)
	// GET  /api/v1/digital-twin/:id/comparison — real vs twin comparison
	dt.GET("/:id/comparison", auth.RequirePermission("digital_twin", "read"), h.GetComparison)
	// POST /api/v1/digital-twin/:id/predict    — run prediction analysis
	dt.POST("/:id/predict", auth.RequirePermission("digital_twin", "write"), h.Predict)
}

// --- CRUD ---

func (h *Handler) CreateTwin(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "CreateTwin")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	var req models.CreateTwinRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		middleware.RespondBadRequest(c, err.Error())
		return
	}
	twin, err := h.svc.CreateTwin(ctx, tenantID, req)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondCreated(c, twinToResponse(twin))
}

func (h *Handler) ListTwins(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "ListTwins")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	q := parseListQuery(c)
	items, total, err := h.svc.ListTwins(ctx, tenantID, q)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	data := make([]gin.H, len(items))
	for i, t := range items {
		data[i] = twinToResponse(&t)
	}
	middleware.RespondSuccess(c, gin.H{
		"data":  data,
		"total": total,
		"offset": q.Offset,
		"limit":  q.Limit,
	})
}

func (h *Handler) GetTwin(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "GetTwin")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	id := c.Param("id")
	twin, err := h.svc.GetTwin(ctx, tenantID, id)
	if err != nil {
		if dt_service.IsNotFound(err) {
			middleware.RespondNotFound(c, "digital twin not found")
			return
		}
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, twinToResponse(twin))
}

func (h *Handler) UpdateTwin(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "UpdateTwin")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	id := c.Param("id")
	var req models.UpdateTwinRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		middleware.RespondBadRequest(c, err.Error())
		return
	}
	twin, err := h.svc.UpdateTwin(ctx, tenantID, id, req)
	if err != nil {
		if dt_service.IsNotFound(err) {
			middleware.RespondNotFound(c, "digital twin not found")
			return
		}
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, twinToResponse(twin))
}

func (h *Handler) DeleteTwin(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "DeleteTwin")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	id := c.Param("id")
	err := h.svc.DeleteTwin(ctx, tenantID, id)
	if err != nil {
		if dt_service.IsNotFound(err) {
			middleware.RespondNotFound(c, "digital twin not found")
			return
		}
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, nil) // c)
}

// --- Sync ---

func (h *Handler) SyncTwin(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "SyncTwin")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	id := c.Param("id")
	twin, err := h.svc.SyncTwin(ctx, tenantID, id)
	if err != nil {
		if dt_service.IsNotFound(err) {
			middleware.RespondNotFound(c, "digital twin not found")
			return
		}
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, twinToResponse(twin))
}

// --- State ---

func (h *Handler) GetState(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "GetState")
	defer span.End()
	id := c.Param("id")
	state, err := h.svc.GetState(ctx, id)
	if err != nil {
		if dt_service.IsNotFound(err) {
			middleware.RespondNotFound(c, "twin state not found")
			return
		}
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, state)
}

// --- Simulate ---

func (h *Handler) Simulate(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "Simulate")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	id := c.Param("id")
	var req models.SimulateRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		middleware.RespondBadRequest(c, err.Error())
		return
	}
	sim, err := h.svc.Simulate(ctx, tenantID, id, req)
	if err != nil {
		if dt_service.IsNotFound(err) {
			middleware.RespondNotFound(c, "digital twin not found")
			return
		}
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondCreated(c, simulationToResponse(sim))
}

// --- Simulation History ---

func (h *Handler) ListSimulations(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "ListSimulations")
	defer span.End()
	id := c.Param("id")
	q := parseListQuery(c)
	sims, total, err := h.svc.ListSimulations(ctx, id, q)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	data := make([]gin.H, len(sims))
	for i, s := range sims {
		data[i] = simulationToResponse(&s)
	}
	middleware.RespondSuccess(c, gin.H{
		"data":  data,
		"total": total,
		"offset": q.Offset,
		"limit":  q.Limit,
	})
}

// --- Comparison ---

func (h *Handler) GetComparison(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "GetComparison")
	defer span.End()
	id := c.Param("id")
	comparison, err := h.svc.GetComparison(ctx, id)
	if err != nil {
		if dt_service.IsNotFound(err) {
			middleware.RespondNotFound(c, "twin state not found")
			return
		}
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, comparison)
}

// --- Predict ---

func (h *Handler) Predict(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "Predict")
	defer span.End()
	id := c.Param("id")
	var req models.PredictRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		middleware.RespondBadRequest(c, err.Error())
		return
	}
	prediction, err := h.svc.Predict(ctx, id, req)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, prediction)
}

// --- Helpers ---

func parseListQuery(c *gin.Context) models.ListQuery {
	var q models.ListQuery
	if err := c.ShouldBindQuery(&q); err != nil {
		q.Limit = 20
	}
	if q.Limit <= 0 {
		q.Limit = 20
	}
	if q.Offset < 0 {
		q.Offset = 0
	}
	if q.Sort == "" {
		q.Sort = "createdAt"
	}
	if q.Order == "" {
		q.Order = "desc"
	}
	return q
}

func twinToResponse(t *models.DigitalTwin) gin.H {
	return gin.H{
		"id":           t.ID,
		"name":         t.Name,
		"description":  t.Description,
		"entityType":   t.EntityType,
		"sourceId":     t.SourceID,
		"status":       t.Status,
		"config":       t.Config,
		"metadata":     t.Metadata,
		"syncPolicy":   t.SyncPolicy,
		"lastSyncTime": t.LastSyncTime,
		"syncHealth":   t.SyncHealth,
		"createdAt":    t.CreatedAt,
		"updatedAt":    t.UpdatedAt,
	}
}

func simulationToResponse(s *models.Simulation) gin.H {
	resp := gin.H{
		"id":          s.ID,
		"twinId":      s.TwinID,
		"type":        s.Type,
		"name":        s.Name,
		"description": s.Description,
		"parameters":  s.Parameters,
		"status":      s.Status,
		"startTime":   s.StartTime,
		"createdAt":   s.CreatedAt,
	}
	if s.EndTime != nil {
		resp["endTime"] = *s.EndTime
	}
	if s.Duration != nil {
		resp["duration"] = *s.Duration
	}
	if len(s.Results) > 0 {
		resp["results"] = s.Results
	}
	return resp
}
