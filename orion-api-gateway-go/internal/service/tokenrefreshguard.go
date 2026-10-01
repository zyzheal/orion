package service

import (
	"context"
	"encoding/json"
	"fmt"
	"strings"
	"time"

	"github.com/redis/go-redis/v9"
	"go.uber.org/zap"
)

// RefreshResult holds the outcome of a token refresh attempt.
type RefreshResult struct {
	Success             bool
	AccessToken         string
	RefreshToken        string
	ExpiresIn           int
	RefreshTokenExpiresIn int
	Revoked             bool
	AnomalousLogin      *AnomalousLoginEvent
}

// TokenRefreshAttempt holds the inputs for a refresh attempt.
type TokenRefreshAttempt struct {
	RefreshToken string
	UserID       string
	DeviceID     string
	Fingerprint  string
	IP           string
	UserAgent    string
}

// RefreshAuditLog tracks refresh attempts for auditing.
type RefreshAuditLog struct {
	UserID       string `json:"userId"`
	RefreshToken string `json:"refreshToken"`
	DeviceID     string `json:"deviceId,omitempty"`
	Fingerprint  string `json:"fingerprint,omitempty"`
	IP           string `json:"ip"`
	Success      bool   `json:"success"`
	Revoked      bool   `json:"revoked"`
	Timestamp    int64  `json:"timestamp"`
	Reason       string `json:"reason,omitempty"`
}

// NewTokenGenerator is a callback that produces fresh token pairs.
type NewTokenGenerator func() (accessToken, refreshToken, jti string, err error)

// TokenRefreshGuard provides concurrent refresh protection and audit logging.
type TokenRefreshGuard struct {
	redis       *redis.Client
	deviceFP    *DeviceFingerprintService
	logger      *zap.Logger
	tokenTTL    time.Duration
	auditTTL    time.Duration
}

// NewTokenRefreshGuard creates a token refresh guard.
func NewTokenRefreshGuard(rdb *redis.Client, deviceFP *DeviceFingerprintService, logger *zap.Logger) *TokenRefreshGuard {
	return &TokenRefreshGuard{
		redis:    rdb,
		deviceFP: deviceFP,
		logger:   logger,
		tokenTTL: 7 * 24 * time.Hour,
		auditTTL: 30 * 24 * time.Hour,
	}
}

// HandleRefresh performs a guarded token refresh.
func (g *TokenRefreshGuard) HandleRefresh(ctx context.Context, attempt TokenRefreshAttempt, gen NewTokenGenerator) (*RefreshResult, error) {
	// Check for concurrent refresh attack
	isConcurrent, err := g.detectConcurrentRefresh(ctx, attempt.UserID, attempt.RefreshToken)
	if err != nil {
		g.logger.Warn("concurrent detection failed", zap.Error(err))
	}
	if isConcurrent {
		g.revokeAllUserTokens(ctx, attempt.UserID)
		g.recordRefreshAttempt(ctx, attempt, false, true, "CONCURRENT_ATTACK")
		return &RefreshResult{Success: false, Revoked: true}, nil
	}

	// Check for anomalous login
	var anomalousEvent *AnomalousLoginEvent
	if g.deviceFP != nil && attempt.Fingerprint != "" && attempt.IP != "" {
		event, err := g.deviceFP.DetectAnomalousLogin(ctx, attempt.UserID, attempt.Fingerprint, attempt.IP)
		if err == nil {
			anomalousEvent = event
		}
	}

	// Generate new tokens
	accessToken, newRefreshToken, jti, err := gen()
	if err != nil {
		g.recordRefreshAttempt(ctx, attempt, false, false, "TOKEN_GENERATION_FAILED")
		return &RefreshResult{Success: false}, nil
	}

	// Execute atomic refresh
	success, err := g.executeAtomicRefresh(ctx, attempt.RefreshToken, newRefreshToken, jti, attempt.UserID, attempt.DeviceID, attempt.Fingerprint)
	if err != nil || !success {
		reason := "ATOMIC_REFRESH_FAILED"
		if err != nil {
			reason = err.Error()
		}
		g.recordRefreshAttempt(ctx, attempt, false, false, reason)
		return &RefreshResult{Success: false, Revoked: false}, nil
	}

	g.recordRefreshAttempt(ctx, attempt, true, false, "")

	return &RefreshResult{
		Success:               true,
		AccessToken:           accessToken,
		RefreshToken:          newRefreshToken,
		ExpiresIn:             24 * 60 * 60,
		RefreshTokenExpiresIn: 7 * 24 * 60 * 60,
		AnomalousLogin:        anomalousEvent,
	}, nil
}

// executeAtomicRefresh performs the core token swap in Redis.
func (g *TokenRefreshGuard) executeAtomicRefresh(ctx context.Context, oldRefreshToken, newRefreshToken, jti, userID, deviceID, fingerprint string) (bool, error) {
	if g.redis == nil {
		return false, fmt.Errorf("redis not connected")
	}

	// Check concurrent refresh guard
	concurrentKey := fmt.Sprintf("concurrent_refresh:%s", oldRefreshToken)
	concurrentVal, err := g.redis.Get(ctx, concurrentKey).Result()
	if err == nil && concurrentVal != "" {
		// Another refresh in progress — revoke everything
		g.redis.Del(ctx, fmt.Sprintf("refresh_token:%s", oldRefreshToken))
		g.redis.Del(ctx, concurrentKey)
		return false, fmt.Errorf("CONCURRENT_REFRESH")
	}

	// Get current token data
	tokenKey := fmt.Sprintf("refresh_token:%s", oldRefreshToken)
	data, err := g.redis.Get(ctx, tokenKey).Result()
	if err != nil {
		return false, fmt.Errorf("TOKEN_NOT_FOUND")
	}

	var tokenData map[string]interface{}
	if err := json.Unmarshal([]byte(data), &tokenData); err != nil {
		return false, fmt.Errorf("TOKEN_PARSE_ERROR")
	}

	// Check device ID match
	if deviceID != "" {
		if existingDev, ok := tokenData["deviceId"].(string); ok && existingDev != "" && existingDev != deviceID {
			g.redis.Del(ctx, tokenKey)
			return false, fmt.Errorf("DEVICE_MISMATCH")
		}
	}

	// Check JTI replay
	if oldJTI, ok := tokenData["jti"].(string); ok && oldJTI != "" {
		usedKey := fmt.Sprintf("used_jti:%s", oldJTI)
		if exists, _ := g.redis.Exists(ctx, usedKey).Result(); exists > 0 {
			g.redis.Del(ctx, tokenKey)
			return false, fmt.Errorf("REPLAY_ATTACK")
		}
	}

	// Mark refresh in progress
	now := time.Now().UnixMilli()
	g.redis.Set(ctx, concurrentKey, fmt.Sprintf("%d", now), 5*time.Second)

	// Mark old JTI as used
	if oldJTI, ok := tokenData["jti"].(string); ok && oldJTI != "" {
		g.redis.Set(ctx, fmt.Sprintf("used_jti:%s", oldJTI), "1", g.tokenTTL)
	}

	// Delete old refresh token
	g.redis.Del(ctx, tokenKey)

	// Store new token data
	newData, _ := json.Marshal(map[string]interface{}{
		"userId":      userID,
		"deviceId":    deviceID,
		"fingerprint": fingerprint,
		"jti":         jti,
		"exp":         now + int64(g.tokenTTL/time.Millisecond),
	})
	newTokenKey := fmt.Sprintf("refresh_token:%s", newRefreshToken)
	g.redis.Set(ctx, newTokenKey, newData, g.tokenTTL)

	// Mark new JTI as used
	g.redis.Set(ctx, fmt.Sprintf("used_jti:%s", jti), "1", g.tokenTTL)

	// Clean concurrent guard
	g.redis.Del(ctx, concurrentKey)

	return true, nil
}

// detectConcurrentRefresh checks for concurrent refresh attacks.
func (g *TokenRefreshGuard) detectConcurrentRefresh(ctx context.Context, userID, refreshToken string) (bool, error) {
	if g.redis == nil {
		return false, nil
	}
	key := fmt.Sprintf("refresh_attempts:%s", userID)
	attempts, err := g.redis.LRange(ctx, key, 0, -1).Result()
	if err != nil {
		return false, err
	}

	now := time.Now().UnixMilli()
	windowMs := int64(5000)
	recentTokens := make(map[string]bool)
	recentCount := 0

	for _, attempt := range attempts {
		var data map[string]interface{}
		if json.Unmarshal([]byte(attempt), &data) != nil {
			continue
		}
		ts, _ := data["timestamp"].(float64)
		if int64(ts) > now-windowMs {
			recentCount++
			if tok, ok := data["token"].(string); ok {
				recentTokens[tok] = true
			}
		}
	}

	if recentCount >= 2 && len(recentTokens) >= 2 {
		return true, nil
	}

	// Record this attempt
	currentAttempt, _ := json.Marshal(map[string]interface{}{
		"token":     refreshToken,
		"timestamp": now,
	})
	g.redis.LPush(ctx, key, currentAttempt)
	g.redis.LTrim(ctx, key, 0, 9)
	g.redis.Expire(ctx, key, 5*time.Second)

	return false, nil
}

// revokeAllUserTokens revokes all refresh tokens for a user.
func (g *TokenRefreshGuard) revokeAllUserTokens(ctx context.Context, userID string) int {
	if g.redis == nil {
		return 0
	}
	pattern := "refresh_token:*"
	var cursor uint64
	count := 0
	for {
		keys, nextCursor, err := g.redis.Scan(ctx, cursor, pattern, 100).Result()
		if err != nil {
			break
		}
		for _, key := range keys {
			data, err := g.redis.Get(ctx, key).Result()
			if err != nil {
				continue
			}
			var td map[string]interface{}
					if json.Unmarshal([]byte(data), &td) != nil {
				continue
			}
			if uid, ok := td["userId"].(string); ok && uid == userID {
				g.redis.Del(ctx, key)
				if jti, ok := td["jti"].(string); ok && jti != "" {
					g.redis.Del(ctx, fmt.Sprintf("used_jti:%s", jti))
				}
				count++
			}
		}
		cursor = nextCursor
		if cursor == 0 {
			break
		}
	}
	g.logger.Warn("all user tokens revoked", zap.String("userId", userID), zap.Int("count", count))
	return count
}

// recordRefreshAttempt logs a refresh attempt for auditing.
func (g *TokenRefreshGuard) recordRefreshAttempt(ctx context.Context, attempt TokenRefreshAttempt, success, revoked bool, reason string) {
	if g.redis == nil {
		return
	}
	log := RefreshAuditLog{
		UserID:       attempt.UserID,
		RefreshToken: truncateToken(attempt.RefreshToken),
		DeviceID:     attempt.DeviceID,
		Fingerprint:  attempt.Fingerprint,
		IP:           attempt.IP,
		Success:      success,
		Revoked:      revoked,
		Timestamp:    time.Now().UnixMilli(),
		Reason:       reason,
	}
	encoded, _ := json.Marshal(log)
	key := fmt.Sprintf("refresh_audit:%s", attempt.UserID)
	g.redis.LPush(ctx, key, encoded)
	g.redis.LTrim(ctx, key, 0, 99)
	g.redis.Expire(ctx, key, g.auditTTL)
}

// GetRefreshAuditLog returns recent refresh audit entries.
func (g *TokenRefreshGuard) GetRefreshAuditLog(ctx context.Context, userID string, limit int64) ([]RefreshAuditLog, error) {
	if g.redis == nil {
		return nil, nil
	}
	if limit <= 0 {
		limit = 20
	}
	key := fmt.Sprintf("refresh_audit:%s", userID)
	logs, err := g.redis.LRange(ctx, key, 0, limit-1).Result()
	if err != nil {
		return nil, err
	}
	result := make([]RefreshAuditLog, 0, len(logs))
	for _, log := range logs {
		var entry RefreshAuditLog
		if json.Unmarshal([]byte(log), &entry) == nil {
			result = append(result, entry)
		}
	}
	return result, nil
}

// BlacklistToken adds a token to the blacklist.
func (g *TokenRefreshGuard) BlacklistToken(ctx context.Context, token string, expiresAt int64) error {
	if g.redis == nil {
		return nil
	}
	ttl := time.Duration(expiresAt-time.Now().UnixMilli()) * time.Millisecond
	if ttl <= 0 {
		return nil
	}
	return g.redis.Set(ctx, fmt.Sprintf("blacklist:%s", token), "1", ttl).Err()
}

// IsTokenBlacklisted checks if a token is in the blacklist.
func (g *TokenRefreshGuard) IsTokenBlacklisted(ctx context.Context, token string) (bool, error) {
	if g.redis == nil {
		return false, nil
	}
	exists, err := g.redis.Exists(ctx, fmt.Sprintf("blacklist:%s", token)).Result()
	if err != nil {
		return false, err
	}
	return exists > 0, nil
}

func truncateToken(token string) string {
	if len(token) <= 8 {
		return token
	}
	return token[:8] + "..."
}

// unused import guard
var _ = strings.Contains
