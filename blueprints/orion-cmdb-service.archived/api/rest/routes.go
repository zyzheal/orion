package rest

import (
	"errors"
	"log"
	"net/http"
	"strconv"
	"time"

	"github.com/gin-gonic/gin"
	cmdbService "github.com/orion-platform/orion-cmdb/internal/cmdb"
	"github.com/orion-platform/orion-cmdb/internal/database"
	"github.com/orion-platform/orion-cmdb/internal/integration"
	"github.com/orion-platform/orion-cmdb/internal/k8s"
	"github.com/orion-platform/orion-cmdb/internal/middleware"
	"github.com/orion-platform/orion-cmdb/internal/relation"
	"github.com/orion-platform/orion-cmdb/internal/script"
	"github.com/orion-platform/orion-cmdb/internal/topology"
)

// Swagger documentation constants
const (
	APIVersion = "v1"
	CMDBTag    = "CMDB - Configuration Management"
)

// LoggingMiddleware logs HTTP requests with tenant context
// @Summary Request logging middleware
// @Description Logs all incoming requests with method, path, and tenant context
func LoggingMiddleware() gin.HandlerFunc {
	return func(c *gin.Context) {
		start := time.Now()
		path := c.Request.URL.Path
		method := c.Request.Method

		// Get tenant context if available
		tenantID, _ := middleware.GetTenantID(c)

		c.Next()

		latency := time.Since(start)
		statusCode := c.Writer.Status()

		log.Printf("[cmdb-rest] %s %s | tenant_id=%d | status=%d | latency=%v",
			method, path, tenantID, statusCode, latency)
	}
}

// CORSMiddleware handles CORS headers
// @Summary CORS middleware
// @Description Adds CORS headers for cross-origin requests
func CORSMiddleware() gin.HandlerFunc {
	return func(c *gin.Context) {
		c.Header("Access-Control-Allow-Origin", "*")
		c.Header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
		c.Header("Access-Control-Allow-Headers", "Content-Type, Authorization")

		if c.Request.Method == "OPTIONS" {
			c.AbortWithStatus(http.StatusNoContent)
			return
		}

		c.Next()
	}
}

// errorResponse returns an appropriate HTTP status code based on the error type.
// Internal errors are logged server-side but return a generic message to clients.
func errorResponse(c *gin.Context, err error) {
	switch {
	case errors.Is(err, cmdbService.ErrCINotFound),
		errors.Is(err, relation.ErrRelationNotFound):
		c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
	case errors.Is(err, cmdbService.ErrCIExists),
		errors.Is(err, relation.ErrRelationExists),
		errors.Is(err, relation.ErrSelfRelation),
		errors.Is(err, relation.ErrSameTypeExists):
		c.JSON(http.StatusConflict, gin.H{"error": err.Error()})
	case errors.Is(err, cmdbService.ErrInvalidInput),
		errors.Is(err, relation.ErrInvalidRelationInput):
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
	default:
		// I4: Log full error server-side, return generic message to client
		log.Printf("[cmdb-rest] internal error: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "internal server error"})
	}
}

// RegisterRoutes registers all CMDB REST API routes with the given auth middleware
// @title CMDB Service API
// @version 1.0
// @description Orion CMDB (Configuration Management Database) REST API
// @termsOfService http://swagger.io/terms/

// @contact.name Orion Platform
// @contact.url https://orion-platform.dev
// @contact.email support@orion-platform.dev

// @license.name Apache 2.0
// @license.url http://www.apache.org/licenses/LICENSE-2.0.html

// @host localhost:8080
// @BasePath /api/v1/cmdb

// @securityDefinitions.apikey BearerAuth
// @in header
// @name Authorization
// @description Type "Bearer" followed by a space and JWT token.

func RegisterRoutes(
	r *gin.Engine,
	cmdbSvc *cmdbService.Service,
	relationSvc *relation.Service,
	topologySvc *topology.Service,
	k8sReconciler *k8s.Reconciler,
	auth gin.HandlerFunc,
) {
	// Apply global middleware
	r.Use(LoggingMiddleware())
	r.Use(CORSMiddleware())

	v1 := r.Group("/api/v1/cmdb")
	v1.Use(auth) // C1: Apply JWT auth middleware to all API routes
	{
		// CI routes
		// @Tag CMDBTag
		cis := v1.Group("/cis")
		{
			// @Summary Create a new CI
			// @Description Creates a new configuration item (CI) in CMDB
			// @Tags CMDBTag
			// @Accept json
			// @Produce json
			// @Security BearerAuth
			// @Param ci body cmdbService.CreateCIInput true "CI data"
			// @Success 201 {object} cmdbService.CI
			// @Failure 400 {object} map[string]string
			// @Failure 401 {object} map[string]string
			// @Failure 409 {object} map[string]string
			cis.POST("", CreateCI(cmdbSvc))

			// @Summary List CIs
			// @Description Retrieves a paginated list of CIs with optional filtering
			// @Tags CMDBTag
			// @Accept json
			// @Produce json
			// @Security BearerAuth
			// @Param ci_type query string false "Filter by CI type"
			// @Param status query string false "Filter by status"
			// @Param search query string false "Search in name/description"
			// @Param page query int false "Page number (default: 1)"
			// @Param page_size query int false "Page size (default: 20, max: 100)"
			// @Success 200 {object} map[string]interface{}
			cis.GET("", ListCIs(cmdbSvc))

			// @Summary Get a CI by ID
			// @Description Retrieves a single CI by its unique identifier
			// @Tags CMDBTag
			// @Accept json
			// @Produce json
			// @Security BearerAuth
			// @Param id path string true "CI ID"
			// @Success 200 {object} cmdbService.CI
			// @Failure 401 {object} map[string]string
			// @Failure 404 {object} map[string]string
			cis.GET("/:id", GetCI(cmdbSvc))

			// @Summary Update a CI
			// @Description Updates an existing CI with new values
			// @Tags CMDBTag
			// @Accept json
			// @Produce json
			// @Security BearerAuth
			// @Param id path string true "CI ID"
			// @Param ci body cmdbService.UpdateCIInput true "CI update data"
			// @Success 200 {object} cmdbService.CI
			// @Failure 400 {object} map[string]string
			// @Failure 401 {object} map[string]string
			// @Failure 404 {object} map[string]string
			cis.PUT("/:id", UpdateCI(cmdbSvc))

			// @Summary Delete a CI
			// @Description Soft deletes a CI (marks as deleted, preserves history)
			// @Tags CMDBTag
			// @Accept json
			// @Produce json
			// @Security BearerAuth
			// @Param id path string true "CI ID"
			// @Success 200 {object} map[string]string
			// @Failure 401 {object} map[string]string
			// @Failure 404 {object} map[string]string
			cis.DELETE("/:id", DeleteCI(cmdbSvc))

			// Batch operations
			// @Summary Batch create CIs
			// @Description Creates multiple CIs in a single request
			// @Tags CMDBTag
			// @Accept json
			// @Produce json
			// @Security BearerAuth
			// @Param cis body []cmdbService.CreateCIInput true "Array of CI data"
			// @Success 201 {object} map[string]interface{}
			cis.POST("/batch", BatchCreateCIs(cmdbSvc))

			// @Summary Get CI statistics
			// @Description Returns counts of CIs by type and status
			// @Tags CMDBTag
			// @Accept json
			// @Produce json
			// @Security BearerAuth
			// @Success 200 {object} map[string]interface{}
			cis.GET("/stats", GetCIStats(cmdbSvc))
		}

		// Relation routes
		// @Tag CMDBTag
		relations := v1.Group("/relations")
		{
			// @Summary Create a new relation
			// @Description Creates a relationship between two CIs
			// @Tags CMDBTag
			// @Accept json
			// @Produce json
			// @Security BearerAuth
			// @Param relation body relation.CreateRelationInput true "Relation data"
			// @Success 201 {object} relation.Relation
			// @Failure 400 {object} map[string]string
			// @Failure 401 {object} map[string]string
			// @Failure 409 {object} map[string]string
			relations.POST("", CreateRelation(relationSvc))

			// @Summary List relations
			// @Description Retrieves relations, optionally filtered by CI ID
			// @Tags CMDBTag
			// @Accept json
			// @Produce json
			// @Security BearerAuth
			// @Param ci_id query string false "Filter by CI ID"
			// @Success 200 {object} map[string]interface{}
			relations.GET("", GetRelations(relationSvc))

			// @Summary Get a relation by ID
			// @Description Retrieves a single relation by its unique identifier
			// @Tags CMDBTag
			// @Accept json
			// @Produce json
			// @Security BearerAuth
			// @Param id path string true "Relation ID"
			// @Success 200 {object} relation.Relation
			// @Failure 404 {object} map[string]string
			relations.GET("/:id", GetRelation(relationSvc))

			// @Summary Delete a relation
			// @Description Soft deletes a relation
			// @Tags CMDBTag
			// @Accept json
			// @Produce json
			// @Security BearerAuth
			// @Param id path string true "Relation ID"
			// @Success 200 {object} map[string]string
			relations.DELETE("/:id", DeleteRelation(relationSvc))
		}

		// Topology routes
		// @Summary Get topology graph
		// @Description Retrieves the complete topology graph of CIs and their relationships
		// @Tags CMDBTag
		// @Accept json
		// @Produce json
		// @Security BearerAuth
		// @Param ci_type query string false "Filter by CI type"
		// @Success 200 {object} topology.Topology
		v1.GET("/topology", GetTopology(topologySvc))

		// @Summary Analyze impact
		// @Description Analyzes the impact of changes to a specific CI
		// @Tags CMDBTag
		// @Accept json
		// @Produce json
		// @Security BearerAuth
		// @Param ciId path string true "CI ID"
		// @Param max_depth query int false "Maximum traversal depth (default: 3)"
		// @Success 200 {object} topology.ImpactAnalysis
		v1.GET("/impact/:ciId", AnalyzeImpact(topologySvc))

		// Integration routes (hosts, k8s, cicd, script execution)
		db := database.GetDB()
		integrationSvc := integration.NewService(cmdbSvc, relationSvc, topologySvc, k8sReconciler)
		scriptSvc := script.NewService(cmdbSvc, db)
		RegisterIntegrationRoutes(v1, integrationSvc, scriptSvc)
	}
}

// CreateCI creates a new CI
func CreateCI(svc *cmdbService.Service) gin.HandlerFunc {
	return func(c *gin.Context) {
		// C2: Fail-closed — RequireTenantID returns 401 if context missing
		tenantID, ok := middleware.GetTenantID(c)
		if !ok {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "tenant context required"})
			return
		}

		var input cmdbService.CreateCIInput
		if err := c.ShouldBindJSON(&input); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}
		input.TenantID = tenantID

		// C3: Safe type assertion for user ID
		if userID, ok := middleware.GetUserID(c); ok {
			input.CreatedBy = userID
		}

		ci, err := svc.CreateCI(&input)
		if err != nil {
			errorResponse(c, err)
			return
		}

		c.JSON(http.StatusCreated, ci)
	}
}

// ListCIs lists CIs with filtering and pagination
func ListCIs(svc *cmdbService.Service) gin.HandlerFunc {
	return func(c *gin.Context) {
		tenantID, ok := middleware.GetTenantID(c)
		if !ok {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "tenant context required"})
			return
		}

		// Get query parameters
		ciType := c.Query("ci_type")
		status := c.Query("status")
		search := c.Query("search")

		page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
		pageSize, _ := strconv.Atoi(c.DefaultQuery("page_size", "20"))

		cis, total, err := svc.ListCIs(ciType, status, search, page, pageSize, tenantID)
		if err != nil {
			errorResponse(c, err)
			return
		}

		c.JSON(http.StatusOK, gin.H{
			"items":       redactAttributesList(cis),
			"total_count": total,
			"page":        page,
			"page_size":   pageSize,
		})
	}
}

// GetCI retrieves a CI by ID with tenant isolation
func GetCI(svc *cmdbService.Service) gin.HandlerFunc {
	return func(c *gin.Context) {
		tenantID, ok := middleware.GetTenantID(c)
		if !ok {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "tenant context required"})
			return
		}

		id := c.Param("id")

		// I3: Pass tenantID to enforce tenant isolation
		ci, err := svc.GetCIWithTenant(id, tenantID)
		if err != nil {
			errorResponse(c, err)
			return
		}

		c.JSON(http.StatusOK, redactAttributes(ci))
	}
}

// UpdateCI updates an existing CI with tenant isolation
func UpdateCI(svc *cmdbService.Service) gin.HandlerFunc {
	return func(c *gin.Context) {
		tenantID, ok := middleware.GetTenantID(c)
		if !ok {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "tenant context required"})
			return
		}

		id := c.Param("id")

		var input cmdbService.UpdateCIInput
		if err := c.ShouldBindJSON(&input); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}

		// I3: Pass tenantID to enforce tenant isolation
		ci, err := svc.UpdateCIWithTenant(id, tenantID, &input)
		if err != nil {
			errorResponse(c, err)
			return
		}

		c.JSON(http.StatusOK, ci)
	}
}

// DeleteCI deletes a CI with tenant isolation
func DeleteCI(svc *cmdbService.Service) gin.HandlerFunc {
	return func(c *gin.Context) {
		tenantID, ok := middleware.GetTenantID(c)
		if !ok {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "tenant context required"})
			return
		}

		id := c.Param("id")

		// I3: Pass tenantID to enforce tenant isolation
		if err := svc.DeleteCIWithTenant(id, tenantID); err != nil {
			errorResponse(c, err)
			return
		}

		c.JSON(http.StatusOK, gin.H{"message": "CI deleted successfully"})
	}
}

// CreateRelation creates a new CI relation
func CreateRelation(svc *relation.Service) gin.HandlerFunc {
	return func(c *gin.Context) {
		tenantID, ok := middleware.GetTenantID(c)
		if !ok {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "tenant context required"})
			return
		}

		var input relation.CreateRelationInput
		if err := c.ShouldBindJSON(&input); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}
		input.TenantID = tenantID

		// C3: Safe type assertion for user ID
		if userID, ok := middleware.GetUserID(c); ok {
			input.CreatedBy = userID
		}

		rel, err := svc.CreateRelation(&input)
		if err != nil {
			errorResponse(c, err)
			return
		}

		c.JSON(http.StatusCreated, rel)
	}
}

// GetRelations retrieves relations with optional filtering
func GetRelations(svc *relation.Service) gin.HandlerFunc {
	return func(c *gin.Context) {
		tenantID, ok := middleware.GetTenantID(c)
		if !ok {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "tenant context required"})
			return
		}

		ciID := c.Query("ci_id")

		var relations []relation.Relation
		var err error

		if ciID != "" {
			relations, err = svc.GetRelationsByCiID(ciID, tenantID)
		} else {
			// I7: List all relations for tenant when no ci_id filter
			relations, err = svc.ListRelations(tenantID)
		}

		if err != nil {
			errorResponse(c, err)
			return
		}

		c.JSON(http.StatusOK, gin.H{
			"items":       relations,
			"total_count": len(relations),
		})
	}
}

// DeleteRelation deletes a relation by ID
func DeleteRelation(svc *relation.Service) gin.HandlerFunc {
	return func(c *gin.Context) {
		// Auth middleware ensures tenant context is present
		if _, ok := middleware.GetTenantID(c); !ok {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "tenant context required"})
			return
		}

		id := c.Param("id")

		if err := svc.DeleteRelation(id); err != nil {
			errorResponse(c, err)
			return
		}

		c.JSON(http.StatusOK, gin.H{"message": "Relation deleted successfully"})
	}
}

// GetTopology retrieves the topology graph
func GetTopology(svc *topology.Service) gin.HandlerFunc {
	return func(c *gin.Context) {
		tenantID, ok := middleware.GetTenantID(c)
		if !ok {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "tenant context required"})
			return
		}

		ciType := c.Query("ci_type")

		topology, err := svc.BuildTopology(tenantID, ciType)
		if err != nil {
			errorResponse(c, err)
			return
		}

		c.JSON(http.StatusOK, topology)
	}
}

// AnalyzeImpact analyzes the impact of a CI
// @Summary Analyze impact of a CI change
// @Description Analyzes which CIs would be affected by changes to a given CI
// @Tags CMDBTag
// @Accept json
// @Produce json
// @Security BearerAuth
// @Param ciId path string true "CI ID"
// @Param max_depth query int false "Maximum depth for traversal"
// @Success 200 {object} topology.ImpactAnalysis
// @Failure 401 {object} map[string]string
// @Failure 404 {object} map[string]string
func AnalyzeImpact(svc *topology.Service) gin.HandlerFunc {
	return func(c *gin.Context) {
		tenantID, ok := middleware.GetTenantID(c)
		if !ok {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "tenant context required"})
			return
		}

		ciID := c.Param("ciId")
		maxDepth, _ := strconv.Atoi(c.DefaultQuery("max_depth", "3"))

		impact, err := svc.AnalyzeImpact(ciID, tenantID, maxDepth)
		if err != nil {
			errorResponse(c, err)
			return
		}

		c.JSON(http.StatusOK, impact)
	}
}

// BatchCreateCIs creates multiple CIs in a single request
// @Summary Batch create CIs
// @Description Creates multiple configuration items in one request
// @Tags CMDBTag
// @Accept json
// @Produce json
// @Security BearerAuth
// @Param cis body []cmdbService.CreateCIInput true "Array of CI data"
// @Success 201 {object} map[string]interface{}
// @Failure 400 {object} map[string]string
// @Failure 401 {object} map[string]string
func BatchCreateCIs(svc *cmdbService.Service) gin.HandlerFunc {
	return func(c *gin.Context) {
		tenantID, ok := middleware.GetTenantID(c)
		if !ok {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "tenant context required"})
			return
		}

		var inputs []cmdbService.CreateCIInput
		if err := c.ShouldBindJSON(&inputs); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}

		if len(inputs) == 0 {
			c.JSON(http.StatusBadRequest, gin.H{"error": "no CIs provided"})
			return
		}

		if len(inputs) > 100 {
			c.JSON(http.StatusBadRequest, gin.H{"error": "batch size cannot exceed 100"})
			return
		}

		var created []cmdbService.CI
		var failed []map[string]interface{}

		userID, _ := middleware.GetUserID(c)

		for i, input := range inputs {
			input.TenantID = tenantID
			if userID != "" {
				input.CreatedBy = userID
			}

			ci, err := svc.CreateCI(&input)
			if err != nil {
				failed = append(failed, map[string]interface{}{
					"index": i,
					"input": input.CiID,
					"error": err.Error(),
				})
				continue
			}
			created = append(created, *ci)
		}

		c.JSON(http.StatusCreated, gin.H{
			"created":    created,
			"failed":     failed,
			"total":      len(inputs),
			"successful": len(created),
		})
	}
}

// GetCIStats returns statistics about CIs
// @Summary Get CI statistics
// @Description Returns counts of CIs grouped by type and status
// @Tags CMDBTag
// @Accept json
// @Produce json
// @Security BearerAuth
// @Success 200 {object} map[string]interface{}
// @Failure 401 {object} map[string]string
func GetCIStats(svc *cmdbService.Service) gin.HandlerFunc {
	return func(c *gin.Context) {
		tenantID, ok := middleware.GetTenantID(c)
		if !ok {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "tenant context required"})
			return
		}

		ciTypes := []string{
			"APPLICATION", "SERVICE", "DATABASE", "SERVER", "CONTAINER",
			"K8S_CLUSTER", "K8S_DEPLOYMENT", "K8S_POD", "NETWORK",
			"LOAD_BALANCER", "MIDDLEWARE", "PIPELINE", "ENVIRONMENT",
		}

		statuses := []string{"ACTIVE", "INACTIVE", "DECOMMISSIONED", "PENDING", "MAINTENANCE"}

		stats := map[string]interface{}{
			"by_type":   map[string]int64{},
			"by_status": map[string]int64{},
			"total":     int64(0),
		}

		var total int64

		// Get counts by type
		for _, ciType := range ciTypes {
			count, err := svc.CountCIs(ciType, "", tenantID)
			if err == nil {
				(stats["by_type"].(map[string]int64))[ciType] = count
				total += count
			}
		}

		// Get counts by status
		for _, status := range statuses {
			count, err := svc.CountCIs("", status, tenantID)
			if err == nil {
				(stats["by_status"].(map[string]int64))[status] = count
			}
		}

		stats["total"] = total

		c.JSON(http.StatusOK, stats)
	}
}

// GetRelation retrieves a single relation by ID
// @Summary Get a relation by ID
// @Description Retrieves a relation by its unique identifier
// @Tags CMDBTag
// @Accept json
// @Produce json
// @Security BearerAuth
// @Param id path string true "Relation ID"
// @Success 200 {object} relation.Relation
// @Failure 401 {object} map[string]string
// @Failure 404 {object} map[string]string
func GetRelation(svc *relation.Service) gin.HandlerFunc {
	return func(c *gin.Context) {
		tenantID, ok := middleware.GetTenantID(c)
		if !ok {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "tenant context required"})
			return
		}

		id := c.Param("id")

		rel, err := svc.GetRelation(id)
		if err != nil {
			errorResponse(c, err)
			return
		}

		// Verify tenant ownership
		if rel.TenantID != tenantID {
			c.JSON(http.StatusNotFound, gin.H{"error": "relation not found"})
			return
		}

		c.JSON(http.StatusOK, rel)
	}
}

// sensitiveAttributeKeys lists attribute keys that must never be returned in API responses
var sensitiveAttributeKeys = map[string]bool{
	"ssh_password":     true,
	"ssh_private_key":  true,
	"ssh_passphrase":   true,
	"private_key":      true,
	"password":         true,
	"secret":           true,
	"access_key":       true,
	"secret_key":       true,
}

// redactAttributes removes sensitive keys from a single CI's attributes
func redactAttributes(ci *cmdbService.CI) *cmdbService.CI {
	if ci == nil || ci.Attributes == nil {
		return ci
	}
	safe := make(map[string]string, len(ci.Attributes))
	for k, v := range ci.Attributes {
		if !sensitiveAttributeKeys[k] {
			safe[k] = v
		}
	}
	ci.Attributes = safe
	return ci
}

// redactAttributesList removes sensitive keys from a list of CIs
func redactAttributesList(cis []cmdbService.CI) []cmdbService.CI {
	result := make([]cmdbService.CI, len(cis))
	for i := range cis {
		result[i] = *redactAttributes(&cis[i])
	}
	return result
}
