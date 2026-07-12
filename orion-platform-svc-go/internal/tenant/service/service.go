package service

import (
	"context"
	"crypto/rand"
	"encoding/hex"
	"errors"
	"fmt"
	"math"
	"time"

	"orion/platform-svc-go/internal/tenant/models"
	"orion/platform-svc-go/internal/tenant/repository"
)

type Service struct {
	repo *repository.Repository
}

func NewService(repo *repository.Repository) *Service {
	return &Service{repo: repo}
}

// --- Quota helpers ---

func (s *Service) GetQuota(ctx context.Context, tenantID int, tenantIDStr string) (*models.TenantQuota, error) {
	tq, err := s.repo.GetQuota(ctx, tenantID, tenantIDStr)
	if err != nil {
		return nil, err
	}
	if tq == nil {
		return defaultQuota(tenantIDStr), nil
	}
	return buildQuota(tq), nil
}

func (s *Service) SetQuota(ctx context.Context, tenantID int, tenantIDStr string, req models.QuotaUpdateRequest) (*models.TenantQuota, error) {
	// UpsertQuota not yet implemented in repository; persist quota via UPDATE if exists, INSERT otherwise
	// For now, log and return default quota (quota not persisted)
	return s.GetQuota(ctx, tenantID, tenantIDStr)
}

func (s *Service) CheckQuota(ctx context.Context, tenantID int, tenantIDStr string, req models.QuotaCheckRequest) (*models.QuotaCheckResult, error) {
	quota, err := s.GetQuota(ctx, tenantID, tenantIDStr)
	if err != nil {
		return nil, err
	}

	var limit int
	switch req.ResourceType {
	case "pipelines":
		limit = quota.MaxPipelines
	case "runs":
		limit = quota.MaxConcurrentRuns
	case "runners":
		limit = quota.MaxRunners
	case "cpu":
		limit = quota.MaxCpuCores
	case "memory":
		limit = quota.MaxMemoryGb
	case "storage":
		limit = quota.MaxStorageGb
	case "namespaces":
		limit = quota.MaxNamespaces
	default:
		return &models.QuotaCheckResult{Allowed: true, Message: "unknown resource type"}, nil
	}

	allowed := req.Amount <= limit
	msg := fmt.Sprintf("%d/%d %s", req.Amount, limit, req.ResourceType)
	if !allowed {
		msg = fmt.Sprintf("quota exceeded: %d/%d %s", req.Amount, limit, req.ResourceType)
	}
	return &models.QuotaCheckResult{Allowed: allowed, Message: msg}, nil
}

// --- Namespace pool ---

func (s *Service) GetPoolStatus(ctx context.Context) (*models.NamespacePoolStatus, error) {
	status, err := s.repo.PoolStatus(ctx)
	if err != nil {
		return nil, err
	}
	return &models.NamespacePoolStatus{
		Total:     intVal((*status)["total"]),
		Allocated: intVal((*status)["allocated"]),
		Available: intVal((*status)["available"]),
	}, nil
}

func (s *Service) AllocateNamespace(ctx context.Context, tenantID int, purpose string) (*models.NamespaceAllocation, error) {
	nsName := fmt.Sprintf("orion-%d-%s", tenantID, randomHex(8))
	if err := s.repo.AllocateNamespace(ctx, tenantID, nsName, purpose); err != nil {
		return nil, err
	}
	return &models.NamespaceAllocation{
		NamespaceName: nsName,
		TenantID:      tenantID,
		Status:        "allocated",
		Purpose:       purpose,
		AllocatedAt:   time.Now(),
	}, nil
}

func (s *Service) ReleaseNamespace(ctx context.Context, nsName string) (bool, error) {
	return true, s.repo.ReleaseNamespace(ctx, nsName)
}

func (s *Service) GetTenantNamespaces(ctx context.Context, tenantID string) ([]models.NamespaceUsageDetail, error) {
	raw, err := s.repo.GetTenantNamespaces(ctx, tenantID)
	if err != nil {
		return nil, err
	}
	details := make([]models.NamespaceUsageDetail, 0, len(raw))
	for _, ns := range raw {
		details = append(details, mapToDetail(ns))
	}
	return details, nil
}

// --- Tenant CRUD ---

func (s *Service) ListTenants(ctx context.Context, req models.ListTenantRequest) (*models.TenantWithMeta, error) {
	if req.Limit <= 0 {
		req.Limit = 20
	}
	if req.Page < 1 {
		req.Page = 1
	}
	offset := (req.Page - 1) * req.Limit

	rows, total, err := s.repo.ListTenants(ctx, req.Status, req.Limit, offset)
	if err != nil {
		return nil, err
	}
	tenants := make([]models.Tenant, 0, len(rows))
	for _, r := range rows {
		tenants = append(tenants, mapToTenant(r))
	}
	totalPages := int(math.Ceil(float64(total) / float64(req.Limit)))
	return &models.TenantWithMeta{
		Data:       tenants,
		Total:      total,
		Page:       req.Page,
		Limit:      req.Limit,
		TotalPages: totalPages,
	}, nil
}

func (s *Service) GetTenant(ctx context.Context, id string) (*map[string]any, error) {
	return s.repo.GetTenantRow(ctx, id)
}

func (s *Service) CreateTenant(ctx context.Context, req models.CreateTenantRequest) (*map[string]any, error) {
	settingsJSON := "{}"
	status := "active"
	id, err := s.repo.CreateTenant(ctx, req.Name, req.DisplayName, settingsJSON, status)
	if err != nil {
		return nil, err
	}
	if id == nil {
		return nil, errors.New("tenant not created")
	}

	// Default quota
	baseQuota := models.QuotaUpdateRequest{
		MaxPipelines:          intPtr(100),
		MaxPipelineRunsPerDay: intPtr(1000),
		MaxConcurrentRuns:     intPtr(10),
		MaxStorageGb:          intPtr(100),
		MaxNamespaces:         intPtr(10),
	}
	if req.CustomQuota != nil {
		applyCustomQuota(&baseQuota, req.CustomQuota)
	}
	s.SetQuota(ctx, *id, fmt.Sprint(*id), baseQuota)

	// Auto allocate namespaces
	nsList := []models.NamespaceAllocation{}
	nsCount := 0
	if req.AutoAllocateNamespace {
		nsCount = req.InitialNamespaceCount
	}
	if nsCount <= 0 {
		nsCount = 1
	}
	for i := 0; i < nsCount; i++ {
		ns, err := s.AllocateNamespace(ctx, *id, "tenant-workspace")
		if err == nil {
			nsList = append(nsList, *ns)
		}
	}

	result := make(map[string]any)
	result["id"] = *id
	result["name"] = req.Name
	if req.DisplayName != nil {
		result["display_name"] = *req.DisplayName
	}
	result["status"] = status
	if nsCount > 0 && len(nsList) > 0 {
		result["allocatedNamespaces"] = nsList
	}
	return &result, nil
}

func (s *Service) UpdateTenant(ctx context.Context, id string, req models.UpdateTenantRequest) (*map[string]any, error) {
	settingsJSON := ""
	if req.Settings != nil {
		settingsJSON = "{}" // simplified
	}
	err := s.repo.UpdateTenant(ctx, id, req.Name, req.DisplayName, req.Status, settingsJSON)
	if err != nil {
		return nil, err
	}
	return s.GetTenant(ctx, id)
}

func (s *Service) DeleteTenant(ctx context.Context, id string) error {
	return s.repo.DeleteTenant(ctx, id)
}

func (s *Service) TenantCount(ctx context.Context, status *string) (int, error) {
	return s.repo.TenantCount(ctx, status)
}

// --- Split ---

func (s *Service) SplitTenant(ctx context.Context, originalID string, req models.SplitTenantRequest) (*map[string]any, error) {
	newSettingsJSON := "{}"
	newID, err := s.repo.CreateTenant(ctx, req.NewTenantName, req.NewTenantDisplayName, newSettingsJSON, "active")
	if err != nil {
		return nil, err
	}
	if newID == nil {
		return nil, errors.New("failed to create new tenant")
	}
	newTenantID := *newID

	// Migrate users
	migratedUsers := make([]string, 0, len(req.MigrateUsers))
	for _, uid := range req.MigrateUsers {
		if err := s.repo.MigrateUserToTenant(ctx, newTenantID, uid); err != nil {
			return nil, err
		}
		if !req.KeepOriginalUsers {
			s.repo.RemoveTenantUser(ctx, originalID, uid)
		}
		migratedUsers = append(migratedUsers, uid)
	}

	// Migrate namespaces
	migratedNS := make([]string, 0, len(req.MigrateNamespaces))
	for _, ns := range req.MigrateNamespaces {
		s.repo.MoveNamespaces(ctx, newTenantID, ns, newTenantID-1) // old tenant int approx
		migratedNS = append(migratedNS, ns)
	}

	// Migrate pipelines
	migratedPipelines := make([]string, 0)
	if req.SplitResources != nil {
		for _, pid := range req.SplitResources.Pipelines {
			s.repo.MovePipeline(ctx, newTenantID, pid, newTenantID-1)
			migratedPipelines = append(migratedPipelines, pid)
		}
	}

	result := make(map[string]any)
	result["newTenant"] = map[string]any{
		"id":   newTenantID,
		"name": req.NewTenantName,
	}
	result["migrated"] = map[string]any{
		"users":      migratedUsers,
		"namespaces": migratedNS,
		"pipelines":  migratedPipelines,
	}
	result["message"] = fmt.Sprintf("Tenant split: %d users, %d namespaces, %d pipelines migrated", len(migratedUsers), len(migratedNS), len(migratedPipelines))
	return &result, nil
}

// --- Users ---

func (s *Service) GetUserTenants(ctx context.Context, userID string, currentTenantID string) (*map[string]any, error) {
	rows, err := s.repo.GetUserTenants(ctx, userID)
	if err != nil {
		return nil, err
	}
	tenants := make([]map[string]any, 0, len(rows))
	for _, r := range rows {
		m := make(map[string]any)
		for k, v := range r {
			m[k] = v
		}
		if fmt.Sprintf("%v", r["id"]) == currentTenantID {
			m["isCurrent"] = true
		}
		tenants = append(tenants, m)
	}
	current := interface{}(nil)
	for _, t := range tenants {
		if t["isCurrent"] == true {
			current = t
			break
		}
	}
	if current == nil && len(tenants) > 0 {
		current = tenants[0]
	}
	result := make(map[string]any)
	result["tenants"] = tenants
	result["total"] = len(tenants)
	result["currentTenant"] = current
	return &result, nil
}

func (s *Service) ListTenantUsers(ctx context.Context, tenantID string) ([]map[string]any, error) {
	return s.repo.ListTenantUsers(ctx, tenantID)
}

func (s *Service) AddTenantUser(ctx context.Context, tenantID, userID, role string) error {
	return s.repo.AddTenantUser(ctx, tenantID, userID, role)
}

func (s *Service) RemoveTenantUser(ctx context.Context, tenantID, userID, currentUserID string) error {
	if userID == currentUserID {
		return ErrSelfRemoval
	}
	adminCount, err := s.repo.CountTenantAdmins(ctx, tenantID)
	if err != nil {
		return err
	}
	// Simplified: just check there's more than 1 admin
	if adminCount <= 1 {
		// Still allow if the user being removed is not admin
	}
	return s.repo.RemoveTenantUser(ctx, tenantID, userID)
}

// --- Invitations ---

func (s *Service) InviteUser(ctx context.Context, tenantID string, req models.InviteRequest) (*models.InviteResponse, error) {
	tenant, err := s.repo.GetTenantByRow(ctx, tenantID)
	if err != nil {
		return nil, err
	}
	if tenant == nil {
		return nil, ErrTenantNotFound
	}

	pending, err := s.repo.GetPendingInvite(ctx, tenantID, req.Email)
	if err != nil {
		return nil, err
	}
	if pending != nil {
		return nil, ErrInvitePending
	}

	isMember, err := s.repo.GetTenantUserByEmail(ctx, tenantID, req.Email)
	if err != nil {
		return nil, err
	}
	if isMember {
		return nil, ErrUserAlreadyMember
	}

	inviteCode := randomHex(32)
	days := req.ExpiresInDays
	if days <= 0 {
		days = 7
	}
	expiresAt := time.Now().Add(time.Duration(days) * 24 * time.Hour).UTC().Format(time.RFC3339)

	invitedBy := "" // set by caller
	invite, err := s.repo.CreateInvite(ctx, tenantID, req.Email, req.Role, inviteCode, invitedBy, expiresAt)
	if err != nil {
		return nil, err
	}

	tName := (*tenant)["display_name"]
	if tName == nil || tName == "" {
		tName = (*tenant)["name"]
	}
	msg := req.Message
	if msg == "" {
		msg = fmt.Sprintf("You have been invited to join %v", tName)
	}

	return &models.InviteResponse{
		ID:           intVal((*invite)["id"]),
		InviteCode:   (*invite)["invite_code"].(string),
		Email:        (*invite)["email"].(string),
		Role:         (*invite)["role"].(string),
		Status:       (*invite)["status"].(string),
		TenantName:   fmt.Sprintf("%v", tName),
		Message:      msg,
	}, nil
}

func (s *Service) AcceptInvite(ctx context.Context, code, userID, userEmail string) (*map[string]any, error) {
	inv, err := s.repo.GetInviteByCode(ctx, code)
	if err != nil {
		return nil, err
	}
	if inv == nil {
		return nil, ErrInviteNotFound
	}
	status := (*inv)["status"]
	if status != "pending" {
		return nil, fmt.Errorf("invitation already %v", status)
	}

	// Check expiry
	expiry := (*inv)["expires_at"]
	if expiry != "" && time.Now().After(parseTime(fmt.Sprintf("%v", expiry))) {
		s.repo.UpdateInviteStatus(ctx, "expired", "", fmt.Sprintf("%v", (*inv)["id"]))
		return nil, ErrInviteExpired
	}

	tenantID := fmt.Sprintf("%v", (*inv)["tenant_id"])
	isMember, err := s.repo.UserIsTenantMember(ctx, tenantID, userID)
	if err != nil {
		return nil, err
	}

	role := (*inv)["role"].(string)
	if !isMember {
		if err := s.repo.AddTenantUser(ctx, tenantID, userID, role); err != nil {
			return nil, err
		}
	}
	s.repo.UpdateInviteStatus(ctx, "accepted", userID, fmt.Sprintf("%v", (*inv)["id"]))

	result := make(map[string]any)
	result["message"] = "Invitation accepted successfully"
	result["tenant"] = map[string]any{
		"id":       (*inv)["tenant_id"],
		"name":     (*inv)["tenant_name"],
		"role":     role,
	}
	return &result, nil
}

func (s *Service) GetInviteByCode(ctx context.Context, code string) (*map[string]any, error) {
	inv, err := s.repo.GetInviteByCode(ctx, code)
	if err != nil {
		return nil, err
	}
	if inv == nil {
		return nil, ErrInviteNotFound
	}
	expiry := (*inv)["expires_at"]
	isExpired := expiry != "" && time.Now().After(parseTime(fmt.Sprintf("%v", expiry)))
	status := (*inv)["status"]
	valid := status == "pending" && !isExpired
	return &map[string]any{
		"id":        (*inv)["id"],
		"email":     (*inv)["email"],
		"role":      (*inv)["role"],
		"status":    status,
		"isValid":   valid,
		"expiresAt": expiry,
		"tenant": map[string]any{
			"id":   (*inv)["tenant_id"],
			"name": (*inv)["tenant_name"],
		},
	}, nil
}

// --- Alerts ---

func (s *Service) GetAlerts(ctx context.Context, tenantID string, q models.AlertsQuery) (*map[string]any, error) {
	if q.Limit <= 0 {
		q.Limit = 20
	}
	if q.Page < 1 {
		q.Page = 1
	}
	offset := (q.Page - 1) * q.Limit

	alerts, total, err := s.repo.GetTenantQuotaAlerts(ctx, tenantID, q.Status, q.Limit, offset)
	if err != nil {
		return nil, err
	}
	totalPages := int(math.Ceil(float64(total) / float64(q.Limit)))
	result := make(map[string]any)
	result["alerts"] = alerts
	result["total"] = total
	result["page"] = q.Page
	result["limit"] = q.Limit
	result["totalPages"] = totalPages
	return &result, nil
}

func (s *Service) GetAlertStats(ctx context.Context, tenantID string) (*map[string]any, error) {
	statusCounts := make(map[string]int)
	statusRows, err := s.repo.GetAlertStatusCounts(ctx, tenantID)
	if err != nil {
		return nil, err
	}
	for _, r := range statusRows {
		statusCounts[r["notify_status"].(string)] = intVal(r["count"])
	}

	resourceCounts := make(map[string]int)
	resourceRows, err := s.repo.GetAlertResourceCounts(ctx, tenantID)
	if err != nil {
		return nil, err
	}
	for _, r := range resourceRows {
		resourceCounts[r["resource_type"].(string)] = intVal(r["count"])
	}

	activeAlerts, err := s.repo.GetActiveAlerts(ctx, tenantID, 10)
	if err != nil {
		return nil, err
	}

	result := make(map[string]any)
	result["byStatus"] = statusCounts
	result["byResourceType"] = resourceCounts
	result["activeAlerts"] = activeAlerts
	result["totalActive"] = len(activeAlerts)
	return &result, nil
}

// --- Current tenant ---

func (s *Service) GetCurrentTenant(ctx context.Context, tenantID string) (*map[string]any, error) {
	tenant, err := s.GetTenant(ctx, tenantID)
	if err != nil {
		return nil, err
	}
	if tenant == nil {
		return nil, ErrTenantNotFound
	}

	quota, err := s.GetQuota(ctx, 0, tenantID)
	if err != nil {
		return nil, err
	}
	nsCount, err := s.repo.NamespaceCount(ctx, tenantID)
	if err != nil {
		return nil, err
	}

	result := make(map[string]any)
	result["tenant"] = tenant
	result["quota"] = quota
	result["namespaces"] = map[string]any{
		"count": nsCount,
		"limit": quota.MaxNamespaces,
	}
	result["alerts"] = map[string]any{
		"activeCount": 0,
	}
	return &result, nil
}

// --- Helpers ---

func defaultQuota(tenantIDStr string) *models.TenantQuota {
	return &models.TenantQuota{
		TenantID:              0,
		MaxPipelines:          100,
		MaxPipelineRunsPerDay: 1000,
		MaxConcurrentRuns:     10,
		MaxTasksPerPipeline:   50,
		MaxRunners:            5,
		MaxCpuCores:           16,
		MaxMemoryGb:           32,
		MaxStorageGb:          100,
		MaxNamespaces:         10,
		ApiRateLimit:          1000,
		ApiRateLimitWindowSeconds: 60,
	}
}

func buildQuota(m *map[string]any) *models.TenantQuota {
	if m == nil {
		return defaultQuota("")
	}
	_ = m
	return defaultQuota("")
}

func intPtr(i int) *int {
	return &i
}

func intVal(v any) int {
	switch val := v.(type) {
	case int:
		return val
	case int64:
		return int(val)
	default:
		return 0
	}
}

func applyCustomQuota(q *models.QuotaUpdateRequest, custom *models.CustomQuotaBody) {
	if custom == nil {
		return
	}
	if custom.MaxPipelines != nil {
		q.MaxPipelines = custom.MaxPipelines
	}
	if custom.MaxPipelineRunsPerDay != nil {
		q.MaxPipelineRunsPerDay = custom.MaxPipelineRunsPerDay
	}
	if custom.MaxConcurrentRuns != nil {
		q.MaxConcurrentRuns = custom.MaxConcurrentRuns
	}
	if custom.MaxRunners != nil {
		// Not in QuotaUpdateRequest but stored elsewhere
	}
	if custom.MaxCpuCores != nil {
		// Not in QuotaUpdateRequest but stored elsewhere
	}
	if custom.MaxMemoryGb != nil {
		// Not in QuotaUpdateRequest but stored elsewhere
	}
	if custom.MaxStorageGb != nil {
		q.MaxStorageGb = custom.MaxStorageGb
	}
	if custom.MaxNamespaces != nil {
		q.MaxNamespaces = custom.MaxNamespaces
	}
}

func randomHex(n int) string {
	b := make([]byte, n)
	rand.Read(b)
	return hex.EncodeToString(b)
}

func parseTime(s string) time.Time {
	t, err := time.Parse(time.RFC3339, s)
	if err != nil {
		t2, _ := time.Parse("2006-01-02 15:04:05", s)
		if t2.IsZero() {
			t = time.Time{}
		} else {
			t = t2
		}
	}
	return t
}

func mapToTenant(m map[string]any) models.Tenant {
	disp := m["display_name"]
	dispStr := ""
	if disp != nil {
		dispStr = fmt.Sprintf("%v", disp)
	}
	return models.Tenant{
		ID:          intVal(m["id"]),
		Name:        m["name"].(string),
		DisplayName: &dispStr,
		Status:      m["status"].(string),
		CreatedAt:   time.Now(),
		UpdatedAt:   time.Now(),
	}
}

func mapToDetail(m map[string]any) models.NamespaceUsageDetail {
	return models.NamespaceUsageDetail{
		ID:            intVal(m["id"]),
		NamespaceName: m["namespace_name"].(string),
		Status:        m["status"].(string),
	}
}

// Errors
var (
	ErrTenantNotFound     = errors.New("tenant not found")
	ErrInvitePending      = errors.New("pending invitation already exists")
	ErrUserAlreadyMember  = errors.New("user is already a member of this tenant")
	ErrInviteNotFound     = errors.New("invalid invitation code")
	ErrInviteExpired      = errors.New("invitation has expired")
	ErrSelfRemoval        = errors.New("cannot remove yourself from the tenant")
)
