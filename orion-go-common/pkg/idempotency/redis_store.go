package idempotency

import (
	"context"
	"encoding/json"
	"fmt"
	"time"

	"github.com/redis/go-redis/v9"
)

// RedisStore Redis 幂等存储实现
// 键格式: idempotency:{keyID}
// 值格式: {code, body, headers, locked, lockedAt}
type RedisStore struct {
	client redis.Cmdable
	prefix string
}

// redisValue Redis 中存储的幂等值结构
type redisValue struct {
	Code        int                `json:"code"`
	Body        string             `json:"body"`
	Headers     map[string]string  `json:"headers,omitempty"`
	Locked      bool               `json:"locked"`
	LockedAt    time.Time          `json:"locked_at"`
}

// NewRedisStore 创建 Redis 幂等存储
func NewRedisStore(client redis.Cmdable, prefix string) *RedisStore {
	if prefix == "" {
		prefix = "idempotency"
	}
	return &RedisStore{client: client, prefix: prefix}
}

func (s *RedisStore) key(k Key) string {
	return fmt.Sprintf("%s:%s", s.prefix, k.ID)
}

// Check 检查幂等键
func (s *RedisStore) Check(ctx context.Context, key Key) (*Result, error) {
	val, err := s.client.Get(ctx, s.key(key)).Result()
	if err != nil {
		if err == redis.Nil {
			return &Result{IsProcessed: false}, nil
		}
		return nil, err
	}

	var rv redisValue
	if err := json.Unmarshal([]byte(val), &rv); err != nil {
		return nil, err
	}

	return &Result{
		IsProcessed:     rv.Code != 0,
		ResponseCode:    rv.Code,
		ResponseBody:    []byte(rv.Body),
		ResponseHeaders: rv.Headers,
	}, nil
}

// Lock 锁定幂等键（SET NX EX）
func (s *RedisStore) Lock(ctx context.Context, key Key) error {
	val := redisValue{Locked: true, LockedAt: time.Now()}
	data, err := json.Marshal(val)
	if err != nil {
		return err
	}

	ok, err := s.client.SetNX(ctx, s.key(key), data, time.Duration(key.TTL)*time.Second).Result()
	if err != nil {
		return err
	}
	if !ok {
		// 检查是否已被锁定（正在处理中）
		result, checkErr := s.Check(ctx, key)
		if checkErr != nil {
			return checkErr
		}
		if result.IsProcessed {
			return ErrAlreadyProcessing
		}
		// 有锁但未完成，可能是请求处理中
		return ErrAlreadyProcessing
	}

	// 更新 TTL 到 key 的完整值
	return nil
}

// Unlock 释放幂等键
func (s *RedisStore) Unlock(ctx context.Context, key Key) error {
	// 幂等键过期由 Redis TTL 自动管理，无需主动删除
	return nil
}

// StoreResponse 存储响应
func (s *RedisStore) StoreResponse(ctx context.Context, key Key, code int, body []byte, headers map[string]string) error {
	val := redisValue{
		Code:    code,
		Body:    string(body),
		Headers: headers,
		Locked:  false,
	}
	data, err := json.Marshal(val)
	if err != nil {
		return err
	}
	return s.client.SetEx(ctx, s.key(key), data, time.Duration(key.TTL)*time.Second).Err()
}

// SetTTL 更新 TTL
func (s *RedisStore) SetTTL(ctx context.Context, key Key, ttl int64) error {
	return s.client.Expire(ctx, s.key(key), time.Duration(ttl)*time.Second).Err()
}
