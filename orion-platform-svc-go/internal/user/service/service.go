package service

//go:generate mockgen -destination=mock_service.go -package=service . ServiceInterface
//go:generate mockgen -destination=mock_repository.go -package=service . RepositoryInterface

import (
	"context"
	"errors"
	"fmt"
	"time"

	"orion/platform-svc-go/internal/user/models"

	"orion/go-common/pkg/sentinel"

	"github.com/google/uuid"
	"golang.org/x/crypto/bcrypt"
)

// RepositoryInterface defines the repository methods used by the service.
type RepositoryInterface interface {
	Count(ctx context.Context, tenantID string) (int, error)
	Create(ctx context.Context, user *models.User) error
	Delete(ctx context.Context, tenantID, id string) error
	GetByID(ctx context.Context, tenantID, id string) (*models.User, error)
	GetByUsername(ctx context.Context, username string) (*models.User, error)
	List(ctx context.Context, tenantID string, filter *models.GetUserFilters, offset, limit int) ([]models.User, error)
	Update(ctx context.Context, tenantID, id string, updates map[string]interface{}) error
	UpdatePassword(ctx context.Context, id string, newPasswordHash string) error
}

// Service provides user management business logic.
type Service struct {
	repo RepositoryInterface
}

var ErrInvalidPassword = errors.New("invalid password")

// NewService creates a new Service instance.
func NewService(repo RepositoryInterface) *Service {
	return &Service{repo: repo}
}

// CreateUserResponse contains the result of user creation.
type CreateUserResponse struct {
	ID        string    `json:"id"`
	Username  string    `json:"username"`
	Email     string    `json:"email"`
	FullName  string    `json:"full_name"`
	Role      string    `json:"role"`
	Status    string    `json:"status"`
	CreatedAt time.Time `json:"created_at"`
}

// Create creates a new user.
func (s *Service) Create(ctx context.Context, tenantID, creatorID string, req *models.CreateUserRequest) (*CreateUserResponse, error) {
	if req.Username == "" {
		return nil, fmt.Errorf("username is required")
	}
	if req.Email == "" {
		return nil, fmt.Errorf("email is required")
	}
	if req.Password == "" {
		return nil, fmt.Errorf("password is required")
	}

	hashed, err := bcrypt.GenerateFromPassword([]byte(req.Password), bcrypt.DefaultCost)
	if err != nil {
		return nil, fmt.Errorf("failed to hash password: %w", err)
	}

	now := time.Now()
	u := &models.User{
		ID:        uuid.New().String(),
		TenantID:  tenantID,
		Username:  req.Username,
		Email:     req.Email,
		FullName:  req.FullName,
		Role:      req.Role,
		Status:    "active",
		Password:  string(hashed),
		CreatedAt: now,
		UpdatedAt: now,
	}

	if err := s.repo.Create(ctx, u); err != nil {
		return nil, fmt.Errorf("failed to create user: %w", err)
	}

	return &CreateUserResponse{
		ID: u.ID, Username: u.Username, Email: u.Email,
		FullName: u.FullName, Role: u.Role, Status: u.Status,
		CreatedAt: u.CreatedAt,
	}, nil
}

// Authenticate verifies credentials and returns the user.
func (s *Service) Authenticate(ctx context.Context, req *models.AuthenticateRequest) (*models.User, error) {
	if req.Username == "" {
		return nil, ErrInvalidPassword
	}

	user, err := s.repo.GetByUsername(ctx, req.Username)
	if err != nil {
		return nil, ErrInvalidPassword
	}

	if user.Status != "active" {
		return nil, ErrInvalidPassword
	}

	err = bcrypt.CompareHashAndPassword([]byte(user.Password), []byte(req.Password))
	if err != nil {
		return nil, ErrInvalidPassword
	}

	return user, nil
}

// List retrieves users for a tenant with optional filters and pagination.
func (s *Service) List(ctx context.Context, tenantID string, filter *models.GetUserFilters, offset, limit int) ([]models.User, error) {
	users, err := s.repo.List(ctx, tenantID, filter, offset, limit)
	if err != nil {
		return nil, fmt.Errorf("failed to list users: %w", err)
	}
	// Strip password from response
	for i := range users {
		users[i].Password = ""
	}
	return users, nil
}

// GetByID retrieves a user by id.
func (s *Service) GetByID(ctx context.Context, tenantID, id string) (*models.User, error) {
	user, err := s.repo.GetByID(ctx, tenantID, id)
	if err != nil {
		return nil, err
	}
	user.Password = ""
	return user, nil
}

// Count returns the total number of users for a tenant.
func (s *Service) Count(ctx context.Context, tenantID string) (int, error) {
	return s.repo.Count(ctx, tenantID)
}

// Update modifies an existing user.
func (s *Service) Update(ctx context.Context, tenantID, id string, req *models.UpdateUserRequest) (*models.User, error) {
	updates := make(map[string]interface{})
	if req.FullName != nil {
		updates["full_name"] = *req.FullName
	}
	if req.Email != nil {
		updates["email"] = *req.Email
	}
	if req.Role != nil {
		updates["role"] = *req.Role
	}
	if req.Status != nil {
		updates["status"] = *req.Status
	}
	if req.AvatarURL != nil {
		updates["avatar_url"] = *req.AvatarURL
	}
	if req.Settings != nil {
		updates["settings"] = *req.Settings
	}

	if len(updates) == 0 {
		user, err := s.repo.GetByID(ctx, tenantID, id)
		if err != nil {
			return nil, err
		}
		user.Password = ""
		return user, nil
	}

	if err := s.repo.Update(ctx, tenantID, id, updates); err != nil {
		return nil, fmt.Errorf("failed to update user: %w", err)
	}

	user, err := s.repo.GetByID(ctx, tenantID, id)
	if err != nil {
		return nil, err
	}
	user.Password = ""
	return user, nil
}

// ChangePassword updates a user's password.
func (s *Service) ChangePassword(ctx context.Context, tenantID, userID string, req *models.ChangePasswordRequest) error {
	if req.OldPassword == "" || req.NewPassword == "" {
		return fmt.Errorf("old and new password are required")
	}

	user, err := s.repo.GetByID(ctx, tenantID, userID)
	if err != nil {
		return sentinel.NotFound
	}

	if err := bcrypt.CompareHashAndPassword([]byte(user.Password), []byte(req.OldPassword)); err != nil {
		return ErrInvalidPassword
	}

	hashed, err := bcrypt.GenerateFromPassword([]byte(req.NewPassword), bcrypt.DefaultCost)
	if err != nil {
		return fmt.Errorf("failed to hash new password: %w", err)
	}

	return s.repo.UpdatePassword(ctx, userID, string(hashed))
}

// Delete removes a user by id.
func (s *Service) Delete(ctx context.Context, tenantID, id string) error {
	if _, err := s.repo.GetByID(ctx, tenantID, id); err != nil {
		return sentinel.NotFound
	}
	return s.repo.Delete(ctx, tenantID, id)
}
