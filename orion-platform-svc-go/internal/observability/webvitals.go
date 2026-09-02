// Plan 32 — Web Vitals Prometheus Metrics (Backend Receiver)
//
// 功能:
//   - 接收前端上报的 Web Vitals 数据
//   - 暴露为 Prometheus Histogram + Gauge metrics
//   - 支持按页面路径(page)和服务名(service)分维度
package observability

import (
	"encoding/json"
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/client_golang/prometheus/promauto"
	"orion/platform-svc-go/internal/middleware"
)

// ============================================================
// Web Vitals 数据模型
// ============================================================

// VitalMetric 单条 Web Vital 指标
type VitalMetric struct {
	Name           string  `json:"name"`
	Value          float64 `json:"value"`
	Delta          float64 `json:"delta"`
	Timestamp      float64 `json:"timestamp"`
	Rating         string  `json:"rating"`
	NavigationType string  `json:"navigationType"`
	URL            string  `json:"url"`
	Element        string  `json:"element"`
}

// PageLoadMetrics 页面加载指标
type PageLoadMetrics struct {
	DomContentLoaded       float64 `json:"domContentLoaded"`
	Load                   float64 `json:"load"`
	Interactive            float64 `json:"interactive"`
	FirstContentfulPaint   float64 `json:"firstContentfulPaint"`
	LargestContentfulPaint float64 `json:"largestContentfulPaint"`
	CumulativeLayoutShift  float64 `json:"cumulativeLayoutShift"`
	TimeToFirstByte        float64 `json:"timeToFirstByte"`
}

// WebVitalsReport 前端上报的完整报告
type WebVitalsReport struct {
	Vitals    []VitalMetric   `json:"vitals"`
	PageLoad  PageLoadMetrics `json:"pageLoad"`
	UserAgent string          `json:"userAgent"`
	PageUrl   string          `json:"pageUrl"`
	Timestamp string          `json:"timestamp"`
	SessionID string          `json:"sessionId"`
}

// ============================================================
// Prometheus Metrics
// ============================================================

var (
	// Core Web Vitals histograms
	wvLCP = promauto.NewHistogramVec(prometheus.HistogramOpts{
		Name:    "web_vitals_lcp_seconds",
		Help:    "Largest Contentful Paint (LCP) in seconds",
		Buckets: prometheus.DefBuckets,
	}, []string{"page", "service", "rating"})

	wvCLS = promauto.NewHistogramVec(prometheus.HistogramOpts{
		Name:    "web_vitals_cls",
		Help:    "Cumulative Layout Shift (CLS)",
		Buckets: []float64{0.05, 0.1, 0.25, 0.5, 1.0, 2.0},
	}, []string{"page", "service", "rating"})

	wvINP = promauto.NewHistogramVec(prometheus.HistogramOpts{
		Name:    "web_vitals_inp_seconds",
		Help:    "Interaction to Next Paint (INP) in seconds",
		Buckets: prometheus.DefBuckets,
	}, []string{"page", "service", "rating"})

	wvFID = promauto.NewHistogramVec(prometheus.HistogramOpts{
		Name:    "web_vitals_fid_seconds",
		Help:    "First Input Delay (FID) in seconds",
		Buckets: prometheus.DefBuckets,
	}, []string{"page", "service", "rating"})

	wvFCP = promauto.NewHistogramVec(prometheus.HistogramOpts{
		Name:    "web_vitals_fcp_seconds",
		Help:    "First Contentful Paint (FCP) in seconds",
		Buckets: prometheus.DefBuckets,
	}, []string{"page", "service", "rating"})

	wvTTFB = promauto.NewHistogramVec(prometheus.HistogramOpts{
		Name:    "web_vitals_ttfb_seconds",
		Help:    "Time to First Byte (TTFB) in seconds",
		Buckets: prometheus.DefBuckets,
	}, []string{"page", "service", "rating"})

	// Aggregate gauge for active users
	wvActiveSessions = promauto.NewGauge(prometheus.GaugeOpts{
		Name: "web_vitals_active_sessions",
		Help: "Number of active user sessions reporting vitals",
	})

	// Page load metrics
	wvPageLoadTime = promauto.NewHistogramVec(prometheus.HistogramOpts{
		Name:    "web_vitals_page_load_seconds",
		Help:    "Full page load time in seconds",
		Buckets: prometheus.DefBuckets,
	}, []string{"page", "service"})

	wvDOMReady = promauto.NewHistogramVec(prometheus.HistogramOpts{
		Name:    "web_vitals_dom_ready_seconds",
		Help:    "DOM Content Loaded time in seconds",
		Buckets: prometheus.DefBuckets,
	}, []string{"page", "service"})

	// Counter for total vitals received
	wvTotalReports = promauto.NewCounterVec(prometheus.CounterOpts{
		Name: "web_vitals_reports_total",
		Help: "Total number of web vitals reports received",
	}, []string{"page", "service", "rating"})
)

// ============================================================
// Gin Handler
// ============================================================

// WebVitalsHandler handles POST /api/v1/performance/vitals
func WebVitalsHandler(c *gin.Context) {
	var report WebVitalsReport
	if err := c.ShouldBindJSON(&report); err != nil {
		middleware.RespondBadRequest(c, "invalid request")
		return
	}

	// Extract dimensions
	page := extractPagePath(report.PageUrl)
	service := extractService(report.UserAgent)

	// Update active sessions gauge
	wvActiveSessions.Set(float64(len(report.Vitals) + 1))

	// Process each vital metric
	for _, v := range report.Vitals {
		switch v.Name {
		case "LCP":
			wvLCP.WithLabelValues(page, service, v.Rating).Observe(v.Value / 1000.0)
		case "CLS":
			wvCLS.WithLabelValues(page, service, v.Rating).Observe(v.Value)
		case "INP":
			wvINP.WithLabelValues(page, service, v.Rating).Observe(v.Value / 1000.0)
		case "FID":
			wvFID.WithLabelValues(page, service, v.Rating).Observe(v.Value / 1000.0)
		case "FCP":
			wvFCP.WithLabelValues(page, service, v.Rating).Observe(v.Value / 1000.0)
		case "TTFB":
			wvTTFB.WithLabelValues(page, service, v.Rating).Observe(v.Value / 1000.0)
		}
	}

	// Process page load metrics
	if report.PageLoad.Load > 0 {
		wvPageLoadTime.WithLabelValues(page, service).Observe(report.PageLoad.Load / 1000.0)
	}
	if report.PageLoad.DomContentLoaded > 0 {
		wvDOMReady.WithLabelValues(page, service).Observe(report.PageLoad.DomContentLoaded / 1000.0)
	}

	// Count reports
	bestRating := findBestRating(report.Vitals)
	wvTotalReports.WithLabelValues(page, service, bestRating).Inc()

	middleware.RespondSuccess(c, gin.H{"status": "ok"})
}

// ============================================================
// Helper functions
// ============================================================

func extractPagePath(url string) string {
	if url == "" {
		return "/"
	}
	// Remove query string and fragment
	for i := 0; i < len(url); i++ {
		if url[i] == '?' || url[i] == '#' {
			url = url[:i]
			break
		}
	}
	// Extract path from URL
	if len(url) > 8 && (url[:7] == "http://" || url[:8] == "https://") {
		rest := url[7:]
		if rest[0] == '/' {
			rest = url[8:]
		}
		if idx := findIndex(rest, '/'); idx > 0 && idx < len(rest) {
			url = rest[idx+1:]
		} else {
			url = rest
		}
	}
	if url == "" {
		url = "/"
	}
	return url
}

func findIndex(s string, ch byte) int {
	for i := 0; i < len(s); i++ {
		if s[i] == ch {
			return i
		}
	}
	return -1
}

func extractService(userAgent string) string {
	if userAgent == "" {
		return "unknown"
	}
	return "web"
}

func findBestRating(vitals []VitalMetric) string {
	best := "good"
	for _, v := range vitals {
		switch v.Rating {
		case "poor":
			return "poor"
		case "needs-improvement":
			best = "needs-improvement"
		}
	}
	return best
}

// MarshalJSON is a no-op placeholder to ensure the package compiles
func MarshalJSON() ([]byte, error) {
	return json.Marshal(map[string]string{"status": "ok"})
}

// Now we suppress the time import warning
var _ = time.Now
