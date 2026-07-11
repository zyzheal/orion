package handler

import (
	"net/http"
	"strconv"

	"github.com/gin-gonic/gin"
	"orion-cmdb-svc-go/internal/models"
	"orion-cmdb-svc-go/internal/service"
)

// CmdbHandler provides the /api/v1/cmdb/* endpoints that map directly to
// the Node.js cmdb-routes.ts. It wraps CIService to match the original
// API surface while using Go idioms.
type CmdbHandler struct {
	svc *service.CIService
}

func NewCmdbHandler(svc *service.CIService) *CmdbHandler {
	return &CmdbHandler{svc: svc}
}

// RegisterRoutes registers all /api/v1/cmdb/* routes.
func (h *CmdbHandler) RegisterRoutes(r *gin.RouterGroup) {
	cmdb := r.Group("/cmdb")

	// CI CRUD
	cmdb.POST("/cis", h.CreateCI)
	cmdb.GET("/cis", h.ListCIs)
	cmdb.GET("/cis/:id", h.GetCI)
	cmdb.GET("/cis/by-id/:ciId", h.GetCIByCiId)
	cmdb.PUT("/cis/:id", h.UpdateCI)
	cmdb.DELETE("/cis/:id", h.DeleteCI)

	// Batch operations
	cmdb.POST("/batch-create", h.BatchCreate)
	cmdb.PUT("/batch-update", h.BatchUpdate)
	cmdb.DELETE("/batch-delete", h.BatchDelete)

	// Batch query
	cmdb.POST("/ci/query", h.BatchQuery)

	// Export / Import
	cmdb.GET("/ci/export/:id", h.ExportCI)
	cmdb.GET("/export", h.ExportCIs)
	cmdb.POST("/import", h.ImportCIs)

	// Relations
	cmdb.GET("/cis/:ciId/relations", h.GetCIRelations)
	cmdb.POST("/relations", h.CreateRelation)
	cmdb.DELETE("/relations/:relationId", h.DeleteRelation)

	// Versions
	cmdb.GET("/cis/:ciId/versions", h.GetCIVersions)
	cmdb.GET("/cis/:ciId/versions/current", h.GetCICurrentVersion)
	cmdb.POST("/cis/:ciId/versions/restore", h.RestoreToVersion)

	// Topology
	cmdb.GET("/topology", h.GetTopology)
	cmdb.GET("/topology/:ciId/dependencies", h.GetServiceDependencies)
	cmdb.GET("/topology/:ciId/impact", h.GetImpactAnalysis)

	// Integration (Hosts, K8s, CICD, Execute)
	cmdb.GET("/hosts", h.ListHosts)
	cmdb.GET("/hosts/:ciId", h.GetHost)
	cmdb.GET("/k8s", h.ListK8sResources)
	cmdb.POST("/k8s/sync/start", h.StartK8sSync)
	cmdb.POST("/k8s/sync/stop", h.StopK8sSync)
	cmdb.GET("/cicd", h.ListCICDResources)
	cmdb.POST("/execute", h.ExecuteScript)

	// Health
	cmdb.GET("/health", h.Health)
}

// getTenantID extracts tenant_id from gin context (set by auth middleware).
func getTenantID(c *gin.Context) string {
	tenantID := c.GetString("tenant_id")
	if tenantID == "" {
		tenantID = "1"
	}
	return tenantID
}

// getActor extracts the actor (user ID) from gin context (set by auth middleware).
func getActor(c *gin.Context) string {
	return c.GetString("user_id")
}

// response wraps a successful response to match the Node.js shape.
func successResponse(c *gin.Context, data any) {
	c.JSON(http.StatusOK, gin.H{"success": true, "data": data})
}

func successPaginated(c *gin.Context, data []any, total int, page int, pageSize int) {
	c.JSON(http.StatusOK, gin.H{
		"success":  true,
		"data":     data,
		"total":    total,
		"page":     page,
		"pageSize": pageSize,
	})
}

func errorResponse(c *gin.Context, status int, code string, msg string) {
	c.JSON(status, gin.H{
		"success": false,
		"error":   msg,
		"code":    code,
	})
}

// ==================== CI CRUD ====================

// CreateCI POST /api/v1/cmdb/cis
func (h *CmdbHandler) CreateCI(c *gin.Context) {
	tenantID := getTenantID(c)
	actor := getActor(c)

	var req models.CreateCIRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		errorResponse(c, http.StatusBadRequest, "CREATE_ERROR", err.Error())
		return
	}

	item, err := h.svc.Create(c.Request.Context(), tenantID, &req, actor)
	if err != nil {
		errorResponse(c, http.StatusInternalServerError, "CREATE_ERROR", err.Error())
		return
	}

	c.JSON(http.StatusCreated, gin.H{"success": true, "data": item})
}

// ListCIs GET /api/v1/cmdb/cis
func (h *CmdbHandler) ListCIs(c *gin.Context) {
	tenantID := getTenantID(c)

	var q models.ListQuery
	if err := c.ShouldBindQuery(&q); err != nil {
		errorResponse(c, http.StatusBadRequest, "LIST_ERROR", err.Error())
		return
	}

	// Default page_size to 20 if 0
	if q.PageSize <= 0 {
		q.PageSize = 20
	}

	items, total, err := h.svc.List(c.Request.Context(), tenantID, q)
	if err != nil {
		errorResponse(c, http.StatusInternalServerError, "LIST_ERROR", err.Error())
		return
	}

	successPaginated(c, itemsToAny(items), total, q.Page, q.PageSize)
}

// GetCI GET /api/v1/cmdb/cis/:id
func (h *CmdbHandler) GetCI(c *gin.Context) {
	tenantID := getTenantID(c)
	id := c.Param("id")

	item, err := h.svc.GetByID(c.Request.Context(), id, tenantID)
	if err != nil {
		errorResponse(c, http.StatusNotFound, "NOT_FOUND", "CI not found")
		return
	}

	successResponse(c, item)
}

// GetCIByCiId GET /api/v1/cmdb/cis/by-id/:ciId
func (h *CmdbHandler) GetCIByCiId(c *gin.Context) {
	tenantID := getTenantID(c)
	ciID := c.Param("ciId")

	item, err := h.svc.GetCIByCiID(c.Request.Context(), tenantID, ciID)
	if err != nil {
		errorResponse(c, http.StatusNotFound, "NOT_FOUND", "CI not found")
		return
	}

	successResponse(c, item)
}

// UpdateCI PUT /api/v1/cmdb/cis/:id
func (h *CmdbHandler) UpdateCI(c *gin.Context) {
	tenantID := getTenantID(c)
	id := c.Param("id")
	actor := getActor(c)

	var req models.UpdateCIRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		errorResponse(c, http.StatusBadRequest, "UPDATE_ERROR", err.Error())
		return
	}

	item, err := h.svc.Update(c.Request.Context(), tenantID, id, &req, actor)
	if err != nil {
		errorResponse(c, http.StatusNotFound, "UPDATE_ERROR", err.Error())
		return
	}

	successResponse(c, item)
}

// DeleteCI DELETE /api/v1/cmdb/cis/:id
func (h *CmdbHandler) DeleteCI(c *gin.Context) {
	tenantID := getTenantID(c)
	id := c.Param("id")
	actor := getActor(c)

	if err := h.svc.Delete(c.Request.Context(), tenantID, id, actor); err != nil {
		errorResponse(c, http.StatusNotFound, "DELETE_ERROR", err.Error())
		return
	}

	c.JSON(http.StatusOK, gin.H{"success": true, "message": "CI deleted"})
}

// ==================== Batch Operations ====================

// BatchCreate POST /api/v1/cmdb/batch-create
func (h *CmdbHandler) BatchCreate(c *gin.Context) {
	tenantID := getTenantID(c)
	actor := getActor(c)

	var req struct {
		TenantID any `json:"tenantId"`
		CreatedBy string `json:"createdBy"`
		Items    []models.CreateCIRequest `json:"items"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		errorResponse(c, http.StatusBadRequest, "BATCH_CREATE_ERROR", err.Error())
		return
	}

	// Override tenantID from body if provided
	if req.TenantID != nil {
		if tid, ok := req.TenantID.(string); ok && tid != "" {
			tenantID = tid
		}
	}
	if req.CreatedBy != "" {
		actor = req.CreatedBy
	}

	succeeded, failed, created, err := h.svc.BatchCreate(c.Request.Context(), tenantID, req.Items, actor)
	if err != nil {
		errorResponse(c, http.StatusInternalServerError, "BATCH_CREATE_ERROR", err.Error())
		return
	}

	c.JSON(http.StatusCreated, gin.H{
		"success": true,
		"success_count": succeeded,
		"failed_count":  failed,
		"data":          created,
	})
}

// BatchUpdate PUT /api/v1/cmdb/batch-update
func (h *CmdbHandler) BatchUpdate(c *gin.Context) {
	tenantID := getTenantID(c)
	actor := getActor(c)

	var req struct {
		TenantID any `json:"tenantId"`
		User     string `json:"user"`
		Items    []models.CIItem `json:"items"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		errorResponse(c, http.StatusBadRequest, "BATCH_UPDATE_ERROR", err.Error())
		return
	}

	if req.TenantID != nil {
		if tid, ok := req.TenantID.(string); ok && tid != "" {
			tenantID = tid
		}
	}
	if req.User != "" {
		actor = req.User
	}

	succeeded, failed, err := h.svc.BatchUpdate(c.Request.Context(), tenantID, req.Items, actor)
	if err != nil {
		errorResponse(c, http.StatusInternalServerError, "BATCH_UPDATE_ERROR", err.Error())
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success":       true,
		"success_count": succeeded,
		"failed_count":  failed,
	})
}

// BatchDelete DELETE /api/v1/cmdb/batch-delete
func (h *CmdbHandler) BatchDelete(c *gin.Context) {
	tenantID := getTenantID(c)

	var req struct {
		TenantID any     `json:"tenantId"`
		Items    []string `json:"items"` // array of CI IDs
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		errorResponse(c, http.StatusBadRequest, "BATCH_DELETE_ERROR", err.Error())
		return
	}

	if req.TenantID != nil {
		if tid, ok := req.TenantID.(string); ok && tid != "" {
			tenantID = tid
		}
	}

	deleted, failed, err := h.svc.BatchDelete(c.Request.Context(), tenantID, req.Items)
	if err != nil {
		errorResponse(c, http.StatusInternalServerError, "BATCH_DELETE_ERROR", err.Error())
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"deleted": deleted,
		"failed":  failed,
	})
}

// BatchQuery POST /api/v1/cmdb/ci/query
func (h *CmdbHandler) BatchQuery(c *gin.Context) {
	tenantID := getTenantID(c)

	var req struct {
		ListRequest models.ListRequest `json:"list"`
		TenantID    any                `json:"tenantId"`
		CIType      string             `json:"ciType"`
		Status      string             `json:"status"`
		Environment string             `json:"environment"`
		Tags        string             `json:"tags"`
		Search      string             `json:"search"`
		Limit       int                `json:"limit"`
		Offset      int                `json:"offset"`
		OrderBy     string             `json:"orderBy"`
		Order       string             `json:"order"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		errorResponse(c, http.StatusBadRequest, "QUERY_ERROR", err.Error())
		return
	}

	// Support both nested and flat JSON shapes
	if req.TenantID != nil {
		if tid, ok := req.TenantID.(string); ok && tid != "" {
			tenantID = tid
		}
	}

	lr := models.ListRequest{
		CIType:      req.CIType,
		Status:      req.Status,
		Environment: req.Environment,
		Tags:        req.Tags,
		Search:      req.Search,
		OrderBy:     req.OrderBy,
		Order:       req.Order,
	}

	if req.Limit > 0 {
		lr.PageSize = req.Limit
	}
	// Convert offset to page
	if req.Offset > 0 && lr.PageSize > 0 {
		lr.Page = (req.Offset / lr.PageSize) + 1
	} else {
		lr.Page = 1
	}
	if lr.PageSize <= 0 {
		lr.PageSize = 20
	}

	items, total, err := h.svc.BatchQuery(c.Request.Context(), tenantID, lr)
	if err != nil {
		errorResponse(c, http.StatusInternalServerError, "QUERY_ERROR", err.Error())
		return
	}

	successPaginated(c, itemsToAny(items), total, lr.Page, lr.PageSize)
}

// ==================== Export / Import ====================

// ExportCI GET /api/v1/cmdb/ci/export/:id
func (h *CmdbHandler) ExportCI(c *gin.Context) {
	tenantID := getTenantID(c)
	id := c.Param("id")

	// Override tenant from query if provided
	if qTenant := c.Query("tenantId"); qTenant != "" {
		tenantID = qTenant
	}

	item, err := h.svc.ExportCI(c.Request.Context(), tenantID, id)
	if err != nil {
		errorResponse(c, http.StatusNotFound, "EXPORT_ERROR", "CI not found")
		return
	}

	c.Header("Content-Type", "application/json")
	c.JSON(http.StatusOK, gin.H{"success": true, "data": item})
}

// ExportCIs GET /api/v1/cmdb/export
func (h *CmdbHandler) ExportCIs(c *gin.Context) {
	tenantID := getTenantID(c)

	var q models.ExportQuery
	if err := c.ShouldBindQuery(&q); err != nil {
		errorResponse(c, http.StatusBadRequest, "EXPORT_ERROR", err.Error())
		return
	}

	// Override tenant from query if provided
	if qTenant := c.Query("tenantId"); qTenant != "" {
		tenantID = qTenant
	}

	items, err := h.svc.ExportCIs(c.Request.Context(), tenantID, q)
	if err != nil {
		errorResponse(c, http.StatusInternalServerError, "EXPORT_ERROR", err.Error())
		return
	}

	c.Header("Content-Type", "application/json")
	c.JSON(http.StatusOK, gin.H{"success": true, "data": items})
}

// ImportCIs POST /api/v1/cmdb/import
func (h *CmdbHandler) ImportCIs(c *gin.Context) {
	tenantID := getTenantID(c)
	actor := getActor(c)

	var req struct {
		TenantID     any                  `json:"tenantId"`
		SkipDuplicates bool               `json:"skipDuplicates"`
		CreatedBy    string               `json:"createdBy"`
		CIs          []models.ImportCIRaw `json:"cis"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		errorResponse(c, http.StatusBadRequest, "IMPORT_ERROR", err.Error())
		return
	}

	if req.TenantID != nil {
		if tid, ok := req.TenantID.(string); ok && tid != "" {
			tenantID = tid
		}
	}
	if req.CreatedBy != "" {
		actor = req.CreatedBy
	}

	result, err := h.svc.ImportCIs(c.Request.Context(), tenantID, req.CIs, req.SkipDuplicates, actor)
	if err != nil {
		errorResponse(c, http.StatusInternalServerError, "IMPORT_ERROR", err.Error())
		return
	}

	successResponse(c, result)
}

// ==================== Relations ====================

// GetCIRelations GET /api/v1/cmdb/cis/:ciId/relations
func (h *CmdbHandler) GetCIRelations(c *gin.Context) {
	tenantID := getTenantID(c)
	ciID := c.Param("ciId")

	rels, err := h.svc.ListCIRelations(c.Request.Context(), tenantID, ciID)
	if err != nil {
		errorResponse(c, http.StatusInternalServerError, "FETCH_ERROR", err.Error())
		return
	}

	successResponse(c, rels)
}

// CreateRelation POST /api/v1/cmdb/relations
func (h *CmdbHandler) CreateRelation(c *gin.Context) {
	tenantID := getTenantID(c)
	actor := getActor(c)

	var req struct {
		FromCiId     string `json:"fromCiId"`
		ToCiId       string `json:"toCiId"`
		RelationType string `json:"relationType"`
		Description  string `json:"description"`
		TenantID     any    `json:"tenantId"`
		User         string `json:"user"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		errorResponse(c, http.StatusBadRequest, "CREATE_ERROR", err.Error())
		return
	}

	if req.TenantID != nil {
		if tid, ok := req.TenantID.(string); ok && tid != "" {
			tenantID = tid
		}
	}
	if req.User != "" {
		actor = req.User
	}

	relReq := &models.CreateRelationRequest{
		SourceCIID:   req.FromCiId,
		TargetCIID:   req.ToCiId,
		RelationType: req.RelationType,
		Description:  req.Description,
	}

	rel, err := h.svc.CreateRelation(c.Request.Context(), tenantID, relReq, actor)
	if err != nil {
		errorResponse(c, http.StatusInternalServerError, "CREATE_ERROR", err.Error())
		return
	}

	c.JSON(http.StatusCreated, gin.H{"success": true, "data": rel})
}

// DeleteRelation DELETE /api/v1/cmdb/relations/:relationId
func (h *CmdbHandler) DeleteRelation(c *gin.Context) {
	tenantID := getTenantID(c)
	relationID := c.Param("relationId")
	actor := getActor(c)

	if err := h.svc.DeleteRelation(c.Request.Context(), tenantID, relationID, actor); err != nil {
		errorResponse(c, http.StatusNotFound, "DELETE_ERROR", err.Error())
		return
	}

	c.JSON(http.StatusOK, gin.H{"success": true, "message": "Relation deleted"})
}

// ==================== Versions ====================

// GetCIVersions GET /api/v1/cmdb/cis/:ciId/versions
func (h *CmdbHandler) GetCIVersions(c *gin.Context) {
	tenantID := getTenantID(c)
	ciID := c.Param("ciId")

	versions, err := h.svc.GetVersions(c.Request.Context(), tenantID, ciID)
	if err != nil {
		errorResponse(c, http.StatusInternalServerError, "FETCH_ERROR", err.Error())
		return
	}

	successResponse(c, versions)
}

// GetCICurrentVersion GET /api/v1/cmdb/cis/:ciId/versions/current
func (h *CmdbHandler) GetCICurrentVersion(c *gin.Context) {
	tenantID := getTenantID(c)
	ciID := c.Param("ciId")

	version, err := h.svc.GetCurrentVersion(c.Request.Context(), tenantID, ciID)
	if err != nil {
		errorResponse(c, http.StatusInternalServerError, "FETCH_ERROR", err.Error())
		return
	}

	successResponse(c, version)
}

// RestoreToVersion POST /api/v1/cmdb/cis/:ciId/versions/restore
func (h *CmdbHandler) RestoreToVersion(c *gin.Context) {
	tenantID := getTenantID(c)
	ciID := c.Param("ciId")
	actor := getActor(c)

	var req models.RestoreVersionRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		errorResponse(c, http.StatusBadRequest, "RESTORE_ERROR", err.Error())
		return
	}

	if req.Version <= 0 {
		errorResponse(c, http.StatusBadRequest, "RESTORE_ERROR", "version is required and must be > 0")
		return
	}

	item, err := h.svc.RestoreToVersion(c.Request.Context(), tenantID, ciID, req.Version, actor)
	if err != nil {
		errorResponse(c, http.StatusNotFound, "RESTORE_ERROR", err.Error())
		return
	}

	successResponse(c, item)
}

// ==================== Topology ====================

// GetTopology GET /api/v1/cmdb/topology
func (h *CmdbHandler) GetTopology(c *gin.Context) {
	tenantID := getTenantID(c)

	// ciType filter is supported as a query param but applied at client side
	// for full topology; depth is used for BFS pruning.
	_ = c.Query("ciType") // acknowledged but not filtered server-side
	depth, _ := strconv.Atoi(c.DefaultQuery("depth", "0"))

	if qTenant := c.Query("tenantId"); qTenant != "" {
		tenantID = qTenant
	}

	// If ciType filter is provided, we'd need to filter the full topology.
	// For now, fetch full topology and let the client filter.
	topology, err := h.svc.GetFullTopology(c.Request.Context(), tenantID, "", depth)
	if err != nil {
		errorResponse(c, http.StatusInternalServerError, "FETCH_ERROR", err.Error())
		return
	}

	successResponse(c, topology)
}

// GetServiceDependencies GET /api/v1/cmdb/topology/:ciId/dependencies
func (h *CmdbHandler) GetServiceDependencies(c *gin.Context) {
	tenantID := getTenantID(c)
	ciID := c.Param("ciId")

	if qTenant := c.Query("tenantId"); qTenant != "" {
		tenantID = qTenant
	}

	topology, err := h.svc.GetServiceDependencies(c.Request.Context(), tenantID, ciID)
	if err != nil {
		errorResponse(c, http.StatusInternalServerError, "FETCH_ERROR", err.Error())
		return
	}

	successResponse(c, topology)
}

// GetImpactAnalysis GET /api/v1/cmdb/topology/:ciId/impact
func (h *CmdbHandler) GetImpactAnalysis(c *gin.Context) {
	tenantID := getTenantID(c)
	ciID := c.Param("ciId")

	if qTenant := c.Query("tenantId"); qTenant != "" {
		tenantID = qTenant
	}

	impact, err := h.svc.GetImpactAnalysis(c.Request.Context(), tenantID, ciID)
	if err != nil {
		errorResponse(c, http.StatusInternalServerError, "FETCH_ERROR", err.Error())
		return
	}

	successResponse(c, impact)
}

// ==================== Health ====================

// Health GET /api/v1/cmdb/health
func (h *CmdbHandler) Health(c *gin.Context) {
	c.JSON(http.StatusOK, gin.H{"success": true, "data": gin.H{"status": "ok"}})
}

// ==================== Integration: Hosts ====================

// ListHosts GET /api/v1/cmdb/hosts
func (h *CmdbHandler) ListHosts(c *gin.Context) {
	tenantID := getTenantID(c)

	if qTenant := c.Query("tenantId"); qTenant != "" {
		tenantID = qTenant
	}

	hosts, err := h.svc.ListHosts(c.Request.Context(), tenantID)
	if err != nil {
		errorResponse(c, http.StatusInternalServerError, "FETCH_ERROR", err.Error())
		return
	}

	successResponse(c, hosts)
}

// GetHost GET /api/v1/cmdb/hosts/:ciId
func (h *CmdbHandler) GetHost(c *gin.Context) {
	tenantID := getTenantID(c)
	ciID := c.Param("ciId")

	host, err := h.svc.GetHost(c.Request.Context(), tenantID, ciID)
	if err != nil {
		errorResponse(c, http.StatusNotFound, "NOT_FOUND", err.Error())
		return
	}

	successResponse(c, host)
}

// ==================== Integration: K8s ====================

// ListK8sResources GET /api/v1/cmdb/k8s
func (h *CmdbHandler) ListK8sResources(c *gin.Context) {
	tenantID := getTenantID(c)

	if qTenant := c.Query("tenantId"); qTenant != "" {
		tenantID = qTenant
	}

	resources, err := h.svc.ListK8sResources(c.Request.Context(), tenantID)
	if err != nil {
		errorResponse(c, http.StatusInternalServerError, "FETCH_ERROR", err.Error())
		return
	}

	successResponse(c, resources)
}

// StartK8sSync POST /api/v1/cmdb/k8s/sync/start
func (h *CmdbHandler) StartK8sSync(c *gin.Context) {
	tenantID := getTenantID(c)
	actor := getActor(c)

	result, err := h.svc.StartK8sSync(c.Request.Context(), tenantID, actor)
	if err != nil {
		errorResponse(c, http.StatusInternalServerError, "SYNC_START_ERROR", err.Error())
		return
	}

	successResponse(c, result)
}

// StopK8sSync POST /api/v1/cmdb/k8s/sync/stop
func (h *CmdbHandler) StopK8sSync(c *gin.Context) {
	tenantID := getTenantID(c)
	actor := getActor(c)

	_ = actor // acknowledged
	result, err := h.svc.StopK8sSync(c.Request.Context(), tenantID, actor)
	if err != nil {
		errorResponse(c, http.StatusInternalServerError, "SYNC_STOP_ERROR", err.Error())
		return
	}

	successResponse(c, result)
}

// ==================== Integration: CICD ====================

// ListCICDResources GET /api/v1/cmdb/cicd
func (h *CmdbHandler) ListCICDResources(c *gin.Context) {
	tenantID := getTenantID(c)

	if qTenant := c.Query("tenantId"); qTenant != "" {
		tenantID = qTenant
	}

	resources, err := h.svc.ListCICDResources(c.Request.Context(), tenantID)
	if err != nil {
		errorResponse(c, http.StatusInternalServerError, "FETCH_ERROR", err.Error())
		return
	}

	successResponse(c, resources)
}

// ExecuteScript POST /api/v1/cmdb/execute
func (h *CmdbHandler) ExecuteScript(c *gin.Context) {
	tenantID := getTenantID(c)
	actor := getActor(c)

	var req struct {
		CIID       string   `json:"ci_id"`
		Script     string   `json:"script"`
		Timeout    int      `json:"timeout"`
		Privileged bool     `json:"privileged"`
		Args       []string `json:"args"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		errorResponse(c, http.StatusBadRequest, "EXECUTE_ERROR", err.Error())
		return
	}
	if req.Script == "" {
		errorResponse(c, http.StatusBadRequest, "EXECUTE_ERROR", "script is required")
		return
	}

	scriptReq := &service.ExecuteScriptRequest{
		CIID:       req.CIID,
		Script:     req.Script,
		Timeout:    req.Timeout,
		Privileged: req.Privileged,
		Args:       req.Args,
	}

	result, err := h.svc.ExecuteScript(c.Request.Context(), tenantID, scriptReq, actor)
	if err != nil {
		errorResponse(c, http.StatusInternalServerError, "EXECUTE_ERROR", err.Error())
		return
	}

	successResponse(c, result)
}

// itemsToAny converts []CIItem to []any for JSON serialization.
func itemsToAny(items []models.CIItem) []any {
	result := make([]any, len(items))
	for i, item := range items {
		result[i] = item
	}
	return result
}
