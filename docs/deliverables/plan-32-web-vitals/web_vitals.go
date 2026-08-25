// ============================================================
// Plan 32 — Web Vitals 后端接收端点
// ============================================================
// 优先级: P1
// 对应前端: plan-32-web-vitals/web-vitals.ts
// 本地证据:
//   - internal/middleware/prometheus.go (149行) 已有 HTTP 指标
//   - 无 Web Vitals 接收端点
// 技术约束: Go, Gin, Prometheus
// ============================================================

package handler

import (
	"encoding/json"
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/client_golang/prometheus/promauto"
)

// --- Prometheus Metrics ---

var (
	webVitalLCP = promauto.NewHistogramVec(prometheus.HistogramOpts{
		Name:    "orion_web_vitals_lcp_seconds",
		Help:    "Largest Contentful Paint in seconds",
		Buckets: []float64{0.5, 1.0, 1.5, 2.0, 2.5, 3.0, 4.0, 5.0, 6.0, 8.0, 10.0},
	}, []string{"pathname", "rating", "tenant_id"})

	webVitalCLS = promauto.NewHistogramVec(prometheus.HistogramOpts{
		Name:    "orion_web_vitals_cls",
		Help:    "Cumulative Layout Shift",
		Buckets: []float64{0.01, 0.05, 0.1, 0.15, 0.2, 0.25, 0.3, 0.5, 1.0},
	}, []string{"pathname", "rating", "tenant_id"})

	webVitalINP = promauto.NewHistogramVec(prometheus.HistogramOpts{
		Name:    "orion_web_vitals_inp_seconds",
		Help:    "Interaction to Next Paint in seconds",
		Buckets: []float64{0.05, 0.1, 0.15, 0.2, 0.3, 0.5, 0.7, 1.0, 1.5, 2.0},
	}, []string{"pathname", "rating", "tenant_id"})

	webVitalTTFB = promauto.NewHistogramVec(prometheus.HistogramOpts{
		Name:    "orion_web_vitals_ttfb_seconds",
		Help:    "Time to First Byte in seconds",
		Buckets: []float64{0.05, 0.1, 0.2, 0.3, 0.5, 0.8, 1.0, 1.5, 2.0, 3.0},
	}, []string{"pathname", "rating", "tenant_id"})

	webVitalFID = promauto.NewHistogramVec(prometheus.HistogramOpts{
		Name:    "orion_web_vitals_fid_seconds",
		Help:    "First Input Delay in seconds",
		Buckets: []float64{0.01, 0.05, 0.1, 0.15, 0.2, 0.3, 0.5, 1.0},
	}, []string{"pathname", "rating", "tenant_id"})
)

// --- Request Types ---

type WebVitalReport struct {
	Name          string  `json:"name"`
	Value         float64 `json:"value"`
	Rating        string  `json:"rating"`
	Pathname      string  `json:"pathname"`
	SessionID     string  `json:"sessionId"`
	Timestamp     int64   `json:"timestamp"`
	NavigationType string `json:"navigationType,omitempty"`
	TenantID      string  `json:"tenantId,omitempty"`
	UserID        string  `json:"userId,omitempty"`
}

type WebVitalsRequest struct {
	Metrics []WebVitalReport `json:"metrics"`
}

// --- Handler ---

// WebVitalsHandler 接收前端 Web Vitals 上报
// 注册到: POST /api/v1/metrics/web-vitals
func WebVitalsHandler(c *gin.Context) {
	var req WebVitalsRequest
	if err := json.NewDecoder(c.Request.Body).Decode(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"error":   gin.H{"code": "INVALID_JSON", "message": "invalid request body"},
		})
		return
	}

	// 限制单次上报数量
	if len(req.Metrics) > 50 {
		req.Metrics = req.Metrics[:50]
	}

	for _, m := range req.Metrics {
		// 秒级时间戳 (如果前端传的是毫秒)
		if m.Timestamp > 1e12 {
			m.Timestamp = m.Timestamp / 1000
		}

		// 写入 Prometheus
		switch m.Name {
		case "LCP":
			webVitalLCP.WithLabelValues(m.Pathname, m.Rating, m.TenantID).
				Observe(m.Value / 1000) // ms → seconds
		case "CLS":
			webVitalCLS.WithLabelValues(m.Pathname, m.Rating, m.TenantID).
				Observe(m.Value)
		case "INP":
			webVitalINP.WithLabelValues(m.Pathname, m.Rating, m.TenantID).
				Observe(m.Value / 1000)
		case "TTFB":
			webVitalTTFB.WithLabelValues(m.Pathname, m.Rating, m.TenantID).
				Observe(m.Value / 1000)
		case "FID":
			webVitalFID.WithLabelValues(m.Pathname, m.Rating, m.TenantID).
				Observe(m.Value / 1000)
		}

		// TODO: 写入 DB (用于历史趋势分析)
		// webVitalsRepo.Create(c.Request.Context(), &m)
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"data":    gin.H{"received": len(req.Metrics)},
	})
}

// --- Aggregation Query (for dashboard) ---

// WebVitalsSummary Web Vitals 汇总
type WebVitalsSummary struct {
	LCP  MetricSummary `json:"lcp"`
	CLS  MetricSummary `json:"cls"`
	INP  MetricSummary `json:"inp"`
	TTFB MetricSummary `json:"ttfb"`
}

type MetricSummary struct {
	P50      float64 `json:"p50"`
	P75      float64 `json:"p75"`
	P95      float64 `json:"p95"`
	Good     int64   `json:"good"`
	NeedsImp int64   `json:"needsImprovement"`
	Poor     int64   `json:"poor"`
}

// GetWebVitalsSummary 获取 Web Vitals 汇总 (从 Prometheus 查询)
// 注册到: GET /api/v1/metrics/web-vitals/summary
func GetWebVitalsSummary(c *gin.Context) {
	// TODO: 从 Prometheus 查询 P50/P75/P95 分位数
	// 使用 promhttp 或 prometheus.DefaultGatherer 获取指标
	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"data": WebVitalsSummary{
			LCP:  MetricSummary{P50: 1.2, P75: 2.1, P95: 4.5, Good: 800, NeedsImp: 150, Poor: 50},
			CLS:  MetricSummary{P50: 0.02, P75: 0.08, P95: 0.15, Good: 900, NeedsImp: 80, Poor: 20},
			INP:  MetricSummary{P50: 0.08, P75: 0.15, P95: 0.3, Good: 850, NeedsImp: 120, Poor: 30},
			TTFB: MetricSummary{P50: 0.15, P75: 0.3, P95: 0.8, Good: 700, NeedsImp: 200, Poor: 100},
		},
		"timestamp": time.Now().Unix(),
	})
}
