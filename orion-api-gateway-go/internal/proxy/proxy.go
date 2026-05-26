package proxy

import (
	"net/http"
	"net/http/httputil"
	"net/url"

	"github.com/gin-gonic/gin"
	"go.uber.org/zap"
)

func NewReverseProxy(target *url.URL, logger *zap.Logger) *httputil.ReverseProxy {
	director := func(req *http.Request) {
		req.URL.Scheme = target.Scheme
		req.URL.Host = target.Host
		req.Host = target.Host
	}

	return &httputil.ReverseProxy{
		Director: director,
		ErrorHandler: func(w http.ResponseWriter, r *http.Request, err error) {
			logger.Error("reverse proxy error",
				zap.Error(err),
				zap.String("method", r.Method),
				zap.String("path", r.URL.Path),
			)
			w.Header().Set("Content-Type", "application/json")
			w.WriteHeader(http.StatusBadGateway)
			w.Write([]byte(`{"code":502,"message":"upstream service unavailable"}`))
		},
	}
}

func Handler(proxy *httputil.ReverseProxy, prefix string, logger *zap.Logger) gin.HandlerFunc {
	return func(c *gin.Context) {
		// Rewrite path: strip prefix
		path := c.Param("path")
		c.Request.URL.Path = prefix + path

		// Forward tenant ID to upstream
		if tenantID, exists := c.Get("tenant_id"); exists {
			if tid, ok := tenantID.(string); ok && tid != "" {
				c.Request.Header.Set("X-Tenant-ID", tid)
			}
		}

		// Forward request ID
		if reqID := c.GetString("request_id"); reqID != "" {
			c.Request.Header.Set("X-Request-ID", reqID)
		}

		proxy.ServeHTTP(c.Writer, c.Request)
	}
}

// SSEHandlerConfig holds the upstream configuration for SSE.
type SSEHandlerConfig struct {
	UpstreamBaseURL string
}

// SSEHandler handles Server-Sent Events for pipeline logs.
func SSEHandler(logger *zap.Logger, cfg *SSEHandlerConfig) gin.HandlerFunc {
	return func(c *gin.Context) {
		c.Header("Content-Type", "text/event-stream")
		c.Header("Cache-Control", "no-cache")
		c.Header("Connection", "keep-alive")
		c.Header("X-Accel-Buffering", "no")

		flusher, ok := c.Writer.(http.Flusher)
		if !ok {
			c.AbortWithStatusJSON(http.StatusInternalServerError, gin.H{"code": 500, "message": "streaming not supported"})
			return
		}

		// Forward the request to upstream SSE endpoint
		upstreamURL := cfg.UpstreamBaseURL + c.Request.URL.Path
		if c.Request.URL.RawQuery != "" {
			upstreamURL += "?" + c.Request.URL.RawQuery
		}

		req, err := http.NewRequestWithContext(c.Request.Context(), "GET", upstreamURL, nil)
		if err != nil {
			logger.Error("failed to create SSE upstream request", zap.Error(err))
			return
		}

		// Forward headers
		req.Header.Set("Accept", "text/event-stream")
		if auth := c.GetHeader("Authorization"); auth != "" {
			req.Header.Set("Authorization", auth)
		}

		resp, err := http.DefaultClient.Do(req)
		if err != nil {
			logger.Error("SSE upstream connection failed", zap.Error(err))
			return
		}
		defer resp.Body.Close()

		buf := make([]byte, 4096)
		for {
			n, readErr := resp.Body.Read(buf)
			if n > 0 {
				_, writeErr := c.Writer.Write(buf[:n])
				if writeErr != nil {
					flusher.Flush()
					return
				}
				flusher.Flush()
			}
			if readErr != nil {
				return
			}
		}
	}
}
