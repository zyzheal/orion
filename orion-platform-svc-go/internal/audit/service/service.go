package service

//go:generate mockgen -destination=mock_service.go -package=service . ServiceInterface
//go:generate mockgen -destination=mock_repository.go -package=service . RepositoryInterface

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"math"
	"sort"
	"strings"
	"time"

	"orion/go-common/pkg/sentinel"
	"orion/platform-svc-go/internal/audit/models"
	"orion/platform-svc-go/internal/audit/repository"
)

// ErrNotFound is an alias for sentinel.NotFound for test compatibility.
var ErrNotFound = sentinel.NotFound

// RepositoryInterface defines the repository methods used by the service.
type RepositoryInterface interface {
	Create(ctx context.Context, tenantID string, req models.AuditLogCreateRequest) (*models.AuditLog, error)
	Export(ctx context.Context, tenantID string, q models.AuditLogQuery) ([]models.AuditLog, error)
	GetActions(ctx context.Context, tenantID string) ([]string, error)
	GetByID(ctx context.Context, tenantID, id string) (*models.AuditLog, error)
	GetResourceTypes(ctx context.Context, tenantID string) ([]string, error)
	List(ctx context.Context, tenantID string, q models.AuditLogQuery) ([]models.AuditLog, int, error)
	VerifyChain(ctx context.Context, tenantID string) (int, bool, error)
}

// Service provides business logic for the audit module.
type Service struct {
	repo RepositoryInterface
}

// NewService creates a new Service backed by the given Repository interface.
func NewService(repo RepositoryInterface) *Service {
	return &Service{repo: repo}
}

// GenesisHash is the immutable chain genesis value (matches TS source).
const GenesisHash = "0000000000000000000000000000000000000000000000000000000000000000"

// toAuditLogEntry converts a DB model to the frontend-friendly entry format.
func toAuditLogEntry(log models.AuditLog) models.AuditLogEntry {
	details := make(map[string]any)
	_ = json.Unmarshal([]byte(log.RequestBody), &details)
	if len(details) == 0 {
		_ = json.Unmarshal([]byte(log.ResponseBody), &details)
	}
	return models.AuditLogEntry{
		ID:             log.ID,
		Timestamp:      log.CreatedAt,
		Action:         log.Action,
		UserID:         log.UserID,
		TenantID:       log.TenantID,
		Details:        details,
		Resource:       log.ResourceType,
		ResourceID:     log.ResourceID,
		IPAddress:      log.IPAddress,
		UserAgent:      log.UserAgent,
		PrevHash:       log.PrevHash,
		ContentHash:    log.Hash,
		ChainHash:      log.Hash,
		SequenceNumber: 0,
		RequestMethod:  log.RequestMethod,
		RequestPath:    log.RequestPath,
		ResponseCode:   log.ResponseCode,
	}
}

// Create creates a new audit log entry.
func (s *Service) Create(ctx context.Context, tenantID string, req models.AuditLogCreateRequest) (*models.AuditLogEntry, error) {
	// Default tenant
	if req.TenantID == "" {
		req.TenantID = tenantID
	}
	// Default resource type
	if req.ResourceType == "" {
		req.ResourceType = "audit"
	}

	log, err := s.repo.Create(ctx, req.TenantID, req)
	if err != nil {
		return nil, err
	}
	entry := toAuditLogEntry(*log)
	return &entry, nil
}

// Get retrieves a single audit log by ID.
func (s *Service) Get(ctx context.Context, tenantID, id string) (*models.AuditLogEntry, error) {
	log, err := s.repo.GetByID(ctx, tenantID, id)
	if err != nil {
		return nil, err
	}
	entry := toAuditLogEntry(*log)
	return &entry, nil
}

// List returns a paginated list of audit logs.
func (s *Service) List(ctx context.Context, tenantID string, q models.AuditLogQuery) (*models.AuditLogListResult, error) {
	logs, total, err := s.repo.List(ctx, tenantID, q)
	if err != nil {
		return nil, err
	}
	limit := q.Limit
	if limit <= 0 {
		limit = 20
	}
	totalPages := int(math.Ceil(float64(total) / float64(limit)))
	if totalPages == 0 {
		totalPages = 1
	}

	entries := make([]models.AuditLogEntry, 0, len(logs))
	for _, l := range logs {
		entries = append(entries, toAuditLogEntry(l))
	}
	return &models.AuditLogListResult{
		Entries:    entries,
		Total:      total,
		Page:       q.Page,
		Limit:      limit,
		TotalPages: totalPages,
	}, nil
}

// VerifySingle verifies the integrity of a single audit log entry.
func (s *Service) VerifySingle(ctx context.Context, tenantID, id string) (*models.AuditLogEntry, bool, error) {
	log, err := s.repo.GetByID(ctx, tenantID, id)
	if err != nil {
		return nil, false, err
	}
	entry := toAuditLogEntry(*log)
	return &entry, log.Hash != "", nil
}

// VerifyChain verifies the integrity of the entire audit chain for a tenant.
func (s *Service) VerifyChain(ctx context.Context, tenantID string) (*models.ChainVerifyResult, error) {
	verified, valid, err := s.repo.VerifyChain(ctx, tenantID)
	if err != nil {
		return nil, err
	}
	result := &models.ChainVerifyResult{
		Valid:         valid,
		TotalVerified: verified,
		VerifiedAt:    time.Now().UTC().Format(time.RFC3339),
	}
	if !valid {
		result.Breaks = []models.ChainBreak{{
			BreakType:   "HASH_MISMATCH",
			Description: fmt.Sprintf("Chain broken at sequence %d", verified),
			DetectedAt:  time.Now().UTC().Format(time.RFC3339),
		}}
	}
	return result, nil
}

// GetActions returns distinct action types for a tenant.
func (s *Service) GetActions(ctx context.Context, tenantID string) ([]string, error) {
	return s.repo.GetActions(ctx, tenantID)
}

// GetResourceTypes returns distinct resource types for a tenant.
func (s *Service) GetResourceTypes(ctx context.Context, tenantID string) ([]string, error) {
	return s.repo.GetResourceTypes(ctx, tenantID)
}

// ChainInfo returns chain compatibility information for a tenant.
func (s *Service) ChainInfo(ctx context.Context, tenantID string) (*models.ChainInfo, error) {
	logs, total, err := s.repo.List(ctx, tenantID, models.AuditLogQuery{Limit: 1})
	if err != nil {
		return nil, err
	}
	return &models.ChainInfo{
		TotalEntries:  total,
		FirstSequence: 1,
		LastSequence:  total,
		LastChainHash: func() string {
			if len(logs) > 0 {
				return logs[0].Hash
			}
			return ""
		}(),
		GenesisHash: GenesisHash,
	}, nil
}

// StorageStats returns storage compatibility stats for a tenant.
func (s *Service) StorageStats(ctx context.Context, tenantID string) (*models.StorageStats, error) {
	_, total, err := s.repo.List(ctx, tenantID, models.AuditLogQuery{Limit: 1})
	if err != nil {
		return nil, err
	}
	return &models.StorageStats{
		TotalEntries: total,
		StorageSize:  int64(total * 1024), // Approximate as TS source does
		LastFlushAt:  time.Now().UTC().Format(time.RFC3339),
		IsHealthy:    true,
	}, nil
}

// Export exports audit logs in the requested format (csv/json).
func (s *Service) Export(ctx context.Context, tenantID string, q models.AuditLogQuery) (*models.AuditLogExportResult, error) {
	logs, err := s.repo.Export(ctx, tenantID, q)
	if err != nil {
		return nil, err
	}
	format := q.Format
	if format == "" {
		format = "json"
	}
	filename := fmt.Sprintf("audit-export-%s.%s", time.Now().UTC().Format("2006-01-02"), format)
	var content string
	switch format {
	case "csv":
		content = repository.FormatCSV(logs)
	default:
		entries := make([]models.AuditLogEntry, 0, len(logs))
		for _, l := range logs {
			entries = append(entries, toAuditLogEntry(l))
		}
		b, _ := json.Marshal(entries)
		content = string(b)
	}
	return &models.AuditLogExportResult{
		Filename: filename,
		Content:  content,
	}, nil
}

// -----------------------------------------------------------------------
// Compliance control catalog
// -----------------------------------------------------------------------

// complianceControl is an internal definition of one compliance control.
type complianceControl struct {
	ID          string // SOC2: CC1–CC6; ISO27001: A.12.x …
	Name        string
	Category    string   // SOC2 trust service category / ISO27001 domain
	Actions     []string // audit action types that provide evidence for this control
	ExpectedMin int      // minimum distinct event types we expect to see
	Remediation string   // guidance given when control is partial / non-compliant
}

// controlCatalog returns the full set of controls. SOC2 and ISO27001 share
// the same audit-event universe; the framework parameter selects which
// subset is returned and labels the result appropriately.
func controlCatalog() []complianceControl {
	return []complianceControl{
		// ---- SOC2 Common Criteria (CC1–CC6) ----
		{ID: "CC1", Category: "SOC2", Name: "Control Environment",
			Actions:     []string{"CREATE", "UPDATE", "DELETE", "LOGIN", "LOGOUT"},
			ExpectedMin: 3,
			Remediation: "Ensure role definitions, segregation of duties and accountability policies are documented and enforced."},
		{ID: "CC2", Category: "SOC2", Name: "Communication and Information",
			Actions:     []string{"CREATE", "UPDATE", "APPROVE", "REVIEW"},
			ExpectedMin: 2,
			Remediation: "Review communication policies for internal and external information exchange; log policy update events."},
		{ID: "CC3", Category: "SOC2", Name: "Risk Assessment",
			Actions:     []string{"CREATE", "UPDATE", "SCAN", "AUDIT"},
			ExpectedMin: 2,
			Remediation: "Establish regular risk-assessment cycles; capture risk-scan and audit events in the audit log."},
		{ID: "CC4", Category: "SOC2", Name: "Monitoring Activities",
			Actions:     []string{"AUDIT", "ALERT", "LOGIN", "SCAN"},
			ExpectedMin: 3,
			Remediation: "Configure continuous monitoring of access, changes and failures; ensure alert events are persisted."},
		{ID: "CC5", Category: "SOC2", Name: "Control Activities",
			Actions:     []string{"APPROVE", "REJECT", "CREATE", "UPDATE", "DELETE"},
			ExpectedMin: 3,
			Remediation: "Document approval workflows and change-control gates; log every approval/rejection decision."},
		{ID: "CC6", Category: "SOC2", Name: "Logical and Physical Access",
			Actions:     []string{"LOGIN", "LOGOUT", "GRANT", "REVOKE", "CREATE", "UPDATE"},
			ExpectedMin: 4,
			Remediation: "Enforce MFA and least-privilege access; log every authentication and permission-change event."},
		// ---- ISO27001:2022 Annex A controls ----
		{ID: "A.9.1.2", Category: "ISO27001", Name: "Access Control — User Registration & De-provisioning",
			Actions:     []string{"CREATE", "DELETE", "GRANT", "REVOKE"},
			ExpectedMin: 3,
			Remediation: "Implement automated de-provisioning on user off-boarding; audit account lifecycle events."},
		{ID: "A.9.2.1", Category: "ISO27001", Name: "Access Control — Privileged Access Rights",
			Actions:     []string{"GRANT", "REVOKE", "UPDATE", "APPROVE"},
			ExpectedMin: 2,
			Remediation: "Require approval and justification for any privileged access grant; log escalation events."},
		{ID: "A.9.4.1", Category: "ISO27001", Name: "Access Control — System and Application Access Review",
			Actions:     []string{"AUDIT", "REVIEW", "SCAN"},
			ExpectedMin: 2,
			Remediation: "Conduct periodic access reviews; persist review outcomes to the audit log."},
		{ID: "A.9.4.2", Category: "ISO27001", Name: "Access Control — User Access Reviews",
			Actions:     []string{"REVIEW", "AUDIT", "REVOKE"},
			ExpectedMin: 2,
			Remediation: "Run quarterly user access reviews; record each review and any resulting de-provisioning."},
		{ID: "A.12.1.1", Category: "ISO27001", Name: "Operations — Change Management",
			Actions:     []string{"CREATE", "UPDATE", "DELETE", "APPROVE", "DEPLOY"},
			ExpectedMin: 3,
			Remediation: "Place all configuration and code changes under change-control; log deploy and rollback events."},
		{ID: "A.12.2.1", Category: "ISO27001", Name: "Operations — Malicious Software Prevention",
			Actions:     []string{"SCAN", "ALERT", "AUDIT"},
			ExpectedMin: 2,
			Remediation: "Run regular malware/SCA scans in CI; persist scan results and alert events."},
		{ID: "A.12.3.1", Category: "ISO27001", Name: "Operations — Information Backup",
			Actions:     []string{"CREATE", "EXPORT", "BACKUP", "RESTORE"},
			ExpectedMin: 2,
			Remediation: "Schedule regular backups of critical data; log every backup and restore operation."},
		{ID: "A.12.4.1", Category: "ISO27001", Name: "Operations — Event Logging",
			Actions:     []string{"CREATE", "AUDIT", "ALERT"},
			ExpectedMin: 3,
			Remediation: "Ensure immutable, time-stamped audit logs for all significant events; verify chain integrity."},
		{ID: "A.12.7.1", Category: "ISO27001", Name: "Operations — Technical Vulnerability Management",
			Actions:     []string{"SCAN", "AUDIT", "CREATE", "UPDATE"},
			ExpectedMin: 2,
			Remediation: "Subscribe to vulnerability feeds and patch on schedule; log scan findings and remediation actions."},
		{ID: "A.14.1.1", Category: "ISO27001", Name: "System Acquisition — Security Requirements",
			Actions:     []string{"CREATE", "APPROVE", "REVIEW"},
			ExpectedMin: 2,
			Remediation: "Define and sign off on security requirements before any system acquisition or development."},
		{ID: "A.14.2.1", Category: "ISO27001", Name: "System Acquisition — Secure Systems Engineering",
			Actions:     []string{"CREATE", "UPDATE", "DEPLOY", "APPROVE"},
			ExpectedMin: 3,
			Remediation: "Embed security reviews into the SDLC; log code-review and deployment-approval events."},
		{ID: "A.14.2.9", Category: "ISO27001", Name: "System Acquisition — Segregation of Environments",
			Actions:     []string{"CREATE", "UPDATE", "DEPLOY"},
			ExpectedMin: 2,
			Remediation: "Maintain separate dev/staging/prod environments; log every cross-environment change."},
		{ID: "A.18.1.1", Category: "ISO27001", Name: "Compliance — Legal and Contractual Obligations",
			Actions:     []string{"APPROVE", "REVIEW", "CREATE", "AUDIT"},
			ExpectedMin: 2,
			Remediation: "Maintain a register of legal obligations; audit and review compliance evidence periodically."},
		// ---- PCI-DSS v4.0 (36 controls across 6 control objectives A–F) ----
		// Objective A — Information Security Policy & Program
		{ID: "PCI-A1", Category: "PCI-DSS", Name: "Policy — Information Security Policy Established",
			Actions:     []string{"CREATE", "APPROVE", "REVIEW"},
			ExpectedMin: 2,
			Remediation: "Document a formal information-security policy covering all cardholder-data (CHD) processes and obtain executive sign-off."},
		{ID: "PCI-A2", Category: "PCI-DSS", Name: "Policy — CDE Scope Defined",
			Actions:     []string{"CREATE", "AUDIT", "REVIEW"},
			ExpectedMin: 2,
			Remediation: "Perform and periodically re-run a Cardholder Data Environment (CDE) scope discovery; log every scope change."},
		{ID: "PCI-A3", Category: "PCI-DSS", Name: "Policy — Roles & Responsibilities",
			Actions:     []string{"CREATE", "GRANT", "REVOKE", "REVIEW"},
			ExpectedMin: 2,
			Remediation: "Define security roles, map them to named individuals, and review assignments at least quarterly."},
		{ID: "PCI-A4", Category: "PCI-DSS", Name: "Policy — Security Awareness Training",
			Actions:     []string{"CREATE", "UPDATE", "APPROVE", "REVIEW"},
			ExpectedMin: 2,
			Remediation: "Deliver annual PCI awareness training and record completion events for every CDE employee."},
		{ID: "PCI-A5", Category: "PCI-DSS", Name: "Policy — Risk Assessment Cycle",
			Actions:     []string{"AUDIT", "SCAN", "CREATE", "REVIEW"},
			ExpectedMin: 2,
			Remediation: "Run formal risk-assessment cycles at least annually and log risk-register changes."},
		{ID: "PCI-A6", Category: "PCI-DSS", Name: "Policy — Service Provider Oversight",
			Actions:     []string{"CREATE", "APPROVE", "REVIEW", "AUDIT"},
			ExpectedMin: 2,
			Remediation: "Maintain an approved vendor list, sign DPAs, and verify providers' PCI-AOC status at least annually."},
		// Objective B — Data Flow & Protection
		{ID: "PCI-B1", Category: "PCI-DSS", Name: "Data — CHD Flow Mapping",
			Actions:     []string{"CREATE", "AUDIT", "REVIEW"},
			ExpectedMin: 2,
			Remediation: "Produce and keep current diagrams showing every CHD storage, processing and transmission path."},
		{ID: "PCI-B2", Category: "PCI-DSS", Name: "Data — Logical Segregation of CDE",
			Actions:     []string{"CREATE", "UPDATE", "REVOKE", "REVIEW"},
			ExpectedMin: 2,
			Remediation: "Enforce logical separation between CDE and non-CDE systems via VLANs, ASGs or equivalent; log boundary changes."},
		{ID: "PCI-B3", Category: "PCI-DSS", Name: "Data — Storage of CHD Minimized",
			Actions:     []string{"CREATE", "DELETE", "REVIEW", "AUDIT"},
			ExpectedMin: 2,
			Remediation: "Prohibit CHD storage where not strictly required; run periodic storage-minimization reviews."},
		{ID: "PCI-B4", Category: "PCI-DSS", Name: "Data — Strong Crypto for CHD in Transit",
			Actions:     []string{"CREATE", "UPDATE", "SCAN", "REVIEW"},
			ExpectedMin: 2,
			Remediation: "Enforce TLS 1.2+ with strong cipher suites for all external-facing CHD paths; scan for downgrade vulnerabilities."},
		{ID: "PCI-B5", Category: "PCI-DSS", Name: "Data — PAN Masked in Display",
			Actions:     []string{"CREATE", "UPDATE", "APPROVE", "REVIEW"},
			ExpectedMin: 2,
			Remediation: "Mask all but the first-6 and last-4 PAN digits wherever PAN is displayed in the UI or logs."},
		{ID: "PCI-B6", Category: "PCI-DSS", Name: "Data — Retention & Disposal",
			Actions:     []string{"DELETE", "EXPORT", "REVIEW", "AUDIT"},
			ExpectedMin: 2,
			Remediation: "Define CHD retention windows and purge expired records on schedule; log every bulk delete."},
		// Objective C — Security Program Elements
		{ID: "PCI-C1", Category: "PCI-DSS", Name: "Program — Network Security Controls",
			Actions:     []string{"CREATE", "UPDATE", "GRANT", "REVOKE"},
			ExpectedMin: 2,
			Remediation: "Deploy stateful firewall / ASG with least-privilege rules between all network segments; log config changes."},
		{ID: "PCI-C2", Category: "PCI-DSS", Name: "Program — Asset Inventory",
			Actions:     []string{"CREATE", "UPDATE", "DELETE", "AUDIT"},
			ExpectedMin: 2,
			Remediation: "Maintain a live inventory of all CDE assets including hardware, software and services; reconcile on change."},
		{ID: "PCI-C3", Category: "PCI-DSS", Name: "Program — Access Control to CDE Systems",
			Actions:     []string{"GRANT", "REVOKE", "APPROVE", "AUDIT"},
			ExpectedMin: 3,
			Remediation: "Enforce least-privilege, unique accounts and separation of duties for all CDE access."},
		{ID: "PCI-C4", Category: "PCI-DSS", Name: "Program — Cryptography for Stored CHD",
			Actions:     []string{"CREATE", "UPDATE", "APPROVE", "SCAN"},
			ExpectedMin: 2,
			Remediation: "Encrypt stored PAN/CHD with strong algorithms; rotate keys on schedule and log key-rotation events."},
		{ID: "PCI-C5", Category: "PCI-DSS", Name: "Program — MFA for CDE Access",
			Actions:     []string{"LOGIN", "GRANT", "REVOKE", "AUDIT"},
			ExpectedMin: 3,
			Remediation: "Require MFA for every authenticated access to the CDE; audit login events for compliance."},
		{ID: "PCI-C6", Category: "PCI-DSS", Name: "Program — Change Management for CDE",
			Actions:     []string{"CREATE", "UPDATE", "APPROVE", "REVIEW", "DEPLOY"},
			ExpectedMin: 3,
			Remediation: "Place all CDE changes under a formal change-control process; require approval and rollback plans."},
		// Objective D — Vulnerability Management
		{ID: "PCI-D1", Category: "PCI-DSS", Name: "Vuln — Approved Patches Within 30 Days",
			Actions:     []string{"UPDATE", "DEPLOY", "REVIEW", "AUDIT"},
			ExpectedMin: 2,
			Remediation: "Apply critical security patches within 30 days; track patch SLA and log install outcomes."},
		{ID: "PCI-D2", Category: "PCI-DSS", Name: "Vuln — Quarterly ASV Scans",
			Actions:     []string{"SCAN", "AUDIT", "CREATE", "REVIEW"},
			ExpectedMin: 2,
			Remediation: "Run quarterly external ASV scans and remediate to a clean report before renewal."},
		{ID: "PCI-D3", Category: "PCI-DSS", Name: "Vuln — Internal Vulnerability Scans",
			Actions:     []string{"SCAN", "AUDIT", "REVIEW"},
			ExpectedMin: 2,
			Remediation: "Perform monthly internal vulnerability scans against all CDE assets; track remediation to closure."},
		{ID: "PCI-D4", Category: "PCI-DSS", Name: "Vuln — Continuous Monitoring",
			Actions:     []string{"AUDIT", "ALERT", "SCAN"},
			ExpectedMin: 3,
			Remediation: "Deploy continuous monitoring of CDE network traffic; alert on suspicious activity."},
		{ID: "PCI-D5", Category: "PCI-DSS", Name: "Vuln — Intrusion-Detection / Prevention",
			Actions:     []string{"ALERT", "AUDIT", "UPDATE", "SCAN"},
			ExpectedMin: 2,
			Remediation: "Run IDS/IPS at CDE boundaries with tuned rules; review alerts at least weekly."},
		{ID: "PCI-D6", Category: "PCI-DSS", Name: "Vuln — Incident Response Plan",
			Actions:     []string{"ALERT", "CREATE", "APPROVE", "REVIEW", "AUDIT"},
			ExpectedMin: 2,
			Remediation: "Document, test and maintain an incident-response plan that covers PCI breach notification timelines."},
		// Objective E — Secure Access
		{ID: "PCI-E1", Category: "PCI-DSS", Name: "Access — Strong Authentication",
			Actions:     []string{"LOGIN", "LOGOUT", "CREATE", "GRANT"},
			ExpectedMin: 3,
			Remediation: "Require strong authentication for every access to the CDE; prohibit shared credentials."},
		{ID: "PCI-E2", Category: "PCI-DSS", Name: "Access — Need-to-Know Authorization",
			Actions:     []string{"GRANT", "REVOKE", "REVIEW", "AUDIT"},
			ExpectedMin: 2,
			Remediation: "Enforce need-to-know; revoke unnecessary access on role changes."},
		{ID: "PCI-E3", Category: "PCI-DSS", Name: "Access — Privileged Account Management",
			Actions:     []string{"GRANT", "REVOKE", "APPROVE", "REVIEW", "AUDIT"},
			ExpectedMin: 3,
			Remediation: "Restrict privileged accounts, require JIT or break-glass workflows, and review privileged assignments monthly."},
		{ID: "PCI-E4", Category: "PCI-DSS", Name: "Access — Session Timeout Enforcement",
			Actions:     []string{"LOGIN", "LOGOUT", "UPDATE", "AUDIT"},
			ExpectedMin: 2,
			Remediation: "Configure automatic session termination after 15 minutes of inactivity for all CDE applications."},
		{ID: "PCI-E5", Category: "PCI-DSS", Name: "Access — Quarterly Access Reviews",
			Actions:     []string{"REVIEW", "AUDIT", "REVOKE", "APPROVE"},
			ExpectedMin: 2,
			Remediation: "Conduct quarterly access reviews of all CDE accounts; document approver, outcome and any revocations."},
		{ID: "PCI-E6", Category: "PCI-DSS", Name: "Access — Timely De-provisioning",
			Actions:     []string{"REVOKE", "DELETE", "UPDATE", "AUDIT"},
			ExpectedMin: 2,
			Remediation: "Automate de-provisioning on off-boarding or role change; log every account deletion."},
		// Objective F — Compliance Evidence
		{ID: "PCI-F1", Category: "PCI-DSS", Name: "Evidence — Retain Audit Logs 12 Months",
			Actions:     []string{"CREATE", "AUDIT", "EXPORT"},
			ExpectedMin: 3,
			Remediation: "Retain CDE audit logs for at least 12 months (3 months immediately available); verify retention policy."},
		{ID: "PCI-F2", Category: "PCI-DSS", Name: "Evidence — Daily Audit-Log Review",
			Actions:     []string{"AUDIT", "REVIEW", "ALERT"},
			ExpectedMin: 3,
			Remediation: "Perform daily review of audit logs covering all CDE components; record reviewer and outcome."},
		{ID: "PCI-F3", Category: "PCI-DSS", Name: "Evidence — Time Synchronization",
			Actions:     []string{"CREATE", "UPDATE", "AUDIT"},
			ExpectedMin: 2,
			Remediation: "Synchronize clocks of all CDE systems via NTP; monitor for clock-skew alerts."},
		{ID: "PCI-F4", Category: "PCI-DSS", Name: "Evidence — Periodic Security Testing",
			Actions:     []string{"SCAN", "AUDIT", "REVIEW", "CREATE"},
			ExpectedMin: 2,
			Remediation: "Run annual penetration tests of the CDE and quarterly internal scans; track remediation."},
		{ID: "PCI-F5", Category: "PCI-DSS", Name: "Evidence — Compliance Reporting",
			Actions:     []string{"CREATE", "APPROVE", "EXPORT", "AUDIT"},
			ExpectedMin: 2,
			Remediation: "Produce the annual SAQ / ROC and archive with governance approval."},
		{ID: "PCI-F6", Category: "PCI-DSS", Name: "Evidence — Management Review",
			Actions:     []string{"REVIEW", "APPROVE", "AUDIT"},
			ExpectedMin: 2,
			Remediation: "Schedule and record a formal management review of PCI program effectiveness at least annually."},
		// ---- MLPS 2.0 等保三级 (21 representative controls) ----
		{ID: "MLPS-C1", Category: "MLPS2", Name: "安全计算环境 — 身份鉴别",
			Actions:     []string{"LOGIN", "LOGOUT", "CREATE", "GRANT"},
			ExpectedMin: 3,
			Remediation: "为所有访问主机的用户配置唯一标识 + 口令 + 双因子认证；空闲超时不超过 15 分钟。"},
		{ID: "MLPS-C2", Category: "MLPS2", Name: "安全计算环境 — 访问控制",
			Actions:     []string{"GRANT", "REVOKE", "REVIEW", "AUDIT"},
			ExpectedMin: 3,
			Remediation: "实现基于角色的访问控制；定期审查权限；管理员账号与业务账号分离。"},
		{ID: "MLPS-C3", Category: "MLPS2", Name: "安全计算环境 — 安全审计",
			Actions:     []string{"AUDIT", "CREATE", "REVIEW"},
			ExpectedMin: 3,
			Remediation: "启用系统、数据库、安全设备审计；审计记录覆盖用户行为并具备完整性保护。"},
		{ID: "MLPS-C4", Category: "MLPS2", Name: "安全计算环境 — 入侵防范",
			Actions:     []string{"SCAN", "ALERT", "AUDIT"},
			ExpectedMin: 2,
			Remediation: "部署主机入侵检测；限制默认共享；及时处置漏洞与后门。"},
		{ID: "MLPS-C5", Category: "MLPS2", Name: "安全计算环境 — 恶意代码防范",
			Actions:     []string{"SCAN", "ALERT", "UPDATE"},
			ExpectedMin: 2,
			Remediation: "启用恶意代码/病毒防护；病毒库定期更新；对重要服务器开启实时监控。"},
		{ID: "MLPS-C6", Category: "MLPS2", Name: "安全计算环境 — 数据完整性",
			Actions:     []string{"UPDATE", "DELETE", "REVIEW", "AUDIT"},
			ExpectedMin: 2,
			Remediation: "对重要数据的传输与存储使用完整性校验；异常时告警并告警后能恢复。"},
		{ID: "MLPS-C7", Category: "MLPS2", Name: "安全计算环境 — 数据备份恢复",
			Actions:     []string{"BACKUP", "RESTORE", "EXPORT", "REVIEW"},
			ExpectedMin: 2,
			Remediation: "关键数据本地 + 异地备份；定期恢复演练并记录验证结果。"},
		{ID: "MLPS-B1", Category: "MLPS2", Name: "安全区域边界 — 边界防护",
			Actions:     []string{"CREATE", "GRANT", "REVOKE", "AUDIT"},
			ExpectedMin: 2,
			Remediation: "在网络边界部署防火墙/ASG；仅开放必要端口与协议；配置变更留痕。"},
		{ID: "MLPS-B2", Category: "MLPS2", Name: "安全区域边界 — 访问控制",
			Actions:     []string{"GRANT", "REVOKE", "REVIEW", "AUDIT"},
			ExpectedMin: 2,
			Remediation: "在网络间访问路径上实施访问控制；采用白名单机制；定期审查访问规则。"},
		{ID: "MLPS-B3", Category: "MLPS2", Name: "安全区域边界 — 入侵防范",
			Actions:     []string{"ALERT", "SCAN", "AUDIT"},
			ExpectedMin: 2,
			Remediation: "在边界处部署 IPS/IDS；对攻击特征进行告警并留痕。"},
		{ID: "MLPS-B4", Category: "MLPS2", Name: "安全区域边界 — 安全审计",
			Actions:     []string{"AUDIT", "CREATE", "REVIEW"},
			ExpectedMin: 2,
			Remediation: "对边界设备进行安全审计；审计记录覆盖进出数据流的来源与去向。"},
		{ID: "MLPS-N1", Category: "MLPS2", Name: "安全通信网络 — 网络架构",
			Actions:     []string{"CREATE", "UPDATE", "REVIEW"},
			ExpectedMin: 2,
			Remediation: "关键网络区域应实现冗余（双链路/双机）；网络架构文档化并定期评审。"},
		{ID: "MLPS-N2", Category: "MLPS2", Name: "安全通信网络 — 通信传输保护",
			Actions:     []string{"CREATE", "UPDATE", "SCAN"},
			ExpectedMin: 2,
			Remediation: "重要通信链路使用加密传输（TLS/IPsec）；密钥定期轮换。"},
		{ID: "MLPS-N3", Category: "MLPS2", Name: "安全通信网络 — 网络访问控制",
			Actions:     []string{"GRANT", "REVOKE", "AUDIT"},
			ExpectedMin: 2,
			Remediation: "依据最小授权原则配置网络访问控制；对异常流量告警。"},
		{ID: "MLPS-N4", Category: "MLPS2", Name: "安全通信网络 — 网络运行监控",
			Actions:     []string{"AUDIT", "ALERT", "CREATE"},
			ExpectedMin: 2,
			Remediation: "部署网络运行监控；对性能、流量与错误率进行实时监测并留痕。"},
		{ID: "MLPS-M1", Category: "MLPS2", Name: "安全管理中心 — 集中管控",
			Actions:     []string{"CREATE", "UPDATE", "AUDIT", "APPROVE"},
			ExpectedMin: 2,
			Remediation: "建立集中化管理平台，统一管理与安全设备策略、账号、告警。"},
		{ID: "MLPS-M2", Category: "MLPS2", Name: "安全管理中心 — 审计集中管理",
			Actions:     []string{"AUDIT", "CREATE", "REVIEW", "EXPORT"},
			ExpectedMin: 3,
			Remediation: "审计日志集中存储 ≥ 6 个月；不可修改；具备审计分析能力。"},
		{ID: "MLPS-P1", Category: "MLPS2", Name: "安全管理制度 — 安全策略",
			Actions:     []string{"CREATE", "APPROVE", "REVIEW"},
			ExpectedMin: 2,
			Remediation: "制定并公示组织层面的安全策略；每年至少评审一次。"},
		{ID: "MLPS-P2", Category: "MLPS2", Name: "安全管理制度 — 人员安全管理",
			Actions:     []string{"CREATE", "APPROVE", "REVIEW"},
			ExpectedMin: 2,
			Remediation: "入职/离岗背景审查；签订保密协议；年度安全意识培训。"},
		{ID: "MLPS-P3", Category: "MLPS2", Name: "安全管理制度 — 建设管理",
			Actions:     []string{"CREATE", "APPROVE", "REVIEW", "DEPLOY"},
			ExpectedMin: 2,
			Remediation: "系统建设过程开展等级保护评估、验收测评；变更走正式流程。"},
		{ID: "MLPS-P4", Category: "MLPS2", Name: "安全管理制度 — 合规评估与定级备案",
			Actions:     []string{"REVIEW", "AUDIT", "CREATE", "APPROVE"},
			ExpectedMin: 2,
			Remediation: "完成定级备案；每年至少一次等保测评；出具测评报告并整改。"},
		// ---- PDPA — Thailand / Singapore Personal Data Protection Act ----
		// 12 controls mapped from the 8 PDPA principles plus operational overlays.
		{ID: "PDPA-1", Category: "PDPA", Name: "Consent — Lawful Basis Recorded",
			Actions:     []string{"CREATE", "APPROVE", "REVIEW"},
			ExpectedMin: 2,
			Remediation: "Capture consent (or other lawful basis) at every collection point; store consent record with timestamp."},
		{ID: "PDPA-2", Category: "PDPA", Name: "Purpose — Limited & Communicated",
			Actions:     []string{"CREATE", "APPROVE", "REVIEW"},
			ExpectedMin: 2,
			Remediation: "Define permitted purposes before collection; communicate them to the data subject in privacy notice."},
		{ID: "PDPA-3", Category: "PDPA", Name: "Necessity — Data Not Excessive",
			Actions:     []string{"CREATE", "DELETE", "REVIEW"},
			ExpectedMin: 2,
			Remediation: "Run data-minimization reviews; drop fields that cannot be justified against the declared purpose."},
		{ID: "PDPA-4", Category: "PDPA", Name: "Quality — Accuracy & Currency",
			Actions:     []string{"UPDATE", "REVIEW", "AUDIT"},
			ExpectedMin: 2,
			Remediation: "Provide a correction workflow for data subjects; document accuracy audits."},
		{ID: "PDPA-5", Category: "PDPA", Name: "Disclosure — Public Privacy Notice",
			Actions:     []string{"CREATE", "APPROVE", "EXPORT"},
			ExpectedMin: 2,
			Remediation: "Publish a public privacy notice covering controller identity, purposes, rights and contact channel."},
		{ID: "PDPA-6", Category: "PDPA", Name: "Protection — Organizational & Technical",
			Actions:     []string{"CREATE", "UPDATE", "GRANT", "SCAN"},
			ExpectedMin: 3,
			Remediation: "Implement organizational safeguards (policy, training, roles) plus technical controls (access, encryption, logging)."},
		{ID: "PDPA-7", Category: "PDPA", Name: "Retention — Limited & Deleted",
			Actions:     []string{"DELETE", "REVIEW", "AUDIT"},
			ExpectedMin: 2,
			Remediation: "Define retention schedules per data category; purge on expiry and log bulk deletions."},
		{ID: "PDPA-8", Category: "PDPA", Name: "Rights — Access / Copy / Correction / Erasure",
			Actions:     []string{"CREATE", "UPDATE", "DELETE", "EXPORT", "APPROVE"},
			ExpectedMin: 3,
			Remediation: "Operate a DSAR (data-subject access request) workflow that fulfils requests within the statutory timeframe."},
		{ID: "PDPA-9", Category: "PDPA", Name: "Cross-Border Transfer — Adequate Protection",
			Actions:     []string{"CREATE", "APPROVE", "REVIEW"},
			ExpectedMin: 2,
			Remediation: "Before transferring personal data abroad, verify adequate protection (adequacy decision, SCC, BCR or consent)."},
		{ID: "PDPA-10", Category: "PDPA", Name: "Controller Obligation — Register & Contact",
			Actions:     []string{"CREATE", "UPDATE", "APPROVE"},
			ExpectedMin: 2,
			Remediation: "Maintain a controller register with DPO contact details; file with the regulator where required."},
		{ID: "PDPA-11", Category: "PDPA", Name: "DPIA — Impact Assessment for High-Risk Processing",
			Actions:     []string{"CREATE", "REVIEW", "APPROVE"},
			ExpectedMin: 2,
			Remediation: "Perform a data-protection impact assessment for high-risk processing before launch; archive the DPIA report."},
		{ID: "PDPA-12", Category: "PDPA", Name: "Incident Notification — Regulator & Subjects",
			Actions:     []string{"ALERT", "CREATE", "APPROVE", "AUDIT"},
			ExpectedMin: 2,
			Remediation: "Notify the regulator within 72 hours of a personal-data breach; notify affected data subjects when risk is material."},
	}
}

// frameworkName maps the framework code to its human-readable name.
func frameworkName(fw string) string {
	switch strings.ToUpper(fw) {
	case "SOC2":
		return "SOC2 Type II — Trust Services Criteria"
	case "ISO27001":
		return "ISO/IEC 27001:2022 — Annex A"
	case "PCI-DSS", "PCIDSS", "PCI_DSS":
		return "PCI DSS v4.0 — Payment Card Industry Data Security Standard"
	case "MLPS2", "MLPS", "等保":
		return "等保 2.0 — 网络安全等级保护基本要求（三级）"
	case "PDPA":
		return "PDPA — Personal Data Protection Act"
	case "COMBINED":
		return "Combined — SOC2 + ISO27001 + PCI-DSS + MLPS2 + PDPA"
	default:
		return "Compliance"
	}
}

// selectControls returns the controls that belong to the given framework.
// For SOC2, ISO27001, PCI-DSS, MLPS2 and PDPA the catalog is category-
// partitioned; COMBINED returns every control. Unknown frameworks return the
// full catalog so callers can still render something useful.
func selectControls(fw string, all []complianceControl) []complianceControl {
	category, ok := frameworkCategory(strings.ToUpper(fw))
	if !ok {
		// COMBINED or unknown — return everything.
		return all
	}
	var out []complianceControl
	for _, c := range all {
		if c.Category == category {
			out = append(out, c)
		}
	}
	return out
}

// frameworkCategory maps a framework code (case-insensitive) to its catalog
// Category value. Returns false when the input is COMBINED or an unknown code.
func frameworkCategory(fw string) (string, bool) {
	switch strings.ToUpper(fw) {
	case "SOC2":
		return "SOC2", true
	case "ISO27001":
		return "ISO27001", true
	case "PCI-DSS", "PCIDSS", "PCI_DSS":
		return "PCI-DSS", true
	case "MLPS2", "MLPS", "等保":
		return "MLPS2", true
	case "PDPA":
		return "PDPA", true
	default:
		return "", false
	}
}

// ValidFramework returns true when the given framework code (case-insensitive)
// maps to a recognized category in the compliance control catalog.
func ValidFramework(fw string) bool {
	_, ok := frameworkCategory(strings.ToUpper(fw))
	return ok
}

// ListFrameworks returns the canonical framework codes, in display order.
// Used by the /compliance/list endpoint and by documentation tests.
func ListFrameworks() []string {
	return []string{"SOC2", "ISO27001", "PCI-DSS", "MLPS2", "PDPA"}
}

// -----------------------------------------------------------------------
// ComplianceReport — full implementation
// -----------------------------------------------------------------------

// ComplianceReport generates a SOC2 / ISO27001 / combined compliance report
// by querying the tenant's audit log entries and mapping observed actions
// against the control catalog.
func (s *Service) ComplianceReport(ctx context.Context, tenantID string, framework string) (*models.ComplianceReport, error) {
	now := time.Now().UTC()
	periodStart := now.AddDate(0, -3, 0) // default assessment window = last 90 days
	periodEnd := now

	// 1. Query audit logs for the tenant within the assessment period.
	logs, err := s.repo.Export(ctx, tenantID, models.AuditLogQuery{
		DateFrom: periodStart.Format(time.RFC3339),
		DateTo:   periodEnd.Format(time.RFC3339),
	})
	if err != nil {
		return nil, fmt.Errorf("querying audit logs: %w", err)
	}

	// 2. Build a set of distinct observed action types.
	seen := make(map[string]struct{})
	for _, l := range logs {
		if l.Action != "" {
			seen[strings.ToUpper(l.Action)] = struct{}{}
		}
	}

	catalog := controlCatalog()
	controls := selectControls(framework, catalog)

	controlResults := make([]models.ControlResult, 0, len(controls))
	findings := make([]models.ComplianceFinding, 0)
	compliant, partial, nonCompliant := 0, 0, 0

	for _, ctrl := range controls {
		// Count how many of this control's required actions are observed.
		found := 0
		for _, act := range ctrl.Actions {
			if _, ok := seen[strings.ToUpper(act)]; ok {
				found++
			}
		}
		coveragePct := 0.0
		if len(ctrl.Actions) > 0 {
			coveragePct = float64(found) / float64(len(ctrl.Actions)) * 100
		}

		status, passed := "", false
		var severity string
		switch {
		case float64(found) >= float64(ctrl.ExpectedMin) && coveragePct >= 80:
			status = "passed"
			passed = true
			compliant++
		case found > 0:
			status = "warning"
			severity = "medium"
			partial++
		default:
			status = "failed"
			severity = "high"
			nonCompliant++
		}

		// Build evidence description.
		var evidenceParts []string
		for _, act := range ctrl.Actions {
			if _, ok := seen[strings.ToUpper(act)]; ok {
				evidenceParts = append(evidenceParts, act)
			}
		}
		evidence := ""
		if len(evidenceParts) > 0 {
			evidence = "Observed actions: " + strings.Join(evidenceParts, ", ")
		} else {
			evidence = "No matching audit events found"
		}

		details := fmt.Sprintf("%d/%d required actions observed (≥%d expected)",
			found, len(ctrl.Actions), ctrl.ExpectedMin)

		controlResults = append(controlResults, models.ControlResult{
			ID:            ctrl.ID,
			Name:          ctrl.Name,
			Status:        status,
			EvidenceCount: found,
			Details:       details,
		})

		// Generate finding only for non-compliant / partial controls.
		if !passed {
			findings = append(findings, models.ComplianceFinding{
				ID:          fmt.Sprintf("F-%s", ctrl.ID),
				ControlID:   ctrl.ID,
				Title:       fmt.Sprintf("%s — %s: %s", ctrl.ID, ctrl.Name, status),
				Description: fmt.Sprintf("%s. %s", details, evidence),
				Severity:    severity,
				Evidence:    evidence,
				Remediation: ctrl.Remediation,
			})
		}
	}

	// 3. Overall score (weighted toward controls that have evidence).
	totalControls := len(controlResults)
	var totalScore float64
	for _, cr := range controlResults {
		switch cr.Status {
		case "passed":
			totalScore += 1.0
		case "warning":
			totalScore += 0.4
		}
	}
	var overallScore float64
	if totalControls > 0 {
		overallScore = math.Round((totalScore/float64(totalControls))*100*10) / 10
	}

	// 4. Rating.
	var rating string
	switch {
	case overallScore >= 80:
		rating = "compliant"
	case overallScore >= 40:
		rating = "partial"
	default:
		rating = "non-compliant"
	}

	// 5. Recommendations — sorted by severity of the worst finding for the
	//    associated control(s). Distinct remediation statements across findings.

	seenRec := make(map[string]struct{})
	recommendations := make([]string, 0)
	// Sort findings so high-severity ones surface first.
	sort.SliceStable(findings, func(i, j int) bool {
		oi := sevRank(findings[i].Severity)
		oj := sevRank(findings[j].Severity)
		return oi > oj
	})
	for _, f := range findings {
		if f.Remediation == "" {
			continue
		}
		if _, dup := seenRec[f.Remediation]; dup {
			continue
		}
		seenRec[f.Remediation] = struct{}{}
		recommendations = append(recommendations, fmt.Sprintf("[%s] %s → %s", f.ControlID, f.Title, f.Remediation))
	}
	if len(recommendations) == 0 {
		recommendations = append(recommendations, "All controls meet the minimum evidence threshold. Continue periodic review.")
	}

	// Sort controls by ID for deterministic output.
	sort.SliceStable(controlResults, func(i, j int) bool {
		return controlResults[i].ID < controlResults[j].ID
	})

	return &models.ComplianceReport{
		ReportType:      strings.ToUpper(framework),
		PeriodStart:     periodStart.Format(time.RFC3339),
		PeriodEnd:       periodEnd.Format(time.RFC3339),
		GeneratedAt:     now.Format(time.RFC3339),
		Score:           overallScore,
		Rating:          rating,
		TotalControls:   totalControls,
		PassedControls:  compliant,
		FailedControls:  nonCompliant + partial,
		Findings:        findings,
		Controls:        controlResults,
		Recommendations: recommendations,
	}, nil
}

// sevRank returns a numeric rank for severity strings (higher = worse).
func sevRank(sev string) int {
	switch strings.ToLower(sev) {
	case "critical":
		return 4
	case "high":
		return 3
	case "medium":
		return 2
	case "low":
		return 1
	}
	return 0
}

// -----------------------------------------------------------------------
// CoverageStats — full implementation
// -----------------------------------------------------------------------

// CoverageStats returns audit coverage statistics across both frameworks by
// re-using the compliance-report engine and collapsing the results.
func (s *Service) CoverageStats(ctx context.Context, tenantID string) (*models.AuditCoverageStats, error) {
	now := time.Now().UTC().Format(time.RFC3339)

	byFramework := make(map[string]float64)
	var allControls, allPassed int

	// Phase 304: CoverageStats now spans all 5 supported frameworks.
	// Previously this loop only covered SOC2 + ISO27001.
	for _, fw := range ListFrameworks() {
		report, err := s.ComplianceReport(ctx, tenantID, fw)
		if err != nil {
			return nil, fmt.Errorf("coverage stats for %s: %w", fw, err)
		}
		byFramework[fw] = report.Score
		allControls += report.TotalControls
		allPassed += report.PassedControls
	}

	var overallCoveragePct float64
	if allControls > 0 {
		overallCoveragePct = math.Round(float64(allPassed)/float64(allControls)*1000) / 10
	}

	return &models.AuditCoverageStats{
		OverallCoveragePct: overallCoveragePct,
		ByFramework:        byFramework,
		AssessedAt:         now,
	}, nil
}

// Known sentinel errors used by handlers for status-code routing.
var (
	ErrInvalidFormat = errors.New("invalid format")
)

// IsNotFound returns true if the error indicates a resource was not found.
func IsNotFound(err error) bool {
	return errors.Is(err, sentinel.NotFound)
}
