package handler

import (
	"fmt"
	"net/http"

	"github.com/gin-gonic/gin"
	"orion/monitor-svc-go/internal/monitoring/models"
	"orion/monitor-svc-go/internal/monitoring/service"
	"orion/monitor-svc-go/internal/response_writer"
	"orion/go-common/pkg/auth"
)

type MonitoringHandler struct {
	svc *service.MonitoringService
}

func NewMonitoringHandler(svc *service.MonitoringService) *MonitoringHandler {
	return &MonitoringHandler{svc: svc}
}

// RegisterRoutes registers monitoring (Prometheus proxy) routes.
func (h *MonitoringHandler) RegisterRoutes(rg *gin.RouterGroup) {
	mon := rg.Group("/monitoring")

	mon.GET("/query", auth.RequirePermission("monitor", "read"), h.Query)
	mon.POST("/query", auth.RequirePermission("monitor", "read"), h.Query)
	mon.GET("/query_range", auth.RequirePermission("monitor", "read"), h.QueryRange)
	mon.POST("/query_range", auth.RequirePermission("monitor", "read"), h.QueryRange)
	mon.GET("/targets", auth.RequirePermission("monitor", "read"), h.GetTargets)
	mon.GET("/alerts", auth.RequirePermission("monitor", "read"), h.GetAlerts)
	mon.GET("/metrics", auth.RequirePermission("monitor", "read"), h.GetMetrics)
	mon.GET("/metrics/:name/series", auth.RequirePermission("monitor", "read"), h.GetSeries)
	mon.GET("/metrics/:name/summary", auth.RequirePermission("monitor", "read"), h.GetSummary)
	mon.GET("/predefined", auth.RequirePermission("monitor", "read"), h.ListPredefined)
	mon.GET("/predefined/:id", auth.RequirePermission("monitor", "read"), h.GetPredefined)
}

// Query performs an instant query.
func (h *MonitoringHandler) Query(c *gin.Context) {
	var req models.PrometheusQueryRequest

	if c.Request.Method == "GET" {
		req.Query = c.Query("query")
		req.Time = c.Query("time")
	} else {
		if err := c.ShouldBindJSON(&req); err != nil {
			response_writer.RespondBadRequest(c, err.Error())
			return
		}
	}

	if req.Query == "" {
		response_writer.RespondBadRequest(c, "query is required")
		return
	}

	resp, err := h.svc.Query(c.Request.Context(), &req)
	if err != nil {
		response_writer.RespondInternalError(c, err.Error())
		return
	}
	if resp.Status == "error" {
		c.JSON(http.StatusBadGateway, resp)
		return
	}
	response_writer.Respond(c, http.StatusOK, resp.Data)
}

// QueryRange performs a range query.
func (h *MonitoringHandler) QueryRange(c *gin.Context) {
	var req models.PrometheusRangeQueryRequest

	if c.Request.Method == "GET" {
		req.Query = c.Query("query")
		req.Start = c.Query("start")
		req.End = c.Query("end")
		req.Step = c.Query("step")
	} else {
		if err := c.ShouldBindJSON(&req); err != nil {
			response_writer.RespondBadRequest(c, err.Error())
			return
		}
	}

	if req.Query == "" || req.Start == "" || req.End == "" {
		response_writer.RespondBadRequest(c, "query, start, and end are required")
		return
	}

	resp, err := h.svc.QueryRange(c.Request.Context(), &req)
	if err != nil {
		response_writer.RespondInternalError(c, err.Error())
		return
	}
	if resp.Status == "error" {
		c.JSON(http.StatusBadGateway, resp)
		return
	}
	response_writer.Respond(c, http.StatusOK, resp.Data)
}

// GetTargets returns Prometheus scrape targets.
func (h *MonitoringHandler) GetTargets(c *gin.Context) {
	resp, err := h.svc.GetTargets(c.Request.Context())
	if err != nil {
		response_writer.RespondInternalError(c, err.Error())
		return
	}
	if resp.Status == "error" {
		c.JSON(http.StatusBadGateway, resp)
		return
	}
	response_writer.Respond(c, http.StatusOK, resp.Data)
}

// GetAlerts returns Prometheus alerts.
func (h *MonitoringHandler) GetAlerts(c *gin.Context) {
	resp, err := h.svc.GetAlerts(c.Request.Context())
	if err != nil {
		response_writer.RespondInternalError(c, err.Error())
		return
	}
	if resp.Status == "error" {
		c.JSON(http.StatusBadGateway, resp)
		return
	}
	response_writer.Respond(c, http.StatusOK, resp.Data)
}

// GetMetrics returns available metrics.
func (h *MonitoringHandler) GetMetrics(c *gin.Context) {
	resp, err := h.svc.GetMetrics(c.Request.Context())
	if err != nil {
		response_writer.RespondInternalError(c, err.Error())
		return
	}
	if resp.Status == "error" {
		c.JSON(http.StatusBadGateway, resp)
		return
	}
	response_writer.Respond(c, http.StatusOK, resp.Data)
}

// GetSeries returns time series data.
func (h *MonitoringHandler) GetSeries(c *gin.Context) {
	metricName := c.Param("name")
	limit := 100
	offset := 0

	if l := c.Query("limit"); l != "" {
		_, _ = fmt.Sscanf(l, "%d", &limit)
	}
	if o := c.Query("offset"); o != "" {
		_, _ = fmt.Sscanf(o, "%d", &offset)
	}

	resp, err := h.svc.GetSeries(c.Request.Context(), metricName, limit, offset)
	if err != nil {
		response_writer.RespondInternalError(c, err.Error())
		return
	}
	if resp.Status == "error" {
		c.JSON(http.StatusBadGateway, resp)
		return
	}
	response_writer.Respond(c, http.StatusOK, resp.Data)
}

// GetSummary returns metric summary statistics.
func (h *MonitoringHandler) GetSummary(c *gin.Context) {
	metricName := c.Param("name")

	resp, err := h.svc.GetSummary(c.Request.Context(), metricName)
	if err != nil {
		response_writer.RespondInternalError(c, err.Error())
		return
	}
	if resp.Status == "error" {
		c.JSON(http.StatusBadGateway, resp)
		return
	}
	response_writer.Respond(c, http.StatusOK, resp.Data)
}

// ListPredefined returns all predefined metrics.
func (h *MonitoringHandler) ListPredefined(c *gin.Context) {
	metrics := h.svc.ListPredefined()
	response_writer.Respond(c, http.StatusOK, metrics)
}

// GetPredefined returns a predefined metric.
func (h *MonitoringHandler) GetPredefined(c *gin.Context) {
	id := c.Param("id")

	metric, err := h.svc.GetPredefined(id)
	if err != nil {
		response_writer.RespondNotFound(c, err.Error())
		return
	}
	response_writer.Respond(c, http.StatusOK, metric)
}
