package handler

import (
	"net/http"
	"strconv"

	"orion/scheduler-svc-go/internal/models"
	"orion/scheduler-svc-go/internal/service"

	"github.com/gin-gonic/gin"
)

// Handler provides HTTP handlers for scheduler operations.
type Handler struct {
	svc *service.SchedulerService
}

func NewHandler(svc *service.SchedulerService) *Handler {
	return &Handler{svc: svc}
}

// RegisterRoutes registers scheduler routes on the given router group.
func (h *Handler) RegisterRoutes(rg *gin.RouterGroup) {
	jobs := rg.Group("/jobs")
	{
		jobs.POST("", h.CreateJob)
		jobs.GET("", h.ListJobs)
		jobs.GET("/:id", h.GetJob)
		jobs.POST("/:id/pause", h.PauseJob)
		jobs.POST("/:id/resume", h.ResumeJob)
		jobs.POST("/:id/disable", h.DisableJob)
		jobs.GET("/:id/runs", h.GetJobRuns)
	}
	jobs.DELETE("/:id", h.Delete)
	jobs.GET("/count", h.Count)
}

func (h *Handler) CreateJob(c *gin.Context) {
	var job models.Job
	if err := c.ShouldBindJSON(&job); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	job.TenantID = c.GetString("tenant_id")
	if err := h.svc.CreateJob(c.Request.Context(), &job); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusCreated, job)
}

func (h *Handler) GetJob(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	id := c.Param("id")

	job, err := h.svc.GetJobByID(c.Request.Context(), tenantID, id)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "job not found"})
		return
	}

	c.JSON(http.StatusOK, job)
}

func (h *Handler) ListJobs(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	pageSize, _ := strconv.Atoi(c.DefaultQuery("page_size", "20"))

	if page <= 0 {
		page = 1
	}
	if pageSize <= 0 || pageSize > 100 {
		pageSize = 20
	}
	offset := (page - 1) * pageSize

	jobs, err := h.svc.ListJobs(c.Request.Context(), tenantID, offset, pageSize)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"data": jobs})
}

func (h *Handler) PauseJob(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	id := c.Param("id")

	if err := h.svc.PauseJob(c.Request.Context(), tenantID, id); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "paused"})
}

func (h *Handler) ResumeJob(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	id := c.Param("id")

	if err := h.svc.ResumeJob(c.Request.Context(), tenantID, id); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "resumed"})
}

func (h *Handler) DisableJob(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	id := c.Param("id")

	if err := h.svc.DisableJob(c.Request.Context(), tenantID, id); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "disabled"})
}

func (h *Handler) GetJobRuns(c *gin.Context) {
	id := c.Param("id")
	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "20"))

	runs, err := h.svc.GetJobRuns(c.Request.Context(), id, limit)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"data": runs})
}

func (h *Handler) Delete(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	if err := h.svc.Delete(c.Request.Context(), tenantID, c.Param("id")); err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "deleted"})
}

func (h *Handler) Count(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	count, err := h.svc.Count(c.Request.Context(), tenantID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"count": count})
}
