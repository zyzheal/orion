package tracing

import (
	"context"
	"fmt"
	"strings"
	"time"

	"github.com/redis/go-redis/v9"
	"go.opentelemetry.io/otel/attribute"
	"go.opentelemetry.io/otel/codes"
	oteltrace "go.opentelemetry.io/otel/trace"
)

const redisSpanPrefix = "redis."

type RedisSpan struct {
	ctx    context.Context
	span   oteltrace.Span
	client *redis.Client
	cmd    string
	key    string
}

func NewRedisSpan(ctx context.Context, tracer oteltrace.Tracer, client *redis.Client, cmd string, key string) RedisSpan {
	name := fmt.Sprintf("%s%s", redisSpanPrefix, cmd)
	name = strings.ToLower(name)

	attrs := []attribute.KeyValue{
		attribute.String("db.system", "redis"),
		attribute.String("db.operation", cmd),
	}
	if key != "" {
		attrs = append(attrs, attribute.String("db.redis.key", truncateKey(key)))
	}

	spCtx := StartSpan(ctx, tracer, name,
		withKind(oteltrace.SpanKindClient),
		withAttrs(attrs...),
	)

	return RedisSpan{ctx: spCtx.Ctx, span: spCtx.Span, client: client, cmd: cmd, key: key}
}

func (r RedisSpan) Exec(fn func(ctx context.Context) (interface{}, error)) (interface{}, error) {
	start := time.Now()
	result, err := fn(r.ctx)
	elapsed := time.Since(start)

	r.span.SetAttributes(attribute.Int64("db.duration.ms", int64(elapsed.Milliseconds())))

	if err != nil {
		r.span.RecordError(err)
		r.span.SetStatus(codes.Error, fmt.Sprintf("redis %s error", r.cmd))
	}
	r.span.End()
	return result, err
}

func (r RedisSpan) Set(value interface{}, expiration time.Duration) (*redis.StatusCmd, error) {
	cmd := r.client.Set(r.ctx, r.key, value, expiration)
	_, err := r.Exec(func(ctx context.Context) (interface{}, error) {
		cmd := r.client.Set(ctx, r.key, value, expiration)
		return cmd.Result()
	})
	return cmd, err
}

func (r RedisSpan) Get() (*redis.StringCmd, error) {
	cmd := r.client.Get(r.ctx, r.key)
	_, err := r.Exec(func(ctx context.Context) (interface{}, error) {
		cmd := r.client.Get(ctx, r.key)
		return cmd.Result()
	})
	return cmd, err
}

func (r RedisSpan) Del(keys ...string) (*redis.IntCmd, error) {
	cmd := r.client.Del(r.ctx, keys...)
	_, err := r.Exec(func(ctx context.Context) (interface{}, error) {
		cmd := r.client.Del(ctx, keys...)
		return cmd.Result()
	})
	return cmd, err
}

func (r RedisSpan) TTL() (*redis.DurationCmd, error) {
	cmd := r.client.TTL(r.ctx, r.key)
	_, err := r.Exec(func(ctx context.Context) (interface{}, error) {
		cmd := r.client.TTL(ctx, r.key)
		return cmd.Result()
	})
	return cmd, err
}

func truncateKey(key string) string {
	const maxLen = 200
	if len(key) > maxLen {
		return key[:maxLen] + "..."
	}
	return key
}
