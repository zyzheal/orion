package service

import (
	"context"
	"errors"
	"regexp"
	"strings"
	"time"

	"orion/platform-svc-go/internal/pipeline-error-detail/models"
	"orion/platform-svc-go/internal/pipeline-error-detail/repository"
)

// RepositoryInterface defines the repository methods used by the service.
type RepositoryInterface interface {
	GetRunDetail(ctx context.Context, runID string) (*repository.RunDetail, error)
}

var (
	ErrInvalidRun  = errors.New("runId is required")
	ErrNotFailed   = errors.New("error detail is only available for failed or cancelled runs")
	ErrRunNotFound = errors.New("pipeline run not found")
)

// Repository defines the data access contract needed by Service.
type Repository interface {
	GetRunDetail(ctx context.Context, runID string) (*repository.RunDetail, error)
}

type Service struct {
	repo Repository
}

func NewService(repo Repository) *Service {
	return &Service{repo: repo}
}

// --- ErrorType mapping: classifier type -> frontend category ---

type errorMapping struct {
	category ErrorCategoryName
	severity ErrorSeverityName
	message  string
	fix      []string
}

type ErrorCategoryName string
type ErrorSeverityName string

// errorTypeMap maps classifier types to frontend categories (fallback mapping).
var errorTypeMap = map[string]errorMapping{
	"permanent": {
		category: ErrorCategoryName(models.CategoryCompilationError),
		severity: ErrorSeverityName(models.SeverityCritical),
		message:  "代码编译或测试失败，请检查代码语法和测试用例",
		fix:      []string{"查看原始日志中的具体编译/测试错误信息", "修复代码中的语法错误或逻辑问题", "本地运行相同命令验证修复效果", "提交修复后重新运行 Pipeline"},
	},
	"transient": {
		severity: ErrorSeverityName(models.SeverityWarning),
		category: ErrorCategoryName(models.CategoryInfrastructure),
		message:  "基础设施临时错误，可能是网络或资源问题",
		fix:      []string{"检查 Runner/K8s 集群运行状态", "确认目标环境资源充足（CPU/内存/磁盘）", "等待几分钟后点击重试", "如果持续失败，联系运维团队排查"},
	},
	"config": {
		category: ErrorCategoryName(models.CategoryConfig),
		severity: ErrorSeverityName(models.SeverityCritical),
		message:  "配置错误，请检查 Pipeline 配置和环境变量",
		fix:      []string{"检查 Pipeline YAML 配置语法是否正确", "确认所有必填环境变量已设置", "验证参数格式和值是否合法", "修正配置后重新运行 Pipeline"},
	},
	"flaky": {
		severity: ErrorSeverityName(models.SeverityInfo),
		category: ErrorCategoryName(models.CategoryUnknown),
		message:  "检测到间歇性失败，可能是测试不稳定导致",
		fix:      []string{"先尝试重新运行一次确认是否为偶发问题", "如果频繁出现，检查测试用例是否存在竞态条件", "考虑为不稳定测试添加重试逻辑", "收集多次运行的日志进行对比分析"},
	},
}

// --- Specific pattern rules (applied first for accurate categorization) ---

type patternRule struct {
	re       *regexp.Regexp
	category models.ErrorCategory
	severity models.ErrorSeverity
	message  string
	fix      []string
}

var specificPatterns = []patternRule{
	{
		re:       regexp.MustCompile(`(?i)syntax error|compilation failed|cannot find module|type error`),
		category: models.CategoryCompilationError,
		severity: models.SeverityCritical,
		message:  "代码编译失败，请检查语法错误",
		fix:      []string{"查看原始日志中的具体编译错误位置", "修复对应的语法或类型错误", "本地执行编译命令验证修复效果", "提交修复后重新运行 Pipeline"},
	},
	{
		re:       regexp.MustCompile(`(?i)test.*failed|assertion.*failed|expect.*received|FAIL.*tests?`),
		category: models.CategoryTestFailure,
		severity: models.SeverityCritical,
		message:  "测试未通过，请检查测试用例",
		fix:      []string{"查看原始日志中失败的测试用例名称", "定位失败原因（预期值 vs 实际值）", "修复代码或更新测试期望", "本地运行失败的测试验证修复"},
	},
	{
		re:       regexp.MustCompile(`(?i)deploy.*fail|rollout.*fail|kubernetes.*error|kubectl.*fail`),
		category: models.CategoryDeploymentFail,
		severity: models.SeverityCritical,
		message:  "部署失败，请检查目标环境状态",
		fix:      []string{"检查目标 K8s 集群和命名空间状态", "确认镜像是否存在且可拉取", "查看 Pod 事件日志排查部署失败原因", "修复配置或镜像问题后重新部署"},
	},
	{
		re:       regexp.MustCompile(`(?i)OOMKilled|out of memory|node.*not ready|pod.*evicted`),
		severity: models.SeverityCritical,
		category: models.CategoryInfrastructure,
		message:  "基础设施资源不足，请检查 Runner/K8s 状态",
		fix:      []string{"检查 K8s 节点资源使用情况", "确认 Pod 内存/CPU 限制是否合理", "必要时扩容节点或调整资源限制", "资源恢复后重新运行 Pipeline"},
	},
	{
		re:       regexp.MustCompile(`(?i)ETIMEDOUT|timeout|i/o timeout|deadline exceeded|timed out`),
		severity: models.SeverityWarning,
		category: models.CategoryTimeout,
		message:  "任务超时，请检查任务耗时或调整超时设置",
		fix:      []string{"确认哪个阶段耗时最长", "检查是否有依赖服务响应缓慢", "适当增加超时阈值或优化任务逻辑", "调整后重新运行 Pipeline"},
	},
	{
		re:       regexp.MustCompile(`(?i)env.*not (?:set|defined)|missing.*config|invalid configuration|ENOENT|no such file`),
		category: models.CategoryConfig,
		severity: models.SeverityCritical,
		message:  "配置错误，请检查 Pipeline 配置",
		fix:      []string{"确认缺失的环境变量或配置文件", "在 Pipeline 配置或 CI/CD 设置中补充缺失项", "验证配置值格式正确", "修复后重新运行 Pipeline"},
	},
}

// --- Error Collector: gather errors from stages and tasks ---

type collectedError struct {
	message   string
	stageName string
	timestamp string
}

func collectErrors(stages []repository.StageRecord, tasks []repository.TaskRecord) []collectedError {
	var errs []collectedError

	for _, s := range stages {
		if s.Error.Valid && s.Error.String != "" {
			errs = append(errs, collectedError{
				message:   s.Error.String,
				stageName: s.Name,
				timestamp: formatTime(s.CompletedAt, s.StartedAt),
			})
		}
	}

	for _, t := range tasks {
		if t.Error.Valid && t.Error.String != "" {
			errs = append(errs, collectedError{
				message:   t.Error.String,
				stageName: t.Name,
				timestamp: formatTime(t.CompletedAt, t.StartedAt),
			})
		}
	}

	// Sort by timestamp descending (most recent first) — using .After() not >=
	for i := 0; i < len(errs); i++ {
		for j := i + 1; j < len(errs); j++ {
			ti := parseTime(errs[i].timestamp)
			tj := parseTime(errs[j].timestamp)
			if tj.After(ti) {
				errs[i], errs[j] = errs[j], errs[i]
			}
		}
	}

	return errs
}

// --- Classifier ---

type classifierRule struct {
	pattern    *regexp.Regexp
	tp         string
	strategy   string
	confidence float64
}

func classifyError(message string) *models.ErrorClassification {
	var (
		bestConfidence float64
		bestType       string
		bestStrategy   string
		bestReasoning  string
		shouldRetry    bool
	)

	patterns := []classifierRule{
		{
			pattern:    regexp.MustCompile(`(?i)ETIMEDOUT|ECONNRESET|ECONNREFUSED|socket hang up|network error|timeout|connection (?:refused|reset|timed out)|temporary failure|i/o timeout|rate limit|429|throttl`),
			tp:         "transient",
			strategy:   "backoff",
			confidence: 0.9,
		},
		{
			pattern:    regexp.MustCompile(`(?i)OOMKilled|out of memory|insufficient resources|node.*not ready|pod.*evicted|container.*failed to start|image pull failed`),
			tp:         "transient",
			strategy:   "backoff",
			confidence: 0.85,
		},
		{
			pattern:    regexp.MustCompile(`(?i)syntax error|compilation failed|cannot find module|type error|undeclared identifier|missing.*argument`),
			tp:         "permanent",
			strategy:   "skip",
			confidence: 0.95,
		},
		{
			pattern:    regexp.MustCompile(`(?i)permission denied|access denied|unauthorized|forbidden|401|403|authentication failed`),
			tp:         "permanent",
			strategy:   "skip",
			confidence: 0.95,
		},
		{
			pattern:    regexp.MustCompile(`(?i)env.*not (?:set|defined)|missing.*config|invalid configuration|required.*parameter|malformed|ENOENT|no such file`),
			tp:         "config",
			strategy:   "skip",
			confidence: 0.9,
		},
	}

	for _, rule := range patterns {
		if rule.pattern.MatchString(message) {
			if rule.confidence > bestConfidence {
				bestConfidence = rule.confidence
				bestType = rule.tp
				bestStrategy = rule.strategy
				bestReasoning = "matched classifier pattern: " + rule.tp
			}
		}
	}

	if bestType == "" {
		bestType = "permanent"
		bestConfidence = 0.5
		bestStrategy = "skip"
		bestReasoning = "no classifier pattern matched, defaulting to permanent"
	}

	if bestType == "transient" {
		shouldRetry = true
	}

	return &models.ErrorClassification{
		Type:          bestType,
		ShouldRetry:   shouldRetry,
		RetryStrategy: bestStrategy,
		Confidence:    bestConfidence,
		Reasoning:     bestReasoning,
	}
}

// --- Frontend mapping ---

func mapToFrontendCategory(message string, classifierType string) (models.ErrorCategory, models.ErrorSeverity, string, []string) {
	// Try specific patterns first (most specific match wins)
	for _, p := range specificPatterns {
		if p.re.MatchString(message) {
			return p.category, p.severity, p.message, p.fix
		}
	}

	// Fall back to classifier type mapping
	fallback, ok := errorTypeMap[classifierType]
	if ok {
		return models.ErrorCategory(fallback.category), models.ErrorSeverity(fallback.severity), fallback.message, fallback.fix
	}

	// Ultimate fallback
	return models.CategoryUnknown, models.SeverityInfo,
		"Pipeline 运行失败，请查看原始日志排查问题",
		[]string{"查看原始日志获取详细错误信息", "根据日志内容排查并修复问题", "修复后重新运行 Pipeline"}
}

// --- Public API ---

// GetErrorDetail returns classified error info for a failed/cancelled pipeline run.
func (s *Service) GetErrorDetail(ctx context.Context, runID string) (*models.PipelineErrorDetail, error) {
	if runID == "" {
		return nil, ErrInvalidRun
	}

	detail, err := s.repo.GetRunDetail(ctx, runID)
	if err != nil {
		if errors.Is(err, repository.ErrRunNotFound) {
			return nil, ErrRunNotFound
		}
		return nil, err
	}

	// Only provide error detail for failed/cancelled runs
	status := strings.ToLower(detail.Run.Status)
	if status != "failed" && status != "cancelled" {
		return nil, ErrNotFailed
	}

	// Collect errors from stages and tasks
	errs := collectErrors(detail.Stages, detail.Tasks)

	if len(errs) == 0 {
		return &models.PipelineErrorDetail{
			ErrorType:            models.CategoryUnknown,
			Severity:             models.SeverityWarning,
			HumanReadableMessage: "Pipeline 运行失败但未捕获到具体错误信息",
			SuggestedFix:         []string{"查看原始日志以获取更多详细信息"},
			RawError:             "",
			StageName:            "unknown",
			Timestamp:            formatTime(detail.Run.CompletedAt, detail.Run.StartedAt),
		}, nil
	}

	primaryError := errs[0]
	errorMessage := primaryError.message
	if errorMessage == "" {
		errorMessage = "Unknown error"
	}

	classification := classifyError(errorMessage)
	category, severity, message, fix := mapToFrontendCategory(errorMessage, classification.Type)

	return &models.PipelineErrorDetail{
		ErrorType:            category,
		Severity:             severity,
		HumanReadableMessage: message,
		SuggestedFix:         fix,
		RawError:             errorMessage,
		StageName:            primaryError.stageName,
		Timestamp:            primaryError.timestamp,
		Classification:       classification,
	}, nil
}

// formatTime returns the ISO time string from completedAt or startedAt.
func formatTime(completedAt, startedAt *time.Time) string {
	if completedAt != nil && !completedAt.IsZero() {
		return completedAt.UTC().Format(time.RFC3339)
	}
	if startedAt != nil && !startedAt.IsZero() {
		return startedAt.UTC().Format(time.RFC3339)
	}
	return ""
}

// parseTime parses an RFC3339 timestamp (returns zero time if empty/invalid).
func parseTime(s string) time.Time {
	if s == "" {
		return time.Time{}
	}
	t, err := time.Parse(time.RFC3339, s)
	if err != nil {
		return time.Time{}
	}
	return t
}
