package handler

import (
	"strconv"

	"github.com/gin-gonic/gin"
	"orion/go-common/pkg/auth"
	"orion/platform-svc-go/internal/middleware"
	"orion/platform-svc-go/internal/test-execution-engine/models"
	"orion/platform-svc-go/internal/test-execution-engine/service"
)

type Handler struct {
	svc *service.Service
}

func NewHandler(svc *service.Service) *Handler {
	return &Handler{svc: svc}
}

func (h *Handler) RegisterRoutes(rg *gin.RouterGroup) {
	exec := rg.Group("/test-executions")
	exec.Use(auth.RequirePermission("test", "read"))
	{
		exec.POST("", auth.RequirePermission("test", "write"), h.Create)
		exec.GET("", h.List)
		exec.GET("/:id", h.Get)
		exec.POST("/:id/start", auth.RequirePermission("test", "write"), h.Start)
		exec.POST("/:id/results", auth.RequirePermission("test", "write"), h.SubmitResults)
		exec.POST("/:id/cancel", auth.RequirePermission("test", "write"), h.Cancel)
		exec.GET("/:id/suites", h.GetSuites)
		exec.GET("/suites/:suiteId/cases", h.GetTestCases)
	}
}

func (h *Handler) Create(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	var req models.CreateExecutionRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		middleware.RespondBadRequest(c, err.Error())
		return
	}
	exec, err := h.svc.Create(c.Request.Context(), tenantID, &req)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondCreated(c, exec)
}

func (h *Handler) Get(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	id := c.Param("id")
	exec, err := h.svc.Get(c.Request.Context(), tenantID, id)
	if err != nil {
		middleware.RespondNotFound(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, exec)
}

func (h *Handler) List(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	pageSize, _ := strconv.Atoi(c.DefaultQuery("pageSize", "20"))
	q := models.ListExecutionsQuery{Page: page, PageSize: pageSize}
	result, err := h.svc.List(c.Request.Context(), tenantID, q)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, result)
}

func (h *Handler) Start(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	id := c.Param("id")
	if err := h.svc.Start(c.Request.Context(), tenantID, id); err != nil {
		middleware.RespondBadRequest(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, gin.H{"message": "started"})
}

func (h *Handler) SubmitResults(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	id := c.Param("id")
	var req models.SubmitResultRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		middleware.RespondBadRequest(c, err.Error())
		return
	}
	if err := h.svc.SubmitResults(c.Request.Context(), tenantID, id, &req); err != nil {
		middleware.RespondBadRequest(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, gin.H{"message": "results submitted"})
}

func (h *Handler) Cancel(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	id := c.Param("id")
	if err := h.svc.Cancel(c.Request.Context(), tenantID, id); err != nil {
		middleware.RespondBadRequest(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, gin.H{"message": "cancelled"})
}

func (h *Handler) GetSuites(c *gin.Context) {
	executionID := c.Param("id")
	suites, err := h.svc.GetSuites(c.Request.Context(), executionID)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, suites)
}

func (h *Handler) GetTestCases(c *gin.Context) {
	suiteID := c.Param("suiteId")
	cases, err := h.svc.GetTestCases(c.Request.Context(), suiteID)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, cases)
}