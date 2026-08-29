package handler

import (
	"go.opentelemetry.io/otel"
	"orion/go-common/pkg/auth"
	"orion/platform-svc-go/internal/workflow/workflow/models"
	"orion/platform-svc-go/internal/workflow/workflow/service"
	"strconv"

	"github.com/gin-gonic/gin"
)

type Handler struct{ svc *service.Service }

func NewHandler(svc *service.Service) *Handler { return &Handler{svc: svc} }

func (h *Handler) RegisterRoutes(rg *gin.RouterGroup) {
	w := rg.Group("/workflows")
	w.POST("", auth.RequirePermission("workflow", "write"), h.Create)
	w.GET("", h.List)
	w.GET("/:id", h.Get)
	w.POST("/:id/runs", auth.RequirePermission("workflow", "execute"), h.StartRun)
	rg.GET("/runs/:id", h.GetRun)
	w.DELETE("/:id", auth.RequirePermission("workflow", "delete"), h.Delete)
	w.GET("/count", h.Count)
}

func (h *Handler) Create(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "WorkflowEngineCreate")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	userID := c.GetString("user_id")
	if userID == "" {
		userID = "system"
	}
	var req models.CreateDefinitionRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		respondBadRequest(c, err.Error())
		return
	}
	d, err := h.svc.CreateDefinition(ctx, tenantID, &req, userID)
	if err != nil {
		respondInternalError(c, err.Error())
		return
	}
	respondCreated(c, d)
}

func (h *Handler) List(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "WorkflowEngineList")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	ps, _ := strconv.Atoi(c.DefaultQuery("page_size", "20"))
	items, err := h.svc.ListDefinitions(ctx, tenantID, nil, (page-1)*ps, ps)
	if err != nil {
		respondInternalError(c, err.Error())
		return
	}
	respondSuccess(c, items)
}

func (h *Handler) Get(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "WorkflowEngineGet")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	d, err := h.svc.GetDefinitionByID(ctx, tenantID, c.Param("id"))
	if err != nil {
		respondNotFound(c, err.Error())
		return
	}
	respondSuccess(c, d)
}

func (h *Handler) StartRun(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "WorkflowEngineStartRun")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	var body struct {
		TriggeredBy  string                 `json:"triggeredBy"`
		InitialInput map[string]interface{} `json:"initialInput"`
	}
	c.ShouldBindJSON(&body)
	if body.TriggeredBy == "" {
		body.TriggeredBy = "system"
	}
	inst, err := h.svc.CreateInstance(ctx, tenantID, c.Param("id"), &models.CreateInstanceRequest{
		TriggeredBy:  body.TriggeredBy,
		InitialInput: body.InitialInput,
	})
	if err != nil {
		respondNotFound(c, err.Error())
		return
	}
	respondCreated(c, inst)
}

func (h *Handler) GetRun(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "WorkflowEngineGetRun")
	defer span.End()
	inst, err := h.svc.GetInstanceByID(ctx, c.Param("id"))
	if err != nil {
		respondNotFound(c, err.Error())
		return
	}
	respondSuccess(c, inst)
}

func (h *Handler) Delete(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "WorkflowEngineDelete")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	if err := h.svc.DeleteDefinition(ctx, tenantID, c.Param("id")); err != nil {
		respondNotFound(c, err.Error())
		return
	}
	respondSuccess(c, gin.H{"message": "deleted"})
}

func (h *Handler) Count(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "WorkflowEngineCount")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	items, err := h.svc.ListDefinitions(ctx, tenantID, nil, 0, 1000)
	if err != nil {
		respondInternalError(c, err.Error())
		return
	}
	respondSuccess(c, gin.H{"count": len(items)})
}
