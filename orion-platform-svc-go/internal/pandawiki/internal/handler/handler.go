package handler

import (
	"strconv"

	"orion/platform-svc-go/internal/pandawiki/internal/models"
	"orion/platform-svc-go/internal/pandawiki/internal/repository"
	"orion/platform-svc-go/internal/pandawiki/internal/service"
	"orion/go-common/pkg/auth"

	"github.com/gin-gonic/gin"
)

type Handler struct {
	svc *service.Service
}

func NewHandler(svc *service.Service) *Handler {
	return &Handler{svc: svc}
}

// RegisterRoutes registers all endpoints under the given group.
func (h *Handler) RegisterRoutes(rg *gin.RouterGroup) {
	// Spaces
	r := rg.Group("/spaces")
	r.POST("", auth.RequirePermission("pandawiki", "write"), h.CreateSpace)
	r.GET("", auth.RequirePermission("pandawiki", "read"), h.ListSpaces)
	r.GET("/:id", auth.RequirePermission("pandawiki", "read"), h.GetSpace)
	r.PUT("/:id", auth.RequirePermission("pandawiki", "write"), h.UpdateSpace)
	r.DELETE("/:id", auth.RequirePermission("pandawiki", "delete"), h.DeleteSpace)

	// Documents
	d := rg.Group("/docs")
	d.GET("", auth.RequirePermission("pandawiki", "read"), h.ListDocs)
	d.POST("", auth.RequirePermission("pandawiki", "write"), h.CreateDoc)
	d.GET("/:id", auth.RequirePermission("pandawiki", "read"), h.GetDoc)
	d.PUT("/:id", auth.RequirePermission("pandawiki", "write"), h.UpdateDoc)
	d.DELETE("/:id", auth.RequirePermission("pandawiki", "delete"), h.DeleteDoc)
	d.GET("/:id/versions", auth.RequirePermission("pandawiki", "read"), h.GetDocVersions)

	// Document Center
	d.GET("/docs/tags", auth.RequirePermission("pandawiki", "read"), h.GetDocTags)
	d.GET("/docs/toc", auth.RequirePermission("pandawiki", "read"), h.GetDocToc)

	// Sync
	d.POST("/sync", auth.RequirePermission("pandawiki", "write"), h.TriggerSync)
	d.GET("/sync/logs", auth.RequirePermission("pandawiki", "read"), h.GetSyncLogs)

	// RAG
	d.POST("/rag/retrieve", auth.RequirePermission("pandawiki", "read"), h.RAGRetrieve)
	d.POST("/rag/query", auth.RequirePermission("pandawiki", "read"), h.RAGQuery)

	// Knowledge Graph
	d.GET("/graph", auth.RequirePermission("pandawiki", "read"), h.GetGraph)
}

// ================== Space Handlers ==================

func (h *Handler) CreateSpace(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	var req models.CreateSpaceRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		respondBadRequest(c, err.Error())
		return
	}
	space, err := h.svc.CreateSpace(c.Request.Context(), tenantID, &req)
	if err != nil {
		if err == service.ErrInvalidInput {
			respondBadRequest(c, err.Error())
			return
		}
		respondInternalError(c, err.Error())
		return
	}
	respondCreated(c, space)
}

func (h *Handler) ListSpaces(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	opts := parseSpaceListOpts(c)
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	pp := 50
	if p := c.Query("perPage"); p != "" {
		pp, _ = strconv.Atoi(p)
	}
	offset := (page - 1) * pp
	spaces, total, err := h.svc.ListSpaces(c.Request.Context(), tenantID, offset, pp, opts)
	if err != nil {
		respondInternalError(c, err.Error())
		return
	}
	respondSuccess(c, gin.H{
		"data": spaces,
		"meta": gin.H{"total": total, "page": page, "perPage": pp},
	})
}

func (h *Handler) GetSpace(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	space, err := h.svc.GetSpace(c.Request.Context(), tenantID, c.Param("id"))
	if err != nil {
		if err == service.ErrNotFound {
			respondNotFound(c, "space not found")
			return
		}
		respondInternalError(c, err.Error())
		return
	}
	respondSuccess(c, space)
}

func (h *Handler) UpdateSpace(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	var input models.UpdateSpaceInput
	if err := c.ShouldBindJSON(&input); err != nil {
		respondBadRequest(c, err.Error())
		return
	}
	space, err := h.svc.UpdateSpace(c.Request.Context(), tenantID, c.Param("id"), &input)
	if err != nil {
		if err == service.ErrNotFound {
			respondNotFound(c, err.Error())
			return
		}
		respondBadRequest(c, err.Error())
		return
	}
	respondSuccess(c, space)
}

func (h *Handler) DeleteSpace(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	err := h.svc.DeleteSpace(c.Request.Context(), tenantID, c.Param("id"))
	if err != nil {
		if err == service.ErrNotFound {
			respondNotFound(c, err.Error())
			return
		}
		respondInternalError(c, err.Error())
		return
	}
	respondSuccess(c, gin.H{"message": "deleted"})
}

// ================== Document Handlers ==================

func (h *Handler) CreateDoc(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	var input models.CreateDocInput
	if err := c.ShouldBindJSON(&input); err != nil {
		respondBadRequest(c, err.Error())
		return
	}
	if input.Title == "" || input.Content == "" || input.SpaceID == "" {
		respondBadRequest(c, "title, content, and space_id are required")
		return
	}
	doc, err := h.svc.CreateDoc(c.Request.Context(), tenantID, &input)
	if err != nil {
		if err == service.ErrNotFound {
			respondNotFound(c, err.Error())
			return
		}
		if err == service.ErrInvalidInput {
			respondBadRequest(c, err.Error())
			return
		}
		respondInternalError(c, err.Error())
		return
	}
	respondCreated(c, doc)
}

func (h *Handler) ListDocs(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	opts := parseDocListOpts(c)
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	pp, _ := strconv.Atoi(c.DefaultQuery("pageSize", "50"))
	if p := c.Query("perPage"); p != "" {
		pp, _ = strconv.Atoi(p)
	}
	offset := (page - 1) * pp
	docs, total, err := h.svc.ListDocs(c.Request.Context(), tenantID, offset, pp, opts)
	if err != nil {
		respondInternalError(c, err.Error())
		return
	}
	respondSuccess(c, gin.H{
		"data": docs,
		"meta": gin.H{"total": total, "page": page, "perPage": pp},
	})
}

func (h *Handler) GetDoc(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	doc, err := h.svc.GetDoc(c.Request.Context(), tenantID, c.Param("id"))
	if err != nil {
		if err == service.ErrNotFound {
			respondNotFound(c, "document not found")
			return
		}
		respondInternalError(c, err.Error())
		return
	}
	respondSuccess(c, doc)
}

func (h *Handler) UpdateDoc(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	var input models.UpdateDocInput
	if err := c.ShouldBindJSON(&input); err != nil {
		respondBadRequest(c, err.Error())
		return
	}
	doc, err := h.svc.UpdateDoc(c.Request.Context(), tenantID, c.Param("id"), &input)
	if err != nil {
		if err == service.ErrNotFound {
			respondNotFound(c, err.Error())
			return
		}
		respondBadRequest(c, err.Error())
		return
	}
	respondSuccess(c, doc)
}

func (h *Handler) DeleteDoc(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	err := h.svc.DeleteDoc(c.Request.Context(), tenantID, c.Param("id"))
	if err != nil {
		if err == service.ErrNotFound {
			respondNotFound(c, err.Error())
			return
		}
		respondInternalError(c, err.Error())
		return
	}
	respondSuccess(c, gin.H{"message": "deleted"})
}

func (h *Handler) GetDocVersions(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	versions, err := h.svc.GetDocVersions(c.Request.Context(), tenantID, c.Param("id"))
	if err != nil {
		if err == service.ErrNotFound {
			respondNotFound(c, "document not found")
			return
		}
		respondInternalError(c, err.Error())
		return
	}
	respondSuccess(c, versions)
}

// ================== Document Center Handlers ==================

func (h *Handler) GetDocTags(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	tags, err := h.svc.GetDocTags(c.Request.Context(), tenantID)
	if err != nil {
		respondInternalError(c, err.Error())
		return
	}
	respondSuccess(c, tags)
}

func (h *Handler) GetDocToc(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	toc, err := h.svc.GetDocToc(c.Request.Context(), tenantID)
	if err != nil {
		respondInternalError(c, err.Error())
		return
	}
	respondSuccess(c, toc)
}

// ================== Sync Handlers ==================

func (h *Handler) TriggerSync(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	var body struct {
		Source *string `json:"source"`
	}
	if err := c.ShouldBindJSON(&body); err != nil {
		respondBadRequest(c, err.Error())
		return
	}
	log, err := h.svc.TriggerSync(c.Request.Context(), tenantID, body.Source)
	if err != nil {
		respondInternalError(c, err.Error())
		return
	}
	respondSuccess(c, log)
}

func (h *Handler) GetSyncLogs(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "10"))
	logs, err := h.svc.GetSyncLogs(c.Request.Context(), tenantID, limit)
	if err != nil {
		respondInternalError(c, err.Error())
		return
	}
	respondSuccess(c, logs)
}

// ================== RAG Handlers ==================

func (h *Handler) RAGRetrieve(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	var body struct {
		Query   string  `json:"query"`
		SpaceID *string `json:"spaceId"`
		TopK    int     `json:"topK"`
	}
	if err := c.ShouldBindJSON(&body); err != nil {
		respondBadRequest(c, err.Error())
		return
	}
	if body.Query == "" {
		respondBadRequest(c, "query is required")
		return
	}
	results, err := h.svc.Retrieve(c.Request.Context(), tenantID, body.Query, body.SpaceID, body.TopK)
	if err != nil {
		respondInternalError(c, err.Error())
		return
	}
	snippets := make([]gin.H, len(results))
	for i, r := range results {
		snippet := r.Content
		if len(snippet) > 500 {
			snippet = snippet[:500]
		}
		snippets[i] = gin.H{
			"docId":   r.ID,
			"title":   r.Title,
			"snippet": snippet,
			"score":   r.Similarity,
		}
	}
	respondSuccess(c, gin.H{
		"results": snippets,
		"total":   len(results),
	})
}

func (h *Handler) RAGQuery(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	var body struct {
		Query   string  `json:"query"`
		SpaceID *string `json:"spaceId"`
		TopK    int     `json:"topK"`
	}
	if err := c.ShouldBindJSON(&body); err != nil {
		respondBadRequest(c, err.Error())
		return
	}
	if body.Query == "" {
		respondBadRequest(c, "query is required")
		return
	}
	results, err := h.svc.Retrieve(c.Request.Context(), tenantID, body.Query, body.SpaceID, body.TopK)
	if err != nil {
		respondInternalError(c, err.Error())
		return
	}

	var answer string
	var confidence float64
	sources := make([]gin.H, 0)

	if len(results) > 0 {
		contentParts := make([]string, 0)
		for _, r := range results {
			if r.Similarity > 0.3 {
				s := r.Content
				if len(s) > 500 {
					s = s[:500]
				}
				contentParts = append(contentParts, s)
			}
			snippet := r.Content
			if len(snippet) > 300 {
				snippet = snippet[:300]
			}
			sources = append(sources, gin.H{
				"documentId":     r.ID,
				"title":          r.Title,
				"snippet":        snippet,
				"relevanceScore": r.Similarity,
				"spaceId":        r.SpaceID,
			})
		}

		joinStr := ""
		for i, p := range contentParts {
			if i > 0 {
				joinStr += "\n\n---\n\n"
			}
			joinStr += p
		}

		if joinStr != "" {
			answer = "Based on " + strconv.Itoa(len(results)) + " retrieved knowledge source(s):\n\n" + joinStr
			confidence = min(0.9, results[0].Similarity+0.2)
		} else {
			answer = "No relevant knowledge sources found for the query."
		}
	} else {
		answer = "No relevant knowledge sources found for the query."
	}

	respondSuccess(c, gin.H{
		"answer":     answer,
		"sources":    sources,
		"confidence": confidence,
	})
}

// ================== Graph Handler ==================

func (h *Handler) GetGraph(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	spaceID := c.Query("spaceId")
	graph, err := h.svc.GetGraph(c.Request.Context(), &tenantID, &spaceID)
	if err != nil {
		if err == service.ErrNotFound {
			respondNotFound(c, err.Error())
			return
		}
		respondInternalError(c, err.Error())
		return
	}
	respondSuccess(c, graph)
}

// ================== Helpers ==================

func parseSpaceListOpts(c *gin.Context) *repository.ListSpacesOpts {
	var opts repository.ListSpacesOpts
	t := c.Query("type")
	s := c.Query("search")
	if t != "" {
		opts.Type = &t
	}
	if s != "" {
		opts.Search = &s
	}
	return &opts
}

func parseDocListOpts(c *gin.Context) *repository.ListDocsOpts {
	var opts repository.ListDocsOpts
	spaceID := c.Query("spaceId")
	status := c.Query("status")
	tag := c.Query("tag")
	search := c.Query("search")
	dType := c.Query("type")
	source := c.Query("source")
	if spaceID != "" {
		opts.SpaceID = &spaceID
	}
	if status != "" {
		opts.Status = &status
	}
	if tag != "" {
		opts.Tag = &tag
	}
	if search != "" {
		opts.Search = &search
	}
	if dType != "" {
		opts.Type = &dType
	}
	if source != "" {
		opts.Source = &source
	}
	return &opts
}
