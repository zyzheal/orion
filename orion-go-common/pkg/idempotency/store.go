package idempotency

import "context"

// Key 幂等键值对，存储幂等请求的元数据
type Key struct {
	// ID 唯一幂等键
	ID string
	// Path 请求路径
	Path string
	// Method HTTP 方法
	Method string
	// TenantID 租户ID（可选，用于多租户隔离）
	TenantID string
	// UserID 用户ID（可选，用于用户级幂等）
	UserID string
	// PayloadHash 请求体哈希（用于防止重放）
	PayloadHash string
	// TTL TTL（秒）
	TTL int64
}

// Result 幂等检查结果
type Result struct {
	// IsProcessed 该请求是否已处理过
	IsProcessed bool
	// ResponseCode 已处理请求的响应状态码（仅当 IsProcessed=true 时有效）
	ResponseCode int
	// ResponseBody 已处理请求的响应体（仅当 IsProcessed=true 时有效）
	ResponseBody []byte
	// ResponseHeaders 已处理请求的响应头（仅当 IsProcessed=true 时有效）
	ResponseHeaders map[string]string
}

// Store 幂等存储接口，支持 Redis 和 PostgreSQL 两种实现
type Store interface {
	// Check 检查幂等键是否存在，如已存在返回缓存的响应
	Check(ctx context.Context, key Key) (*Result, error)

	// Lock 锁定幂等键，阻止并发重复请求（SET NX）
	Lock(ctx context.Context, key Key) error

	// Unlock 释放幂等键（请求处理完成后）
	Unlock(ctx context.Context, key Key) error

	// StoreResponse 存储请求响应，供后续重复请求返回
	StoreResponse(ctx context.Context, key Key, code int, body []byte, headers map[string]string) error

	// SetTTL 更新幂等键的 TTL（用于 Saga 长时间事务）
	SetTTL(ctx context.Context, key Key, ttl int64) error
}
