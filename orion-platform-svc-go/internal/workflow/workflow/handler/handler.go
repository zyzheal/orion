package handler

import (
	"strconv"
	"orion/platform-svc-go/internal/workflow/workflow/models"
	"orion/platform-svc-go/internal/workflow/workflow/service"
	"orion/go-common/pkg/auth"

	"github.com/gin-gonic/gin"
)

type Handler struct { svc *service.Service }
func NewHandler(svc *service.Service) *Handler { return &Handler{svc: svc} }

func (h *Handler) RegisterRoutes(rg *gin.RouterGroup) {
	w := rg.Group("/workflows")
	w.POST("", auth.RequirePermission("workflow", "write"), h.Create); w.GET("", h.List); w.GET("/:id", h.Get); w.POST("/:id/runs", auth.RequirePermission("workflow", "execute"), h.StartRun)
	rg.GET("/runs/:id", h.GetRun)
	w.DELETE("/:id", auth.RequirePermission("workflow", "delete"), h.Delete)
	w.GET("/count", h.Count)
}

func (h *Handler) Create(c *gin.Context) {
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
	d, err := h.svc.CreateDefinition(c.Request.Context(), tenantID, &req, userID)
	if err != nil {
		respondInternalError(c, err.Error())
		return
	}
	respondCreated(c, d)
}

func (h *Handler) List(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	ps, _ := strconv.Atoi(c.DefaultQuery("page_size", "20"))
	items, err := h.svc.ListDefinitions(c.Request.Context(), tenantID, nil, (page-1)*ps, ps)
	if err != nil {
		respondInternalError(c, err.Error())
		return
	}
	respondSuccess(c, items)
}

func (h *Handler) Get(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	d, err := h.svc.GetDefinitionByID(c.Request.Context(), tenantID, c.Param("id"))
	if err != nil {
		respondNotFound(c, err.Error())
		return
	}
	respondSuccess(c, d)
}

func (h *Handler) StartRun(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	var body struct {
		TriggeredBy  string                 `json:"triggeredBy"`
		InitialInput map[string]interface{} `json:"initialInput"`
	}
	c.ShouldBindJSON(&body)
	if body.TriggeredBy == "" {
		body.TriggeredBy = "system"
	}
	inst, err := h.svc.CreateInstance(c.Request.Context(), tenantID, c.Param("id"), &models.CreateInstanceRequest{
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
	inst, err := h.svc.GetInstanceByID(c.Request.Context(), c.Param("id"))
	if err != nil {
		respondNotFound(c, err.Error())
		return
	}
	respondSuccess(c, inst)
}

func (h *Handler) Delete(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	if err := h.svc.DeleteDefinition(c.Request.Context(), tenantID, c.Param("id")); err != nil {
		respondNotFound(c, err.Error())
		return
	}
	respondSuccess(c, gin.H{"message": "deleted"})
}

func (h *Handler) Count(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	items, err := h.svc.ListDefinitions(c.Request.Context(), tenantID, nil, 0, 1000)
	if err != nil {
		respondInternalError(c, err.Error())
		return
	}
	respondSuccess(c, gin.H{"count": len(items)})
}
