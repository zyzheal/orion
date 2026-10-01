package service

import (
	"context"
	"crypto/rand"
	"encoding/hex"
	"fmt"
	"time"

	"github.com/golang-jwt/jwt/v5"
	"github.com/redis/go-redis/v9"
	"go.uber.org/zap"
)

// TokenPair holds a complete access+refresh token pair.
type TokenPair struct {
	AccessToken         string `json:"accessToken"`
	RefreshToken        string `json:"refreshToken"`
	ExpiresIn           int    `json:"expiresIn"`
	RefreshTokenExpiresIn int `json:"refreshTokenExpiresIn"`
	AnomalousLogin      *AnomalousLoginEvent `json:"anomalousLogin,omitempty"`
}

// TokenPayload holds the JWT claims data.
type TokenPayload struct {
	UserID      string
	Email       string
	Roles       []string
	Permissions []string
	DeviceID    string
}

// RefreshTokenData is the stored refresh token record.
type RefreshTokenData struct {
	UserID      string `json:"userId"`
	DeviceID    string `json:"deviceId,omitempty"`
	Fingerprint string `json:"fingerprint,omitempty"`
	JTI         string `json:"jti"`
	Exp         int64  `json:"exp"`
}

// TokenService manages JWT access tokens and refresh tokens.
type TokenService struct {
	redis       *redis.Client
	jwtSecret   string
	jwtExpiry   time.Duration
	refreshExpiry time.Duration
	deviceFP    *DeviceFingerprintService
	refreshGuard *TokenRefreshGuard
	logger      *zap.Logger
}

// NewTokenService creates a token service.
func NewTokenService(rdb *redis.Client, jwtSecret string, logger *zap.Logger) *TokenService {
	deviceFP := NewDeviceFingerprintService(rdb)
	guard := NewTokenRefreshGuard(rdb, deviceFP, logger)
	return &TokenService{
		redis:         rdb,
		jwtSecret:     jwtSecret,
		jwtExpiry:      24 * time.Hour,
		refreshExpiry:  7 * 24 * time.Hour,
		deviceFP:       deviceFP,
		refreshGuard:   guard,
		logger:         logger,
	}
}

// GenerateDeviceFingerprint creates a fingerprint from device info.
func (s *TokenService) GenerateDeviceFingerprint(userAgent, ip, deviceID string) string {
	return s.deviceFP.GenerateFingerprint(DeviceInfo{
		UserAgent: userAgent,
		IP:        ip,
		DeviceID:  deviceID,
	})
}

// GenerateAccessToken creates a signed JWT access token.
func (s *TokenService) GenerateAccessToken(payload TokenPayload) (string, error) {
	claims := jwt.MapClaims{
		"sub":         payload.UserID,
		"email":       payload.Email,
		"roles":       payload.Roles,
		"permissions": payload.Permissions,
		"deviceId":    payload.DeviceID,
		"iat":         time.Now().Unix(),
		"exp":         time.Now().Add(s.jwtExpiry).Unix(),
	}
	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	return token.SignedString([]byte(s.jwtSecret))
}

// GenerateRefreshToken creates a refresh token and stores it in Redis.
func (s *TokenService) GenerateRefreshToken(ctx context.Context, userID, deviceID, fingerprint string) (string, string, int64, error) {
	jti := generateID()
	refreshToken := generateID() + generateID()
	expiresAt := time.Now().Add(s.refreshExpiry).UnixMilli()

	tokenData := RefreshTokenData{
		UserID:      userID,
		DeviceID:    deviceID,
		Fingerprint: fingerprint,
		JTI:         jti,
		Exp:         expiresAt,
	}

	if s.redis != nil {
		key := fmt.Sprintf("refresh_token:%s", refreshToken)
		data, _ := jsonMarshalToken(tokenData)
		if err := s.redis.Set(ctx, key, data, s.refreshExpiry).Err(); err != nil {
			return "", "", 0, err
		}
		jtiKey := fmt.Sprintf("used_jti:%s", jti)
		s.redis.Set(ctx, jtiKey, "1", s.refreshExpiry)
	}

	return refreshToken, jti, expiresAt, nil
}

// GenerateTokenPair creates a complete token pair for a user.
func (s *TokenService) GenerateTokenPair(ctx context.Context, payload TokenPayload, userAgent, ip, deviceID string) (*TokenPair, error) {
	fingerprint := s.GenerateDeviceFingerprint(userAgent, ip, deviceID)

	accessToken, err := s.GenerateAccessToken(payload)
	if err != nil {
		return nil, fmt.Errorf("generate access token: %w", err)
	}

	refreshToken, _, _, err := s.GenerateRefreshToken(ctx, payload.UserID, deviceID, fingerprint)
	if err != nil {
		return nil, fmt.Errorf("generate refresh token: %w", err)
	}

	// Store device fingerprint
	if s.redis != nil && fingerprint != "" {
		s.deviceFP.StoreFingerprint(ctx, payload.UserID, fingerprint, DeviceInfo{
			UserAgent: userAgent,
			IP:        ip,
			DeviceID:  deviceID,
		})
	}

	// Check for anomalous login
	var anomalous *AnomalousLoginEvent
	if s.redis != nil && fingerprint != "" {
		isNew, _ := s.deviceFP.IsNewDevice(ctx, payload.UserID, fingerprint)
		if !isNew && ip != "" {
			anomalous, _ = s.deviceFP.DetectAnomalousLogin(ctx, payload.UserID, fingerprint, ip)
		}
	}

	return &TokenPair{
		AccessToken:           accessToken,
		RefreshToken:          refreshToken,
		ExpiresIn:             int(s.jwtExpiry.Seconds()),
		RefreshTokenExpiresIn: int(s.refreshExpiry.Seconds()),
		AnomalousLogin:        anomalous,
	}, nil
}

// RefreshTokens validates a refresh token and generates a new pair.
func (s *TokenService) RefreshTokens(ctx context.Context, refreshToken, ip, userAgent, deviceID string) (*TokenPair, error) {
	if s.redis == nil {
		return nil, fmt.Errorf("redis not connected")
	}

	// Check blacklist
	blacklisted, _ := s.refreshGuard.IsTokenBlacklisted(ctx, refreshToken)
	if blacklisted {
		return nil, fmt.Errorf("token is blacklisted")
	}

	// Get token data
	key := fmt.Sprintf("refresh_token:%s", refreshToken)
	data, err := s.redis.Get(ctx, key).Result()
	if err != nil {
		return nil, fmt.Errorf("invalid refresh token")
	}

	var tokenData RefreshTokenData
	if jsonUnmarshalToken(data, &tokenData) != nil {
		return nil, fmt.Errorf("invalid token data")
	}

	// Generate new fingerprint
	fingerprint := s.GenerateDeviceFingerprint(userAgent, ip, deviceID)

	// Use refresh guard
	attempt := TokenRefreshAttempt{
		RefreshToken: refreshToken,
		UserID:       tokenData.UserID,
		DeviceID:     deviceID,
		Fingerprint:  fingerprint,
		IP:           ip,
		UserAgent:    userAgent,
	}

	result, err := s.refreshGuard.HandleRefresh(ctx, attempt, func() (string, string, string, error) {
		newRefresh, newJTI, _, err := s.GenerateRefreshToken(ctx, tokenData.UserID, deviceID, fingerprint)
		if err != nil {
			return "", "", "", err
		}
		access, err := s.GenerateAccessToken(TokenPayload{
			UserID:   tokenData.UserID,
			DeviceID: deviceID,
		})
		if err != nil {
			return "", "", "", err
		}
		return access, newRefresh, newJTI, nil
	})

	if err != nil {
		return nil, err
	}
	if !result.Success {
		return nil, fmt.Errorf("refresh failed")
	}

	return &TokenPair{
		AccessToken:           result.AccessToken,
		RefreshToken:          result.RefreshToken,
		ExpiresIn:             result.ExpiresIn,
		RefreshTokenExpiresIn: result.RefreshTokenExpiresIn,
		AnomalousLogin:        result.AnomalousLogin,
	}, nil
}

// ValidateRefreshToken checks if a refresh token is valid.
func (s *TokenService) ValidateRefreshToken(ctx context.Context, refreshToken string) (*RefreshTokenData, error) {
	if s.redis == nil {
		return nil, fmt.Errorf("redis not connected")
	}

	blacklisted, _ := s.refreshGuard.IsTokenBlacklisted(ctx, refreshToken)
	if blacklisted {
		return nil, fmt.Errorf("token blacklisted")
	}

	key := fmt.Sprintf("refresh_token:%s", refreshToken)
	data, err := s.redis.Get(ctx, key).Result()
	if err != nil {
		return nil, fmt.Errorf("invalid refresh token")
	}

	var tokenData RefreshTokenData
	if jsonUnmarshalToken(data, &tokenData) != nil {
		return nil, fmt.Errorf("invalid token data")
	}

	if tokenData.Exp < time.Now().UnixMilli() {
		s.RevokeToken(ctx, refreshToken)
		return nil, fmt.Errorf("token expired")
	}

	return &tokenData, nil
}

// RevokeToken revokes a refresh token (for logout).
func (s *TokenService) RevokeToken(ctx context.Context, refreshToken string) error {
	if s.redis == nil {
		return nil
	}
	key := fmt.Sprintf("refresh_token:%s", refreshToken)
	data, err := s.redis.Get(ctx, key).Result()
	if err != nil {
		return nil
	}

	var tokenData RefreshTokenData
	if jsonUnmarshalToken(data, &tokenData) == nil {
		jtiKey := fmt.Sprintf("used_jti:%s", tokenData.JTI)
		s.redis.Del(ctx, jtiKey)
		s.refreshGuard.BlacklistToken(ctx, refreshToken, tokenData.Exp)
	}
	return s.redis.Del(ctx, key).Err()
}

// RevokeAllUserTokens revokes all tokens for a user (forced logout).
func (s *TokenService) RevokeAllUserTokens(ctx context.Context, userID string) {
	s.refreshGuard.revokeAllUserTokens(ctx, userID)
	if s.deviceFP != nil {
		s.deviceFP.RemoveAllDevices(ctx, userID)
	}
}

// IsTokenBlacklisted checks if a token is blacklisted.
func (s *TokenService) IsTokenBlacklisted(ctx context.Context, token string) (bool, error) {
	return s.refreshGuard.IsTokenBlacklisted(ctx, token)
}

// GetUserDevices returns all devices for a user.
func (s *TokenService) GetUserDevices(ctx context.Context, userID string) ([]DeviceFingerprintData, error) {
	return s.deviceFP.GetUserDevices(ctx, userID)
}

// RemoveDevice removes a device fingerprint.
func (s *TokenService) RemoveDevice(ctx context.Context, userID, fingerprint string) error {
	return s.deviceFP.RemoveFingerprint(ctx, userID, fingerprint)
}

// GetRefreshAuditLog returns the refresh audit log.
func (s *TokenService) GetRefreshAuditLog(ctx context.Context, userID string, limit int64) ([]RefreshAuditLog, error) {
	return s.refreshGuard.GetRefreshAuditLog(ctx, userID, limit)
}

// --- helpers ---

func generateID() string {
	b := make([]byte, 16)
	_, _ = rand.Read(b)
	return hex.EncodeToString(b)
}

func jsonMarshalToken(v interface{}) ([]byte, error) {
	return jsonMarshal(v)
}

func jsonUnmarshalToken(data string, v interface{}) error {
	jsonUnmarshal(data, v)
	return nil
}
