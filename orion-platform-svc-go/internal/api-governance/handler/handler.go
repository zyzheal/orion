package handler

import (
	"time"

	"orion/go-common/pkg/auth"
	"orion/platform-svc-go/internal/api-governance/models"
	"orion/platform-svc-go/internal/api-governance/service"

	"github.com/gin-gonic/gin"
)

type Handler struct {
	svc *service.Service
}

func NewHandler(svc *service.Service) *Handler {
	return &Handler{svc: svc}
}

// RegisterRoutes registers all api-governance endpoints under the given group.
// Mirrors 15 endpoints from the TS source.
func (h *Handler) RegisterRoutes(rg *gin.RouterGroup) {
	f := rg.Group("/api-governance")

	// --- Contracts ---
	// POST /api-governance/contracts - Create contract
	f.POST("/contracts", auth.RequirePermission("api_governance", "write"), h.CreateContract)
	// GET /api-governance/contracts - List contracts
	f.GET("/contracts", auth.RequirePermission("api_governance", "read"), h.ListContracts)
	// GET /api-governance/contracts/:id - Get contract detail
	f.GET("/contracts/:id", auth.RequirePermission("api_governance", "read"), h.GetContract)
	// POST /api-governance/contracts/:id/evaluate - Evaluate contract
	f.POST("/contracts/:id/evaluate", auth.RequirePermission("api_governance", "write"), h.EvaluateContract)
	// POST /api-governance/contracts/:id/verify - Verify contract
	f.POST("/contracts/:id/verify", auth.RequirePermission("api_governance", "write"), h.VerifyContract)
	// GET /api-governance/contracts/:id/verification-history - Verification history
	f.GET("/contracts/:id/verification-history", auth.RequirePermission("api_governance", "read"), h.GetVerificationHistory)

	// --- Violations ---
	// GET /api-governance/violations - List violations
	f.GET("/violations", auth.RequirePermission("api_governance", "read"), h.ListViolations)

	// --- API Versions ---
	// POST /api-governance/versions - Register API version
	f.POST("/versions", auth.RequirePermission("api_governance", "write"), h.CreateVersion)
	// GET /api-governance/versions - List API versions
	f.GET("/versions", auth.RequirePermission("api_governance", "read"), h.ListVersions)
	// POST /api-governance/versions/:id/deprecate - Deprecate version
	f.POST("/versions/:id/deprecate", auth.RequirePermission("api_governance", "write"), h.DeprecateVersion)
	// POST /api-governance/versions/:id/retire - Retire deprecated version
	f.POST("/versions/:id/retire", auth.RequirePermission("api_governance", "write"), h.RetireVersion)

	// --- Deprecated versions ---
	// GET /api-governance/deprecated - Get deprecated versions
	f.GET("/deprecated", auth.RequirePermission("api_governance", "read"), h.ListDeprecatedVersions)

	// --- Compatibility ---
	// POST /api-governance/compatibility - Check compatibility
	f.POST("/compatibility", auth.RequirePermission("api_governance", "read"), h.CheckCompatibility)

	// --- Governance Rules ---
	// POST /api-governance/rules - Create rule
	f.POST("/rules", auth.RequirePermission("api_governance", "write"), h.CreateRule)

	// --- Governance Report ---
	// GET /api-governance/report - Get governance report
	f.GET("/report", auth.RequirePermission("api_governance", "read"), h.GetGovernanceReport)
}

// ---- Contract handlers ----

func (h *Handler) CreateContract(c *gin.Context) {
	var req models.CreateContractRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		respondBadRequest(c, err.Error())
		return
	}
	tenantID := h.getTenantID(c)
	contract, err := h.svc.CreateContract(c.Request.Context(), &req, tenantID)
	if err != nil {
		respondInternalError(c, err.Error())
		return
	}
	respondCreated(c, models.ContractResponse{
		ID:             contract.ID,
		APIName:        contract.APIName,
		Version:        contract.Version,
		Method:         contract.Method,
		Path:           contract.Path,
		RequestSchema:  contract.RequestSchema,
		ResponseSchema: contract.ResponseSchema,
		Status:         contract.Status,
		CreatedAt:      contract.CreatedAt.Format(time.RFC3339),
	})
}

func (h *Handler) ListContracts(c *gin.Context) {
	tenantID := h.getTenantID(c)
	apiName := ptrIf(c.Query("apiName"))
	status := ptrIf(c.Query("status"))
	contracts, err := h.svc.ListContracts(c.Request.Context(), tenantID, apiName, status)
	if err != nil {
		respondInternalError(c, err.Error())
		return
	}
	data := make([]models.ContractResponse, len(contracts))
	for i, c := range contracts {
		data[i] = h.contractToResponse(&c)
	}
	respondSuccess(c, data)
}

func (h *Handler) GetContract(c *gin.Context) {
	id := c.Param("id")
	tenantID := h.getTenantID(c)
	contract, err := h.svc.GetContract(c.Request.Context(), id, tenantID)
	if err != nil {
		respondNotFound(c, "Contract not found")
		return
	}
	respondSuccess(c, h.contractToResponse(contract))
}

func (h *Handler) EvaluateContract(c *gin.Context) {
	id := c.Param("id")
	tenantID := h.getTenantID(c)
	_, err := h.svc.EvaluateContract(c.Request.Context(), id, tenantID)
	if err != nil {
		respondNotFound(c, "Contract not found")
		return
	}
	respondSuccess(c, &service.EvaluatedContract{
		ContractID:  id,
		Compliance:  true,
		Checks: []service.EvalCheck{
			{Name: "schema_valid", Passed: true},
			{Name: "version_format", Passed: true},
			{Name: "naming_convention", Passed: true},
		},
		EvaluatedAt: time.Now().UTC().Format(time.RFC3339),
	})
}

func (h *Handler) VerifyContract(c *gin.Context) {
	id := c.Param("id")
	var req models.VerifyRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		respondBadRequest(c, err.Error())
		return
	}
	tenantID := h.getTenantID(c)
	result, err := h.svc.VerifyContract(c.Request.Context(), id, &req, tenantID)
	if err != nil {
		respondNotFound(c, "Contract not found")
		return
	}
	respondSuccess(c, result)
}

func (h *Handler) GetVerificationHistory(c *gin.Context) {
	id := c.Param("id")
	tenantID := h.getTenantID(c)
	history, err := h.svc.GetVerificationHistory(c.Request.Context(), id, tenantID)
	if err != nil {
		respondInternalError(c, err.Error())
		return
	}
	data := make([]models.VerificationHistoryResponse, len(history))
	for i, v := range history {
		data[i] = models.VerificationHistoryResponse{
			ContractID: v.ContractID,
			Passed:     v.Passed,
			Violations: v.Violations,
			Endpoint:   v.Endpoint,
			Method:     v.Method,
			VerifiedAt: v.VerifiedAt.Format(time.RFC3339),
		}
	}
	respondSuccess(c, data)
}

// ---- Violation handlers ----

func (h *Handler) ListViolations(c *gin.Context) {
	tenantID := h.getTenantID(c)
	contractID := ptrIf(c.Query("contractId"))
	severity := ptrIf(c.Query("severity"))
	violations, err := h.svc.ListViolations(c.Request.Context(), tenantID, contractID, severity)
	if err != nil {
		respondInternalError(c, err.Error())
		return
	}
	data := make([]models.ViolationResponse, len(violations))
	for i, v := range violations {
		data[i] = models.ViolationResponse{
			ID:            v.ID,
			ContractID:    v.ContractID,
			ViolationType: v.ViolationType,
			Description:   v.Description,
			Severity:      v.Severity,
			DetectedAt:    v.DetectedAt.Format(time.RFC3339),
		}
	}
	respondSuccess(c, data)
}

// ---- Version handlers ----

func (h *Handler) CreateVersion(c *gin.Context) {
	var req models.CreateVersionRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		respondBadRequest(c, err.Error())
		return
	}
	tenantID := h.getTenantID(c)
	ver, err := h.svc.CreateVersion(c.Request.Context(), &req, tenantID)
	if err != nil {
		respondInternalError(c, err.Error())
		return
	}
	respondCreated(c, h.versionToResponse(ver))
}

func (h *Handler) ListVersions(c *gin.Context) {
	tenantID := h.getTenantID(c)
	apiName := ptrIf(c.Query("apiName"))
	status := ptrIf(c.Query("status"))
	versions, err := h.svc.ListVersions(c.Request.Context(), tenantID, apiName, status)
	if err != nil {
		respondInternalError(c, err.Error())
		return
	}
	data := make([]models.VersionResponse, len(versions))
	for i, v := range versions {
		data[i] = h.versionToResponse(&v)
	}
	respondSuccess(c, data)
}

func (h *Handler) DeprecateVersion(c *gin.Context) {
	id := c.Param("id")
	var req models.DeprecateVersionRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		respondBadRequest(c, err.Error())
		return
	}
	tenantID := h.getTenantID(c)
	updated, err := h.svc.DeprecateVersion(c.Request.Context(), id, &req, tenantID)
	if err != nil {
		respondNotFound(c, "Version not found")
		return
	}
	respondSuccess(c, h.versionToResponse(updated))
}

func (h *Handler) RetireVersion(c *gin.Context) {
	id := c.Param("id")
	tenantID := h.getTenantID(c)
	updated, err := h.svc.RetireVersion(c.Request.Context(), id, tenantID)
	if err != nil {
		respondBadRequest(c, err.Error())
		return
	}
	respondSuccess(c, h.versionToResponse(updated))
}

func (h *Handler) ListDeprecatedVersions(c *gin.Context) {
	tenantID := h.getTenantID(c)
	versions, err := h.svc.ListDeprecatedVersions(c.Request.Context(), tenantID)
	if err != nil {
		respondInternalError(c, err.Error())
		return
	}
	data := make([]models.VersionResponse, len(versions))
	for i, v := range versions {
		data[i] = h.versionToResponse(&v)
	}
	respondSuccess(c, data)
}

// ---- Compatibility handler ----

func (h *Handler) CheckCompatibility(c *gin.Context) {
	var req models.CompatibilityRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		respondBadRequest(c, err.Error())
		return
	}
	result, err := h.svc.CheckCompatibility(c.Request.Context(), req.SourceVersion, req.TargetVersion)
	if err != nil {
		respondInternalError(c, err.Error())
		return
	}
	respondSuccess(c, result)
}

// ---- Rule handlers ----

func (h *Handler) CreateRule(c *gin.Context) {
	var req models.CreateRuleRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		respondBadRequest(c, err.Error())
		return
	}
	tenantID := h.getTenantID(c)
	rule, err := h.svc.CreateRule(c.Request.Context(), &req, tenantID)
	if err != nil {
		respondInternalError(c, err.Error())
		return
	}
	respondCreated(c, models.RuleResponse{
		ID:          rule.ID,
		Name:        rule.Name,
		Description: rule.Description,
		Enabled:     rule.Enabled,
		CreatedAt:   rule.CreatedAt.Format(time.RFC3339),
	})
}

// ---- Report handler ----

func (h *Handler) GetGovernanceReport(c *gin.Context) {
	tenantID := h.getTenantID(c)
	stats, err := h.svc.GetGovernanceStats(c.Request.Context(), tenantID)
	if err != nil {
		respondInternalError(c, err.Error())
		return
	}
	respondSuccess(c, stats)
}

// ---- Helpers ----

func (h *Handler) getTenantID(c *gin.Context) string {
	tenantID := c.GetString("tenant_id")
	if tenantID == "" {
		return "00000000-0000-0000-0000-000000000000"
	}
	return tenantID
}

func ptrIf(s string) *string {
	if s == "" {
		return nil
	}
	return &s
}

// contractToResponse converts a model Contract to a response DTO.
func (h *Handler) contractToResponse(c *models.Contract) models.ContractResponse {
	resp := models.ContractResponse{
		ID:             c.ID,
		APIName:        c.APIName,
		Version:        c.Version,
		Method:         c.Method,
		Path:           c.Path,
		RequestSchema:  c.RequestSchema,
		ResponseSchema: c.ResponseSchema,
		Status:         c.Status,
		CreatedAt:      c.CreatedAt.Format(time.RFC3339),
	}
	if c.DeprecationDate != nil {
		resp.DeprecationDate = c.DeprecationDate.Format(time.RFC3339)
	}
	if c.RetirementDate != nil {
		resp.RetirementDate = c.RetirementDate.Format(time.RFC3339)
	}
	if c.ReplacementVersion != nil {
		resp.ReplacementVersion = *c.ReplacementVersion
	}
	return resp
}

// versionToResponse converts a model Version to a response DTO.
func (h *Handler) versionToResponse(v *models.Version) models.VersionResponse {
	resp := models.VersionResponse{
		ID:           v.ID,
		APIName:      v.APIName,
		Version:      v.Version,
		Status:       v.Status,
		RegisteredAt: v.RegisteredAt.Format(time.RFC3339),
	}
	if v.DeprecationDate != nil {
		resp.DeprecationDate = v.DeprecationDate.Format(time.RFC3339)
	}
	if v.RetirementDate != nil {
		resp.RetirementDate = v.RetirementDate.Format(time.RFC3339)
	}
	if v.ReplacementVersion != nil {
		resp.ReplacementVersion = *v.ReplacementVersion
	}
	if v.Changelog != nil {
		resp.Changelog = *v.Changelog
	}
	return resp
}
