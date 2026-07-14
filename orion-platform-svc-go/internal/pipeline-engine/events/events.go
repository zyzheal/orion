package events

import (
	"context"
	"fmt"
	"log"
	"time"
)

// 事件类型常量
const (
	EventTypePipelineRunCreated     = "pipeline.run.created"
	EventTypePipelineRunStarted     = "pipeline.run.started"
	EventTypePipelineRunCompleted   = "pipeline.run.completed"
	EventTypePipelineRunFailed      = "pipeline.run.failed"
	EventTypePipelineRunCancelled   = "pipeline.run.cancelled"
	EventTypePipelineStageStarted   = "pipeline.stage.started"
	EventTypePipelineStageCompleted = "pipeline.stage.completed"
	EventTypePipelineStageFailed    = "pipeline.stage.failed"
	EventTypePipelineStageSkipped   = "pipeline.stage.skipped"
	EventTypePipelineTaskStarted    = "pipeline.task.started"
	EventTypePipelineTaskCompleted  = "pipeline.task.completed"
	EventTypePipelineTaskFailed     = "pipeline.task.failed"
)

// StageInfo Stage 信息
type StageInfo struct {
	ID        string   `json:"id"`
	Name      string   `json:"name"`
	Sequence  int      `json:"sequence"`
	Status    string   `json:"status"`
	DependsOn []string `json:"dependsOn,omitempty"`
}

// PipelineRunEvent PipelineRun 事件数据
type PipelineRunEvent struct {
	PipelineID      string      `json:"pipelineId"`
	PipelineVersion string      `json:"pipelineVersion"`
	RunID           string      `json:"runId"`
	Status          string      `json:"status"`
	TriggerType     string      `json:"triggerType"`
	TriggeredBy     *string     `json:"triggeredBy,omitempty"`
	Stages          []StageInfo `json:"stages,omitempty"`
	GitRef          *string     `json:"gitRef,omitempty"`
	GitSha          *string     `json:"gitSha,omitempty"`
	DurationMs      *int64      `json:"durationMs,omitempty"`
	Error           *string     `json:"error,omitempty"`
	Timestamp       string      `json:"timestamp"`
}

// StageEvent Stage 事件数据
type StageEvent struct {
	RunID      string  `json:"runId"`
	PipelineID *string `json:"pipelineId,omitempty"`
	StageID    string  `json:"stageId"`
	StageName  string  `json:"stageName"`
	Sequence   int     `json:"sequence"`
	Status     string  `json:"status"`
	DurationMs *int64  `json:"durationMs,omitempty"`
	Error      *string `json:"error,omitempty"`
	Timestamp  string  `json:"timestamp"`
}

// TaskEvent Task 事件数据
type TaskEvent struct {
	RunID      string  `json:"runId"`
	StageID    string  `json:"stageId"`
	TaskID     string  `json:"taskId"`
	TaskName   string  `json:"taskName"`
	Sequence   int     `json:"sequence"`
	Status     string  `json:"status"`
	DurationMs *int64  `json:"durationMs,omitempty"`
	Error      *string `json:"error,omitempty"`
	Timestamp  string  `json:"timestamp"`
}

// EventExtensions 事件上下文扩展
type EventExtensions struct {
	TenantID string  `json:"tenantId"`
	UserID   string  `json:"userId"`
	TraceID  string  `json:"traceId"`
	Version  *string `json:"version,omitempty"`
	Priority *string `json:"priority,omitempty"` // low|normal|high|critical
}

// PipelineEvent Pipeline 事件接口
type PipelineEvent interface {
	GetEventType() string
	GetTimestamp() string
	GetExtensions() EventExtensions
}

// EventPublisher 事件发布器接口
type EventPublisher interface {
	Publish(ctx context.Context, event interface{}) error
	PublishRunEvent(ctx context.Context, event *PipelineRunEvent) error
	PublishStageEvent(ctx context.Context, event *StageEvent) error
	PublishTaskEvent(ctx context.Context, event *TaskEvent) error
}

// NoopPublisher v1 占位实现，仅打印日志
type NoopPublisher struct{}

// NewNoopPublisher 创建 NoopPublisher
func NewNoopPublisher() *NoopPublisher {
	return &NoopPublisher{}
}

// NewPipelineEventPublisher 工厂函数，返回 NoopPublisher
func NewPipelineEventPublisher() EventPublisher {
	return NewNoopPublisher()
}

// Publish 通用发布
func (p *NoopPublisher) Publish(ctx context.Context, event interface{}) error {
	et := fmt.Sprintf("%T", event)
	log.Printf("[NoopPublisher] publish event type=%s", et)
	return nil
}

// PublishRunEvent 发布 Run 事件
func (p *NoopPublisher) PublishRunEvent(ctx context.Context, event *PipelineRunEvent) error {
	log.Printf("[NoopPublisher] pipeline.run event runId=%s status=%s", event.RunID, event.Status)
	return nil
}

// PublishStageEvent 发布 Stage 事件
func (p *NoopPublisher) PublishStageEvent(ctx context.Context, event *StageEvent) error {
	log.Printf("[NoopPublisher] pipeline.stage event runId=%s stageId=%s status=%s", event.RunID, event.StageID, event.Status)
	return nil
}

// PublishTaskEvent 发布 Task 事件
func (p *NoopPublisher) PublishTaskEvent(ctx context.Context, event *TaskEvent) error {
	log.Printf("[NoopPublisher] pipeline.task event runId=%s taskId=%s status=%s", event.RunID, event.TaskID, event.Status)
	return nil
}

// NowUTC 生成 UTC 时间戳
func NowUTC() string {
	return time.Now().UTC().Format(time.RFC3339)
}

// DefaultExtensions 生成默认扩展（traceId 为空）
func DefaultExtensions(tenantID, userID string) EventExtensions {
	return EventExtensions{
		TenantID: tenantID,
		UserID:   userID,
		TraceID:  "",
	}
}
