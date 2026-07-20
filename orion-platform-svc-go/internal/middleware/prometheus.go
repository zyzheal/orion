// Package middleware provides Orion-platform-specific Gin middleware.
package middleware

import (
	"regexp"
	"strconv"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/client_golang/prometheus/promhttp"
)

// ---------------------------------------------------------------------------
// Prometheus HTTP metrics — request count, latency, status code
// ---------------------------------------------------------------------------

const (
	promNamespace  = "orion"
	promSubsystem  = "http_requests"
	labelMethod    = "method"
	labelHandler   = "handler"
	labelStatus    = "status"
)

// requestTotal counts all requests by method, handler, and status.
var requestTotal = prometheus.NewCounterVec(
	prometheus.CounterOpts{
		Namespace: promNamespace,
		Subsystem: promSubsystem,
		Name:      "total",
		Help:      "Total number of HTTP requests by method, handler, and status",
	},
	[]string{labelMethod, labelHandler, labelStatus},
)

// requestDurationSeconds measures per-request latency in seconds.
var requestDurationSeconds = prometheus.NewHistogramVec(
	prometheus.HistogramOpts{
		Namespace: promNamespace,
		Subsystem: promSubsystem,
		Name:      "duration_seconds",
		Help:      "HTTP request duration in seconds by method and handler",
		Buckets: []float64{
			0.005, 0.01, 0.025, 0.05, 0.1,
			0.25, 0.5, 1.0, 2.5, 5.0, 10.0,
		},
	},
	[]string{labelMethod, labelHandler},
)

// errorTotal counts HTTP error responses (status >= 400) by method and handler.
var errorTotal = prometheus.NewCounterVec(
	prometheus.CounterOpts{
		Namespace: promNamespace,
		Subsystem: promSubsystem,
		Name:      "errors_total",
		Help:      "Total number of HTTP error responses (status >= 400) by method and handler",
	},
	[]string{labelMethod, labelHandler},
)

// RegisterPrometheusMetrics registers all HTTP metrics with the global
// Prometheus default registry. Call once at server startup.
func RegisterPrometheusMetrics() {
	prometheus.MustRegister(requestTotal)
	prometheus.MustRegister(requestDurationSeconds)
	prometheus.MustRegister(errorTotal)
}

// normalizeStatus groups raw HTTP status codes into a string label.
// e.g. 200 → "2xx", 503 → "5xx".
func normalizeStatus(code int) string {
	return strconv.Itoa(code/100) + "xx"
}

// Prometheus returns a Gin middleware that records request counter, duration
// histogram, and error counter for every handled request.
//
// Usage:
//
//	middleware.RegisterPrometheusMetrics()
//	r.Use(middleware.Prometheus())
//
// Each request records:
//   - orion_http_requests_total{method,handler,status}
//   - orion_http_requests_duration_seconds{method,handler} (bucket)
//   - orion_http_requests_errors_total{method,handler} (status >= 400)
func Prometheus() gin.HandlerFunc {
	return func(c *gin.Context) {
		start := time.Now()

		c.Next()

		// Record metrics after the handler chain completes.
		status := c.Writer.Status()
		method := c.Request.Method
		handler := normalizeHandler(c.HandlerName())

		// Request counter (always).
		requestTotal.WithLabelValues(method, handler, normalizeStatus(status)).Inc()

		// Latency histogram.
		duration := time.Since(start).Seconds()
		requestDurationSeconds.WithLabelValues(method, handler).Observe(duration)

		// Error counter (4xx / 5xx).
		if status >= 400 {
			errorTotal.WithLabelValues(method, handler).Inc()
		}
	}
}

// MetricsHandler returns a Gin handler function that serves the Prometheus
// /metrics scrape endpoint. Register as an unprotected route:
//
//	r.GET("/metrics", gin.WrapH(middleware.MetricsHandler()))
func MetricsHandler() gin.HandlerFunc {
	return gin.WrapH(promhttp.Handler())
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

// normalizeHandler collapses verbose handler names into a stable, short label
// suitable for Prometheus. For example:
//
//	"orion/platform-svc-go/internal/feature-flag/handler.(*Handler).List-fm"
//	→ "feature-flag/handler.List"
//
// If the name cannot be parsed, the raw name is returned.
func normalizeHandler(fullName string) string {
	if fullName == "" {
		return "unregistered"
	}

	// Strip the package import path prefix — keep only the last two path segments.
	// Pattern: orion/platform-svc-go/internal/<module>/<subpkg>/<Receiver>.<Method>-fm
	// We want: <module>/<subpkg>.<Receiver>.<Method>
	re := regexp.MustCompile(`internal/([a-zA-Z0-9_-]+)/([a-zA-Z0-9_-]+)\/\(\*?([A-Za-z0-9_]+)\)\.?([A-Za-z0-9_]+)`)
	match := re.FindStringSubmatch(fullName)
	if match != nil {
		return match[1] + "/" + match[2] + "." + match[3] + "." + match[4]
	}

	// Fallback: extract "module/pkg.Handler.Method" from last segments.
	return fullName
}
