package advisor

import (
	"orion/go-common/pkg/auth"
	"orion/platform-svc-go/internal/middleware"

	"github.com/gin-gonic/gin"
	"go.opentelemetry.io/otel"
)

// Handler exposes the IndexAdvisorService over HTTP.
type Handler struct {
	svc *IndexAdvisorService
}

// NewHandler wires a Handler around an IndexAdvisorService.
func NewHandler(svc *IndexAdvisorService) *Handler {
	return &Handler{svc: svc}
}

// RegisterRoutes mounts the advisor endpoints under /dba/advisor.
//
// Routes:
//   POST /dba/advisor/indexes    — suggest CREATE INDEX statements
func (h *Handler) RegisterRoutes(rg *gin.RouterGroup) {
	f := rg.Group("/dba/advisor")
	f.POST("/indexes", auth.RequirePermission("dba", "write"), h.SuggestIndexes)
}

// SuggestIndexes handles POST /dba/advisor/indexes.
func (h *Handler) SuggestIndexes(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "AdvisorSuggestIndexes")
	defer span.End()
	var req SuggestIndexesRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		middleware.RespondBadRequest(c, err.Error())
		return
	}
	result, err := h.svc.SuggestIndexes(ctx, c.GetString("tenant_id"), req)
	if err != nil {
		middleware.RespondBadRequest(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, result)
}
