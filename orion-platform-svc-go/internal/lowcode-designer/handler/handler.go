package handler

import (
	"github.com/gin-gonic/gin"
	"go.opentelemetry.io/otel"
	"orion/go-common/pkg/auth"
	"orion/platform-svc-go/internal/lowcode-designer/models"
	"orion/platform-svc-go/internal/lowcode-designer/service"
	"orion/platform-svc-go/internal/middleware"
)

type Handler struct {
	svc service.ServiceInterface
}

func NewHandler(svc service.ServiceInterface) *Handler {
	return &Handler{svc: svc}
}

func (h *Handler) RegisterRoutes(rg *gin.RouterGroup) {
	f := rg.Group("/lowcode-designer")

	f.GET("/forms", auth.RequirePermission("lowcode", "read"), h.ListForms)
	f.POST("/forms", auth.RequirePermission("lowcode", "write"), h.CreateForm)
	f.GET("/forms/:id", auth.RequirePermission("lowcode", "read"), h.GetForm)
	f.PUT("/forms/:id", auth.RequirePermission("lowcode", "write"), h.UpdateForm)
	f.DELETE("/forms/:id", auth.RequirePermission("lowcode", "delete"), h.DeleteForm)

	f.POST("/forms/:id/fields", auth.RequirePermission("lowcode", "write"), h.CreateField)
	f.GET("/forms/:id/fields", auth.RequirePermission("lowcode", "read"), h.GetFieldsByForm)
	f.PUT("/fields/:id", auth.RequirePermission("lowcode", "write"), h.UpdateField)
	f.DELETE("/fields/:id", auth.RequirePermission("lowcode", "delete"), h.DeleteField)

	f.GET("/templates", auth.RequirePermission("lowcode", "read"), h.ListTemplates)
	f.GET("/templates/:id", auth.RequirePermission("lowcode", "read"), h.GetTemplate)
	f.POST("/templates", auth.RequirePermission("lowcode", "write"), h.CreateTemplate)

	f.POST("/forms/:id/instances", auth.RequirePermission("lowcode", "write"), h.SubmitInstance)
	f.GET("/instances", auth.RequirePermission("lowcode", "read"), h.ListInstances)
	f.GET("/instances/:id", auth.RequirePermission("lowcode", "read"), h.GetInstance)
	f.POST("/instances/:id/approve", auth.RequirePermission("lowcode", "write"), h.ApproveInstance)

	f.GET("/components", auth.RequirePermission("lowcode", "read"), h.ListComponents)
	f.GET("/components/:id", auth.RequirePermission("lowcode", "read"), h.GetComponent)
	f.POST("/components", auth.RequirePermission("lowcode", "write"), h.CreateComponent)
}

func (h *Handler) getTenantID(c *gin.Context) string {
	tid := c.GetString("tenant_id")
	if tid == "" {
		middleware.RespondUnauthorized(c, "tenant_id required")
		return ""
	}
	return tid
}

func (h *Handler) getOperator(c *gin.Context) string {
	op := c.GetString("user_id")
	if op == "" {
		op = "system"
	}
	return op
}

// Form routes

func (h *Handler) ListForms(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "LowcodeDesignListForms")
	defer span.End()
	cat := c.Query("category")
	st := c.Query("status")
	forms, err := h.svc.ListForms(ctx, h.getTenantID(c), cat, st)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, forms)
}

func (h *Handler) CreateForm(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "LowcodeDesignCreateForm")
	defer span.End()
	var req models.CreateFormRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		middleware.RespondBadRequest(c, err.Error())
		return
	}
	f, err := h.svc.CreateForm(ctx, &req, h.getTenantID(c), h.getOperator(c))
	if err != nil {
		middleware.RespondBadRequest(c, err.Error())
		return
	}
	middleware.RespondCreated(c, f)
}

func (h *Handler) GetForm(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "LowcodeDesignGetForm")
	defer span.End()
	f, err := h.svc.GetForm(ctx, c.Param("id"), h.getTenantID(c))
	if err != nil {
		middleware.RespondNotFound(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, f)
}

func (h *Handler) UpdateForm(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "LowcodeDesignUpdateForm")
	defer span.End()
	var req models.UpdateFormRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		middleware.RespondBadRequest(c, err.Error())
		return
	}
	f, err := h.svc.UpdateForm(ctx, c.Param("id"), h.getTenantID(c), h.getOperator(c), &req)
	if err != nil {
		middleware.RespondNotFound(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, f)
}

func (h *Handler) DeleteForm(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "LowcodeDesignDeleteForm")
	defer span.End()
	deleted, err := h.svc.DeleteForm(ctx, c.Param("id"), h.getTenantID(c))
	if err != nil || !deleted {
		middleware.RespondNotFound(c, "form not found")
		return
	}
	middleware.RespondSuccess(c, gin.H{"deleted": true})
}

// Field routes

func (h *Handler) CreateField(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "LowcodeDesignCreateField")
	defer span.End()
	var req models.CreateFieldRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		middleware.RespondBadRequest(c, err.Error())
		return
	}
	field, err := h.svc.CreateField(ctx, c.Param("id"), h.getTenantID(c), &req)
	if err != nil {
		middleware.RespondBadRequest(c, err.Error())
		return
	}
	middleware.RespondCreated(c, field)
}

func (h *Handler) GetFieldsByForm(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "LowcodeDesignGetFieldsByForm")
	defer span.End()
	fields, err := h.svc.GetFieldsByForm(ctx, c.Param("id"), h.getTenantID(c))
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, fields)
}

func (h *Handler) UpdateField(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "LowcodeDesignUpdateField")
	defer span.End()
	var req models.CreateFieldRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		middleware.RespondBadRequest(c, err.Error())
		return
	}
	field, err := h.svc.UpdateField(ctx, c.Param("id"), h.getTenantID(c), &req)
	if err != nil {
		middleware.RespondNotFound(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, field)
}

func (h *Handler) DeleteField(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "LowcodeDesignDeleteField")
	defer span.End()
	deleted, err := h.svc.DeleteField(ctx, c.Param("id"), h.getTenantID(c))
	if err != nil || !deleted {
		middleware.RespondNotFound(c, "field not found")
		return
	}
	middleware.RespondSuccess(c, gin.H{"deleted": true})
}

// Template routes

func (h *Handler) ListTemplates(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "LowcodeDesignListTemplates")
	defer span.End()
	cat := c.Query("category")
	templates, err := h.svc.ListTemplates(ctx, h.getTenantID(c), cat)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, templates)
}

func (h *Handler) GetTemplate(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "LowcodeDesignGetTemplate")
	defer span.End()
	t, err := h.svc.GetTemplate(ctx, c.Param("id"))
	if err != nil {
		middleware.RespondNotFound(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, t)
}

func (h *Handler) CreateTemplate(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "LowcodeDesignCreateTemplate")
	defer span.End()
	var body struct {
		Name        string                 `json:"name" binding:"required"`
		Description string                 `json:"description"`
		Category    string                 `json:"category"`
		Schema      map[string]interface{} `json:"schema" binding:"required"`
	}
	if err := c.ShouldBindJSON(&body); err != nil {
		middleware.RespondBadRequest(c, err.Error())
		return
	}
	t, err := h.svc.CreateTemplate(ctx, h.getTenantID(c), body.Name, body.Description, body.Category, body.Schema)
	if err != nil {
		middleware.RespondBadRequest(c, err.Error())
		return
	}
	middleware.RespondCreated(c, t)
}

// Instance routes

func (h *Handler) SubmitInstance(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "LowcodeDesignSubmitInstance")
	defer span.End()
	var req models.SubmitInstanceRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		middleware.RespondBadRequest(c, err.Error())
		return
	}
	inst, err := h.svc.SubmitInstance(ctx, c.Param("id"), h.getTenantID(c), &req)
	if err != nil {
		middleware.RespondBadRequest(c, err.Error())
		return
	}
	middleware.RespondCreated(c, inst)
}

func (h *Handler) ListInstances(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "LowcodeDesignListInstances")
	defer span.End()
	formID := c.Query("formId")
	status := c.Query("status")
	insts, err := h.svc.ListInstances(ctx, h.getTenantID(c), formID, status)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, insts)
}

func (h *Handler) GetInstance(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "LowcodeDesignGetInstance")
	defer span.End()
	inst, err := h.svc.GetInstance(ctx, c.Param("id"), h.getTenantID(c))
	if err != nil {
		middleware.RespondNotFound(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, inst)
}

func (h *Handler) ApproveInstance(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "LowcodeDesignApproveInstance")
	defer span.End()
	var req models.ApproveInstanceRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		middleware.RespondBadRequest(c, err.Error())
		return
	}
	inst, err := h.svc.ApproveInstance(ctx, c.Param("id"), h.getTenantID(c), &req)
	if err != nil {
		middleware.RespondNotFound(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, inst)
}

// Component routes

func (h *Handler) ListComponents(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "LowcodeDesignListComponents")
	defer span.End()
	cat := c.Query("category")
	comps, err := h.svc.ListComponents(ctx, h.getTenantID(c), cat)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, comps)
}

func (h *Handler) GetComponent(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "LowcodeDesignGetComponent")
	defer span.End()
	c2, err := h.svc.GetComponent(ctx, c.Param("id"))
	if err != nil {
		middleware.RespondNotFound(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, c2)
}

func (h *Handler) CreateComponent(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "LowcodeDesignCreateComponent")
	defer span.End()
	var body struct {
		Name          string                 `json:"name" binding:"required"`
		DisplayName   string                 `json:"displayName" binding:"required"`
		Category      string                 `json:"category"`
		Version       string                 `json:"version"`
		PropsSchema   map[string]interface{} `json:"propsSchema" binding:"required"`
		DefaultConfig map[string]interface{} `json:"defaultConfig"`
		Icon          string                 `json:"icon"`
	}
	if err := c.ShouldBindJSON(&body); err != nil {
		middleware.RespondBadRequest(c, err.Error())
		return
	}
	if body.Category == "" {
		body.Category = "basic"
	}
	if body.Version == "" {
		body.Version = "1.0.0"
	}
	c2, err := h.svc.CreateComponent(ctx, h.getTenantID(c), body.Name, body.DisplayName, body.Category, body.Version, body.PropsSchema, body.DefaultConfig, body.Icon)
	if err != nil {
		middleware.RespondBadRequest(c, err.Error())
		return
	}
	middleware.RespondCreated(c, c2)
}
