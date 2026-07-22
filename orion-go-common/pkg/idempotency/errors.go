package idempotency

import "errors"

// 错误定义
var (
	// ErrAlreadyProcessing 请求正在处理中，幂等键已被占用
	ErrAlreadyProcessing = errors.New("idempotency: 请求正在处理中，请稍后重试")

	// ErrInvalidIdempotencyKey 无效的幂等键格式
	ErrInvalidIdempotencyKey = errors.New("idempotency: 幂等键格式无效")

	// ErrIdempotencyKeyMissing 缺少幂等键
	ErrIdempotencyKeyMissing = errors.New("idempotency: 缺少幂等键")
)
