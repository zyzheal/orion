// Package adapter 提供 notification 与 pipeline 的适配层。
//
// G3 目标：让 notification 通过 pipeline 分发（统一投递管线），
// 同时保留 3 层 fallback：pipeline → legacy-service → silent-fail。
//
// 参见: backend-g1-g3-implementation-spec-2026-10-11.md §4
// 参见: triage-api-contract-design-2026-10-11.md §6 (Feature Flag)
package adapter

import (
	"context"
	"errors"
	"sync"
	"time"

	"go.opentelemetry.io/otel"
	"go.uber.org/zap"
)

// FeatureFlag 由外部（装配层）注入，控制 pipeline_adapter 开关。
type FeatureFlag interface {
	// Enabled 返回 Flag 是否启用；若 Flag 不可用应返回 false（走 legacy）。
	Enabled(name string) bool
}

// StaticFlag 是简单实现，供测试与装配。
type StaticFlag struct {
	Value bool
}

func (s StaticFlag) Enabled(name string) bool { return s.Value }

// PipelineSender 是 pipeline 抽象，由装配层注入具体实现。
type PipelineSender interface {
	Send(ctx context.Context, req SendRequest) (*SendResponse, error)
}

// LegacySender 是通知模块自身直接发送的旧路径。
type LegacySender interface {
	Send(ctx context.Context, req SendRequest) (*SendResponse, error)
}

// SendRequest 描述一次投递请求。
type SendRequest struct {
	TenantID      string
	UserID        string
	Channel       string // wechat-work / sms / email / dingtalk / ...
	TemplateID    string
	Subject       string
	Body          string
	Context       map[string]any
	DryRun        bool
}

// SendResponse 描述一次投递结果。
type SendResponse struct {
	DeliveryID   string         `json:"delivery_id"`
	Status       string         `json:"status"` // delivered / dry_run / failed
	AdapterMode  string         `json:"adapter_mode"` // pipeline / legacy / silent
	ErrorCode    string         `json:"error_code,omitempty"`
	ErrorMessage string         `json:"error_message,omitempty"`
}

// DeliveryMode 记录当前生效的发送模式。
type DeliveryMode int

const (
	ModePipeline DeliveryMode = iota
	ModeLegacy
	ModeSilent
)

func (m DeliveryMode) String() string {
	switch m {
	case ModePipeline:
		return "pipeline"
	case ModeLegacy:
		return "legacy"
	case ModeSilent:
		return "silent"
	default:
		return "unknown"
	}
}

// StatusSnapshot 记录 Adapter 当前状态（供 GET /status）。
type StatusSnapshot struct {
	PipelineAdapterEnabled  bool    `json:"pipeline_adapter_enabled"`
	PipelineAvailable       bool    `json:"pipeline_available"`
	LegacyFallbackActive    bool    `json:"legacy_fallback_active"`
	RecentDeliverySuccessRate float64 `json:"recent_delivery_success_rate"`
	RecentDeliveryCount     int64   `json:"recent_delivery_count"`
	LastSwitchAt            string  `json:"last_switch_at"`
}

// Adapter 是三层 fallback 的核心。
type Adapter struct {
	mu          sync.RWMutex
	pipeline    PipelineSender
	legacy      LegacySender
	flag        FeatureFlag
	log         *zap.Logger
	tracer      *zap.Logger // 复用 log；trace 由 span 处理

	successCount  int64
	failureCount  int64
	lastSwitchAt  time.Time
}

// 常见错误码。
var (
	ErrAdapterDisabled = errors.New("E_ADAPTER_DISABLED: adapter disabled")
	ErrTemplateNotFound = errors.New("E_ADAPTER_TEMPLATE_NOT_FOUND: template not found")
)

// New 创建新的 Adapter。
//
// flag: 若为 nil 使用 StaticFlag{Enabled: false}（禁用 pipeline）。
// log: 若为 nil 使用 zap.NewNop()。
func New(pipeline PipelineSender, legacy LegacySender, flag FeatureFlag, log *zap.Logger) *Adapter {
	if flag == nil {
		flag = StaticFlag{Value: false}
	}
	if log == nil {
		log = zap.NewNop()
	}
	return &Adapter{
		pipeline:     pipeline,
		legacy:       legacy,
		flag:         flag,
		log:          log,
		lastSwitchAt: time.Now(),
	}
}

const FlagKey = "notification.pipeline_adapter"

// Send 执行三层 fallback 投递。
//
// 流程：
//   1. Feature Flag 未启用 → legacy
//   2. pipeline 返回 nil → 认为不可用 → legacy
//   3. pipeline 失败 → legacy
//   4. legacy 也失败 → 记录指标 + 返回 ErrSilent（不阻塞上游）
func (a *Adapter) Send(ctx context.Context, req SendRequest) (*SendResponse, error) {
	tracer := otel.Tracer("orion-platform-svc")
	ctx, span := tracer.Start(ctx, "NotificationAdapter.Send")
	defer span.End()

	// 层 1: Feature Flag 检查
	if !a.flag.Enabled(FlagKey) {
		return a.sendLegacy(ctx, req)
	}

	// 层 2: pipeline 优先
	if a.pipeline != nil {
		resp, err := a.pipeline.Send(ctx, req)
		if err == nil && resp != nil {
			resp.AdapterMode = "pipeline"
			a.recordSuccess()
			a.log.Info("adapter delivered via pipeline",
				zap.String("delivery_id", resp.DeliveryID),
				zap.String("channel", req.Channel))
			return resp, nil
		}
		// pipeline 失败，fallback 到 legacy
		a.log.Warn("pipeline delivery failed, falling back to legacy",
			zap.String("channel", req.Channel),
			zap.Error(err))
		a.switchMode("pipeline→legacy")
	}

	// 层 3: legacy 兜底
	resp, err := a.sendLegacy(ctx, req)
	if err != nil {
		// legacy 也失败，silent 记录（不阻塞上游）
		a.recordFailure()
		return &SendResponse{
			AdapterMode:  "silent",
			Status:       "failed",
			ErrorCode:    "E_ADAPTER_FALLBACK",
			ErrorMessage: err.Error(),
		}, nil
	}
	return resp, nil
}

func (a *Adapter) sendLegacy(ctx context.Context, req SendRequest) (*SendResponse, error) {
	if a.legacy == nil {
		return nil, errors.New("legacy sender not configured")
	}
	resp, err := a.legacy.Send(ctx, req)
	if err != nil {
		a.recordFailure()
		return nil, err
	}
	if resp == nil {
		return nil, errors.New("legacy returned nil response")
	}
	resp.AdapterMode = "legacy"
	a.recordSuccess()
	return resp, nil
}

func (a *Adapter) recordSuccess() {
	a.mu.Lock()
	defer a.mu.Unlock()
	a.successCount++
}

func (a *Adapter) recordFailure() {
	a.mu.Lock()
	defer a.mu.Unlock()
	a.failureCount++
}

func (a *Adapter) switchMode(reason string) {
	a.mu.Lock()
	defer a.mu.Unlock()
	a.lastSwitchAt = time.Now()
	a.log.Info("adapter mode switched", zap.String("reason", reason))
}

// Status 返回当前状态快照。
func (a *Adapter) Status() StatusSnapshot {
	a.mu.RLock()
	defer a.mu.RUnlock()

	total := a.successCount + a.failureCount
	rate := 0.0
	if total > 0 {
		rate = float64(a.successCount) / float64(total)
	}

	return StatusSnapshot{
		PipelineAdapterEnabled:  a.flag.Enabled(FlagKey),
		PipelineAvailable:       a.pipeline != nil,
		LegacyFallbackActive:    a.legacy != nil,
		RecentDeliverySuccessRate: rate,
		RecentDeliveryCount:     total,
		LastSwitchAt:            a.lastSwitchAt.Format(time.RFC3339),
	}
}

// 编译期检查：确保 Adapter 不依赖任何循环依赖。
var _ interface{ Send(context.Context, SendRequest) (*SendResponse, error) } = (*Adapter)(nil)
var _ interface{ Status() StatusSnapshot } = (*Adapter)(nil)
