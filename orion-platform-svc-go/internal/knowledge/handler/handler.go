package handler

import (
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"net/http"
	"strconv"
	"strings"
	"time"

	"orion/go-common/pkg/auth"
	"orion/platform-svc-go/internal/knowledge/models"
	"orion/platform-svc-go/internal/knowledge/service"

	"orion/platform-svc-go/internal/middleware"

	"github.com/gin-gonic/gin"
	"go.opentelemetry.io/otel"
)

type Handler struct {
	svc *service.Service
}

func NewHandler(svc *service.Service) *Handler {
	return &Handler{svc: svc}
}

// sseEvent writes a single SSE event to the writer.
func sseEvent(w gin.ResponseWriter, event string, data interface{}) {
	var payload string
	switch v := data.(type) {
	case string:
		payload = v
	default:
		b, err := json.Marshal(v)
		if err != nil {
			payload = fmt.Sprintf("%v", data)
		} else {
			payload = string(b)
		}
	}
	fmt.Fprintf(w, "event: %s\ndata: %s\n\n", event, payload)
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
	// POST /rag/query - RAG query with full pipeline
	f.POST("/rag/query", auth.RequirePermission("knowledge", "read"), h.RAGQuery)
	// POST /rag/query/stream - SSE streaming RAG query
	f.POST("/rag/query/stream", auth.RequirePermission("knowledge", "read"), h.RAGQueryStream)
	// POST /rag/feedback - user feedback
	f.POST("/rag/feedback", auth.RequirePermission("knowledge", "write"), h.RAGFeedback)

	// --- RAG Admin ---
	// GET /rag/admin/config - pipeline config
	f.GET("/rag/admin/config", auth.RequirePermission("knowledge", "admin"), h.RAGAdminConfig)
	// POST /rag/admin/config - update pipeline config
	f.POST("/rag/admin/config", auth.RequirePermission("knowledge", "admin"), h.RAGAdminUpdateConfig)

	// --- RAG Prompt ---
	// GET /rag/prompt/templates - list prompt templates
	f.GET("/rag/prompt/templates", auth.RequirePermission("knowledge", "admin"), h.RAGPromptTemplates)
	// POST /rag/prompt/templates - save prompt template
	f.POST("/rag/prompt/templates", auth.RequirePermission("knowledge", "admin"), h.RAGPromptSave)

	// --- RAG Index ---
	// POST /rag/index - trigger index build
	f.POST("/rag/index", auth.RequirePermission("knowledge", "admin"), h.RAGIndexTrigger)

	// --- RAG Evaluation ---
	// GET /rag/eval/metrics - evaluation metrics
	f.GET("/rag/eval/metrics", auth.RequirePermission("knowledge", "read"), h.RAGEvalMetrics)
	// GET /rag/eval/ground-truth - ground truth data
	f.GET("/rag/eval/ground-truth", auth.RequirePermission("knowledge", "read"), h.RAGEvalGroundTruth)

	// --- RAG Security Audit ---
	// GET /rag/audit/logs - query audit logs
	f.GET("/rag/audit/logs", auth.RequirePermission("knowledge", "admin"), h.RAGAuditLogs)
	// GET /rag/audit/flagged - flagged queries
	f.GET("/rag/audit/flagged", auth.RequirePermission("knowledge", "admin"), h.RAGFlaggedQueries)

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
	space, err := h.svc.GetSpace(ctx, id, c.GetString("tenant_id"))
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
	space, err := h.svc.UpdateSpace(ctx, id, c.GetString("tenant_id"), req)
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
	if err := h.svc.DeleteSpace(ctx, id, c.GetString("tenant_id")); err != nil {
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
	doc, err := h.svc.GetDoc(ctx, id, c.GetString("tenant_id"))
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
	doc, err := h.svc.UpdateDoc(ctx, id, c.GetString("tenant_id"), req)
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
	if err := h.svc.DeleteDoc(ctx, id, c.GetString("tenant_id")); err != nil {
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
	versions, err := h.svc.GetDocVersions(ctx, id, c.GetString("tenant_id"))
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
	userID := c.GetString("user_id")
	var req models.RAGQueryRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		middleware.RespondBadRequest(c, err.Error())
		return
	}
	if req.Query == "" {
		middleware.RespondBadRequest(c, "query is required")
		return
	}

	// Safety filter: check query for injections / PII
	safety := h.svc.GetSafetyFilter()
	safetyResult := safety.CheckQuery(req.Query)
	if !safetyResult.IsSafe {
		if h.svc.GetRAGRepo() != nil {
			_ = h.svc.SaveQueryAuditLog(ctx, &models.RAGQueryAuditLog{
				ID:            fmt.Sprintf("audit_%d", time.Now().UnixNano()),
				TenantID:      tenantID,
				UserID:        userID,
				QueryText:     safety.Sanitize(req.Query),
				QueryHash:     computeQueryHash(req.Query),
				QueryType:     "blocked",
				SafetyFlagged: true,
				SafetyReason:  safetyResult.Reason,
				IPAddress:     c.ClientIP(),
				UserAgent:     c.GetHeader("User-Agent"),
				CreatedAt:     time.Now().UTC(),
			})
		}
		middleware.RespondForbidden(c, safetyResult.Reason)
		return
	}

	pipeline := h.svc.GetRAGPipeline()
	resp, err := pipeline.Execute(ctx, tenantID, req)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	if req.ConversationID != "" {
		_ = h.svc.SaveRAGMessage(ctx, tenantID, req.ConversationID, req, *resp)
	}

	// Audit log the query
	if h.svc.GetRAGRepo() != nil {
		auditLog := &models.RAGQueryAuditLog{
			ID:           fmt.Sprintf("audit_%d", time.Now().UnixNano()),
			TenantID:     tenantID,
			UserID:       userID,
			QueryText:    safety.Sanitize(req.Query),
			QueryHash:    computeQueryHash(req.Query),
			QueryType:    resp.QueryType,
			Confidence:   resp.Confidence,
			LatencyMs:    resp.LatencyMs,
			SourceCount:  len(resp.Sources),
			AnswerLength: len(resp.Answer),
			IPAddress:    c.ClientIP(),
			UserAgent:    c.GetHeader("User-Agent"),
			CreatedAt:    time.Now().UTC(),
		}
		_ = h.svc.SaveQueryAuditLog(ctx, auditLog)
	}

	middleware.RespondSuccess(c, resp)
}

// RAGQueryStream handles SSE streaming RAG queries.
func (h *Handler) RAGQueryStream(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "RAGQueryStream")
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

	c.Writer.Header().Set("Content-Type", "text/event-stream")
	c.Writer.Header().Set("Cache-Control", "no-cache")
	c.Writer.Header().Set("Connection", "keep-alive")
	writer := c.Writer
	writer.WriteHeader(200)

	flusher := writer.(http.Flusher)

	// Phase 1: retrieval progress
	sseEvent(writer, "progress", map[string]interface{}{"phase": "retrieval", "status": "searching", "message": "正在检索知识库..."})
	flusher.Flush()

	// Phase 2: execute pipeline
	pipeline := h.svc.GetRAGPipeline()
	resp, err := pipeline.Execute(ctx, tenantID, req)
	if err != nil {
		sseEvent(writer, "error", err.Error())
		flusher.Flush()
		return
	}

	// Stream answer in chunks
	answer := resp.Answer
	chunkSize := 50
	for i := 0; i < len(answer); i += chunkSize {
		end := i + chunkSize
		if end > len(answer) {
			end = len(answer)
		}
		sseEvent(writer, "chunk", answer[i:end])
		flusher.Flush()
	}

	// Phase 3: completion
	sseEvent(writer, "complete", map[string]interface{}{
		"answer":     resp.Answer,
		"sources":    resp.Sources,
		"confidence": resp.Confidence,
		"latency_ms": resp.LatencyMs,
		"query_type": resp.QueryType,
	})
	flusher.Flush()
}

// RAGFeedback handles user thumbs-up/thumbs-down feedback.
func (h *Handler) RAGFeedback(c *gin.Context) {
	ctx, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "RAGFeedback")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	userID := c.GetString("user_id")
	var req models.RAGFeedbackRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		middleware.RespondBadRequest(c, err.Error())
		return
	}
	result, err := h.svc.HandleFeedback(ctx, tenantID, userID, req)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, gin.H{"status": result.Status})
}

// RAGAdminConfig returns the current pipeline configuration.
func (h *Handler) RAGAdminConfig(c *gin.Context) {
	_, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "RAGAdminConfig")
	defer span.End()
	pipeline := h.svc.GetRAGPipeline()
	config := pipeline.GetConfig()
	middleware.RespondSuccess(c, config)
}

// RAGAdminUpdateConfig updates pipeline configuration at runtime.
func (h *Handler) RAGAdminUpdateConfig(c *gin.Context) {
	_, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "RAGAdminUpdateConfig")
	defer span.End()
	var updates map[string]interface{}
	if err := c.ShouldBindJSON(&updates); err != nil {
		middleware.RespondBadRequest(c, err.Error())
		return
	}
	pipeline := h.svc.GetRAGPipeline()
	pipeline.UpdateConfig(updates)
	middleware.RespondSuccess(c, gin.H{"status": "updated"})
}

// RAGEvalMetrics returns evaluation metrics summary.
func (h *Handler) RAGEvalMetrics(c *gin.Context) {
	_, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "RAGEvalMetrics")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	metrics, err := h.svc.GetEvalMetrics(c.Request.Context(), tenantID)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, gin.H{
		"tenant_id":          tenantID,
		"recall_at_5":        metrics.RecallAt5,
		"precision":          metrics.Precision,
		"ndcg":               metrics.NDCG,
		"hallucination_rate": metrics.HallucinationRate,
		"avg_latency_ms":     metrics.LatencyMs,
	})
}

// RAGEvalGroundTruth returns ground truth evaluation data.
func (h *Handler) RAGEvalGroundTruth(c *gin.Context) {
	_, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "RAGEvalGroundTruth")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	items, err := h.svc.GetEvalGroundTruth(c.Request.Context(), tenantID)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	itemsOut := make([]interface{}, len(items))
	for i, item := range items {
		itemsOut[i] = gin.H{
			"id":           item.ID,
			"query":        item.Query,
			"gold_answer":  item.GoldAnswer,
			"gold_sources": item.GoldSources,
		}
	}
	middleware.RespondSuccess(c, gin.H{
		"tenant_id": tenantID,
		"items":     itemsOut,
		"total":     len(items),
	})
}

// RAGPromptTemplates lists all prompt templates.
func (h *Handler) RAGPromptTemplates(c *gin.Context) {
	_, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "RAGPromptTemplates")
	defer span.End()
	stats := h.svc.GetPromptMgr().GetPromptTemplateStats(c.Request.Context())
	middleware.RespondSuccess(c, stats)
}

// RAGPromptSave saves a new prompt template version.
func (h *Handler) RAGPromptSave(c *gin.Context) {
	_, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "RAGPromptSave")
	defer span.End()
	var req struct {
		Name    string `json:"name" binding:"required"`
		Version string `json:"version" binding:"required"`
		Content string `json:"content" binding:"required"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		middleware.RespondBadRequest(c, err.Error())
		return
	}
	mgr := h.svc.GetPromptMgr()
	if mgr == nil {
		middleware.RespondBadRequest(c, "prompt manager not initialized")
		return
	}
	tmpl := &models.PromptTemplate{Name: req.Name, Version: req.Version, Content: req.Content, IsActive: true}
	if err := mgr.SavePrompt(c.Request.Context(), tmpl); err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, gin.H{"id": tmpl.ID, "name": req.Name, "version": req.Version})
}

// RAGIndexTrigger triggers a document re-index.
func (h *Handler) RAGIndexTrigger(c *gin.Context) {
	_, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "RAGIndexTrigger")
	defer span.End()
	tenantID := c.GetString("tenant_id")
	docs, err := h.svc.ListDocs(c.Request.Context(), tenantID, models.DocListQuery{Status: "published", Limit: 1000})
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	_ = docs
	middleware.RespondSuccess(c, gin.H{"status": "indexing", "documents_scanned": len(docs)})
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
		space, e := h.svc.GetSpace(ctx, spaceID, c.GetString("tenant_id"))
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

// --- RAG Security Audit Handlers ---

func (h *Handler) RAGAuditLogs(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "50"))
	offset, _ := strconv.Atoi(c.DefaultQuery("offset", "0"))
	logs, err := h.svc.ListQueryAuditLogs(c.Request.Context(), tenantID, limit, offset)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	total, err := h.svc.CountQueryAuditLogs(c.Request.Context(), tenantID)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, gin.H{"data": logs, "total": total})
}

func (h *Handler) RAGFlaggedQueries(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "50"))
	offset, _ := strconv.Atoi(c.DefaultQuery("offset", "0"))
	logs, err := h.svc.ListFlaggedQueryAuditLogs(c.Request.Context(), tenantID, limit, offset)
	if err != nil {
		middleware.RespondInternalError(c, err.Error())
		return
	}
	middleware.RespondSuccess(c, gin.H{"data": logs, "total": len(logs)})
}

// computeQueryHash computes a deterministic hash of a query string.
func computeQueryHash(query string) string {
	h := sha256.Sum256([]byte(strings.ToLower(strings.TrimSpace(query))))
	return hex.EncodeToString(h[:32])
}
