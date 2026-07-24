package idempotency

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
)

// Checker 幂等检查器，封装存储层和操作逻辑
type Checker struct {
	store Store
}

// NewChecker 创建新的幂等检查器
func NewChecker(store Store) *Checker {
	return &Checker{store: store}
}

// CheckAndLock 检查幂等键并尝试锁定
// 如果已存在则返回缓存响应，不存在则锁定等待处理
func (c *Checker) CheckAndLock(ctx context.Context, key Key) (*Result, error) {
	result, err := c.store.Check(ctx, key)
	if err != nil {
		return nil, err
	}
	if result.IsProcessed {
		return result, nil
	}
	return nil, c.store.Lock(ctx, key)
}

// Complete 请求处理完成，存储响应并释放锁
func (c *Checker) Complete(ctx context.Context, key Key, code int, body []byte, headers map[string]string) error {
	if err := c.store.StoreResponse(ctx, key, code, body, headers); err != nil {
		return err
	}
	return c.store.Unlock(ctx, key)
}

// PayloadHash 计算请求体 SHA-256 哈希
func PayloadHash(body []byte) string {
	h := sha256.Sum256(body)
	return hex.EncodeToString(h[:])
}
