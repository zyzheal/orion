package handler

import (
	"github.com/gin-gonic/gin"
	"go.opentelemetry.io/otel"
	"orion/platform-svc-go/internal/code/code-repo/service"
	"orion/platform-svc-go/internal/middleware"
)

type CodeRepoHandler struct {
	Service service.CodeRepoService
}

func NewCodeRepoHandler(svc service.CodeRepoService) *CodeRepoHandler {
	return &CodeRepoHandler{Service: svc}
}

func (h *CodeRepoHandler) RegisterRoutes(rg *gin.RouterGroup) {
	rg.GET("/repos", h.List)
	rg.POST("/repos", h.Create)
	rg.GET("/repos/:id", h.Get)
	rg.PUT("/repos/:id", h.Update)
	rg.DELETE("/repos/:id", h.Delete)
	rg.POST("/repos/:id/webhook", h.HandleWebhook)
	rg.GET("/repos/:id/branches", h.ListBranches)
	rg.GET("/repos/:id/commits", h.ListCommits)
}

func (h *CodeRepoHandler) List(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "ListCodeRepos")
	defer span.End()
	repos, err := h.Service.List(ctx)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, repos)
}

func (h *CodeRepoHandler) Create(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "CreateCodeRepo")
	defer span.End()
	var req struct {
		Name     string `json:"name"`
		URL      string `json:"url"`
		Provider string `json:"provider"`
		Token    string `json:"token,omitempty"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		middleware.RespondBadRequest(c, "invalid request")
		return
	}
	repo, err := h.Service.Create(ctx, req.Name, req.URL, req.Provider, req.Token)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondCreated(c, repo)
}

func (h *CodeRepoHandler) Get(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "GetCodeRepo")
	defer span.End()
	id := c.Param("id")
	repo, err := h.Service.Get(ctx, id)
	if err != nil {
		middleware.RespondNotFound(c, "not found")
		return
	}
	middleware.RespondSuccess(c, repo)
}

func (h *CodeRepoHandler) Update(c *gin.Context) {
	_, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "UpdateCodeRepo")
	defer span.End()
	middleware.RespondSuccess(c, gin.H{"message": "success"})
}

func (h *CodeRepoHandler) Delete(c *gin.Context) {
	_, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "DeleteCodeRepo")
	defer span.End()
	middleware.RespondSuccess(c, gin.H{"message": "success"})
}

func (h *CodeRepoHandler) HandleWebhook(c *gin.Context) {
	_, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "HandleWebhook")
	defer span.End()
	middleware.RespondSuccess(c, gin.H{"message": "success"})
}

func (h *CodeRepoHandler) ListBranches(c *gin.Context) {
	_, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "ListBranches")
	defer span.End()
	middleware.RespondSuccess(c, gin.H{"message": "success"})
}

func (h *CodeRepoHandler) ListCommits(c *gin.Context) {
	_, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "ListCommits")
	defer span.End()
	middleware.RespondSuccess(c, gin.H{"message": "success"})
}
