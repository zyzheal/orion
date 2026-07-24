package handler

import (
	"net/http"

	"orion/platform-svc-go/internal/graphviz/graph"
	"orion/platform-svc-go/internal/graphviz/models"
	"orion/platform-svc-go/internal/graphviz/service"

	"orion/go-common/pkg/auth"
	"orion/go-common/pkg/errors"

	"github.com/gin-gonic/gin"
	"go.opentelemetry.io/otel"
)

// Handler is the HTTP handler for graphviz endpoints.
type Handler struct {
	svc *service.Service
}

// NewHandler creates a new Handler.
func NewHandler(svc *service.Service) *Handler {
	return &Handler{svc: svc}
}

// RegisterRoutes registers all graphviz routes.
func (h *Handler) RegisterRoutes(rg *gin.RouterGroup) {
	r := rg.Group("/graph")
	r.POST("/build", h.Build)
	r.GET("/templates", h.ListTemplates)
	r.POST("", auth.RequirePermission("graphviz", "write"), h.Create)
	r.GET("/:id", auth.RequirePermission("graphviz", "read"), h.Get)
	r.GET("/:id/dot", auth.RequirePermission("graphviz", "read"), h.RenderDOT)
	r.GET("/:id/svg", auth.RequirePermission("graphviz", "read"), h.RenderSVG)
	r.GET("/:id/json", auth.RequirePermission("graphviz", "read"), h.RenderJSON)
	r.PUT("/:id", auth.RequirePermission("graphviz", "write"), h.Update)
	r.DELETE("/:id", auth.RequirePermission("graphviz", "delete"), h.Delete)
}

// Build builds a graph from a template request.
func (h *Handler) Build(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "graphviz.Build")
	defer span.End()
	var req models.BuildRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		errors.WriteError(c, errors.ErrBadRequest, err.Error(), 400)
		return
	}
	g, err := h.svc.BuildFromTemplate(ctx, c.GetString("tenant_id"), req)
	if err != nil {
		errors.WriteError(c, errors.ErrBadRequest, err.Error(), 400)
		return
	}
	errors.WriteSuccess(c, gin.H{"graph": g})
}

// Create persists a new graph.
func (h *Handler) Create(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "graphviz.Create")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	var req models.CreateGraphRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		errors.WriteError(c, errors.ErrBadRequest, err.Error(), 400)
		return
	}

	g := &graph.Graph{
		Name:      req.Name,
		TemplateID: req.TemplateID,
		Direction: req.Direction,
		Layout:    req.Layout,
	}
	if g.Direction == "" {
		g.Direction = "TB"
	}
	if g.Layout == "" {
		g.Layout = "dot"
	}

	for _, nr := range req.Nodes {
		n := &graph.Node{
			ID:      nr.ID,
			Label:   nr.Label,
			Type:    nr.Type,
			Shape:   nr.Shape,
			Color:   nr.Color,
			Tooltip: nr.ToolTip,
			Image:   nr.Image,
			Attrs:   nr.Attrs,
		}
		if nr.Position != nil {
			n.Position = &graph.Point{X: nr.Position.X, Y: nr.Position.Y}
		}
		g.Nodes = append(g.Nodes, n)
	}
	for _, lr := range req.Links {
		l := &graph.Link{
			ID:       lr.ID,
			Source:   lr.Source,
			Target:   lr.Target,
			Label:    lr.Label,
			Type:     lr.Type,
			Directed: lr.Directed,
			Style:    lr.Style,
			Color:    lr.Color,
			Attrs:    lr.Attrs,
		}
		g.Links = append(g.Links, l)
	}

	m, err := h.svc.SaveGraph(ctx, tenantID, g)
	if err != nil {
		errors.WriteError(c, errors.ErrInternal, err.Error(), 500)
		return
	}
	errors.WriteCreated(c, gin.H{"id": m.ID, "message": "created"})
}

// Get retrieves a graph by ID.
func (h *Handler) Get(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "graphviz.Get")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	id := c.Param("id")
	m, err := h.svc.GetGraph(ctx, tenantID, id)
	if err != nil {
		errors.WriteError(c, errors.ErrNotFound, "not found", 404)
		return
	}
	errors.WriteSuccess(c, m)
}

// RenderDOT renders a graph as DOT format.
func (h *Handler) RenderDOT(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "graphviz.RenderDOT")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	id := c.Param("id")
	dot, err := h.svc.RenderDOT(ctx, tenantID, id)
	if err != nil {
		errors.WriteError(c, errors.ErrNotFound, "not found", 404)
		return
	}
	c.Header("Content-Type", "text/vnd.graphviz")
	c.Writer.Write([]byte(dot))
}

// RenderSVG renders a graph as SVG format.
func (h *Handler) RenderSVG(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "graphviz.RenderSVG")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	id := c.Param("id")
	svg, err := h.svc.RenderSVG(ctx, tenantID, id)
	if err != nil {
		errors.WriteError(c, errors.ErrNotFound, "not found", 404)
		return
	}
	c.Data(http.StatusOK, "image/svg+xml", []byte(svg))
}

// RenderJSON renders a graph as JSON format.
func (h *Handler) RenderJSON(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "graphviz.RenderJSON")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	id := c.Param("id")
	j, err := h.svc.RenderJSON(ctx, tenantID, id)
	if err != nil {
		errors.WriteError(c, errors.ErrNotFound, "not found", 404)
		return
	}
	errors.WriteSuccess(c, j)
}

// Update modifies a graph.
func (h *Handler) Update(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "graphviz.Update")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	id := c.Param("id")
	var req models.UpdateGraphRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		errors.WriteError(c, errors.ErrBadRequest, err.Error(), 400)
		return
	}
	_, err := h.svc.UpdateGraph(ctx, tenantID, id, req)
	if err != nil {
		errors.WriteError(c, errors.ErrInternal, err.Error(), 500)
		return
	}
	errors.WriteSuccess(c, gin.H{"message": "updated"})
}

// Delete removes a graph.
func (h *Handler) Delete(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "graphviz.Delete")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	id := c.Param("id")
	if err := h.svc.DeleteGraph(ctx, tenantID, id); err != nil {
		errors.WriteError(c, errors.ErrInternal, err.Error(), 500)
		return
	}
	errors.WriteSuccess(c, gin.H{"message": "deleted"})
}

// ListTemplates returns all registered template names.
func (h *Handler) ListTemplates(c *gin.Context) {
	names := h.svc.ListTemplates()
	errors.WriteSuccess(c, gin.H{"templates": names})
}
