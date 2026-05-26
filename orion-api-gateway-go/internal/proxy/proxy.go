package proxy

import (
	"net/http"
	"net/http/httputil"
	"net/url"
	"strings"

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

// SSEHandler handles Server-Sent Events for pipeline logs.
func SSEHandler(logger *zap.Logger, cfg any) gin.HandlerFunc {
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

		// TODO: Connect to upstream SSE source and pipe events
		c.Stream(func(w io.Writer) bool {
			// SSE event forwarding logic
			return false
		})

		flusher.Flush()
	}
}
