package handler

import (
	"strconv"

	"orion/go-common/pkg/auth"
	"orion/platform-svc-go/internal/knowledge/models"
	"orion/platform-svc-go/internal/knowledge/service"

	"github.com/gin-gonic/gin"
	"orion/platform-svc-go/internal/middleware"
	"go.opentelemetry.io/otel"
)

type Handler struct {
	svc *service.Service
}

func NewHandler(svc *service.Service) *Handler {
	return &Handler{svc: svc}
}

// RegisterRoutes registers all knowledge endpoints under the given group.
// Mirrors /api/v1/knowledge routes from the TS source (18 endpoints).
func (h *Handler) RegisterRoutes(rg *gin.RouterGroup) {
	f := rg.Group("/knowledge")

	// --- Space CRUD ---
	// GET /spaces - list/search spaces
	f.GET("/spaces", auth.RequirePermission("knowledge", "read"), h.ListSpaces)
	// POST /spaces - create space
	f.POST("/spaces", auth.RequirePermission("knowledge", "write"), h.CreateSpace)
	// GET /spaces/:id - get space detail
	f.GET("/spaces/:id", auth.RequirePermission("knowledge", "read"), h.GetSpace)
	// PUT /spaces/:id - update space
	f.PUT("/spaces/:id", auth.RequirePermission("knowledge", "write"), h.UpdateSpace)
	// DELETE /spaces/:id - delete space
	f.DELETE("/spaces/:id", auth.RequirePermission("knowledge", "delete"), h.DeleteSpace)

	// --- Document CRUD ---
	// GET /docs - list/search documents
	f.GET("/docs", auth.RequirePermission("knowledge", "read"), h.ListDocs)
	// GET /docs/tags - get document center tags
	f.GET("/docs/tags", auth.RequirePermission("knowledge", "read"), h.GetDocTags)
	// GET /docs/toc - get document center table of contents
	f.GET("/docs/toc", auth.RequirePermission("knowledge", "read"), h.GetDocToc)
	// POST /docs - create document
	f.POST("/docs", auth.RequirePermission("knowledge", "write"), h.CreateDoc)
	// GET /docs/:id - get document detail
	f.GET("/docs/:id", auth.RequirePermission("knowledge", "read"), h.GetDoc)
	// PUT /docs/:id - update document
	f.PUT("/docs/:id", auth.RequirePermission("knowledge", "write"), h.UpdateDoc)
	// DELETE /docs/:id - delete document
	f.DELETE("/docs/:id", auth.RequirePermission("knowledge", "delete"), h.DeleteDoc)
	// GET /docs/:id/versions - get document version history
	f.GET("/docs/:id/versions", auth.RequirePermission("knowledge", "read"), h.GetDocVersions)

	// --- Sync ---
	// POST /sync - trigger document center sync
	f.POST("/sync", auth.RequirePermission("knowledge", "write"), h.TriggerSync)
	// GET /sync/logs - get sync logs
	f.GET("/sync/logs", auth.RequirePermission("knowledge", "read"), h.GetSyncLogs)

	// --- RAG ---
	// POST /rag/retrieve - semantic/text retrieve
	f.POST("/rag/retrieve", auth.RequirePermission("knowledge", "read"), h.RAGRetrieve)
	// POST /rag/query - RAG query with source attribution
	f.POST("/rag/query", auth.RequirePermission("knowledge", "read"), h.RAGQuery)

	// --- Knowledge Graph ---
	// GET /graph - get knowledge graph
	f.GET("/graph", auth.RequirePermission("knowledge", "read"), h.GetGraph)
}

// --- Space handlers ---

func (h *Handler) ListSpaces(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "ListSpaces")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	q := models.SpaceListQuery{
		Type:   c.Query("type"),
		Search: c.Query("search"),
	}
	p := 1
	pp := 50
	if page := c.Query("page"); page != "" {
		if v, err := strconv.Atoi(page); err == nil && v > 0 {
			p = v
		}
	}
	if perPage := c.Query("perPage"); perPage != "" {
		if v, err := strconv.Atoi(perPage); err == nil && v > 0 {
			pp = v
		}
	}
	q.Limit = pp
	q.Offset = (p - 1) * pp

	spaces, err := h.svc.ListSpaces(ctx, tenantID, q)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, models.PaginatedResponse{
		Data: spaces,
		Meta: models.Meta{Total: len(spaces), Page: p, PerPage: pp},
	})
}

func (h *Handler) CreateSpace(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "CreateSpace")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	var req models.CreateSpaceRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		middleware.RespondBadRequest(c, err.Error())
		return
	}
	if req.Name == "" {
		middleware.RespondBadRequest(c, "name is required")
		return
	}
	space, err := h.svc.CreateSpace(ctx, tenantID, req)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondCreated(c, space)
}

func (h *Handler) GetSpace(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "GetSpace")
	defer span.End()
	id := c.Param("id")
	space, err := h.svc.GetSpace(ctx, id)
	if err != nil {
		if service.IsNotFound(err) {
			middleware.RespondNotFound(c, "space not found")
			return
		}
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, space)
}

func (h *Handler) UpdateSpace(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "UpdateSpace")
	defer span.End()
	id := c.Param("id")
	var req models.UpdateSpaceRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		middleware.RespondBadRequest(c, err.Error())
		return
	}
	space, err := h.svc.UpdateSpace(ctx, id, req)
	if err != nil {
		if service.IsNotFound(err) {
			middleware.RespondNotFound(c, "space not found")
			return
		}
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, space)
}

func (h *Handler) DeleteSpace(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "DeleteSpace")
	defer span.End()
	id := c.Param("id")
	if err := h.svc.DeleteSpace(ctx, id); err != nil {
		if service.IsNotFound(err) {
			middleware.RespondNotFound(c, "space not found")
			return
		}
		middleware.RespondInternalError(c, err.Error())
		return
	}
	c.Status(204)
}

// --- Document handlers ---

func (h *Handler) ListDocs(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "ListDocs")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	q := models.DocListQuery{
		SpaceID: c.Query("spaceId"),
		Status:  c.Query("status"),
		Tag:     c.Query("tag"),
		Search:  c.Query("search"),
	}
	p := 1
	pp := 50
	if page := c.Query("page"); page != "" {
		if v, err := strconv.Atoi(page); err == nil && v > 0 {
			p = v
		}
	}
	if pageSize := c.Query("pageSize"); pageSize != "" {
		if v, err := strconv.Atoi(pageSize); err == nil && v > 0 {
			pp = v
		}
	} else if perPage := c.Query("perPage"); perPage != "" {
		if v, err := strconv.Atoi(perPage); err == nil && v > 0 {
			pp = v
		}
	}
	q.Limit = pp
	q.Offset = (p - 1) * pp

	var docs []models.Document
	var err error
	if c.Query("type") == "docs" {
		docs, err = h.svc.ListDocsByType(ctx, tenantID, q)
	} else {
		docs, err = h.svc.ListDocs(ctx, tenantID, q)
	}
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, models.PaginatedResponse{
		Data: docs,
		Meta: models.Meta{Total: len(docs), Page: p, PerPage: pp, Type: c.Query("type")},
	})
}

func (h *Handler) GetDocTags(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "GetDocTags")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	tags, err := h.svc.GetDocTags(ctx, tenantID)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, tags)
}

func (h *Handler) GetDocToc(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "GetDocToc")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	toc, err := h.svc.GetDocToc(ctx, tenantID)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, toc)
}

func (h *Handler) CreateDoc(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "CreateDoc")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	var req models.CreateDocumentRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		middleware.RespondBadRequest(c, err.Error())
		return
	}
	if req.Title == "" || req.Content == "" || req.SpaceID == "" {
		middleware.RespondBadRequest(c, "title, content, and space_id are required")
		return
	}
	doc, err := h.svc.CreateDoc(ctx, tenantID, req)
	if err != nil {
		if service.IsNotFound(err) {
			middleware.RespondNotFound(c, "space not found")
			return
		}
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondCreated(c, doc)
}

func (h *Handler) GetDoc(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "GetDoc")
	defer span.End()
	id := c.Param("id")
	doc, err := h.svc.GetDoc(ctx, id)
	if err != nil {
		if service.IsNotFound(err) {
			middleware.RespondNotFound(c, "document not found")
			return
		}
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, doc)
}

func (h *Handler) UpdateDoc(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "UpdateDoc")
	defer span.End()
	id := c.Param("id")
	var req models.UpdateDocumentRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		middleware.RespondBadRequest(c, err.Error())
		return
	}
	doc, err := h.svc.UpdateDoc(ctx, id, req)
	if err != nil {
		if service.IsNotFound(err) {
			middleware.RespondNotFound(c, "document not found")
			return
		}
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, doc)
}

func (h *Handler) DeleteDoc(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "DeleteDoc")
	defer span.End()
	id := c.Param("id")
	if err := h.svc.DeleteDoc(ctx, id); err != nil {
		if service.IsNotFound(err) {
			middleware.RespondNotFound(c, "document not found")
			return
		}
		middleware.RespondInternalError(c, err.Error())
		return
	}
	c.Status(204)
}

func (h *Handler) GetDocVersions(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "GetDocVersions")
	defer span.End()
	id := c.Param("id")
	versions, err := h.svc.GetDocVersions(ctx, id)
	if err != nil {
		if service.IsNotFound(err) {
			middleware.RespondNotFound(c, "document not found")
			return
		}
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, versions)
}

// --- Sync handlers ---

func (h *Handler) TriggerSync(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "TriggerSync")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	var req models.SyncTriggerRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		middleware.RespondBadRequest(c, err.Error())
		return
	}
	log, err := h.svc.TriggerSync(ctx, tenantID, req.Source)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, log)
}

func (h *Handler) GetSyncLogs(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "GetSyncLogs")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	limit := 10
	if l := c.Query("limit"); l != "" {
		if v, err := strconv.Atoi(l); err == nil && v > 0 {
			limit = v
		}
	}
	logs, err := h.svc.GetSyncLogs(ctx, tenantID, limit)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, logs)
}

// --- RAG handlers ---

func (h *Handler) RAGRetrieve(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "RAGRetrieve")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	var req models.RetrieveRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		middleware.RespondBadRequest(c, err.Error())
		return
	}
	if req.Query == "" {
		middleware.RespondBadRequest(c, "query is required")
		return
	}
	results, err := h.svc.Retrieve(ctx, tenantID, req.Query, models.RetrieveRequest{SpaceID: req.SpaceID, TopK: req.TopK})
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	resp := models.RetrieveResponse{
		Results: make([]models.RetrieveResult, len(results)),
		Total:   len(results),
	}
	for i, r := range results {
		snippet := r.Content
		if len(snippet) > 500 {
			snippet = snippet[:500]
		}
		resp.Results[i] = models.RetrieveResult{
			ID:      r.ID,
			Title:   r.Title,
			Snippet: snippet,
			Score:   r.Similarity,
		}
	}
	middleware.RespondSuccess(c, resp)
}

func (h *Handler) RAGQuery(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "RAGQuery")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	var req models.RAGQueryRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		middleware.RespondBadRequest(c, err.Error())
		return
	}
	if req.Query == "" {
		middleware.RespondBadRequest(c, "query is required")
		return
	}
	results, err := h.svc.Retrieve(ctx, tenantID, req.Query, models.RetrieveRequest{SpaceID: req.SpaceID, TopK: req.TopK})
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}

	resp := models.RAGQueryResponse{
		Sources:    make([]models.RAGSource, 0),
		Confidence: 0,
	}

	if len(results) > 0 {
		var sourceContents []string
		for _, r := range results {
			if r.Similarity > 0.3 {
				snippet := r.Content
				if len(snippet) > 500 {
					snippet = snippet[:500]
				}
				sourceContents = append(sourceContents, snippet)
			}
			sSnippet := r.Content
			if len(sSnippet) > 300 {
				sSnippet = sSnippet[:300]
			}
			resp.Sources = append(resp.Sources, models.RAGSource{
				DocumentID:     r.ID,
				Title:          r.Title,
				Snippet:        sSnippet,
				RelevanceScore: r.Similarity,
				SpaceID:        r.SpaceID,
			})
		}
		sourceText := ""
		for i, sc := range sourceContents {
			if i > 0 {
				sourceText += "\n\n---\n\n"
			}
			sourceText += sc
		}
		if len(sourceText) > 2000 {
			sourceText = sourceText[:2000]
		}
		resp.Answer = "Based on " + strconv.Itoa(len(results)) + " retrieved knowledge source(s):\n\n" + sourceText
		resp.Confidence = results[0].Similarity + 0.2
		if resp.Confidence > 0.9 {
			resp.Confidence = 0.9
		}
	} else {
		resp.Answer = "No relevant knowledge sources found for the query."
	}

	middleware.RespondSuccess(c, resp)
}

// --- Knowledge Graph handler ---

func (h *Handler) GetGraph(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "GetGraph")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	spaceID := c.Query("spaceId")

	var spaces []models.Space
	var err error
	if spaceID != "" {
		space, e := h.svc.GetSpace(ctx, spaceID)
		if e != nil {
			if service.IsNotFound(e) {
				middleware.RespondNotFound(c, "space not found")
				return
			}
			middleware.RespondInternalError(c, e.Error())
			return
		}
		spaces = []models.Space{*space}
	} else {
		spaces, err = h.svc.ListSpaces(ctx, tenantID, models.SpaceListQuery{Limit: 20})
		if err != nil {
			middleware.RespondInternalError(c, err.Error())
			return
		}
	}

	nodes := make([]models.GraphNode, 0)
	edges := make([]models.GraphEdge, 0)

	for _, space := range spaces {
		nodes = append(nodes, models.GraphNode{ID: space.ID, Type: "space", Label: space.Name})

		docs, e := h.svc.ListDocs(ctx, tenantID, models.DocListQuery{SpaceID: space.ID, Limit: 50})
		if e != nil {
			continue
		}
		for _, doc := range docs {
			nodes = append(nodes, models.GraphNode{ID: doc.ID, Type: "doc", Label: doc.Title, SpaceID: doc.SpaceID})
			edges = append(edges, models.GraphEdge{Source: space.ID, Target: doc.ID, Relation: "contains"})

			for _, tag := range doc.Tags {
				tagID := "tag-" + tag
				found := false
				for _, n := range nodes {
					if n.ID == tagID {
						found = true
						break
					}
				}
				if !found {
					nodes = append(nodes, models.GraphNode{ID: tagID, Type: "tag", Label: tag})
				}
				edges = append(edges, models.GraphEdge{Source: doc.ID, Target: tagID, Relation: "tagged"})
			}
		}
	}

	middleware.RespondSuccess(c, models.GraphResponse{Nodes: nodes, Edges: edges})
}
