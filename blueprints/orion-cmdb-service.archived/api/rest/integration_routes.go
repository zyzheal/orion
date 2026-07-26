package rest

import (
	"fmt"
	"net/http"
	"strconv"

	"github.com/gin-gonic/gin"
	"github.com/orion-platform/orion-cmdb/internal/integration"
	"github.com/orion-platform/orion-cmdb/internal/middleware"
	"github.com/orion-platform/orion-cmdb/internal/script"
)

const maxScriptTargets = 50

// RegisterIntegrationRoutes adds /hosts, /k8s, /cicd, /execute, /sync routes
func RegisterIntegrationRoutes(
	v1 *gin.RouterGroup,
	integrationSvc *integration.Service,
	scriptSvc *script.Service,
) {
	// Host routes
	v1.GET("/hosts", ListHosts(integrationSvc))
	v1.GET("/hosts/:ciId", GetHost(integrationSvc))

	// K8s routes
	v1.GET("/k8s", ListK8sResources(integrationSvc))
	v1.GET("/k8s/sync/state", GetSyncState(integrationSvc))
	v1.POST("/k8s/sync/start", StartK8sSync(integrationSvc))
	v1.POST("/k8s/sync/stop", StopK8sSync(integrationSvc))

	// CI/CD routes
	v1.GET("/cicd", ListCICDResources(integrationSvc))

	// Script execution
	v1.POST("/execute", ExecuteScript(scriptSvc))
}

// ListHosts returns the list of SERVER-type CIs
func ListHosts(svc *integration.Service) gin.HandlerFunc {
	return func(c *gin.Context) {
		tenantID, ok := middleware.GetTenantID(c)
		if !ok {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "tenant context required"})
			return
		}

		page := queryInt(c.DefaultQuery("page", "1"), 1)
		pageSize := queryInt(c.DefaultQuery("page_size", "20"), 20)

		hosts, total, err := svc.ListHosts(tenantID, page, pageSize)
		if err != nil {
			errorResponse(c, err)
			return
		}

		c.JSON(http.StatusOK, gin.H{
			"items":       hosts,
			"total_count": total,
			"page":        page,
			"page_size":   pageSize,
		})
	}
}

// GetHost returns a single host
func GetHost(svc *integration.Service) gin.HandlerFunc {
	return func(c *gin.Context) {
		tenantID, ok := middleware.GetTenantID(c)
		if !ok {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "tenant context required"})
			return
		}

		ciID := c.Param("ciId")
		host, err := svc.GetHost(ciID, tenantID)
		if err != nil {
			errorResponse(c, err)
			return
		}
		if host == nil {
			c.JSON(http.StatusNotFound, gin.H{"error": "host not found"})
			return
		}

		c.JSON(http.StatusOK, host)
	}
}

// ListK8sResources returns K8s resources
func ListK8sResources(svc *integration.Service) gin.HandlerFunc {
	return func(c *gin.Context) {
		tenantID, ok := middleware.GetTenantID(c)
		if !ok {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "tenant context required"})
			return
		}

		kind := c.Query("kind")
		namespace := c.Query("namespace")
		page := queryInt(c.DefaultQuery("page", "1"), 1)
		pageSize := queryInt(c.DefaultQuery("page_size", "20"), 20)

		resources, total, err := svc.ListK8sResources(tenantID, kind, namespace, page, pageSize)
		if err != nil {
			errorResponse(c, err)
			return
		}

		c.JSON(http.StatusOK, gin.H{
			"items":       resources,
			"total_count": total,
			"page":        page,
			"page_size":   pageSize,
		})
	}
}

// GetSyncState returns the K8s sync health state
func GetSyncState(svc *integration.Service) gin.HandlerFunc {
	return func(c *gin.Context) {
		state := svc.GetSyncState()
		c.JSON(http.StatusOK, state)
	}
}

// StartK8sSync starts the K8s synchronization
func StartK8sSync(svc *integration.Service) gin.HandlerFunc {
	return func(c *gin.Context) {
		tenantID, ok := middleware.GetTenantID(c)
		if !ok {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "tenant context required"})
			return
		}

		state := svc.StartSync(tenantID)
		c.JSON(http.StatusOK, state)
	}
}

// StopK8sSync stops the K8s synchronization
func StopK8sSync(svc *integration.Service) gin.HandlerFunc {
	return func(c *gin.Context) {
		tenantID, ok := middleware.GetTenantID(c)
		if !ok {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "tenant context required"})
			return
		}

		state := svc.StopSync(tenantID)
		c.JSON(http.StatusOK, state)
	}
}

// ListCICDResources returns CI/CD pipeline resources
func ListCICDResources(svc *integration.Service) gin.HandlerFunc {
	return func(c *gin.Context) {
		tenantID, ok := middleware.GetTenantID(c)
		if !ok {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "tenant context required"})
			return
		}

		status := c.Query("status")
		page := queryInt(c.DefaultQuery("page", "1"), 1)
		pageSize := queryInt(c.DefaultQuery("page_size", "20"), 20)

		resources, total, err := svc.ListCICDResources(tenantID, status, page, pageSize)
		if err != nil {
			errorResponse(c, err)
			return
		}

		c.JSON(http.StatusOK, gin.H{
			"items":       resources,
			"total_count": total,
			"page":        page,
			"page_size":   pageSize,
		})
	}
}

// ExecuteScript executes scripts on target CIs
func ExecuteScript(svc *script.Service) gin.HandlerFunc {
	return func(c *gin.Context) {
		tenantID, ok := middleware.GetTenantID(c)
		if !ok {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "tenant context required"})
			return
		}

		var req script.ScriptExecutionRequest
		if err := c.ShouldBindJSON(&req); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}

		if len(req.TargetCiIds) > maxScriptTargets {
			c.JSON(http.StatusBadRequest, gin.H{
				"error": fmt.Sprintf("too many targets: %d (max %d)", len(req.TargetCiIds), maxScriptTargets),
			})
			return
		}
		if len(req.TargetCiIds) == 0 {
			c.JSON(http.StatusBadRequest, gin.H{"error": "no target CI IDs provided"})
			return
		}

		userID, _ := middleware.GetUserID(c)
		results, err := svc.ExecuteScript(c.Request.Context(), &req, tenantID, userID)
		if err != nil {
			errorResponse(c, err)
			return
		}

		failed := len(results) - countSuccessful(results)

		c.JSON(http.StatusOK, gin.H{
			"results":    results,
			"total":      len(results),
			"successful": countSuccessful(results),
			"failed":     failed,
			"success":    failed == 0,
		})
	}
}

func countSuccessful(results []script.ScriptExecutionResult) int {
	count := 0
	for _, r := range results {
		if r.Status == script.StatusSuccess {
			count++
		}
	}
	return count
}

// queryInt parses a query parameter string, returning fallback on error
func queryInt(s string, fallback int) int {
	n, err := strconv.Atoi(s)
	if err != nil {
		return fallback
	}
	return n
}
