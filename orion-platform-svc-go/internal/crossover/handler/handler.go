package handler

import (
	"go.opentelemetry.io/otel"
	"strconv"

	"github.com/gin-gonic/gin"
	"orion/go-common/pkg/auth"
	"orion/platform-svc-go/internal/crossover/models"
	"orion/platform-svc-go/internal/crossover/service"
	"orion/platform-svc-go/internal/middleware"
)

type Handler struct{ svc *service.CrossoverService }

func NewHandler(svc *service.CrossoverService) *Handler { return &Handler{svc: svc} }

func (h *Handler) RegisterRoutes(rg *gin.RouterGroup) {
	g := rg.Group("/crossover")
	g.POST("/operations", auth.RequirePermission("crossover", "write"), h.RegisterOperation)
	g.DELETE("/operations/:module/:name", auth.RequirePermission("crossover", "delete"), h.UnregisterOperation)
	g.GET("/operations", auth.RequirePermission("crossover", "read"), h.ListOperations)
	g.GET("/operations/:module/:name", auth.RequirePermission("crossover", "read"), h.GetOperation)
	g.POST("/invoke", auth.RequirePermission("crossover", "execute"), h.Invoke)
	g.POST("/async", auth.RequirePermission("crossover", "execute"), h.CreateAsyncJob)
	g.GET("/async/:id", auth.RequirePermission("crossover", "read"), h.GetAsyncJob)
	g.POST("/batch", auth.RequirePermission("crossover", "execute"), h.DispatchBatch)
	g.GET("/calls", auth.RequirePermission("crossover", "read"), h.ListCalls)
	g.GET("/calls/:id", auth.RequirePermission("crossover", "read"), h.GetCall)
	g.DELETE("/calls/:id", auth.RequirePermission("crossover", "delete"), h.DeleteCall)
	g.GET("/stats", auth.RequirePermission("crossover", "read"), h.Stats)
	g.GET("/async", auth.RequirePermission("crossover", "read"), h.ListAsyncJobs)
}

func (h *Handler) RegisterOperation(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "RegisterCrossoverOperation")
	defer span.End()
	var req models.RegisterOperationRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		middleware.RespondBadRequest(c, err.Error())
		return
	}
	_, err := h.svc.RegisterOperation(ctx, c.GetString("tenant_id"), &req)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondCreated(c, gin.H{"status": "registered"})
}

func (h *Handler) UnregisterOperation(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "UnregisterCrossoverOperation")
	defer span.End()
	err := h.svc.UnregisterOperation(ctx, c.GetString("tenant_id"), c.Param("module"), c.Param("name"))
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, gin.H{"status": "deleted"})
}

func (h *Handler) ListOperations(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "ListCrossoverOperations")
	defer span.End()
	module := c.Query("module")
	tenantID := c.GetString("tenant_id")
	if module != "" {
		ops, err := h.svc.ListOperationsByModule(ctx, tenantID, module)
		if err != nil {
			middleware.RespondInternalError(c, err.Error())
			return
		}
		middleware.RespondSuccess(c, ops)
		return
	}
	ops, err := h.svc.ListOperations(ctx, tenantID, nil)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, ops)
}

func (h *Handler) GetOperation(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "GetCrossoverOperation")
	defer span.End()
	op, err := h.svc.GetOperation(ctx, c.GetString("tenant_id"), c.Param("module"), c.Param("name"))
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, op)
}

func (h *Handler) Invoke(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "InvokeCrossover")
	defer span.End()
	var req models.CreateCrossoverCallRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		middleware.RespondBadRequest(c, err.Error())
		return
	}
	result, err := h.svc.Invoke(ctx, c.GetString("tenant_id"), &req)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, result)
}

func (h *Handler) CreateAsyncJob(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "CreateCrossoverAsyncJob")
	defer span.End()
	var req models.CreateAsyncJobRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		middleware.RespondBadRequest(c, err.Error())
		return
	}
	job, err := h.svc.CreateAsyncJob(ctx, c.GetString("tenant_id"), &req)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondCreated(c, job)
}

func (h *Handler) GetAsyncJob(c *gin.Context) {
	_, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "GetCrossoverAsyncJob")
	defer span.End()
	job, err := h.svc.GetAsyncJob(c.Param("id"))
	if err != nil || job == nil {
		middleware.RespondNotFound(c, "job not found")
		return
	}
	middleware.RespondSuccess(c, job)
}

func (h *Handler) DispatchBatch(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "DispatchCrossoverBatch")
	defer span.End()
	var req struct {
		Calls []*models.CrossoverCall `json:"calls" binding:"required"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		middleware.RespondBadRequest(c, err.Error())
		return
	}
	ids, err := h.svc.DispatchBatch(ctx, c.GetString("tenant_id"), req.Calls)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondCreated(c, gin.H{"job_ids": ids})
}

func (h *Handler) ListCalls(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "ListCrossoverCalls")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	targetModule := c.Query("targetModule")
	opts := &service.ListOptions{Limit: intParam(c, "limit", 20), Offset: intParam(c, "offset", 0)}
	if targetModule != "" {
		calls, err := h.svc.ListCallsByTarget(ctx, tenantID, targetModule, opts)
		if err != nil {
			middleware.RespondInternalError(c, err.Error())
			return
		}
		middleware.RespondSuccess(c, gin.H{"data": calls, "total": len(calls)})
		return
	}
	calls, err := h.svc.ListCalls(ctx, tenantID, opts)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, gin.H{"data": calls, "total": len(calls)})
}

func (h *Handler) GetCall(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "GetCrossoverCall")
	defer span.End()
	call, err := h.svc.GetCall(ctx, c.GetString("tenant_id"), c.Param("id"))
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	if call == nil {
		middleware.RespondNotFound(c, "call not found")
		return
	}
	middleware.RespondSuccess(c, call)
}

func (h *Handler) DeleteCall(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "DeleteCrossoverCall")
	defer span.End()
	err := h.svc.DeleteCall(ctx, c.GetString("tenant_id"), c.Param("id"))
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, gin.H{"status": "deleted"})
}

func (h *Handler) Stats(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "CrossoverStats")
	defer span.End()
	stats, err := h.svc.Stats(ctx, c.GetString("tenant_id"))
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, stats)
}

func (h *Handler) ListAsyncJobs(c *gin.Context) {
	_, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "ListCrossoverAsyncJobs")
	defer span.End()
	jobs := h.svc.ListAsyncJobs(c.GetString("tenant_id"), c.Query("status"))
	middleware.RespondSuccess(c, gin.H{"data": jobs, "total": len(jobs)})
}

func intParam(c *gin.Context, key string, fallback int) int {
	v := c.Query(key)
	if v == "" {
		return fallback
	}
	n, err := strconv.Atoi(v)
	if err != nil {
		return fallback
	}
	return n
}
