package service

import (
	"crypto/rand"
	"crypto/rsa"
	"errors"
	"fmt"
	"time"

	"github.com/golang-jwt/jwt/v5"
)

// JWTService handles JWT token generation and validation.
// Access tokens use RS256 (asymmetric), refresh tokens use HS256 (symmetric).
type JWTService struct {
	// RS256 for access tokens (nil = fallback to HS256)
	privateKey *rsa.PrivateKey
	publicKey  *rsa.PublicKey
	// HS256 for refresh tokens and backward compatibility
	secret            []byte
	expiration        time.Duration // Access token TTL (default 5min)
	refreshExpiration time.Duration // Refresh token TTL (default 7d)
}

// NewJWTService creates a JWTService with HS256 only (legacy mode).
func NewJWTService(secret string, expiration, refreshExpiration time.Duration) *JWTService {
	return &JWTService{
		secret:            []byte(secret),
		expiration:        expiration,
		refreshExpiration: refreshExpiration,
	}
}

// NewJWTServiceWithRS256 creates a JWTService with RS256 for access tokens.
// Access tokens are signed with RS256 private key, validated with public key.
// Refresh tokens continue to use HS256.
func NewJWTServiceWithRS256(privateKey *rsa.PrivateKey, publicKey *rsa.PublicKey, hs256Secret string, expiration, refreshExpiration time.Duration) *JWTService {
	return &JWTService{
		privateKey:        privateKey,
		publicKey:         publicKey,
		secret:            []byte(hs256Secret),
		expiration:        expiration,
		refreshExpiration: refreshExpiration,
	}
}

type TokenPair struct {
	AccessToken  string `json:"access_token"`
	RefreshToken string `json:"refresh_token"`
	ExpiresIn    int    `json:"expires_in"`
	TokenType    string `json:"token_type"`
	JTI          string `json:"-"`
}

type Claims struct {
	jwt.RegisteredClaims
	TenantID string   `json:"tenant_id"`
	Role     string   `json:"role"`
	Roles    []string `json:"roles,omitempty"`
	JTI      string   `json:"jti"`
	DeviceID string   `json:"device_id,omitempty"`
}

func (s *JWTService) GenerateTokens(userID, tenantID, role string, deviceID ...string) (*TokenPair, error) {
	now := time.Now()
	jti := generateUUID()
	devID := ""
	if len(deviceID) > 0 {
		devID = deviceID[0]
	}

	accessClaims := &Claims{
		RegisteredClaims: jwt.RegisteredClaims{
			Subject:   userID,
			IssuedAt:  jwt.NewNumericDate(now),
			ExpiresAt: jwt.NewNumericDate(now.Add(s.expiration)),
			ID:        jti,
		},
		TenantID: tenantID,
		Role:     role,
		JTI:      jti,
		DeviceID: devID,
	}

	refreshClaims := &Claims{
		RegisteredClaims: jwt.RegisteredClaims{
			Subject:   userID,
			IssuedAt:  jwt.NewNumericDate(now),
			ExpiresAt: jwt.NewNumericDate(now.Add(s.refreshExpiration)),
			ID:        generateUUID(),
		},
		TenantID: tenantID,
		Role:     role,
		JTI:      jti + "-refresh",
		DeviceID: devID,
	}

	// Access token: RS256 if key available, else HS256
	var accessStr string
	var err error
	if s.privateKey != nil {
		accessToken := jwt.NewWithClaims(jwt.SigningMethodRS256, accessClaims)
		accessStr, err = accessToken.SignedString(s.privateKey)
	} else {
		accessToken := jwt.NewWithClaims(jwt.SigningMethodHS256, accessClaims)
		accessStr, err = accessToken.SignedString(s.secret)
	}
	if err != nil {
		return nil, fmt.Errorf("failed to sign access token: %w", err)
	}

	// Refresh token: always HS256
	refreshToken := jwt.NewWithClaims(jwt.SigningMethodHS256, refreshClaims)
	refreshStr, err := refreshToken.SignedString(s.secret)
	if err != nil {
		return nil, fmt.Errorf("failed to sign refresh token: %w", err)
	}

	return &TokenPair{
		AccessToken:  accessStr,
		RefreshToken: refreshStr,
		ExpiresIn:    int(s.expiration.Seconds()),
		TokenType:    "Bearer",
		JTI:          jti,
	}, nil
}

// ValidateToken validates an access token. Supports both RS256 and HS256 (dual-algorithm).
func (s *JWTService) ValidateToken(tokenString string) (*Claims, error) {
	token, err := jwt.ParseWithClaims(tokenString, &Claims{}, func(token *jwt.Token) (interface{}, error) {
		switch token.Method.(type) {
		case *jwt.SigningMethodRSA:
			if s.publicKey == nil {
				return nil, fmt.Errorf("RS256 public key not configured")
			}
			return s.publicKey, nil
		case *jwt.SigningMethodHMAC:
			return s.secret, nil
		default:
			return nil, fmt.Errorf("unexpected signing method: %v", token.Header["alg"])
		}
	})

	if err != nil {
		return nil, fmt.Errorf("invalid token: %w", err)
	}

	claims, ok := token.Claims.(*Claims)
	if !ok {
		return nil, errors.New("invalid token claims")
	}

	return claims, nil
}

// ValidateRefreshToken validates a refresh token (HS256 only).
func (s *JWTService) ValidateRefreshToken(tokenString string) (*Claims, error) {
	token, err := jwt.ParseWithClaims(tokenString, &Claims{}, func(token *jwt.Token) (interface{}, error) {
		if _, ok := token.Method.(*jwt.SigningMethodHMAC); !ok {
			return nil, fmt.Errorf("refresh token must use HS256")
		}
		return s.secret, nil
	})

	if err != nil {
		return nil, fmt.Errorf("invalid refresh token: %w", err)
	}

	claims, ok := token.Claims.(*Claims)
	if !ok {
		return nil, errors.New("invalid token claims")
	}

	return claims, nil
}

// generateUUID generates a cryptographically random UUID v4.
func generateUUID() string {
	b := make([]byte, 16)
	_, _ = rand.Read(b)
	// Set version 4 and variant 10xx
	b[6] = (b[6] & 0x0f) | 0x40
	b[8] = (b[8] & 0x3f) | 0x80
	return fmt.Sprintf("%x-%x-%x-%x-%x", b[0:4], b[4:6], b[6:8], b[8:10], b[10:])
}
