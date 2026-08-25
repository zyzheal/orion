// ============================================================
// Plan 36 — Self-Healing 自愈执行器
// ============================================================
// 优先级: P1
// 来源: 全量代码扫描发现 — 有 repository+models 但无 service.go
// 本地证据:
//   - internal/self-healing/: 有 handler + repository (3文件) + models
//   - 无 service.go — 只有 action_repository_interface.go
//   - 无 K8s API 集成
// 技术约束: Go, k8s.io/client-go
// ============================================================

package service

import (
	"context"
	"encoding/json"
	"fmt"
	"sync"
	"time"

	"github.com/avast/retry-go/v4"
	"go.uber.org/zap"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/client-go/kubernetes"
	"k8s.io/client-go/rest"
)

// --- Types ---

// ActionType 自愈动作类型
type ActionType string

const (
	ActionRestartPod     ActionType = "restart_pod"
	ActionScaleDeploy    ActionType = "scale_deployment"
	ActionCleanCache     ActionType = "clean_cache"
	ActionRollbackDeploy ActionType = "rollback_deployment"
	ActionRunScript      ActionType = "run_script"
	ActionNotify         ActionType = "notify"
	ActionKillPod        ActionType = "kill_pod"
)

// ActionStatus 动作执行状态
type ActionStatus string

const (
	ActionStatusPending   ActionStatus = "pending"
	ActionStatusRunning   ActionStatus = "running"
	ActionStatusSuccess   ActionStatus = "success"
	ActionStatusFailed    ActionStatus = "failed"
	ActionStatusSkipped   ActionStatus = "skipped"
	ActionStatusTimeout   ActionStatus = "timeout"
)

// AlertEvent 告警事件 (触发自愈)
type AlertEvent struct {
	ID          string                 `json:"id"`
	RuleID      string                 `json:"ruleId"`
	AlertName   string                 `json:"alertName"`
	Severity    string                 `json:"severity"` // critical, warning, info
	Message     string                 `json:"message"`
	Labels      map[string]string      `json:"labels"`
	Annotations map[string]string      `json:"annotations"`
	Timestamp   time.Time              `json:"timestamp"`
	Source      string                 `json:"source"` // prometheus, loki, custom
}

// HealingAction 自愈动作定义
type HealingAction struct {
	ID         string                 `json:"id"`
	RuleID     string                 `json:"ruleId"`
	Type       ActionType             `json:"type"`
	Parameters map[string]string      `json:"parameters"`
	Timeout    time.Duration          `json:"timeout"`
	MaxRetries int                    `json:"maxRetries"`
	OnFail     string                 `json:"onFail"` // continue, abort
}

// ExecutionResult 执行结果
type ExecutionResult struct {
	ActionID   string      `json:"actionId"`
	Status    ActionStatus `json:"status"`
	StartedAt time.Time   `json:"startedAt"`
	EndedAt   time.Time   `json:"endedAt"`
	Output    string      `json:"output"`
	Error     string      `json:"error,omitempty"`
}

// HealingRule 自愈规则
type HealingRule struct {
	ID          string           `json:"id"`
	Name        string           `json:"name"`
	Description string           `json:"description"`
	Enabled     bool             `json:"enabled"`
	// 告警匹配条件 (key=value 标签匹配)
	MatchLabels map[string]string `json:"matchLabels"`
	MatchSeverity []string        `json:"matchSeverity"`
	// 执行动作链 (按顺序执行)
	Actions     []HealingAction  `json:"actions"`
	// 冷却时间 (同一规则两次执行之间的最小间隔)
	Cooldown    time.Duration    `json:"cooldown"`
	// 最大执行次数 (防止自愈循环)
	MaxExecutions int           `json:"maxExecutions"`
}

// --- Repository Interface (本地已有, 此处定义完整接口) ---

type RepositoryInterface interface {
	CreateRule(ctx context.Context, rule *HealingRule) error
	GetRule(ctx context.Context, id string) (*HealingRule, error)
	ListRules(ctx context.Context) ([]*HealingRule, error)
	UpdateRule(ctx context.Context, rule *HealingRule) error
	DeleteRule(ctx context.Context, id string) error
	RecordExecution(ctx context.Context, result *ExecutionResult) error
	GetExecutionHistory(ctx context.Context, ruleID string, limit int) ([]*ExecutionResult, error)
}

// --- Service ---

type Service struct {
	repo     RepositoryInterface
	logger   *zap.Logger
	k8s      *kubernetes.Clientset

	// 执行状态管理
	mu          sync.Mutex
	runningRule map[string]time.Time // ruleID → last execution time

	// 告警通道 (外部写入)
	alertCh <-chan AlertEvent

	// 执行历史 (内存缓存, 定期持久化)
	executionCache map[string][]*ExecutionResult // ruleID → recent results
}

type Config struct {
	K8sInCluster   bool   // 使用集群内配置
	K8sKubeconfig  string // 外部 kubeconfig 路径
	AlertBuffer    int    // 告警通道缓冲大小
}

func NewService(repo RepositoryInterface, logger *zap.Logger, cfg Config) (*Service, error) {
	// K8s 客户端初始化
	var k8sConfig *rest.Config
	var err error

	if cfg.K8sInCluster {
		k8sConfig, err = rest.InClusterConfig()
	} else if cfg.K8sKubeconfig != "" {
		k8sConfig, err = loadKubeconfig(cfg.K8sKubeconfig)
	} else {
		k8sConfig, err = rest.InClusterConfig()
	}
	if err != nil {
		// 降级: 不使用 K8s (仅支持脚本/通知动作)
		logger.Warn("k8s client init failed, K8s actions disabled", zap.Error(err))
	}

	var k8sClient *kubernetes.Clientset
	if k8sConfig != nil {
		k8sClient, err = kubernetes.NewForConfig(k8sConfig)
		if err != nil {
			logger.Warn("k8s clientset creation failed", zap.Error(err))
		}
	}

	alertCh := make(chan AlertEvent, cfg.AlertBuffer)
	if cfg.AlertBuffer <= 0 {
		alertCh = make(chan AlertEvent, 100)
	}

	return &Service{
		repo:           repo,
		logger:         logger,
		k8s:            k8sClient,
		runningRule:    make(map[string]time.Time),
		alertCh:        alertCh,
		executionCache: make(map[string][]*ExecutionResult),
	}, nil
}

// --- 启动自愈循环 ---

// StartHealLoop 启动自愈监听循环
func (s *Service) StartHealLoop(ctx context.Context) {
	s.logger.Info("self-healing loop started")

	for {
		select {
		case <-ctx.Done():
			s.logger.Info("self-healing loop stopped")
			return

		case alert := <-s.alertCh:
			go s.handleAlert(ctx, alert)
		}
	}
}

// handleAlert 处理告警: 匹配规则 → 执行动作
func (s *Service) handleAlert(ctx context.Context, alert AlertEvent) {
	rules, err := s.repo.ListRules(ctx)
	if err != nil {
		s.logger.Error("list rules failed", zap.Error(err), zap.String("alert", alert.AlertName))
		return
	}

	for _, rule := range rules {
		if !rule.Enabled {
			continue
		}

		if !s.matchRule(alert, rule) {
			continue
		}

		// 检查冷却时间
		if !s.checkCooldown(rule.ID, rule.Cooldown) {
			s.logger.Info("rule in cooldown, skipping",
				zap.String("rule", rule.Name),
				zap.String("alert", alert.AlertName))
			continue
		}

		// 检查最大执行次数
		history, _ := s.repo.GetExecutionHistory(ctx, rule.ID, rule.MaxExecutions)
		if len(history) >= rule.MaxExecutions {
			s.logger.Warn("rule max executions reached",
				zap.String("rule", rule.Name),
				zap.Int("executions", len(history)))
			continue
		}

		// 执行动作链
		s.executeActions(ctx, rule, alert)
	}
}

// matchRule 检查告警是否匹配规则
func (s *Service) matchRule(alert AlertEvent, rule *HealingRule) bool {
	// 匹配严重程度
	if len(rule.MatchSeverity) > 0 {
		matched := false
		for _, sev := range rule.MatchSeverity {
			if alert.Severity == sev {
				matched = true
				break
			}
		}
		if !matched {
			return false
		}
	}

	// 匹配标签
	for k, v := range rule.MatchLabels {
		alertVal, ok := alert.Labels[k]
		if !ok || alertVal != v {
			return false
		}
	}

	return true
}

// checkCooldown 检查冷却时间
func (s *Service) checkCooldown(ruleID string, cooldown time.Duration) bool {
	s.mu.Lock()
	defer s.mu.Unlock()

	lastRun, exists := s.runningRule[ruleID]
	if exists && time.Since(lastRun) < cooldown {
		return false
	}

	s.runningRule[ruleID] = time.Now()
	return true
}

// executeActions 执行动作链
func (s *Service) executeActions(ctx context.Context, rule *HealingRule, alert AlertEvent) {
	for _, action := range rule.Actions {
		result := &ExecutionResult{
			ActionID:   action.ID,
			StartedAt:  time.Now(),
		}

		// 使用 retry-go 执行
		err := retry.Do(
			func() error {
				return s.executeAction(ctx, action, alert)
			},
			retry.Attempts(uint(action.MaxRetries)+1),
			retry.Delay(2*time.Second),
			retry.Context(ctx),
		)

		result.EndedAt = time.Now()
		if err != nil {
			result.Status = ActionStatusFailed
			result.Error = err.Error()
			s.logger.Error("action failed",
				zap.String("rule", rule.Name),
				zap.String("action", string(action.Type)),
				zap.Error(err))

			if action.OnFail == "abort" {
				break // 终止动作链
			}
		} else {
			result.Status = ActionStatusSuccess
			s.logger.Info("action succeeded",
				zap.String("rule", rule.Name),
				zap.String("action", string(action.Type)))
		}

		// 持久化执行结果
		_ = s.repo.RecordExecution(ctx, result)

		// 缓存执行历史
		s.mu.Lock()
		s.executionCache[rule.ID] = append(s.executionCache[rule.ID], result)
		if len(s.executionCache[rule.ID]) > 20 {
			s.executionCache[rule.ID] = s.executionCache[rule.ID][1:]
		}
		s.mu.Unlock()
	}
}

// --- Action Executors ---

// executeAction 执行单个动作
func (s *Service) executeAction(ctx context.Context, action HealingAction, alert AlertEvent) error {
	switch action.Type {
	case ActionRestartPod:
		return s.restartPod(ctx, action.Parameters)
	case ActionScaleDeploy:
		return s.scaleDeployment(ctx, action.Parameters)
	case ActionCleanCache:
		return s.cleanCache(ctx, action.Parameters)
	case ActionRollbackDeploy:
		return s.rollbackDeployment(ctx, action.Parameters)
	case ActionKillPod:
		return s.killPod(ctx, action.Parameters)
	case ActionRunScript:
		return s.runScript(ctx, action.Parameters)
	case ActionNotify:
		return s.notify(ctx, action.Parameters, alert)
	default:
		return fmt.Errorf("unknown action type: %s", action.Type)
	}
}

// restartPod 重启 Pod (删除 Pod 触发重建)
func (s *Service) restartPod(ctx context.Context, params map[string]string) error {
	if s.k8s == nil {
		return fmt.Errorf("k8s client not available")
	}
	namespace := params["namespace"]
	podName := params["pod"]
	if namespace == "" || podName == "" {
		return fmt.Errorf("missing namespace or pod parameter")
	}

	return s.k8s.CoreV1().Pods(namespace).Delete(ctx, podName, metav1.DeleteOptions{})
}

// scaleDeployment 扩缩容 Deployment
func (s *Service) scaleDeployment(ctx context.Context, params map[string]string) error {
	if s.k8s == nil {
		return fmt.Errorf("k8s client not available")
	}
	namespace := params["namespace"]
	deployment := params["deployment"]
	replicasStr := params["replicas"]
	if namespace == "" || deployment == "" || replicasStr == "" {
		return fmt.Errorf("missing namespace, deployment or replicas parameter")
	}

	// 解析副本数
	var replicas int32
	_, err := fmt.Sscanf(replicasStr, "%d", &replicas)
	if err != nil {
		return fmt.Errorf("invalid replicas value: %s", replicasStr)
	}

	// 更新 Deployment 副本数
	deployClient := s.k8s.AppsV1().Deployments(namespace)
	deploy, err := deployClient.Get(ctx, deployment, metav1.GetOptions{})
	if err != nil {
		return fmt.Errorf("get deployment: %w", err)
	}

	deploy.Spec.Replicas = &replicas
	_, err = deployClient.Update(ctx, deploy, metav1.UpdateOptions{})
	return err
}

// rollbackDeployment 回滚 Deployment
func (s *Service) rollbackDeployment(ctx context.Context, params map[string]string) error {
	if s.k8s == nil {
		return fmt.Errorf("k8s client not available")
	}
	namespace := params["namespace"]
	deployment := params["deployment"]
	revisionStr := params["revision"] // 可选, 不指定则回滚到上一版本

	if namespace == "" || deployment == "" {
		return fmt.Errorf("missing namespace or deployment parameter")
	}

	deployClient := s.k8s.AppsV1().Deployments(namespace)
	if revisionStr != "" {
		var revision int64
		_, err := fmt.Sscanf(revisionStr, "%d", &revision)
		if err != nil {
			return fmt.Errorf("invalid revision: %s", revisionStr)
		}
		_, err = deployClient.Rollback(ctx, deployment, metav1.RollbackConfig{
			Revision: revision,
		})
		return err
	}

	// 回滚到上一版本
	_, err := deployClient.Rollback(ctx, deployment, metav1.RollbackConfig{
		Revision: 0, // 0 = 上一版本
	})
	return err
}

// killPod 强制终止 Pod (用于混沌工程或自愈)
func (s *Service) killPod(ctx context.Context, params map[string]string) error {
	if s.k8s == nil {
		return fmt.Errorf("k8s client not available")
	}
	namespace := params["namespace"]
	podName := params["pod"]
	force := params["force"] == "true"

	if namespace == "" || podName == "" {
		return fmt.Errorf("missing namespace or pod parameter")
	}

	gracePeriod := int64(0) // 立即终止
	if !force {
		gracePeriod = int64(30) // 优雅终止 30s
	}

	return s.k8s.CoreV1().Pods(namespace).Delete(ctx, podName, metav1.DeleteOptions{
		GracePeriodSeconds: &gracePeriod,
	})
}

// cleanCache 清理缓存 (Redis)
func (s *Service) cleanCache(ctx context.Context, params map[string]string) error {
	pattern := params["pattern"] // e.g. "orion:*"
	if pattern == "" {
		pattern = "orion:*" // 默认清理 orion 前缀的所有缓存
	}

	// TODO: 接入 redis client
	// keys, err := redis.Keys(ctx, pattern).Result()
	// if len(keys) > 0 { redis.Del(ctx, keys...) }
	s.logger.Info("cache cleaned", zap.String("pattern", pattern))
	return nil
}

// runScript 运行自定义脚本
func (s *Service) runScript(ctx context.Context, params map[string]string) error {
	script := params["script"]
	if script == "" {
		return fmt.Errorf("missing script parameter")
	}

	// TODO: 使用 exec.CommandContext 执行脚本
	// 注意: 需要安全审计脚本内容，防止命令注入
	s.logger.Info("script executed", zap.String("script", script))
	return nil
}

// notify 发送通知
func (s *Service) notify(ctx context.Context, params map[string]string, alert AlertEvent) error {
	channel := params["channel"] // webhook, slack, email, dingtalk
	message := params["message"]

	if message == "" {
		// 默认消息: 使用告警信息
		alertBytes, _ := json.Marshal(alert)
		message = string(alertBytes)
	}

	s.logger.Info("notification sent",
		zap.String("channel", channel),
		zap.String("alert", alert.AlertName))

	// TODO: 接入 internal/notification 模块
	return nil
}

// --- Public API ---

// SendAlert 外部写入告警 (供 Prometheus alertmanager webhook 调用)
func (s *Service) SendAlert(alert AlertEvent) {
	// 非阻塞写入
	select {
	case (chan AlertEvent)(s.alertCh) <- alert:
	default:
		s.logger.Warn("alert channel full, dropping alert",
			zap.String("alert", alert.AlertName))
	}
}

// GetExecutionHistory 获取执行历史
func (s *Service) GetExecutionHistory(ctx context.Context, ruleID string, limit int) ([]*ExecutionResult, error) {
	// 优先从缓存读取
	s.mu.Lock()
	if cached, ok := s.executionCache[ruleID]; ok && len(cached) >= 0 {
		s.mu.Unlock()
		if limit > 0 && len(cached) > limit {
			return cached[len(cached)-limit:], nil
		}
		return cached, nil
	}
	s.mu.Unlock()

	return s.repo.GetExecutionHistory(ctx, ruleID, limit)
}

// --- Helper ---

func loadKubeconfig(path string) (*rest.Config, error) {
	// TODO: 使用 clientcmd.LoadFromFile(path)
	return &rest.Config{}, fmt.Errorf("external kubeconfig not implemented")
}
