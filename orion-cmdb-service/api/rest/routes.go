package rest

import (
	"errors"
	"net/http"
	"strconv"

	"github.com/gin-gonic/gin"
	cmdbService "github.com/orion-platform/orion-cmdb/internal/cmdb"
	"github.com/orion-platform/orion-cmdb/internal/relation"
	"github.com/orion-platform/orion-cmdb/internal/topology"
)

// errorResponse returns an appropriate HTTP status code based on the error type
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
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
	}
}

// RegisterRoutes registers all CMDB REST API routes
func RegisterRoutes(r *gin.Engine, cmdbSvc *cmdbService.Service, relationSvc *relation.Service, topologySvc *topology.Service) {
	v1 := r.Group("/api/v1/cmdb")
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
		var input cmdbService.CreateCIInput
		if err := c.ShouldBindJSON(&input); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}

		// Get tenant ID from context (default to 1 for now)
		tenantID := int64(1)
		if t, ok := c.Get("tenant_id"); ok {
			tenantID = t.(int64)
		}
		input.TenantID = tenantID

		// Get user ID from context
		if userID, ok := c.Get("user_id"); ok {
			input.CreatedBy = userID.(string)
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
		// Get query parameters
		ciType := c.Query("ci_type")
		status := c.Query("status")
		search := c.Query("search")

		page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
		pageSize, _ := strconv.Atoi(c.DefaultQuery("page_size", "20"))

		// Get tenant ID from context
		tenantID := int64(1)
		if t, ok := c.Get("tenant_id"); ok {
			tenantID = t.(int64)
		}

		cis, total, err := svc.ListCIs(ciType, status, search, page, pageSize, tenantID)
		if err != nil {
			errorResponse(c, err)
			return
		}

		c.JSON(http.StatusOK, gin.H{
			"items":      cis,
			"total_count": total,
			"page":       page,
			"page_size":  pageSize,
		})
	}
}

// GetCI retrieves a CI by ID
func GetCI(svc *cmdbService.Service) gin.HandlerFunc {
	return func(c *gin.Context) {
		id := c.Param("id")

		ci, err := svc.GetCI(id)
		if err != nil {
			errorResponse(c, err)
			return
		}

		c.JSON(http.StatusOK, ci)
	}
}

// UpdateCI updates an existing CI
func UpdateCI(svc *cmdbService.Service) gin.HandlerFunc {
	return func(c *gin.Context) {
		id := c.Param("id")

		var input cmdbService.UpdateCIInput
		if err := c.ShouldBindJSON(&input); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}

		ci, err := svc.UpdateCI(id, &input)
		if err != nil {
			errorResponse(c, err)
			return
		}

		c.JSON(http.StatusOK, ci)
	}
}

// DeleteCI deletes a CI
func DeleteCI(svc *cmdbService.Service) gin.HandlerFunc {
	return func(c *gin.Context) {
		id := c.Param("id")

		if err := svc.DeleteCI(id); err != nil {
			errorResponse(c, err)
			return
		}

		c.JSON(http.StatusOK, gin.H{"message": "CI deleted successfully"})
	}
}

// CreateRelation creates a new CI relation
func CreateRelation(svc *relation.Service) gin.HandlerFunc {
	return func(c *gin.Context) {
		var input relation.CreateRelationInput
		if err := c.ShouldBindJSON(&input); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}

		// Get tenant ID from context
		tenantID := int64(1)
		if t, ok := c.Get("tenant_id"); ok {
			tenantID = t.(int64)
		}
		input.TenantID = tenantID

		// Get user ID from context
		if userID, ok := c.Get("user_id"); ok {
			input.CreatedBy = userID.(string)
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
		ciID := c.Query("ci_id")

		// Get tenant ID from context
		tenantID := int64(1)
		if t, ok := c.Get("tenant_id"); ok {
			tenantID = t.(int64)
		}

		var relations []relation.Relation
		var err error

		if ciID != "" {
			relations, err = svc.GetRelationsByCiID(ciID, tenantID)
		} else {
			// For now, return empty list if no filter
			relations = []relation.Relation{}
		}

		if err != nil {
			errorResponse(c, err)
			return
		}

		c.JSON(http.StatusOK, gin.H{
			"items":      relations,
			"total_count": len(relations),
		})
	}
}

// DeleteRelation deletes a relation by ID
func DeleteRelation(svc *relation.Service) gin.HandlerFunc {
	return func(c *gin.Context) {
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
		ciType := c.Query("ci_type")

		// Get tenant ID from context
		tenantID := int64(1)
		if t, ok := c.Get("tenant_id"); ok {
			tenantID = t.(int64)
		}

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
		ciID := c.Param("ciId")

		// Get tenant ID from context
		tenantID := int64(1)
		if t, ok := c.Get("tenant_id"); ok {
			tenantID = t.(int64)
		}

		maxDepth, _ := strconv.Atoi(c.DefaultQuery("max_depth", "3"))

		impact, err := svc.AnalyzeImpact(ciID, tenantID, maxDepth)
		if err != nil {
			errorResponse(c, err)
			return
		}

		c.JSON(http.StatusOK, impact)
	}
}