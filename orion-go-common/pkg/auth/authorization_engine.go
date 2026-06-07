package auth

import (
	"context"
	"crypto/sha256"
	"database/sql"
	"encoding/hex"
	"fmt"
	"log"
	"net"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"

	audit "orion/go-common/pkg/audit"
)

// AuthorizationEngine is the unified authorization engine that evaluates
// RBAC → ABAC deny-only → relationship check → audit log.
//
// Evaluation order:
//  1. RBAC: Check if user's role (with inheritance) grants resource:action
//  2. ABAC: Evaluate deny-only policies (can only restrict, never expand)
//  3. Relationship: Check project membership for project-scoped resources
//  4. Audit: Log the decision with chain hash
type AuthorizationEngine struct {
	repo      *RBACRepository
	abac      *ABACEngine
	cache     *PermissionCache
	config    EngineConfig
	auditCh   chan *PermissionAuditLog
	auditStop chan struct{}

	// Phase 4: UEBA real-time detection and WORM storage
	uebaDetector *audit.UEBADetector
	alertService *audit.AlertService
	wormStore    *audit.S3WORMStorage
}

// EngineConfig holds configuration for the AuthorizationEngine.
type EngineConfig struct {
	// UseInMemoryRBAC uses the in-memory role permission maps (permission.go)
	// instead of DB-backed role_permissions table. Default: true for backward compat.
	UseInMemoryRBAC bool
	// AuditEnabled enables writing to permission_audit_logs table. Default: true.
	AuditEnabled bool
	// ChainHashEnabled enables chain hash computation for audit logs. Default: false (Phase 4).
	ChainHashEnabled bool
}

// DefaultEngineConfig returns the default engine configuration.
func DefaultEngineConfig() EngineConfig {
	return EngineConfig{
		UseInMemoryRBAC:  true,
		AuditEnabled:     true,
		ChainHashEnabled: true,
	}
}

// NewAuthorizationEngine creates a new AuthorizationEngine.
// If AuditEnabled and repo are set, starts a background audit worker.
func NewAuthorizationEngine(repo *RBACRepository, config EngineConfig) *AuthorizationEngine {
	e := &AuthorizationEngine{
		repo:      repo,
		abac:      NewABACEngine(DefaultABACPolicies()),
		config:    config,
		auditCh:   make(chan *PermissionAuditLog, 1024),
		auditStop: make(chan struct{}),
	}
	e.startAuditWorker()
	return e
}

// NewAuthorizationEngineWithCache creates a new AuthorizationEngine with a permission cache.
func NewAuthorizationEngineWithCache(repo *RBACRepository, config EngineConfig, cache *PermissionCache) *AuthorizationEngine {
	e := &AuthorizationEngine{
		repo:      repo,
		abac:      NewABACEngine(DefaultABACPolicies()),
		cache:     cache,
		config:    config,
		auditCh:   make(chan *PermissionAuditLog, 1024),
		auditStop: make(chan struct{}),
	}
	e.startAuditWorker()
	return e
}

// NewAuthorizationEngineWithABAC creates a new AuthorizationEngine with custom ABAC policies.
func NewAuthorizationEngineWithABAC(repo *RBACRepository, config EngineConfig, abacPolicies []ABACPolicy) *AuthorizationEngine {
	e := &AuthorizationEngine{
		repo:      repo,
		abac:      NewABACEngine(abacPolicies),
		config:    config,
		auditCh:   make(chan *PermissionAuditLog, 1024),
		auditStop: make(chan struct{}),
	}
	e.startAuditWorker()
	return e
}

// startAuditWorker launches a background goroutine that drains the audit channel.
func (e *AuthorizationEngine) startAuditWorker() {
	if !e.config.AuditEnabled || e.repo == nil {
		return
	}
	go func() {
		for {
			select {
			case entry := <-e.auditCh:
				if entry == nil {
					continue
				}
				// Retry up to 3 times on failure
				for attempt := 0; attempt < 3; attempt++ {
					if err := e.repo.CreateAuditLog(context.Background(), entry); err == nil {
						break
					}
					time.Sleep(time.Duration(attempt+1) * 50 * time.Millisecond)
				}
				// Phase 4: Also write to WORM storage if configured
				if e.wormStore != nil {
					auditEntry := permissionAuditLogToAuditEntry(entry)
					if err := e.wormStore.Store(context.Background(), []audit.AuditEntry{auditEntry}); err != nil {
						log.Printf("[WARN] WORM store write failed for audit entry %s: %v", entry.ID, err)
					}
				}
			case <-e.auditStop:
				// Drain remaining entries before shutdown
				for {
					select {
					case entry := <-e.auditCh:
						if entry != nil {
							_ = e.repo.CreateAuditLog(context.Background(), entry)
						}
					default:
						return
					}
				}
			}
		}
	}()
}

// StopAuditWorker gracefully stops the audit worker, flushing remaining entries.
func (e *AuthorizationEngine) StopAuditWorker() {
	select {
	case <-e.auditStop:
		// already stopped
	default:
		close(e.auditStop)
	}
}

// SetUEBADetector attaches a UEBA detector for real-time security event evaluation.
func (e *AuthorizationEngine) SetUEBADetector(detector *audit.UEBADetector) {
	e.uebaDetector = detector
}

// SetAlertService attaches an alert service for dispatching UEBA alerts.
func (e *AuthorizationEngine) SetAlertService(service *audit.AlertService) {
	e.alertService = service
}

// SetWORMStorage attaches S3-based WORM storage as a secondary audit log destination.
func (e *AuthorizationEngine) SetWORMStorage(store *audit.S3WORMStorage) {
	e.wormStore = store
}

// Authorize evaluates an authorization request through the full pipeline.
// Returns a decision indicating whether the request is allowed.
//
// Evaluation order:
//  0. User status: deny if user account is disabled or suspended
//  1. Cache: check PermissionCache for prior allow decision
//  2. RBAC: check if user's role (with inheritance) grants resource:action
//  3. ABAC: evaluate deny-only policies (can only restrict, never expand)
//  4. Relationship: check project membership for project-scoped resources
//  5. Cache: cache allow decision for future lookups
//  6. Audit: log the decision with chain hash
func (e *AuthorizationEngine) Authorize(ctx context.Context, req AuthZRequest) AuthZDecision {
	// Step 0: User status check — deny disabled/suspended accounts immediately
	if req.UserStatus == "disabled" || req.UserStatus == "suspended" {
		decision := AuthZDecision{Allowed: false, Reason: "user account is " + req.UserStatus, Source: "status"}
		e.auditDecision(ctx, req, decision)
		return decision
	}

	// Step 1: Check permission cache (only for non-super_admin)
	if e.cache != nil {
		if cached := e.cache.Get(ctx, req); cached != nil {
			return *cached
		}
	}

	// Step 2: RBAC check
	allowed, reason, source := e.checkRBAC(ctx, req)
	if !allowed {
		decision := AuthZDecision{Allowed: false, Reason: reason, Source: source}
		e.auditDecision(ctx, req, decision)
		return decision
	}

	// Step 3: ABAC deny-only check
	denied, abacReason := e.abac.Evaluate(ctx, req)
	if denied {
		decision := AuthZDecision{Allowed: false, Reason: abacReason, Source: "abac"}
		e.auditDecision(ctx, req, decision)
		return decision
	}

	// Step 4: Relationship check (project-scoped resources)
	if req.ResourceID != "" {
		relAllowed, relReason := e.checkRelationship(ctx, req)
		if !relAllowed {
			decision := AuthZDecision{Allowed: false, Reason: relReason, Source: "relationship"}
			e.auditDecision(ctx, req, decision)
			return decision
		}
	}

	// All checks passed
	decision := AuthZDecision{Allowed: true, Reason: "authorized", Source: source}

	// Cache the allow decision for future lookups
	if e.cache != nil {
		e.cache.Set(ctx, req, decision)
	}

	e.auditDecision(ctx, req, decision)
	return decision
}

// checkRBAC performs the RBAC permission check.
// Returns (allowed, reason, source).
func (e *AuthorizationEngine) checkRBAC(ctx context.Context, req AuthZRequest) (bool, string, string) {
	// Super admin bypass
	for _, role := range req.Roles {
		if role == "super_admin" {
			return true, "super_admin", "super_admin"
		}
	}

	if e.config.UseInMemoryRBAC {
		return e.checkRBACInMemory(req)
	}
	return e.checkRBACDatabase(ctx, req)
}

// checkRBACInMemory uses the in-memory role permission maps.
func (e *AuthorizationEngine) checkRBACInMemory(req AuthZRequest) (bool, string, string) {
	for _, role := range req.Roles {
		if HasPermission(role, req.Resource, req.Action) {
			return true, fmt.Sprintf("role %s has %s:%s", role, req.Resource, req.Action), "rbac"
		}
	}
	return false, fmt.Sprintf("no role has %s:%s", req.Resource, req.Action), "rbac"
}

// checkRBACDatabase uses the database-backed role_permissions table with inheritance.
func (e *AuthorizationEngine) checkRBACDatabase(ctx context.Context, req AuthZRequest) (bool, string, string) {
	if e.repo == nil {
		return false, "no RBAC repository configured", "rbac"
	}

	// Resolve all effective permissions for the user
	perms, err := e.repo.ResolveUserPermissions(ctx, req.TenantID, req.UserID)
	if err != nil {
		return false, fmt.Sprintf("failed to resolve permissions: %v", err), "rbac"
	}

	// Check if any permission matches
	target := req.Resource + ":" + req.Action
	for _, p := range perms {
		if matchPermission(p, target) {
			return true, fmt.Sprintf("user has permission %s", p), "rbac"
		}
	}

	return false, fmt.Sprintf("user lacks %s:%s", req.Resource, req.Action), "rbac"
}

// matchPermission checks if a permission string matches the target.
// Supports wildcards: "*:*", "resource:*", "*:action".
func matchPermission(perm, target string) bool {
	if perm == "*:*" {
		return true
	}
	parts := strings.SplitN(perm, ":", 2)
	if len(parts) != 2 {
		return false
	}
	targetParts := strings.SplitN(target, ":", 2)
	if len(targetParts) != 2 {
		return false
	}
	// resource:* matches any action on that resource
	if parts[0] == targetParts[0] && parts[1] == "*" {
		return true
	}
	// *:action matches that action on any resource
	if parts[0] == "*" && parts[1] == targetParts[1] {
		return true
	}
	// exact match
	return perm == target
}

// checkRelationship checks project membership for project-scoped resources.
func (e *AuthorizationEngine) checkRelationship(ctx context.Context, req AuthZRequest) (bool, string) {
	if e.repo == nil {
		return true, "" // no repo, skip relationship check
	}

	// Only check for project-scoped resources
	if req.Resource != "project" && req.ResourceID == "" {
		return true, ""
	}

	// Check if user is a member of the project
	member, err := e.repo.GetProjectMember(ctx, req.TenantID, req.ResourceID, req.UserID)
	if err != nil {
		// Non-member accessing project-scoped resource — deny
		return false, fmt.Sprintf("user is not a member of project %s", req.ResourceID)
	}

	// Check if the project role grants the requested action
	if HasPermission(member.Role, req.Resource, req.Action) {
		return true, ""
	}

	return false, fmt.Sprintf("project role %s lacks %s:%s", member.Role, req.Resource, req.Action)
}

// auditDecision writes the authorization decision to the audit log.
func (e *AuthorizationEngine) auditDecision(ctx context.Context, req AuthZRequest, decision AuthZDecision) {
	if !e.config.AuditEnabled || e.repo == nil {
		return
	}

	decisionStr := "deny"
	if decision.Allowed {
		decisionStr = "allow"
	}
	auditLog := &PermissionAuditLog{
		ID:       uuid.New().String(),
		TenantID: req.TenantID,
		UserID:   req.UserID,
		Resource: req.Resource,
		Action:   req.Action,
		Decision: decisionStr,
		Source:   decision.Source,
	}

	if req.ResourceID != "" {
		auditLog.ResourceID = sql.NullString{String: req.ResourceID, Valid: true}
	}
	if decision.Reason != "" {
		auditLog.Reason = sql.NullString{String: decision.Reason, Valid: true}
	}

	// Extract IP and user agent from context if available
	if ip := extractIP(ctx); ip != "" {
		auditLog.IPAddress = sql.NullString{String: ip, Valid: true}
	}
	if ua := extractUserAgent(ctx); ua != "" {
		auditLog.UserAgent = sql.NullString{String: ua, Valid: true}
	}
	if reqID := extractRequestID(ctx); reqID != "" {
		auditLog.RequestID = sql.NullString{String: reqID, Valid: true}
	}

	// Chain hash computation (Phase 4)
	if e.config.ChainHashEnabled {
		e.computeChainHash(ctx, auditLog)
	}

	// Phase 4: UEBA real-time evaluation
	if e.uebaDetector != nil {
		secEvent := audit.SecurityEvent{
			Type:      "auth",
			TenantID:  req.TenantID,
			UserID:    req.UserID,
			Resource:  req.Resource,
			Action:    req.Action,
			Decision:  decisionStr,
			Timestamp: time.Now(),
		}
		if ip := extractIP(ctx); ip != "" {
			secEvent.IPAddress = ip
		}
		if ua := extractUserAgent(ctx); ua != "" {
			secEvent.UserAgent = ua
		}

		go func() {
			defer func() {
				if r := recover(); r != nil {
					// UEBA panic should never crash the authorization engine
				}
			}()
			alerts, err := e.uebaDetector.Evaluate(ctx, secEvent)
			if err != nil {
				return
			}
			if len(alerts) > 0 && e.alertService != nil {
				_ = e.alertService.DispatchBatch(ctx, alerts)
			}
		}()
	}

	// Send to buffered audit worker (non-blocking, drops on full channel)
	select {
	case e.auditCh <- auditLog:
	default:
		// Channel full — drop to avoid blocking the request path
	}
}

// computeChainHash computes the chain hash for tamper-proofing (Phase 4).
func (e *AuthorizationEngine) computeChainHash(ctx context.Context, log *PermissionAuditLog) {
	prevHash, _ := e.repo.GetLastAuditHash(ctx, log.TenantID)
	log.PrevHash = sql.NullString{String: prevHash, Valid: prevHash != ""}

	// Hash: SHA256(prev_hash + tenant_id + user_id + resource + action + decision + timestamp)
	payload := fmt.Sprintf("%s|%s|%s|%s|%s|%s|%s",
		prevHash, log.TenantID, log.UserID, log.Resource, log.Action,
		log.Decision, log.CreatedAt.Format(time.RFC3339Nano))
	hash := sha256.Sum256([]byte(payload))
	log.ChainHash = sql.NullString{String: hex.EncodeToString(hash[:]), Valid: true}
}

// context key types for extracting request metadata
type contextKeyIP string
type contextKeyUA string
type contextKeyRequestID string
type contextKeyUserStatus string

const (
	ctxKeyIP         contextKeyIP = "ip_address"
	ctxKeyUA         contextKeyUA = "user_agent"
	ctxKeyRequestID  contextKeyRequestID = "request_id"
	ctxKeyUserStatus contextKeyUserStatus = "user_status"
)

// extractIP extracts the client IP from context.
func extractIP(ctx context.Context) string {
	if ip, ok := ctx.Value(ctxKeyIP).(string); ok {
		return ip
	}
	return ""
}

// extractUserAgent extracts the user agent from context.
func extractUserAgent(ctx context.Context) string {
	if ua, ok := ctx.Value(ctxKeyUA).(string); ok {
		return ua
	}
	return ""
}

// extractRequestID extracts the request ID from context.
func extractRequestID(ctx context.Context) string {
	if rid, ok := ctx.Value(ctxKeyRequestID).(string); ok {
		return rid
	}
	return ""
}

// ContextWithIP adds client IP to context.
func ContextWithIP(ctx context.Context, ip string) context.Context {
	return context.WithValue(ctx, ctxKeyIP, ip)
}

// ContextWithUserAgent adds user agent to context.
func ContextWithUserAgent(ctx context.Context, ua string) context.Context {
	return context.WithValue(ctx, ctxKeyUA, ua)
}

// ContextWithRequestID adds request ID to context.
func ContextWithRequestID(ctx context.Context, rid string) context.Context {
	return context.WithValue(ctx, ctxKeyRequestID, rid)
}

// ContextWithUserStatus adds user account status to context.
func ContextWithUserStatus(ctx context.Context, status string) context.Context {
	return context.WithValue(ctx, ctxKeyUserStatus, status)
}

// extractUserStatus extracts user account status from context.
func extractUserStatus(ctx context.Context) string {
	if s, ok := ctx.Value(ctxKeyUserStatus).(string); ok {
		return s
	}
	return ""
}

// permissionAuditLogToAuditEntry converts a PermissionAuditLog to an audit.AuditEntry
// for WORM storage. This bridges the auth package's audit log type with the
// audit package's unified AuditEntry type.
func permissionAuditLogToAuditEntry(log *PermissionAuditLog) audit.AuditEntry {
	entry := audit.AuditEntry{
		ID:        log.ID,
		TenantID:  log.TenantID,
		UserID:    log.UserID,
		Resource:  log.Resource,
		Action:    log.Action,
		Decision:  log.Decision,
		Source:    log.Source,
		Timestamp: log.CreatedAt,
	}
	// Note: ResourceID is not mapped to AuditEntry (no corresponding field).
	// entry.ID is already set to log.ID above.
	if log.Reason.Valid {
		entry.Reason = log.Reason.String
	}
	if log.IPAddress.Valid {
		entry.IPAddress = log.IPAddress.String
	}
	if log.UserAgent.Valid {
		entry.UserAgent = log.UserAgent.String
	}
	if log.RequestID.Valid {
		entry.RequestID = log.RequestID.String
	}
	if log.PrevHash.Valid {
		entry.PrevHash = log.PrevHash.String
	}
	if log.ChainHash.Valid {
		entry.Hash = log.ChainHash.String
	}
	return entry
}

// ──────────────────────────────────────────────────────────────────────────────
// Middleware integration
// ──────────────────────────────────────────────────────────────────────────────

// RequireAuthorization returns gin middleware that uses the AuthorizationEngine.
// Usage: router.Use(auth.RequireAuthorization(engine, "pipeline", "write"))
func RequireAuthorization(engine *AuthorizationEngine, resource, action string) gin.HandlerFunc {
	return func(c *gin.Context) {
		userID := GetUserID(c)
		tenantID := GetTenantID(c)

		if userID == "" || tenantID == "" {
			c.AbortWithStatusJSON(401, gin.H{"code": 401, "message": "unauthenticated"})
			return
		}

		roles := GetRoles(c)

		// Enrich context with request metadata
		ctx := c.Request.Context()
		if ip, _, err := net.SplitHostPort(c.Request.RemoteAddr); err == nil {
			ctx = ContextWithIP(ctx, ip)
		}
		ctx = ContextWithUserAgent(ctx, c.Request.UserAgent())
		if reqID := c.GetHeader("X-Request-ID"); reqID != "" {
			ctx = ContextWithRequestID(ctx, reqID)
		}

		// Extract user status from gin context (set by Auth middleware)
		userStatus := ""
		if s, exists := c.Get("user_status"); exists {
			userStatus, _ = s.(string)
		}

		req := AuthZRequest{
			UserID:     userID,
			TenantID:   tenantID,
			Roles:      roles,
			Resource:   resource,
			Action:     action,
			UserStatus: userStatus,
		}

		decision := engine.Authorize(ctx, req)
		if !decision.Allowed {
			c.AbortWithStatusJSON(403, gin.H{
				"code":    403,
				"message": "forbidden",
				"detail":  decision.Reason,
				"source":  decision.Source,
			})
			return
		}

		c.Next()
	}
}
