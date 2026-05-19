package rest

import (
	"errors"
	"log"
	"net/http"
	"strconv"

	"github.com/gin-gonic/gin"
	cmdbService "github.com/orion-platform/orion-cmdb/internal/cmdb"
	"github.com/orion-platform/orion-cmdb/internal/middleware"
	"github.com/orion-platform/orion-cmdb/internal/relation"
	"github.com/orion-platform/orion-cmdb/internal/topology"
)

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
func RegisterRoutes(r *gin.Engine, cmdbSvc *cmdbService.Service, relationSvc *relation.Service, topologySvc *topology.Service, auth gin.HandlerFunc) {
	v1 := r.Group("/api/v1/cmdb")
	v1.Use(auth) // C1: Apply JWT auth middleware to all API routes
	{
		// CI routes
		cis := v1.Group("/cis")
		{
			cis.POST("", CreateCI(cmdbSvc))
			cis.GET("", ListCIs(cmdbSvc))
			cis.GET("/:id", GetCI(cmdbSvc))
			cis.PUT("/:id", UpdateCI(cmdbSvc))
			cis.DELETE("/:id", DeleteCI(cmdbSvc))
		}

		// Relation routes
		relations := v1.Group("/relations")
		{
			relations.POST("", CreateRelation(relationSvc))
			relations.GET("", GetRelations(relationSvc))
			relations.DELETE("/:id", DeleteRelation(relationSvc))
		}

		// Topology routes
		v1.GET("/topology", GetTopology(topologySvc))
		v1.GET("/impact/:ciId", AnalyzeImpact(topologySvc))
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
			"items":       cis,
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

		c.JSON(http.StatusOK, ci)
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
