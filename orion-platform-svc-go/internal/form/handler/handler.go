package handler

import (
	"encoding/json"
	"net/http"

	"orion/go-common/pkg/auth"
	"orion/go-common/pkg/errors"
	"orion/platform-svc-go/internal/form/models"
	"orion/platform-svc-go/internal/form/service"

	"github.com/gin-gonic/gin"
	"go.opentelemetry.io/otel"
	"go.uber.org/zap"
)

type Handler struct {
	engine *service.FormEngine
	logger *zap.Logger
}

func NewHandler(engine *service.FormEngine, logger *zap.Logger) *Handler {
	return &Handler{engine: engine, logger: logger}
}

// RegisterRoutes registers form engine routes under the given group.
func (h *Handler) RegisterRoutes(rg *gin.RouterGroup) {
	r := rg.Group("/forms")
	r.POST("", auth.RequirePermission("form", "write"), h.CreateForm)
	r.GET("", auth.RequirePermission("form", "read"), h.ListForms)
	r.GET("/:id", auth.RequirePermission("form", "read"), h.GetForm)
	r.PUT("/:id", auth.RequirePermission("form", "write"), h.UpdateForm)
	r.DELETE("/:id", auth.RequirePermission("form", "delete"), h.DeleteForm)
	r.GET("/:id/fields", auth.RequirePermission("form", "read"), h.GetFields)
	r.GET("/:id/render", auth.RequirePermission("form", "read"), h.RenderForm)
	r.POST("/:id/submit", auth.RequirePermission("form", "write"), h.SubmitForm)
	r.GET("/:id/submissions", auth.RequirePermission("form", "read"), h.ListSubmissions)
	r.GET("/submissions/:sid", auth.RequirePermission("form", "read"), h.GetSubmission)
	r.POST("/:id/validate", auth.RequirePermission("form", "write"), h.ValidateForm)
}

func (h *Handler) CreateForm(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "CreateForm")
	defer span.End()
	tenantID := c.GetString("tenant_id")

	var req models.CreateFormRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		errors.WriteError(c, errors.ErrBadRequest, "invalid request", http.StatusBadRequest)
		return
	}
	form, err := h.engine.CreateForm(ctx, tenantID, req.Name, req.Code, req.Category, req.Layout, nil)
	if err != nil {
		errors.WriteError(c, errors.ErrInternal, err.Error(), http.StatusInternalServerError)
		return
	}
	errors.WriteSuccess(c, form)
}

func (h *Handler) ListForms(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "ListForms")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	category := c.Query("category")
	forms, err := h.engine.ListForms(ctx, tenantID, category)
	if err != nil {
		errors.WriteError(c, errors.ErrInternal, err.Error(), http.StatusInternalServerError)
		return
	}
	errors.WriteSuccess(c, gin.H{"data": forms, "total": len(forms)})
}

func (h *Handler) GetForm(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "GetForm")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	form, err := h.engine.GetFormByID(ctx, tenantID, c.Param("id"))
	if err != nil {
		errors.WriteError(c, errors.ErrNotFound, "form not found", http.StatusNotFound)
		return
	}
	errors.WriteSuccess(c, form)
}

func (h *Handler) UpdateForm(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "UpdateForm")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	var req models.UpdateFormRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		errors.WriteError(c, errors.ErrBadRequest, "invalid request", http.StatusBadRequest)
		return
	}

	updates := make(map[string]interface{})
	if req.Name != nil {
		updates["name"] = *req.Name
	}
	if req.Category != nil {
		updates["category"] = *req.Category
	}
	if req.Description != nil {
		updates["description"] = *req.Description
	}
	if req.Status != nil {
		updates["status"] = *req.Status
	}
	if req.Layout != nil {
		layoutJSON, _ := json.Marshal(req.Layout)
		updates["layout"] = string(layoutJSON)
	}
	if req.Fields != nil {
		fieldsJSON, _ := json.Marshal(req.Fields)
		updates["fields"] = string(fieldsJSON)
	}

	form, err := h.engine.UpdateForm(ctx, tenantID, c.Param("id"), updates)
	if err != nil {
		errors.WriteError(c, errors.ErrInternal, err.Error(), http.StatusInternalServerError)
		return
	}
	errors.WriteSuccess(c, form)
}

func (h *Handler) DeleteForm(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "DeleteForm")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	if err := h.engine.DeleteForm(ctx, tenantID, c.Param("id")); err != nil {
		errors.WriteError(c, errors.ErrInternal, err.Error(), http.StatusInternalServerError)
		return
	}
	errors.WriteSuccess(c, nil)
}

func (h *Handler) GetFields(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "GetFields")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	fields, err := h.engine.GetFields(ctx, tenantID, c.Param("id"))
	if err != nil {
		errors.WriteError(c, errors.ErrInternal, err.Error(), http.StatusInternalServerError)
		return
	}
	errors.WriteSuccess(c, gin.H{"data": fields, "total": len(fields)})
}

func (h *Handler) RenderForm(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "RenderForm")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	resp, err := h.engine.RenderForm(ctx, tenantID, c.Param("id"))
	if err != nil {
		errors.WriteError(c, errors.ErrNotFound, "form not found", http.StatusNotFound)
		return
	}
	errors.WriteSuccess(c, resp)
}

func (h *Handler) SubmitForm(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "SubmitForm")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	var req models.SubmitFormRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		errors.WriteError(c, errors.ErrBadRequest, "invalid request", http.StatusBadRequest)
		return
	}
	submittedBy := c.GetString("user_id")
	if submittedBy == "" {
		submittedBy = "anonymous"
	}
	sub, err := h.engine.SubmitForm(ctx, tenantID, c.Param("id"), submittedBy, req.Data)
	if err != nil {
		errors.WriteError(c, errors.ErrBadRequest, err.Error(), http.StatusBadRequest)
		return
	}
	errors.WriteSuccess(c, sub)
}

func (h *Handler) ListSubmissions(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "ListSubmissions")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	subs, err := h.engine.ListSubmissions(ctx, tenantID, c.Param("id"))
	if err != nil {
		errors.WriteError(c, errors.ErrInternal, err.Error(), http.StatusInternalServerError)
		return
	}
	errors.WriteSuccess(c, gin.H{"data": subs, "total": len(subs)})
}

func (h *Handler) GetSubmission(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "GetSubmission")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	sub, err := h.engine.GetSubmission(ctx, tenantID, c.Param("sid"))
	if err != nil {
		errors.WriteError(c, errors.ErrNotFound, "submission not found", http.StatusNotFound)
		return
	}
	errors.WriteSuccess(c, sub)
}

func (h *Handler) ValidateForm(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "ValidateForm")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	var req models.ValidateFormRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		errors.WriteError(c, errors.ErrBadRequest, "invalid request", http.StatusBadRequest)
		return
	}
	form, err := h.engine.GetFormByID(ctx, tenantID, c.Param("id"))
	if err != nil {
		errors.WriteError(c, errors.ErrNotFound, "form not found", http.StatusNotFound)
		return
	}
	err = h.engine.ValidateSubmission(req.Data, form)
	if err != nil {
		errors.WriteSuccess(c, gin.H{"valid": false, "errors": []string{err.Error()}})
		return
	}
	errors.WriteSuccess(c, gin.H{"valid": true, "errors": []string{}})
}
