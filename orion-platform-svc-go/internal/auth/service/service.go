package service

import (
	"context"
	"crypto/rand"
	"crypto/sha256"
	"encoding/hex"
	"errors"
	"fmt"
	"net/url"
	"time"

	"orion/platform-svc-go/internal/auth/models"
	auth_repo "orion/platform-svc-go/internal/auth/repository"
	user_models "orion/platform-svc-go/internal/user/models"
	user_repo "orion/platform-svc-go/internal/user/repository"

	"github.com/golang-jwt/jwt/v5"
	"github.com/google/uuid"
	"golang.org/x/crypto/bcrypt"
)

const (
	accessTokenExpiry  = 5 * time.Minute
	refreshTokenExpiry = 7 * 24 * time.Hour
	bcryptCost         = 12
)

var (
	ErrInvalidCredentials  = errors.New("invalid username or password")
	ErrUserDisabled        = errors.New("account is disabled")
	ErrUserSuspended       = errors.New("account is suspended")
	ErrInvalidRefreshToken = errors.New("invalid or expired refresh token")
	ErrUsernameExists      = errors.New("username already exists")
	ErrTenantAccessDenied  = errors.New("user does not have access to the specified tenant")
	ErrMultipleTenants     = errors.New("user belongs to multiple tenants, specify X-Tenant-ID header")
	ErrPasswordTooShort    = errors.New("password must be at least 8 characters")
	ErrUserNotFound        = errors.New("user not found")
)

// UserRepository defines the user persistence contract.
type UserRepository interface {
	GetByUsername(ctx context.Context, username string) (*user_models.User, error)
	Create(ctx context.Context, user *user_models.User) error
	GetByID(ctx context.Context, tenantID, id string) (*user_models.User, error)
}

// AuthRepository defines the auth persistence contract.
type AuthRepository interface {
	Create(ctx context.Context, rt *models.RefreshToken) error
	FindByHash(ctx context.Context, tokenHash string) (*auth_repo.RefreshTokenRow, error)
	DeleteByHash(ctx context.Context, tokenHash string) error
	FindTenantsByUserID(ctx context.Context, userID string) ([]string, error)
}

// passwordHasher abstracts password hashing for testability.
type passwordHasher interface {
	hash(password string) (string, error)
	compare(password, hash string) error
}

type bcryptHasher struct{}

func (bcryptHasher) hash(password string) (string, error) {
	b, err := bcrypt.GenerateFromPassword([]byte(password), bcryptCost)
	return string(b), err
}

func (bcryptHasher) compare(password, hash string) error {
	return bcrypt.CompareHashAndPassword([]byte(hash), []byte(password))
}

// Service provides authentication business logic.
type Service struct {
	authRepo  AuthRepository
	userRepo  UserRepository
	jwtSecret string
	hasher    passwordHasher
}

// NewService creates a new Service instance.
func NewService(authRepo *auth_repo.Repository, userRepo *user_repo.Repository, jwtSecret string) *Service {
	return &Service{
		authRepo:  authRepo,
		userRepo:  userRepo,
		jwtSecret: jwtSecret,
	}
}

func (s *Service) getHasher() passwordHasher {
	if s.hasher != nil {
		return s.hasher
	}
	return bcryptHasher{}
}

// Register creates a new user account.
func (s *Service) Register(ctx context.Context, req *models.RegisterRequest, requestedTenantID string) (*models.RegisterResponse, error) {
	if req.Username == "" || req.Password == "" {
		return nil, fmt.Errorf("username and password are required")
	}
	if len(req.Password) < 8 {
		return nil, ErrPasswordTooShort
	}

	existing, err := s.userRepo.GetByUsername(ctx, req.Username)
	if err == nil && existing != nil {
		return nil, ErrUsernameExists
	}

	hashedPassword, err := s.getHasher().hash(req.Password)
	if err != nil {
		return nil, fmt.Errorf("failed to hash password: %w", err)
	}

	now := time.Now()
	user := &user_models.User{
		ID:        uuid.New().String(),
		Username:  req.Username,
		Email:     req.Email,
		Password:  string(hashedPassword),
		Role:      "user",
		Status:    "active",
		CreatedAt: now,
		UpdatedAt: now,
	}

	if err := s.userRepo.Create(ctx, user); err != nil {
		return nil, fmt.Errorf("failed to create user: %w", err)
	}

	return &models.RegisterResponse{
		ID:       user.ID,
		Username: user.Username,
		Email:    user.Email,
		Role:     user.Role,
		Message:  "registration successful",
	}, nil
}

// Login authenticates a user and returns tokens.
func (s *Service) Login(ctx context.Context, req *models.LoginRequest, requestedTenantID string) (*models.LoginResponse, error) {
	if req.Username == "" || req.Password == "" {
		return nil, ErrInvalidCredentials
	}

	user, err := s.userRepo.GetByUsername(ctx, req.Username)
	if err != nil {
		return nil, ErrInvalidCredentials
	}

	switch user.Status {
	case "terminated", "deleted":
		return nil, ErrUserDisabled
	case "suspended":
		return nil, ErrUserSuspended
	}

	if err := s.getHasher().compare(req.Password, user.Password); err != nil {
		return nil, ErrInvalidCredentials
	}

	effectiveTenantID, err := s.resolveTenant(ctx, user.ID, requestedTenantID)
	if err != nil {
		return nil, err
	}

	accessToken, err := s.generateAccessToken(user.ID, user.Username, user.Role, effectiveTenantID)
	if err != nil {
		return nil, fmt.Errorf("failed to generate access token: %w", err)
	}

	refreshToken, tokenHash, err := generateRefreshToken()
	if err != nil {
		return nil, fmt.Errorf("failed to generate refresh token: %w", err)
	}

	now := time.Now()
	rt := &models.RefreshToken{
		ID:        uuid.New().String(),
		UserID:    user.ID,
		TokenHash: tokenHash,
		ExpiresAt: now.Add(refreshTokenExpiry),
		TenantID:  effectiveTenantID,
		CreatedAt: now,
	}
	if err := s.authRepo.Create(ctx, rt); err != nil {
		return nil, fmt.Errorf("failed to store refresh token: %w", err)
	}

	return &models.LoginResponse{
		AccessToken:  accessToken,
		RefreshToken: refreshToken,
		ExpiresAt:    now.Add(accessTokenExpiry).UnixMilli(),
		TenantID:     effectiveTenantID,
		User: models.UserInfo{
			ID:       user.ID,
			Username: user.Username,
			Email:    user.Email,
			Role:     user.Role,
			Avatar:   buildAvatarURL(user.Username),
		},
	}, nil
}

// Refresh validates a refresh token and issues new tokens.
func (s *Service) Refresh(ctx context.Context, req *models.RefreshRequest) (*models.RefreshResponse, error) {
	if req.RefreshToken == "" {
		return nil, ErrInvalidRefreshToken
	}

	tokenHash := hashToken(req.RefreshToken)
	row, err := s.authRepo.FindByHash(ctx, tokenHash)
	if err != nil {
		return nil, ErrInvalidRefreshToken
	}

	switch row.Status {
	case "terminated", "deleted":
		_ = s.authRepo.DeleteByHash(ctx, tokenHash)
		return nil, ErrUserDisabled
	case "suspended":
		_ = s.authRepo.DeleteByHash(ctx, tokenHash)
		return nil, ErrUserSuspended
	}

	// Token rotation: delete old, issue new
	if err := s.authRepo.DeleteByHash(ctx, tokenHash); err != nil {
		return nil, fmt.Errorf("failed to rotate refresh token: %w", err)
	}

	now := time.Now()

	accessToken, err := s.generateAccessToken(row.UserID, row.Username, row.Role, row.TenantID)
	if err != nil {
		return nil, fmt.Errorf("failed to generate access token: %w", err)
	}

	newRefreshToken, newTokenHash, err := generateRefreshToken()
	if err != nil {
		return nil, fmt.Errorf("failed to generate refresh token: %w", err)
	}

	rt := &models.RefreshToken{
		ID:        uuid.New().String(),
		UserID:    row.UserID,
		TokenHash: newTokenHash,
		ExpiresAt: now.Add(refreshTokenExpiry),
		TenantID:  row.TenantID,
		CreatedAt: now,
	}
	if err := s.authRepo.Create(ctx, rt); err != nil {
		return nil, fmt.Errorf("failed to store refresh token: %w", err)
	}

	return &models.RefreshResponse{
		AccessToken:  accessToken,
		RefreshToken: newRefreshToken,
		ExpiresAt:    now.Add(accessTokenExpiry).UnixMilli(),
		TenantID:     row.TenantID,
	}, nil
}

// Logout invalidates a refresh token.
func (s *Service) Logout(ctx context.Context, req *models.LogoutRequest) error {
	if req.RefreshToken != "" {
		tokenHash := hashToken(req.RefreshToken)
		_ = s.authRepo.DeleteByHash(ctx, tokenHash)
	}
	return nil
}

// GetProfile returns the current user's profile using JWT-derived IDs.
func (s *Service) GetProfile(ctx context.Context, tenantID, userID string) (*models.MeResponse, error) {
	user, err := s.userRepo.GetByID(ctx, tenantID, userID)
	if err != nil {
		return nil, ErrUserNotFound
	}

	tenants, _ := s.authRepo.FindTenantsByUserID(ctx, userID)
	if tenants == nil {
		tenants = []string{}
	}

	// Determine the current tenant ID
	currentTenantID := tenantID
	if currentTenantID == "" && len(tenants) > 0 {
		currentTenantID = tenants[0]
	}

	return &models.MeResponse{
		ID:              user.ID,
		Username:        user.Username,
		Email:           user.Email,
		FullName:        user.FullName,
		Role:            user.Role,
		Status:          user.Status,
		Avatar:          buildAvatarURL(user.Username),
		Tenants:         tenants,
		CurrentTenantID: currentTenantID,
	}, nil
}

func (s *Service) generateAccessToken(userID, username, role, tenantID string) (string, error) {
	now := time.Now()
	claims := jwt.MapClaims{
		"sub":      userID,
		"username": username,
		"role":     role,
		"roles":    []string{role},
		"status":   "active",
		"iat":      now.Unix(),
		"exp":      now.Add(accessTokenExpiry).Unix(),
	}
	if tenantID != "" {
		claims["tenant_id"] = tenantID
	}

	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	return token.SignedString([]byte(s.jwtSecret))
}

func (s *Service) resolveTenant(ctx context.Context, userID, requestedTenantID string) (string, error) {
	tenants, err := s.authRepo.FindTenantsByUserID(ctx, userID)
	if err != nil {
		return "", nil // Non-critical: proceed without tenant
	}
	if len(tenants) == 0 {
		return "", nil
	}
	if requestedTenantID != "" {
		for _, t := range tenants {
			if t == requestedTenantID {
				return requestedTenantID, nil
			}
		}
		return "", ErrTenantAccessDenied
	}
	if len(tenants) == 1 {
		return tenants[0], nil
	}
	return "", ErrMultipleTenants
}

func generateRefreshToken() (token, hash string, err error) {
	b := make([]byte, 32)
	if _, err := rand.Read(b); err != nil {
		return "", "", err
	}
	token = hex.EncodeToString(b)
	hash = hashToken(token)
	return token, hash, nil
}

func hashToken(token string) string {
	h := sha256.Sum256([]byte(token))
	return hex.EncodeToString(h[:])
}

func buildAvatarURL(username string) string {
	return fmt.Sprintf("https://ui-avatars.com/api/?name=%s&background=1890ff&color=fff",
		url.QueryEscape(username))
}
