package tokenblacklist

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"errors"
	"sync"
	"time"

	"orion/platform-svc-go/internal/identity/auth/repository"

	"github.com/redis/go-redis/v9"
	"go.uber.org/zap"
)

// TokenBlacklistService manages revoked JWT tokens across three tiers:
//   Tier 1: Redis (distributed, TTL-based) — optional
//   Tier 2: PostgreSQL (token_blacklist table) — source-of-truth
//   Tier 3: in-memory cache (local, fast)
//
// On DB failure, silently falls back to in-memory cache.

type TokenBlacklistService struct {
	repo   *repository.AuthRepository
	redis  *redis.Client
	log    *zap.Logger
	config TokenBlacklistConfig

	// in-memory cache (write-through)
	cache  sync.Map // key: tokenHash, value: BlacklistedToken
	dbDown bool
	mu     sync.Mutex
}

type TokenBlacklistConfig struct {
	TTLSeconds int
	KeyPrefix  string
}

type BlacklistedToken struct {
	ID           string
	TokenHash    string
	UserID       string
	TenantID     string
	RevokedAt    time.Time
	ExpiresAt    time.Time
	RevokeReason string
	RevokedBy    string
}

type RevokedTokenInfo struct {
	TokenHash    string
	UserID       string
	TenantID     string
	RevokedAt    time.Time
	ExpiresAt    time.Time
	RevokeReason string
	RevokedBy    string
}

type TokenBlacklistStats struct {
	TotalRevoked int
	ByReason     map[string]int
	ByTenant     map[string]int
	ByUser       map[string]int
}

var defaultConfig = TokenBlacklistConfig{
	TTLSeconds: 7 * 24 * 3600, // 7 days
	KeyPrefix:  "token:blacklist:",
}

func New(repo *repository.AuthRepository, log *zap.Logger, redisClient *redis.Client, cfg TokenBlacklistConfig) *TokenBlacklistService {
	if cfg.TTLSeconds == 0 {
		cfg = defaultConfig
	}
	return &TokenBlacklistService{
		repo:   repo,
		redis:  redisClient,
		log:    log,
		config: cfg,
	}
}

// hashToken returns a SHA-256 hex digest of the token.
func hashToken(token string) string {
	d := sha256.Sum256([]byte(token))
	return hex.EncodeToString(d[:])
}

// RevokeToken writes the token hash to all three tiers.
func (s *TokenBlacklistService) RevokeToken(ctx context.Context, token, userID, tenantID, reason string, revokedBy string) error {
	hash := hashToken(token)
	now := time.Now()
	expiresAt := now.Add(time.Duration(s.config.TTLSeconds) * time.Second)

	info := BlacklistedToken{
		TokenHash:    hash,
		UserID:       userID,
		TenantID:     tenantID,
		RevokedAt:    now,
		ExpiresAt:    expiresAt,
		RevokeReason: reason,
		RevokedBy:    revokedBy,
	}

	// Tier 1: Redis
	if s.redis != nil {
		ttl := int(expiresAt.Sub(now).Seconds())
		if ttl > 0 {
			err := s.redis.Set(ctx, s.config.KeyPrefix+hash, "1", time.Duration(ttl)*time.Second).Err()
			if err != nil {
				s.log.Warn("failed to blacklist token in Redis", zap.String("hash_prefix", hash[:16]), zap.Error(err))
			}
		}
	}

	// Tier 2: PostgreSQL
	err := s.persistToDB(ctx, info)

	// Tier 3: in-memory cache
	s.cache.Store(hash, info)

	s.log.Debug("token revoked", zap.String("hash_prefix", hash[:16]), zap.String("user_id", userID))
	return err
}

// IsRevoked checks all three tiers.
func (s *TokenBlacklistService) IsRevoked(ctx context.Context, token string) (bool, error) {
	hash := hashToken(token)
	now := time.Now()

	// Tier 1: Redis
	if s.redis != nil {
		exists, err := s.redis.Exists(ctx, s.config.KeyPrefix+hash).Result()
		if err == nil && exists > 0 {
			return true, nil
		}
	}

	// Tier 2: DB
	dbToken, err := s.lookupInDB(ctx, hash)
	if err != nil {
		return false, err
	}
	if dbToken != nil {
		if dbToken.ExpiresAt.Before(now) {
			s.cache.Delete(hash)
			return false, nil
		}
		return true, nil
	}

	// Tier 3: in-memory
	if val, ok := s.cache.Load(hash); ok {
		info := val.(BlacklistedToken)
		if info.ExpiresAt.Before(now) {
			s.cache.Delete(hash)
			return false, nil
		}
		return true, nil
	}

	return false, nil
}

// GetRevokedTokenInfo returns details about a revoked token or nil.
func (s *TokenBlacklistService) GetRevokedTokenInfo(ctx context.Context, token string) (*RevokedTokenInfo, error) {
	hash := hashToken(token)
	now := time.Now()

	if val, ok := s.cache.Load(hash); ok {
		info := val.(BlacklistedToken)
		if info.ExpiresAt.Before(now) {
			s.cache.Delete(hash)
			return nil, nil
		}
		return &RevokedTokenInfo{
			TokenHash:    info.TokenHash,
			UserID:       info.UserID,
			TenantID:     info.TenantID,
			RevokedAt:    info.RevokedAt,
			ExpiresAt:    info.ExpiresAt,
			RevokeReason: info.RevokeReason,
			RevokedBy:    info.RevokedBy,
		}, nil
	}

	dbToken, err := s.lookupInDB(ctx, hash)
	if err != nil {
		return nil, err
	}
	if dbToken == nil {
		return nil, nil
	}
	if dbToken.ExpiresAt.Before(now) {
		s.cache.Delete(hash)
		return nil, nil
	}

	return &RevokedTokenInfo{
		TokenHash:    dbToken.TokenHash,
		UserID:       dbToken.UserID,
		TenantID:     dbToken.TenantID,
		RevokedAt:    dbToken.RevokedAt,
		ExpiresAt:    dbToken.ExpiresAt,
		RevokeReason: dbToken.RevokeReason,
		RevokedBy:    dbToken.RevokedBy,
	}, nil
}

// CleanupExpired removes expired tokens from memory and DB. Returns count cleaned.
func (s *TokenBlacklistService) CleanupExpired(ctx context.Context) (int, error) {
	now := time.Now()
	cleaned := 0

	// Clean in-memory
	s.cache.Range(func(key, value interface{}) bool {
		info := value.(BlacklistedToken)
		if info.ExpiresAt.Before(now) {
			s.cache.Delete(key)
			cleaned++
		}
		return true
	})

	// Clean DB
	if s.repo != nil && !s.dbDown {
		_, dbErr := s.repo.DB().ExecContext(ctx,
			"DELETE FROM token_blacklist WHERE expires_at < $1", now)
		if dbErr == nil {
			cleaned += 1
		}
	}

	s.log.Info("blacklist cleanup completed", zap.Int("cache_cleaned", cleaned))
	return cleaned, nil
}

// ---- private ----

func (s *TokenBlacklistService) persistToDB(ctx context.Context, info BlacklistedToken) error {
	if s.dbDown || s.repo == nil {
		return nil
	}
	s.mu.Lock()
	defer s.mu.Unlock()
	_, dbErr := s.repo.DB().ExecContext(ctx,
		`INSERT INTO token_blacklist (token_hash, user_id, tenant_id, revoke_reason, revoked_by, revoked_at, expires_at, created_at)
		 VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
		 ON CONFLICT (token_hash) DO NOTHING`,
		info.TokenHash, info.UserID, info.TenantID, info.RevokeReason, info.RevokedBy, info.RevokedAt, info.ExpiresAt, time.Now(),
	)
	if dbErr != nil {
		s.dbDown = true
		s.log.Error("DB write failed for token blacklist, switching to memory-only", zap.Error(dbErr))
	}
	return dbErr
}

func (s *TokenBlacklistService) lookupInDB(ctx context.Context, tokenHash string) (*BlacklistedToken, error) {
	if s.dbDown || s.repo == nil {
		return nil, nil
	}
	var info BlacklistedToken
	dbRows, err := s.repo.DB().QueryContext(ctx,
		"SELECT token_hash, user_id, tenant_id, revoke_reason, revoked_by, revoked_at, expires_at FROM token_blacklist WHERE token_hash = $1", tokenHash)
	if err != nil {
		if errors.Is(err, context.Canceled) || errors.Is(err, context.DeadlineExceeded) {
			return nil, err
		}
		s.mu.Lock()
		s.dbDown = true
		s.mu.Unlock()
		s.log.Error("DB read failed for token blacklist", zap.Error(err))
		return nil, nil
	}
	defer dbRows.Close()
	if !dbRows.Next() {
		return nil, nil
	}
	var userID, tenantID, reason, revokedBy string
	var revokedAt, expiresAt time.Time
	if err := dbRows.Scan(&info.TokenHash, &userID, &tenantID, &reason, &revokedBy, &revokedAt, &expiresAt); err != nil {
		return nil, nil
	}
	info.UserID = userID
	info.TenantID = tenantID
	info.RevokeReason = reason
	info.RevokedBy = revokedBy
	info.RevokedAt = revokedAt
	info.ExpiresAt = expiresAt
	s.cache.Store(tokenHash, info)
	return &info, nil
}
