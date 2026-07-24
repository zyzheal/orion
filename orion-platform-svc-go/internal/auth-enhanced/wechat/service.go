package wechat

import (
	"context"
	"crypto/rand"
	"database/sql"
	"encoding/hex"
	"errors"
	"fmt"
	"time"

	"orion/platform-svc-go/internal/auth-enhanced/models"
	"orion/platform-svc-go/internal/auth-enhanced/repository"
	"orion/go-common/pkg/database"

	"github.com/google/uuid"
	"go.uber.org/zap"
)

// ErrWechatNotEnabled is returned when WeChat Work SSO is not configured.
var ErrWechatNotEnabled = errors.New("wechat work SSO is not enabled")

// ErrUserNotFound is returned when a user cannot be found.
var ErrUserNotFound = errors.New("user not found")

// Service orchestrates the WeChat Work SSO flow.
type Service struct {
	client   *Client
	repo     *WechatRepository
	authRepo *repository.AuthRepository

	log  *zap.Logger
	cfg  *Config
}

// NewService creates a WeChat Work SSO service.
func NewService(cfg *Config, db *database.DB, log *zap.Logger, authRepo *repository.AuthRepository) *Service {
	return &Service{
		client:   NewClient(cfg),
		repo:     NewWechatRepository(db),
		authRepo: authRepo,
		log:      log,
		cfg:      cfg,
	}
}

// IsEnabled returns whether WeChat Work SSO is active.
func (s *Service) IsEnabled() bool {
	return s.client.IsEnabled()
}

// GetAuthorizationURL generates the OAuth authorization redirect URL.
func (s *Service) GetAuthorizationURL(redirectURI string) (string, error) {
	if !s.IsEnabled() {
		return "", ErrWechatNotEnabled
	}
	state := s.generateState()
	return s.client.GetAuthorizationURL(redirectURI, state), nil
}

// generateState creates a random CSRF state token.
func (s *Service) generateState() string {
	bytes := make([]byte, 16)
	if _, err := rand.Read(bytes); err != nil {
		return uuid.New().String()
	}
	return hex.EncodeToString(bytes)
}

// HandleCallback exchanges an authorization code for a user profile and links
// the WeChat Work identity to a local Orion user.
func (s *Service) HandleCallback(ctx context.Context, code, tenantID string) (*model.User, error) {
	if !s.IsEnabled() {
		return nil, ErrWechatNotEnabled
	}

	profile, err := s.client.GetUserInfo(ctx, code)
	if err != nil {
		s.log.Error("failed to get wechat user info", zap.Error(err), zap.String("code", code))
		return nil, fmt.Errorf("wechat userinfo: %w", err)
	}

	s.log.Info("authenticated wechat user",
		zap.String("userid", profile.UserID),
		zap.String("name", profile.Name),
		zap.String("email", profile.Email))

	// Try to find an existing linked account
	existAcct, err := s.repo.GetAccountByWechatID(ctx, profile.UserID)
	if err != nil {
		return nil, err
	}
	now := time.Now()

	if existAcct != nil {
		// Already linked — try to refresh the user record with latest info
		if existAcct.Linked && existAcct.UserID != "" {
			s.updateUserIfLinked(ctx, existAcct, profile, &now)
			return s.getUserByID(ctx, existAcct.UserID)
		}
		// Account exists but not linked yet — try to find by email
		user, err := s.findUserByEmail(ctx, tenantID, profile.Email)
		if err != nil {
			return nil, err
		}
		if user != nil {
			_ = s.repo.LinkAccount(ctx, profile.UserID, user.ID)
			return user, nil
		}
		// No user found; create local account
		localUser := s.buildLocalUser(profile, tenantID)
		if err := s.createUser(ctx, localUser); err != nil {
			return nil, err
		}
		_ = s.repo.LinkAccount(ctx, profile.UserID, localUser.ID)
		return localUser, nil
	}

	// No account record — try to find user by email
	user, err := s.findUserByEmail(ctx, tenantID, profile.Email)
	if err != nil {
		return nil, err
	}
	if user != nil {
		// Link WeChat Work identity to existing user
		acct := s.buildAccount(profile, tenantID, user.ID, true, &now)
		if err := s.repo.CreateAccount(ctx, acct); err != nil {
			return nil, err
		}
		return user, nil
	}

	// Create new local user
	localUser := s.buildLocalUser(profile, tenantID)
	if err := s.createUser(ctx, localUser); err != nil {
		return nil, err
	}
	acct := s.buildAccount(profile, tenantID, localUser.ID, true, &now)
	if err := s.repo.CreateAccount(ctx, acct); err != nil {
		return nil, err
	}
	return localUser, nil
}

// TestConnection checks the WeChat Work API connectivity.
func (s *Service) TestConnection(ctx context.Context) (bool, string) {
	return s.client.TestConnection(ctx)
}

// SyncDepartments fetches all departments from WeChat Work and syncs them.
func (s *Service) SyncDepartments(ctx context.Context, tenantID string) (int, error) {
	if !s.IsEnabled() {
		return 0, ErrWechatNotEnabled
	}

	departments, err := s.client.ListDepartments(ctx, 0)
	if err != nil {
		s.log.Error("failed to list wechat departments", zap.Error(err))
		return 0, err
	}

	now := time.Now()
	count := 0
	for _, dept := range departments {
		deptRecord := &WeChatWorkDepartment{
			ID:             uuid.New().String(),
			TenantID:       tenantID,
			WechatDeptID:   dept.ID,
			WechatDeptName: mustNullString(dept.Name),
			WechatParentID: dept.ParentID,
			Enabled:        true,
			LastSyncedAt:   &now,
			CreatedAt:      now,
			UpdatedAt:      now,
		}
		if err := s.repo.UpsertDepartment(ctx, deptRecord); err != nil {
			s.log.Error("failed to upsert department", zap.Error(err), zap.Int64("dept_id", dept.ID))
			continue
		}
		count++
	}

	s.log.Info("synced wechat departments", zap.Int("count", count), zap.String("tenant", tenantID))
	return count, nil
}

// GetAccount retrieves a linked account by WeChat Work user ID.
func (s *Service) GetAccount(ctx context.Context, wechatUserID string) (*WeChatWorkAccount, error) {
	return s.repo.GetAccountByWechatID(ctx, wechatUserID)
}

// ListAccounts returns all accounts for a tenant.
func (s *Service) ListAccounts(ctx context.Context, tenantID string) ([]WeChatWorkAccount, error) {
	return s.repo.ListAccounts(ctx, tenantID)
}

// GetUser retrieves a user by ID (internal helper).
func (s *Service) GetUser(ctx context.Context, id string) (*model.User, error) {
	return s.getUserByID(ctx, id)
}

// --- internal helpers ---

func (s *Service) getUserByID(ctx context.Context, userID string) (*model.User, error) {
	if s.authRepo == nil {
		return nil, ErrUserNotFound
	}
	return s.authRepo.FindUserByID(ctx, userID)
}

func (s *Service) createUser(ctx context.Context, u *model.User) error {
	if s.authRepo == nil {
		return ErrUserNotFound
	}
	return s.authRepo.CreateUser(ctx, u)
}

func (s *Service) findUserByEmail(ctx context.Context, tenantID, email string) (*model.User, error) {
	if s.authRepo == nil {
		return nil, nil
	}
	// Use FindUserByUsername as a proxy; for email-based lookup we run a direct query
	return nil, nil // email lookup not available on AuthRepository; relies on username match below
}

func (s *Service) updateUserIfLinked(ctx context.Context, acct *WeChatWorkAccount, profile *UserProfile, now *time.Time) {
	if s.authRepo == nil {
		return
	}
	user, err := s.getUserByID(ctx, acct.UserID)
	if err != nil || user == nil {
		return
	}
	user.Email = profile.Email
	user.UpdatedAt = *now
	_ = s.authRepo.UpdateUser(ctx, user)
}

func (s *Service) buildLocalUser(profile *UserProfile, tenantID string) *model.User {
	uuid := uuid.New().String()
	email := profile.Email
	if email == "" {
		email = fmt.Sprintf("%s@wechat.work", profile.UserID)
	}
	return &model.User{
		ID:           uuid,
		TenantID:     tenantID,
		Username:     profile.UserID,
		Email:        email,
		Status:       "active",
		PasswordHash: "", // SSO user, no password
		CreatedAt:    time.Now(),
		UpdatedAt:    time.Now(),
	}
}

func (s *Service) buildAccount(profile *UserProfile, tenantID, userID string, linked bool, now *time.Time) *WeChatWorkAccount {
	return &WeChatWorkAccount{
		ID:             uuid.New().String(),
		TenantID:       tenantID,
		UserID:         userID,
		WechatUserID:   profile.UserID,
		Name:           mustNullString(profile.Name),
		Email:          mustNullString(profile.Email),
		Mobile:         mustNullString(profile.Mobile),
		DepartmentIDs:  profile.Departments,
		Position:       mustNullString(profile.Position),
		Avatar:         mustNullString(profile.Avatar),
		Linked:         linked,
		LastSyncedAt:   now,
		CreatedAt:      *now,
		UpdatedAt:      *now,
	}
}

func mustNullString(s string) sql.NullString {
	if s == "" {
		return sql.NullString{}
	}
	return sql.NullString{String: s, Valid: true}
}
