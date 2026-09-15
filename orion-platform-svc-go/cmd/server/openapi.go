// Package server generates OpenAPI 3.0 spec from gin routes at runtime.
package main

import (
	"encoding/json"
	"net/http"
	"regexp"
	"strings"

	"github.com/gin-gonic/gin"
)

// OpenAPI 3.0 spec structures generated at runtime from gin routes.
type openapiSpec struct {
	OpenAPI string                  `json:"openapi"`
	Info    openapiInfo             `json:"info"`
	Paths   map[string]*openapiPath `json:"paths"`
}

type openapiInfo struct {
	Title   string `json:"title"`
	Version string `json:"version"`
}

type openapiPath struct {
	GET    *openapiOperation `json:"get,omitempty"`
	POST   *openapiOperation `json:"post,omitempty"`
	PUT    *openapiOperation `json:"put,omitempty"`
	DELETE *openapiOperation `json:"delete,omitempty"`
	PATCH  *openapiOperation `json:"patch,omitempty"`
}

type openapiOperation struct {
	Summary string `json:"summary,omitempty"`
	Tag     string `json:"x-tag,omitempty"`
}

var pathParamRe = regexp.MustCompile(`:(\w+)`)

// buildOpenAPISpec scans gin RouteInfo and produces an OpenAPI 3.0 JSON spec.
func buildOpenAPISpec(routes []gin.RouteInfo) *openapiSpec {
	spec := &openapiSpec{
		OpenAPI: "3.0.3",
		Info: openapiInfo{
			Title:   "Orion Platform API",
			Version: "1.0.0",
		},
		Paths: make(map[string]*openapiPath),
	}
	for _, rt := range routes {
		tag, path := extractTagAndParams(rt.Path)
		if path == "" {
			continue
		}
		p, ok := spec.Paths[path]
		if !ok {
			p = &openapiPath{}
			spec.Paths[path] = p
		}
		summary := strings.TrimPrefix(rt.Path, "/")
		if summary == "" {
			summary = "root"
		}
		op := &openapiOperation{Summary: summary, Tag: tag}
		switch rt.Method {
		case "GET":
			p.GET = op
		case "POST":
			p.POST = op
		case "PUT":
			p.PUT = op
		case "DELETE":
			p.DELETE = op
		case "PATCH":
			p.PATCH = op
		}
	}
	return spec
}

// extractTagAndParams derives a tag from the first path segment and
// converts :param placeholders to {param} per OpenAPI convention.
func extractTagAndParams(path string) (string, string) {
	cleaned := strings.TrimPrefix(path, "/api/v1")
	if cleaned == "" {
		cleaned = path
	}
	parts := strings.Split(strings.Trim(cleaned, "/"), "/")
	tag := "General"
	if len(parts) > 0 && parts[0] != "" {
		switch strings.ToLower(parts[0]) {
		case "pipeline", "pipelines":
			tag = "Pipeline"
		case "deploy", "deployment":
			tag = "Deployment"
		case "alert", "alerts":
			tag = "Alert"
		case "agent", "agents":
			tag = "Agent"
		case "ai":
			tag = "AI"
		case "code", "codescan":
			tag = "CodeScan"
		case "security":
			tag = "Security"
		case "audit":
			tag = "Audit"
		case "artifact":
			tag = "Artifact"
		case "version":
			tag = "Version"
		case "ticket":
			tag = "Ticket"
		case "config", "configs":
			tag = "Config"
		default:
			tag = parts[0]
		}
	}
	newPath := pathParamRe.ReplaceAllStringFunc(cleaned, func(m string) string {
		return "{" + m[1:] + "}"
	})
	return tag, newPath
}

// registerOpenAPIRoutes adds /api/v1/openapi.json and /api/v1/openapi/healthcheck to the gin engine.
func registerOpenAPIRoutes(r *gin.Engine) {
	r.GET("/api/v1/openapi.json", func(c *gin.Context) {
		allRoutes := r.Routes()
		apiRoutes := make([]gin.RouteInfo, 0, len(allRoutes))
		for _, rt := range allRoutes {
			if strings.HasPrefix(rt.Path, "/api/v1") {
				apiRoutes = append(apiRoutes, rt)
			}
		}
		spec := buildOpenAPISpec(apiRoutes)
		c.JSON(http.StatusOK, spec)
	})
	r.GET("/api/v1/openapi/healthcheck", func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{"status": "ok", "spec": "/api/v1/openapi.json"})
	})
}

func init() {
	_ = json.Marshal
}
