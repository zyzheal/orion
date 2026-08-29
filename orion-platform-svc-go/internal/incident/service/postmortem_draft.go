package service

import (
	"context"
	"fmt"
	"strings"
	"time"

	"orion/platform-svc-go/internal/incident/models"
)

// GeneratePostmortemDraft builds a structured post-mortem draft from an
// incident's metadata and its timeline. It is a deterministic, rule-based
// generator (no LLM required) that the user reviews before persisting.
func (s *Service) GeneratePostmortemDraft(ctx context.Context, tenantID, incidentID string) (*models.PostmortemDraft, error) {
	inc, err := s.repo.GetByID(ctx, tenantID, incidentID)
	if err != nil {
		return nil, err
	}

	timeline, err := s.repo.GetTimeline(ctx, tenantID, incidentID, models.TimelineQuery{})
	if err != nil {
		return nil, err
	}

	// 1. Title
	title := "Incident Postmortem"
	if inc.Title != "" {
		title = "Postmortem: " + inc.Title
	}
	if inc.Severity != "" {
		title += fmt.Sprintf(" [%s]", strings.ToUpper(inc.Severity))
	}

	// 2. Summary from incident description
	summary := inc.Description
	if summary == "" {
		summary = fmt.Sprintf("Incident %s (%s) resolved from state %s to %s.", inc.ID, inc.Type, inc.Impact, inc.Status)
	}

	// 3. Likely root cause from heuristic signals
	rootCause := inferIncidentRootCause(inc)

	// 4. Contributing factors
	factors := inferContributingFactors(inc)

	// 5. Timeline summary: compress events into readable lines
	timelineSummary := formatTimeline(timeline)
	if timelineSummary == "" {
		timelineSummary = fmt.Sprintf("Incident opened at %s, %s.", inc.CreatedAt.Format("2006-01-02 15:04"), statusVerb(inc.Status))
	}

	// 6. Action items derived from root cause + severities
	actionItems := buildActionItems(inc, rootCause, timeline)

	// 7. Lessons learned template
	lessons := "严格执行变更审批与回滚演练；出现高危告警后第一时间升级指挥官；复盘后一周内完成改进项闭环。"
	if inc.SlaBreach {
		lessons = "本次事件触发 SLA 违约，需专项评估响应链路耗时并制定改进措施。"
	}

	return &models.PostmortemDraft{
		IncidentID:     inc.ID,
		Title:          title,
		Summary:        summary,
		RootCause:      rootCause,
		Factors:        factors,
		Timeline:       timelineSummary,
		ActionItems:    actionItems,
		LessonsLearned: lessons,
		GeneratedAt:    time.Now().UTC(),
	}, nil
}

// inferIncidentRootCause uses metadata signals to propose a likely cause.
func inferIncidentRootCause(inc *models.Incident) string {
	var signals []string
	if inc.ErrorMessage != nil && *inc.ErrorMessage != "" {
		signals = append(signals, *inc.ErrorMessage)
	}
	if inc.Service != "" {
		signals = append(signals, inc.Service)
	}
	if inc.AffectedServices != "" {
		signals = append(signals, inc.AffectedServices)
	}
	text := strings.ToLower(strings.Join(signals, " "))

	switch {
	case strings.Contains(text, "timeout") || strings.Contains(text, "超时"):
		return "可能由下游依赖超时或请求排队导致，需结合链路追踪确认耗时热点。"
	case strings.Contains(text, "oom") || strings.Contains(text, "内存"):
		return "可能由内存泄漏或容量不足导致，建议检查实例内存曲线与 GC 日志。"
	case strings.Contains(text, "disk") || strings.Contains(text, "磁盘"):
		return "可能由磁盘空间耗尽导致，建议扩容或清理日志并配置自动告警。"
	case strings.Contains(text, "5xx") || strings.Contains(text, "50x") || strings.Contains(text, "backend"):
		return "可能由后端服务异常（5xx 上升）导致，建议查看错误率与发布窗口。"
	default:
		if inc.LinkedChangeID != nil && *inc.LinkedChangeID != "" {
			return "事件关联到变更 " + *inc.LinkedChangeID + "，建议将变更回滚/复盘纳入根因排查。"
		}
		return "根因待确认，建议结合告警收敛、链路追踪与变更记录综合定位。"
	}
}

func inferContributingFactors(inc *models.Incident) []string {
	var factors []string
	if inc.Priority != "" {
		factors = append(factors, "优先级评估："+inc.Priority)
	}
	if inc.EscalationLevel > 0 {
		factors = append(factors, fmt.Sprintf("升级层级：L%d", inc.EscalationLevel))
	}
	if inc.Environment != "" {
		factors = append(factors, "环境："+inc.Environment)
	}
	if len(factors) == 0 {
		factors = append(factors, "缺少可用的补充信息")
	}
	return factors
}

func formatTimeline(timeline []models.TimelineEvent) string {
	var b strings.Builder
	for _, ev := range timeline {
		b.WriteString(fmt.Sprintf("[%s] %s\n", ev.CreatedAt.Format("15:04"), ev.Content))
	}
	return strings.TrimSpace(b.String())
}

func buildActionItems(inc *models.Incident, rootCause string, timeline []models.TimelineEvent) []string {
	items := []string{
		"补充监控告警与对应的处理 runbook",
		fmt.Sprintf("跟进根因分析：%s", rootCause),
	}
	if inc.SlaBreach {
		items = append(items, "专项改善响应与恢复时间，避免再次触发 SLA 违约")
	}
	if len(timeline) == 0 {
		items = append(items, "完善事件时间线记录，确保关键动作可追溯")
	}
	return items
}

func statusVerb(status string) string {
	switch status {
	case "resolved", "closed":
		return "已解决"
	case "investigating", "in_progress":
		return "处理中"
	default:
		return "已创建"
	}
}
