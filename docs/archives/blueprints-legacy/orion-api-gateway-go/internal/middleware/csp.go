package middleware

import (
	"net/http"
	"strings"

	"github.com/gin-gonic/gin"
)

// CSPConfig holds Content Security Policy configuration.
type CSPConfig struct {
	Enabled          bool
	ReportOnly       bool
	ReportURI        string
	TrustedSources   TrustedSources
	AllowInlineScript bool
	AllowEval        bool
}

// TrustedSources defines allowed origins for each CSP directive.
type TrustedSources struct {
	ScriptSrc []string
	StyleSrc  []string
	ImgSrc    []string
	FontSrc   []string
	ConnectSrc []string
	FrameSrc  []string
	MediaSrc  []string
	ObjectSrc []string
	BaseURI   []string
	FormAction []string
}

// DefaultCSPConfig returns a sensible default CSP configuration.
func DefaultCSPConfig() CSPConfig {
	return CSPConfig{
		Enabled:    true,
		ReportOnly: false,
		ReportURI:  "/api/v1/csp-report",
		TrustedSources: TrustedSources{
			ScriptSrc:  []string{"'self'"},
			StyleSrc:   []string{"'self'", "'unsafe-inline'"},
			ImgSrc:     []string{"'self'", "data:", "blob:"},
			FontSrc:    []string{"'self'", "data:"},
			ConnectSrc: []string{"'self'"},
			FrameSrc:   []string{},
			MediaSrc:   []string{"'self'"},
			ObjectSrc:  []string{"'none'"},
			BaseURI:    []string{"'self'"},
			FormAction: []string{"'self'"},
		},
		AllowInlineScript: false,
		AllowEval:         false,
	}
}

// buildCSPString constructs the CSP header value from config.
func buildCSPString(cfg CSPConfig) string {
	var directives []string

	// script-src
	scriptSrc := append([]string{}, cfg.TrustedSources.ScriptSrc...)
	if cfg.AllowInlineScript {
		scriptSrc = append(scriptSrc, "'unsafe-inline'")
	}
	if cfg.AllowEval {
		scriptSrc = append(scriptSrc, "'unsafe-eval'")
	}
	directives = append(directives, "script-src "+strings.Join(scriptSrc, " "))

	// style-src
	directives = append(directives, "style-src "+strings.Join(cfg.TrustedSources.StyleSrc, " "))

	// img-src
	directives = append(directives, "img-src "+strings.Join(cfg.TrustedSources.ImgSrc, " "))

	// font-src
	directives = append(directives, "font-src "+strings.Join(cfg.TrustedSources.FontSrc, " "))

	// connect-src
	directives = append(directives, "connect-src "+strings.Join(cfg.TrustedSources.ConnectSrc, " "))

	// frame-src
	if len(cfg.TrustedSources.FrameSrc) > 0 {
		directives = append(directives, "frame-src "+strings.Join(cfg.TrustedSources.FrameSrc, " "))
	}

	// media-src
	directives = append(directives, "media-src "+strings.Join(cfg.TrustedSources.MediaSrc, " "))

	// object-src
	directives = append(directives, "object-src "+strings.Join(cfg.TrustedSources.ObjectSrc, " "))

	// base-uri
	directives = append(directives, "base-uri "+strings.Join(cfg.TrustedSources.BaseURI, " "))

	// form-action
	directives = append(directives, "form-action "+strings.Join(cfg.TrustedSources.FormAction, " "))

	// report-uri
	if cfg.ReportURI != "" {
		directives = append(directives, "report-uri "+cfg.ReportURI)
		directives = append(directives, "report-to csp-endpoint")
	}

	return strings.Join(directives, "; ")
}

// CSP returns a Gin middleware that sets Content-Security-Policy headers.
func CSP(cfg CSPConfig) gin.HandlerFunc {
	if !cfg.Enabled {
		return func(c *gin.Context) { c.Next() }
	}

	cspHeader := "Content-Security-Policy"
	if cfg.ReportOnly {
		cspHeader = "Content-Security-Policy-Report-Only"
	}
	cspValue := buildCSPString(cfg)

	return func(c *gin.Context) {
		c.Header(cspHeader, cspValue)
		c.Header("X-Content-Type-Options", "nosniff")
		c.Header("X-Frame-Options", "SAMEORIGIN")
		c.Header("X-XSS-Protection", "1; mode=block")
		c.Header("Referrer-Policy", "strict-origin-when-cross-origin")
		c.Next()
	}
}

// CSPReportHandler handles CSP violation reports.
func CSPReportHandler() gin.HandlerFunc {
	return func(c *gin.Context) {
		var report map[string]interface{}
		if err := c.ShouldBindJSON(&report); err != nil {
			c.Status(http.StatusBadRequest)
			return
		}
		// Log CSP violation (structured logging via zap would be injected in production)
		c.Set("csp_report", report)
		c.Status(http.StatusNoContent)
	}
}

// AddSubAppSources adds sub-app origins to CSP trusted sources for micro-frontend scenarios.
func AddSubAppSources(cfg CSPConfig, subAppEntries []string) CSPConfig {
	origins := make([]string, 0, len(subAppEntries))
	for _, entry := range subAppEntries {
		// Extract origin from URL (scheme + host)
		if idx := strings.Index(entry, "://"); idx > 0 {
			rest := entry[idx+3:]
			if slashIdx := strings.Index(rest, "/"); slashIdx > 0 {
				origins = append(origins, entry[:idx+3+slashIdx])
			} else {
				origins = append(origins, entry)
			}
		} else {
			origins = append(origins, entry)
		}
	}

	cfg.TrustedSources.ScriptSrc = append(cfg.TrustedSources.ScriptSrc, origins...)
	cfg.TrustedSources.ConnectSrc = append(cfg.TrustedSources.ConnectSrc, origins...)
	return cfg
}
