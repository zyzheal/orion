package service

//go:generate mockgen -destination=mock_service.go -package=service . ServiceInterface
//go:generate mockgen -destination=mock_repository.go -package=service . RepositoryInterface

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"strings"
	"time"

	"orion/platform-svc-go/internal/alert/models"

	"github.com/google/uuid"
	"github.com/jmoiron/sqlx"
)

// RepositoryInterface defines the repository methods used by the service.
type RepositoryInterface interface {
	AddKnownIssue(ctx context.Context, ki *models.KnownIssue) error
	AddMaintenanceWindow(ctx context.Context, mw *models.MaintenanceWindow) error
	CreateAlert(ctx context.Context, a *models.Alert) error
	DeleteAlert(ctx context.Context, tenantID, id string) error
	ExpireMaintenanceWindows(ctx context.Context, tenantID string) error
	GetActiveGroups(ctx context.Context, tenantID string) ([]models.AlertGroup, error)
	GetActiveMaintenanceWindows(ctx context.Context, tenantID string) ([]models.MaintenanceWindow, error)
	GetAlertByID(ctx context.Context, tenantID, id string) (*models.Alert, error)
	GetKnownIssueByPattern(ctx context.Context, tenantID, pattern string) (*models.KnownIssue, error)
	GetOpenKnownIssues(ctx context.Context, tenantID string) ([]models.KnownIssue, error)
	GetStats(ctx context.Context, tenantID string) (*models.DedupStats, error)
	GetSuppressionStats(ctx context.Context, tenantID string) (*models.SuppressionStats, error)
	GetTopology(ctx context.Context, tenantID string) (*models.Topology, error)
	ListAlerts(ctx context.Context, tenantID string, severity, status string, limit int) ([]models.Alert, int, error)
	SetTopology(ctx context.Context, tenantID string, nodes, edges any) (*models.Topology, error)
	UpdateAlert(ctx context.Context, a *models.Alert) error
	UpdateNodeHealth(ctx context.Context, tenantID string, node models.NodeHealth) error
}

type Service struct {
	repo RepositoryInterface
	db   *sqlx.DB
}

func NewService(repo RepositoryInterface, db *sqlx.DB) *Service {
	return &Service{repo: repo, db: db}
}

// Ingest processes an incoming alert: generates fingerprint, checks suppression, deduplicates.
func (s *Service) Ingest(ctx context.Context, tenantID string, req models.IngestRequest) (*models.IngestResponse, error) {
	// Ensure tenant ID
	if req.TenantID != "" {
		tenantID = req.TenantID
	}
	severity := req.Severity
	if severity == "" {
		severity = "warning"
	}
	status := "firing"

	// Build alert
	alert := &models.Alert{
		ID:         fmt.Sprintf("alert-%d", time.Now().UnixNano()),
		TenantID:   tenantID,
		Name:       req.Name,
		Severity:   severity,
		Status:     status,
		SourceType: req.SourceType,
		SourceID:   req.SourceID,
		SourceName: req.SourceName,
		Value:      req.Value,
		Threshold:  req.Threshold,
		Metric:     req.Metric,
	}
	// Serialize labels/annotations to JSON
	alert.Labels = req.Labels
	alert.Annotations = req.Annotations

	// Generate fingerprint
	alert.Fingerprint = s.generateFingerprint(alert)

	// Check suppression via maintenance windows
	suppressed, suppressionReason, err := s.checkSuppression(ctx, tenantID, alert)
	if err != nil {
		return nil, err
	}
	if suppressed {
		alert.Status = "suppressed"
		return &models.IngestResponse{
			Status: "suppressed",
			Reason: suppressionReason,
			Alert:  *alert,
		}, nil
	}

	// Check for existing alert with same fingerprint (deduplication)
	existing, _ := s.repo.GetActiveGroups(ctx, tenantID)
	var isDuplicate bool
	var existingGroupID string
	for _, g := range existing {
		if g.Fingerprint == alert.Fingerprint {
			isDuplicate = true
			existingGroupID = g.GroupID
			break
		}
	}

	if isDuplicate {
		alert.GroupID = existingGroupID
		alert.IsDuplicate = true
		alert.Status = "firing"
	} else {
		alert.GroupID = uuid.New().String()
	}

	if err := s.repo.CreateAlert(ctx, alert); err != nil {
		return nil, fmt.Errorf("failed to create alert: %w", err)
	}

	statusOut := "created"
	if isDuplicate {
		statusOut = "updated"
	}
	return &models.IngestResponse{
		Status:      statusOut,
		Alert:       *alert,
		IsDuplicate: isDuplicate,
	}, nil
}

// Correlate performs root cause analysis on a batch of alerts.
func (s *Service) Correlate(ctx context.Context, tenantID string, alerts []models.Alert) (*models.CorrelationAnalysis, error) {
	if len(alerts) == 0 {
		return nil, errors.New("alerts is required")
	}

	// Update node health for each alert
	for _, a := range alerts {
		health := "healthy"
		switch a.Severity {
		case "critical":
			health = "down"
		case "warning":
			health = "degraded"
		default:
			health = "healthy"
		}
		s.repo.UpdateNodeHealth(ctx, tenantID, models.NodeHealth{
			NodeID:     a.SourceID,
			NodeName:   a.SourceName,
			Health:     health,
			AlertCount: 1,
			LastUpdate: time.Now().UTC(),
		})
	}

	// Group alerts by common fingerprint pattern
	correlatedGroups := make([]models.CorrelatedGroup, 0)
	seen := make(map[string]bool)
	for _, a := range alerts {
		fp := a.Fingerprint
		if fp == "" {
			fp = s.generateFingerprint(&a)
		}
		if seen[fp] {
			continue
		}
		seen[fp] = true
		var ids []string
		for _, other := range alerts {
			otherFp := other.Fingerprint
			if otherFp == "" {
				otherFp = s.generateFingerprint(&other)
			}
			if fp == otherFp {
				ids = append(ids, other.ID)
			}
		}
		if len(ids) > 1 {
			correlatedGroups = append(correlatedGroups, models.CorrelatedGroup{
				GroupID:    uuid.New().String(),
				AlertIDs:   ids,
				CommonRoot: true,
				Similarity: 1.0,
			})
		}
	}

	// Root causes = alerts with highest severity
	var rootCauses []models.Alert
	for _, a := range alerts {
		if a.Severity == "critical" || a.Severity == "warning" {
			rootCauses = append(rootCauses, a)
		}
	}

	return &models.CorrelationAnalysis{
		RootCauses:       rootCauses,
		CorrelatedGroups: correlatedGroups,
		TopologyUpdate: models.TopologyUpdate{
			NodeCount: len(alerts),
		},
	}, nil
}

// GetTopology returns the current alert topology.
func (s *Service) GetTopology(ctx context.Context, tenantID string) (*models.Topology, error) {
	return s.repo.GetTopology(ctx, tenantID)
}

// SetTopology stores a new topology.
func (s *Service) SetTopology(ctx context.Context, tenantID string, req models.TopologyNodesRequest) (*models.TopologyUpdate, error) {
	// Count nodes
	var nodeCount, edgeCount int
	if n, ok := req.Nodes.([]interface{}); ok {
		nodeCount = len(n)
	}
	if e, ok := req.Edges.([]interface{}); ok {
		edgeCount = len(e)
	}
	t, err := s.repo.SetTopology(ctx, tenantID, req.Nodes, req.Edges)
	if err != nil {
		return nil, err
	}
	_ = t
	return &models.TopologyUpdate{NodeCount: nodeCount, EdgeCount: edgeCount}, nil
}

// GetDedupStats returns deduplication statistics.
func (s *Service) GetDedupStats(ctx context.Context, tenantID string) (*models.DedupStats, error) {
	return s.repo.GetStats(ctx, tenantID)
}

// GetActiveGroups returns active alert groups.
func (s *Service) GetActiveGroups(ctx context.Context, tenantID string) ([]models.AlertGroup, error) {
	return s.repo.GetActiveGroups(ctx, tenantID)
}

// GetSuppressionStats returns suppression statistics.
func (s *Service) GetSuppressionStats(ctx context.Context, tenantID string) (*models.SuppressionStats, error) {
	// First expire old windows
	s.repo.ExpireMaintenanceWindows(ctx, tenantID)
	return s.repo.GetSuppressionStats(ctx, tenantID)
}

// GetActiveMaintenanceWindows returns active maintenance windows.
func (s *Service) GetActiveMaintenanceWindows(ctx context.Context, tenantID string) ([]models.MaintenanceWindow, error) {
	return s.repo.GetActiveMaintenanceWindows(ctx, tenantID)
}

// AddMaintenanceWindow creates a new maintenance window.
func (s *Service) AddMaintenanceWindow(ctx context.Context, tenantID string, req models.AddMaintenanceWindowRequest) (*models.MaintenanceWindow, error) {
	startTime, err := time.Parse(time.RFC3339, req.StartTime)
	if err != nil {
		return nil, fmt.Errorf("invalid start time: %w", err)
	}
	endTime, err := time.Parse(time.RFC3339, req.EndTime)
	if err != nil {
		return nil, fmt.Errorf("invalid end time: %w", err)
	}
	if endTime.Before(startTime) {
		return nil, errors.New("end time must be after start time")
	}
	scopeJSON, _ := json.Marshal(req.Scope)
	mw := &models.MaintenanceWindow{
		ID:        uuid.New().String(),
		TenantID:  tenantID,
		Name:      req.Name,
		StartTime: startTime,
		EndTime:   endTime,
		Scope:     string(scopeJSON),
	}
	if err := s.repo.AddMaintenanceWindow(ctx, mw); err != nil {
		return nil, err
	}
	return mw, nil
}

// GetOpenKnownIssues returns open known issues.
func (s *Service) GetOpenKnownIssues(ctx context.Context, tenantID string) ([]models.KnownIssue, error) {
	return s.repo.GetOpenKnownIssues(ctx, tenantID)
}

// AddKnownIssue creates a new known issue.
func (s *Service) AddKnownIssue(ctx context.Context, tenantID string, req models.AddKnownIssueRequest) (*models.KnownIssue, error) {
	if req.Title == "" {
		return nil, errors.New("title is required")
	}
	labelSelectors, _ := json.Marshal(req.LabelSelectors)
	silenceDuration := req.SilenceDuration
	if silenceDuration <= 0 {
		silenceDuration = 3600000 // 1 hour default
	}
	ki := &models.KnownIssue{
		ID:                 uuid.New().String(),
		TenantID:           tenantID,
		Title:              req.Title,
		Description:        req.Description,
		FingerprintPattern: req.FingerprintPattern,
		LabelSelectors:     string(labelSelectors),
		SilenceDuration:    silenceDuration,
		Status:             "open",
	}
	if err := s.repo.AddKnownIssue(ctx, ki); err != nil {
		return nil, err
	}
	return ki, nil
}

// GetActiveAlerts returns all active alerts.
func (s *Service) GetActiveAlerts(ctx context.Context, tenantID string) ([]models.Alert, error) {
	groups, err := s.GetActiveGroups(ctx, tenantID)
	if err != nil {
		return nil, err
	}
	var allAlerts []models.Alert
	for _, g := range groups {
		allAlerts = append(allAlerts, g.Alerts...)
	}
	return allAlerts, nil
}

// ListAlerts returns a filtered list of alerts.
func (s *Service) ListAlerts(ctx context.Context, tenantID string, severity, status string, limit int) (*models.AlertListResponse, error) {
	if limit <= 0 {
		limit = 100
	}
	alerts, total, err := s.repo.ListAlerts(ctx, tenantID, severity, status, limit)
	if err != nil {
		return nil, err
	}
	return &models.AlertListResponse{
		Alerts: alerts,
		Total:  total,
	}, nil
}

// UpdateAlertRequest holds the updatable fields for PUT /alert/:id.
type UpdateAlertRequest struct {
	Severity    string            `json:"severity"`
	Status      string            `json:"status"`
	SourceName  string            `json:"sourceName"`
	Labels      map[string]string `json:"labels"`
	Annotations map[string]string `json:"annotations"`
	Value       float64           `json:"value"`
	Threshold   float64           `json:"threshold"`
}

// UpdateAlert applies partial updates to an existing alert.
func (s *Service) UpdateAlert(ctx context.Context, tenantID, id string, req UpdateAlertRequest) (*models.Alert, error) {
	alert, err := s.repo.GetAlertByID(ctx, tenantID, id)
	if err != nil {
		return nil, errors.New("alert not found")
	}
	if req.Severity != "" {
		alert.Severity = req.Severity
	}
	if req.Status != "" {
		alert.Status = req.Status
		if req.Status == "resolved" {
			now := time.Now().UTC()
			alert.ResolvedAt = &now
		}
	}
	if req.SourceName != "" {
		alert.SourceName = req.SourceName
	}
	if req.Labels != nil {
		alert.Labels = req.Labels
	}
	if req.Annotations != nil {
		alert.Annotations = req.Annotations
	}
	if req.Value != 0 {
		alert.Value = req.Value
	}
	if req.Threshold != 0 {
		alert.Threshold = req.Threshold
	}
	if err := s.repo.UpdateAlert(ctx, alert); err != nil {
		return nil, err
	}
	return alert, nil
}

// DeleteAlert removes an alert by ID.
func (s *Service) DeleteAlert(ctx context.Context, tenantID, id string) error {
	exists, err := s.repo.GetAlertByID(ctx, tenantID, id)
	if err != nil {
		return errors.New("alert not found")
	}
	_ = exists
	return s.repo.DeleteAlert(ctx, tenantID, id)
}

// GetAlert returns a single alert by ID.
func (s *Service) GetAlert(ctx context.Context, tenantID, id string) (*models.Alert, error) {
	alert, err := s.repo.GetAlertByID(ctx, tenantID, id)
	if err != nil {
		return nil, errors.New("alert not found")
	}
	return alert, nil
}

// ExplainAlert generates a natural-language explanation for an alert.
// It leverages the alert's own metadata plus context (known issues / groups)
// to produce evidence-backed text without calling an external LLM.
func (s *Service) ExplainAlert(ctx context.Context, tenantID, id string) (*models.AlertExplanation, error) {
	alert, err := s.repo.GetAlertByID(ctx, tenantID, id)
	if err != nil {
		return nil, errors.New("alert not found")
	}

	relation := "standalone"
	var evidence []string
	evidence = append(evidence, fmt.Sprintf("告警 %s %s(%s) 源 %s，严重级别 %s", alert.Name, alert.SourceName, alert.SourceType, alert.SourceID, alert.Severity))
	evidence = append(evidence, fmt.Sprintf("指标 %s 当前值 %.2f 阈值 %.2f，状态 %s", alert.Metric, alert.Value, alert.Threshold, alert.Status))

	// Detect relationship to groups (duplicate)
	if alert.GroupID != "" {
		now := time.Now().UTC()
		since := now.Sub(alert.CreatedAt).Round(time.Minute)
		relation = "duplicate"
		evidence = append(evidence, fmt.Sprintf("属于分组 %s（自 %s 起，约 %s），指纹 %s", alert.GroupID, alert.CreatedAt.Format("15:04:05"), since, truncate(alert.Fingerprint, 24)))
	}

	// Check known issue match
	var matchedIssue *models.KnownIssue
	if alert.Fingerprint != "" {
		if issue, err := s.repo.GetKnownIssueByPattern(ctx, tenantID, alert.Fingerprint); err == nil {
			matchedIssue = issue
			relation = "suppressed"
			evidence = append(evidence, fmt.Sprintf("命中已知问题：%s（%s）", issue.Title, issue.Description))
		}
	}

	// Determine likely cause from metric/source patterns
	cause, suggestions := inferCause(alert)

	if matchedIssue != nil {
		cause = fmt.Sprintf("已知问题触发：%s（%s）", matchedIssue.Title, matchedIssue.Description)
		suggestions = append(suggestions, models.FixSuggestion{Title: "查看已知问题详情", Description: matchedIssue.Description, Priority: 1})
	}

	return &models.AlertExplanation{
		AlertID:     alert.ID,
		Summary:     fmt.Sprintf("%s 触发严重级别 %s 的 %s 告警", alert.Name, alert.Severity, alert.Status),
		Severity:    alert.Severity,
		LikelyCause: cause,
		Relation:    relation,
		Evidence:    evidence,
		Suggestions: suggestions,
		GeneratedAt: time.Now().UTC(),
	}, nil
}

// inferCause produces a human-readable cause + fix suggestions based on alert shape.
func inferCause(a *models.Alert) (string, []models.FixSuggestion) {
	metric := strings.ToLower(a.Metric)
	name := strings.ToLower(a.Name)
	var cause string
	var suggestions []models.FixSuggestion

	switch {
	case strings.Contains(metric, "cpu"):
		cause = "资源类：实例 CPU 使用率超出阈值，可能存在流量突增或实例过载"
		suggestions = []models.FixSuggestion{
			{Title: "检查实例负载与扩容", Description: "查看 CPU 曲线并考虑水平扩容", Priority: 1},
			{Title: "定位热门调用方", Description: "结合 trace 识别高并发入口", Priority: 2},
		}
	case strings.Contains(metric, "mem") || strings.Contains(metric, "memory"):
		cause = "资源类：内存水位过高，可能存在内存泄漏或大对象堆积"
		suggestions = []models.FixSuggestion{
			{Title: "检查堆/内存曲线", Description: "确认是否存在持续增长趋势", Priority: 1},
			{Title: "触发告警的业务请求抽样", Description: "分析 GC 与大对象分配", Priority: 2},
		}
	case strings.Contains(metric, "latency") || strings.Contains(metric, "p99") || strings.Contains(name, "latency"):
		cause = "性能类：链路延迟升高，可能存在慢查询、依赖超时或排队"
		suggestions = []models.FixSuggestion{
			{Title: "分析耗时分布", Description: "定位 P99/P95 突增的服务与接口", Priority: 1},
			{Title: "检查下游依赖", Description: "确认 DB/缓存/外部服务是否存在超时", Priority: 2},
		}
	case strings.Contains(metric, "error") || strings.Contains(metric, "fail") || strings.Contains(metric, "5xx"):
		cause = "可用性类：错误率升高，可能存在发布异常、配置变更或依赖故障"
		suggestions = []models.FixSuggestion{
			{Title: "检查最近发布与变更", Description: "排查是否伴随新版本上线", Priority: 1},
			{Title: "查看错误堆栈聚合", Description: "按错误类型分组定位根因", Priority: 2},
		}
	default:
		if a.Severity == "critical" {
			cause = "高严重级别告警：建议立即排查对应服务的健康状态与依赖链路"
		} else {
			cause = "常规告警：建议结合指标趋势与运行日志判断是否需要介入"
		}
		suggestions = []models.FixSuggestion{
			{Title: "查看服务运行状态", Description: "确认健康检查与实例状态", Priority: 1},
		}
	}
	return cause, suggestions
}

// truncate shortens a fingerprint-like string for readability.
func truncate(s string, n int) string {
	if len(s) <= n {
		return s
	}
	return s[:n] + "..."
}

// checkSuppression checks if an alert should be suppressed.
func (s *Service) checkSuppression(ctx context.Context, tenantID string, alert *models.Alert) (bool, string, error) {
	// Check maintenance windows
	windows, err := s.repo.GetActiveMaintenanceWindows(ctx, tenantID)
	if err != nil {
		return false, "", err
	}
	for _, w := range windows {
		scope := w.Scope.(string)
		// Check if alert source matches window scope
		if strings.Contains(scope, alert.SourceID) || strings.Contains(scope, alert.SourceName) {
			return true, fmt.Sprintf("suppressed by maintenance window: %s", w.Name), nil
		}
	}

	// Check known issues
	if alert.Fingerprint != "" {
		issue, err := s.repo.GetKnownIssueByPattern(ctx, tenantID, alert.Fingerprint)
		if err == nil {
			return true, fmt.Sprintf("suppressed by known issue: %s", issue.Title), nil
		}
	}
	return false, "", nil
}

// generateFingerprint creates a hash fingerprint from alert attributes.
func (s *Service) generateFingerprint(a *models.Alert) string {
	data := strings.Join([]string{
		a.Name, a.Severity, a.SourceType, a.SourceID,
	}, "|")
	hash := sha256.Sum256([]byte(data))
	return "fp-" + hex.EncodeToString(hash[:16])
}
