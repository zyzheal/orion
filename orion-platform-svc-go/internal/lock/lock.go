package lock

import (
	"context"
	"crypto/rand"
	"encoding/hex"
	"errors"
	"time"

	"github.com/redis/go-redis/v9"
)

// DistributedLock provides Redis-based distributed locking using SET NX PX + Lua script.
type DistributedLock struct {
	client *redis.Client
}

// LockResult holds the value associated with an acquired lock.
type LockResult struct {
	Value string // must be passed to Release()
}

var (
	ErrLockNotAcquired = errors.New("lock not acquired")
	ErrLockNotOwned    = errors.New("lock not owned by this holder")
)

const (
	DefaultTTL     = 10 * time.Second
	ScriptLock     = `if redis.call("GET", KEYS[1]) == ARGV[1] then return redis.call("DEL", KEYS[1]) else return 0 end`
	ScriptExtend   = `if redis.call("GET", KEYS[1]) == ARGV[1] then return redis.call("PEXPIRE", KEYS[1], ARGV[2]) else return 0 end`
)

func NewDistributedLock(client *redis.Client) *DistributedLock {
	return &DistributedLock{client: client}
}

// Acquire tries to acquire the lock with the given TTL (min 1ms).
// Returns LockResult.Value which must be passed to Release().
func (l *DistributedLock) Acquire(ctx context.Context, key string, ttl time.Duration) (*LockResult, error) {
	if ttl <= 0 {
		ttl = DefaultTTL
	}
	if ttl < time.Millisecond {
		ttl = time.Millisecond
	}

	value, err := randomValue()
	if err != nil {
		return nil, err
	}

	ok, err := l.client.SetNX(ctx, key, value, ttl).Result()
	if err != nil {
		return nil, err
	}
	if !ok {
		return nil, ErrLockNotAcquired
	}
	return &LockResult{Value: value}, nil
}

// Release atomically releases a lock only if the caller still owns it.
func (l *DistributedLock) Release(ctx context.Context, key string, value string) error {
	var delScript = redis.NewScript(ScriptLock)
	result, err := delScript.Run(ctx, l.client, []string{key}, value).Int64()
	if err != nil {
		return err
	}
	if result == 0 {
		return ErrLockNotOwned
	}
	return nil
}

// Extend atomically extends the TTL of an owned lock.
func (l *DistributedLock) Extend(ctx context.Context, key string, value string, ttl time.Duration) error {
	var script = redis.NewScript(ScriptExtend)
	result, err := script.Run(ctx, l.client, []string{key}, value, int64(ttl)).Int64()
	if err != nil {
		return err
	}
	if result == 0 {
		return ErrLockNotOwned
	}
	return nil
}

// WithLock acquires a lock, runs fn, and releases the lock (best-effort).
// Returns fn's result or ErrLockNotAcquired if the lock could not be obtained.
func WithLock[T any](l *DistributedLock, ctx context.Context, key string, ttl time.Duration, fn func(context.Context) (T, error)) (T, error) {
	lock, err := l.Acquire(ctx, key, ttl)
	if err != nil {
		var zero T
		return zero, err
	}
	// release best-effort
	defer func() {
		_ = l.Release(ctx, key, lock.Value)
	}()
	return fn(ctx)
}

func randomValue() (string, error) {
	b := make([]byte, 16)
	if _, err := rand.Read(b); err != nil {
		return "", err
	}
	return hex.EncodeToString(b), nil
}
