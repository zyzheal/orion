package service

import (
	"errors"
	"fmt"
	"time"

	"github.com/golang-jwt/jwt/v5"
)

// JWTService handles JWT token generation and validation.
type JWTService struct {
	secret           []byte
	expiration       time.Duration
	refreshExpiration time.Duration
}

func NewJWTService(secret string, expiration, refreshExpiration time.Duration) *JWTService {
	return &JWTService{
		secret:           []byte(secret),
		expiration:       expiration,
		refreshExpiration: refreshExpiration,
	}
}

type TokenPair struct {
	AccessToken  string    `json:"access_token"`
	RefreshToken string    `json:"refresh_token"`
	ExpiresIn    int       `json:"expires_in"`
	TokenType    string    `json:"token_type"`
	JTI          string    `json:"-"`
}

type Claims struct {
	jwt.RegisteredClaims
	TenantID string `json:"tenant_id"`
	Role     string `json:"role"`
	JTI      string `json:"jti"`
}

func (s *JWTService) GenerateTokens(userID, tenantID, role string) (*TokenPair, error) {
	now := time.Now()
	jti := generateUUID()

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
	}

	accessToken := jwt.NewWithClaims(jwt.SigningMethodHS256, accessClaims)
	refreshToken := jwt.NewWithClaims(jwt.SigningMethodHS256, refreshClaims)

	accessStr, err := accessToken.SignedString(s.secret)
	if err != nil {
		return nil, fmt.Errorf("failed to sign access token: %w", err)
	}

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

func (s *JWTService) ValidateToken(tokenString string) (*Claims, error) {
	token, err := jwt.ParseWithClaims(tokenString, &Claims{}, func(token *jwt.Token) (interface{}, error) {
		if _, ok := token.Method.(*jwt.SigningMethodHMAC); !ok {
			return nil, fmt.Errorf("unexpected signing method: %v", token.Header["alg"])
		}
		return s.secret, nil
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

func (s *JWTService) ValidateRefreshToken(tokenString string) (*Claims, error) {
	return s.ValidateToken(tokenString)
}

func generateUUID() string {
	b := make([]byte, 16)
	for i := range b {
		b[i] = byte(i)
	}
	return fmt.Sprintf("%x-%x-%x-%x-%x", b[0:4], b[4:6], b[6:8], b[8:10], b[10:])
}
