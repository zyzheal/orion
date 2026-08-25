// ============================================================
// Plan 35 — OTel 服务层 Span 追踪
// ============================================================
// 优先级: P1
// 来源: 全量代码扫描发现 — 中间件已有 OTel 但服务层未接入
// 本地证据:
//   - internal/middleware/tracing.go: 完整 OTel 中间件 (Extract/Inject/GetTraceID)
//   - grep -r "otel.\|tracer.Start" internal/ --include="*.go" -l → 仅 5 个 handler 文件
//   - 300+ 模块中 95%+ 无 span 追踪
//   - orion-go-common/pkg/otel/otel.go (70行): 仅 Init + Tracer, 缺少 Span 工具函数
// 技术约束: Go, go.opentelemetry.io/otel, go.opentelemetry.io/otel/trace
// ============================================================

package otel

import (
	"context"

	"go.opentelemetry.io/otel"
	"go.opentelemetry.io/otel/attribute"
	"go.opentelemetry.io/otel/codes"
	"go.opentelemetry.io/otel/trace"
)

// ============================================================
// Span 工具函数 — 供所有 service 层使用
// ============================================================

// StartSpan 创建一个 span 并返回带有 trace context 的 context
//
// 使用方式:
//
//	func (s *Service) Create(ctx context.Context, req *CreateReq) (*Model, error) {
//	    ctx, span := otel.StartSpan(ctx, "circuit-breaker.Create",
//	        attribute.String("breaker.name", req.Name))
//	    defer span.End()
//	    // ... 业务逻辑 ...
//	}
func StartSpan(ctx context.Context, name string, attrs ...attribute.KeyValue) (context.Context, trace.Span) {
	tracer := otel.Tracer("orion/platform-svc")
	return tracer.Start(ctx, name, trace.WithAttributes(attrs...))
}

// StartDBSpan 创建数据库操作 span
//
// 使用方式:
//
//	ctx, span := otel.StartDBSpan(ctx, "SELECT", "circuit_breakers")
//	defer span.End()
//	err := s.db.SelectContext(ctx, &items, query)
func StartDBSpan(ctx context.Context, operation, table string, attrs ...attribute.KeyValue) (context.Context, trace.Span) {
	allAttrs := append([]attribute.KeyValue{
		attribute.String("db.system", "postgresql"),
		attribute.String("db.operation", operation),
		attribute.String("db.table", table),
	}, attrs...)
	return StartSpan(ctx, "DB."+operation+"."+table, allAttrs...)
}

// StartRedisSpan 创建 Redis 操作 span
func StartRedisSpan(ctx context.Context, operation, key string, attrs ...attribute.KeyValue) (context.Context, trace.Span) {
	allAttrs := append([]attribute.KeyValue{
		attribute.String("db.system", "redis"),
		attribute.String("db.operation", operation),
		attribute.String("db.redis.key", key),
	}, attrs...)
	return StartSpan(ctx, "Redis."+operation, allAttrs...)
}

// StartHTTPSpan 创建出站 HTTP 请求 span
func StartHTTPSpan(ctx context.Context, method, url string, attrs ...attribute.KeyValue) (context.Context, trace.Span) {
	allAttrs := append([]attribute.KeyValue{
		attribute.String("http.method", method),
		attribute.String("http.url", url),
	}, attrs...)
	return StartSpan(ctx, "HTTP."+method, allAttrs...)
}

// StartMsgSpan 创建消息处理 span (事件总线消费)
func StartMsgSpan(ctx context.Context, subject string, attrs ...attribute.KeyValue) (context.Context, trace.Span) {
	allAttrs := append([]attribute.KeyValue{
		attribute.String("messaging.system", "nats"),
		attribute.String("messaging.destination", subject),
	}, attrs...)
	return StartSpan(ctx, "MSG."+subject, allAttrs...)
}

// ============================================================
// Span 属性记录工具
// ============================================================

// SetSpanAttributes 设置 span 属性
func SetSpanAttributes(ctx context.Context, attrs ...attribute.KeyValue) {
	span := trace.SpanFromContext(ctx)
	span.SetAttributes(attrs...)
}

// SetTenant 标记当前 span 的租户
func SetTenant(ctx context.Context, tenantID string) {
	span := trace.SpanFromContext(ctx)
	span.SetAttributes(attribute.String("tenant.id", tenantID))
}

// SetUser 标记当前 span 的用户
func SetUser(ctx context.Context, userID, userName string) {
	span := trace.SpanFromContext(ctx)
	span.SetAttributes(
		attribute.String("enduser.id", userID),
		attribute.String("enduser.name", userName),
	)
}

// SetRequest 标记 HTTP 请求信息
func SetRequest(ctx context.Context, method, path string, status int) {
	span := trace.SpanFromContext(ctx)
	span.SetAttributes(
		attribute.String("http.method", method),
		attribute.String("http.path", path),
		attribute.Int("http.status_code", status),
	)
}

// ============================================================
// 错误记录工具
// ============================================================

// RecordError 记录错误到 span
//
// 使用方式:
//
//	if err != nil {
//	    otel.RecordError(ctx, err)
//	    return err
//	}
func RecordError(ctx context.Context, err error) {
	if err == nil {
		return
	}
	span := trace.SpanFromContext(ctx)
	span.RecordError(err)
	span.SetStatus(codes.Error, err.Error())
}

// RecordErrorWithAttrs 记录错误到 span (带附加属性)
func RecordErrorWithAttrs(ctx context.Context, err error, attrs ...attribute.KeyValue) {
	if err == nil {
		return
	}
	span := trace.SpanFromContext(ctx)
	span.RecordError(err, trace.WithAttributes(attrs...))
	span.SetStatus(codes.Error, err.Error())
}

// ============================================================
// Trace ID 工具
// ============================================================

// GetTraceID 从 context 获取 trace ID
func GetTraceID(ctx context.Context) string {
	spanCtx := trace.SpanContextFromContext(ctx)
	if spanCtx.HasTraceID() {
		return spanCtx.TraceID().String()
	}
	return ""
}

// GetSpanID 从 context 获取 span ID
func GetSpanID(ctx context.Context) string {
	spanCtx := trace.SpanContextFromContext(ctx)
	if spanCtx.HasSpanID() {
		return spanCtx.SpanID().String()
	}
	return ""
}

// ============================================================
// Span 包装器 — 自动追踪函数执行
// ============================================================

// TraceFunc 包装一个函数，自动创建 span
//
// 使用方式:
//
//	result, err := otel.TraceFunc(ctx, "calculate-price", func(ctx context.Context) (*Price, error) {
//	    return s.pricingEngine.Calculate(ctx, req)
//	}, attribute.String("item.id", req.ItemID))
func TraceFunc[T any](ctx context.Context, name string, fn func(ctx context.Context) (T, error), attrs ...attribute.KeyValue) (T, error) {
	ctx, span := StartSpan(ctx, name, attrs...)
	defer span.End()

	result, err := fn(ctx)
	if err != nil {
		RecordError(ctx, err)
	}
	return result, err
}

// TraceVoidFunc 包装无返回值函数
func TraceVoidFunc(ctx context.Context, name string, fn func(ctx context.Context) error, attrs ...attribute.KeyValue) error {
	ctx, span := StartSpan(ctx, name, attrs...)
	defer span.End()

	err := fn(ctx)
	if err != nil {
		RecordError(ctx, err)
	}
	return err
}

// ============================================================
// Service 层自动追踪 Mixin
// ============================================================

// TracedService 追踪服务调用
// 嵌入到 service struct 中使用
//
//	type Service struct {
//	    otel.TracedService
//	    repo Repository
//	}
//
//	func (s *Service) Get(ctx context.Context, id string) (*Model, error) {
//	    ctx, span := s.StartSpan(ctx, "Get", attribute.String("id", id))
//	    defer span.End()
//	    return s.repo.Get(ctx, id)
//	}
type TracedService struct{}

func (TracedService) StartSpan(ctx context.Context, name string, attrs ...attribute.KeyValue) (context.Context, trace.Span) {
	return StartSpan(ctx, name, attrs...)
}

func (TracedService) RecordError(ctx context.Context, err error) {
	RecordError(ctx, err)
}

func (TracedService) GetTraceID(ctx context.Context) string {
	return GetTraceID(ctx)
}
