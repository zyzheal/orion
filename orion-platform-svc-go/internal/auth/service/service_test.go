package service

import (
	"context"
	"errors"
	"testing"
	"time"

	"orion/platform-svc-go/internal/auth/models"
	auth_repo "orion/platform-svc-go/internal/auth/repository"
	user_models "orion/platform-svc-go/internal/user/models"
)

// --- mock implementations ---

type mockUserRepo struct {
	usersByUsername map[string]*user_models.User
	usersByID       map[string]*user_models.User
	createErr       error
}

func (m *mockUserRepo) GetByUsername(_ context.Context, username string) (*user_models.User, error) {
	u, ok := m.usersByUsername[username]
	if !ok {
		return nil, errors.New("user not found")
	}
	return u, nil
}

func (m *mockUserRepo) Create(_ context.Context, user *user_models.User) error {
	if m.createErr != nil {
		return m.createErr
	}
	m.usersByUsername[user.Username] = user
	m.usersByID[user.ID] = user
	return nil
}

func (m *mockUserRepo) GetByID(_ context.Context, tenantID, id string) (*user_models.User, error) {
	key := tenantID + ":" + id
	u, ok := m.usersByID[key]
	if !ok {
		// Try by id alone
		for _, v := range m.usersByID {
			if v.ID == id {
				return v, nil
			}
		}
		return nil, errors.New("user not found")
	}
	return u, nil
}

type mockAuthRepo struct {
	tokens   map[string]*auth_repo.RefreshTokenRow
	tenants  map[string][]string
	createErr error
}

func (m *mockAuthRepo) Create(_ context.Context, rt *models.RefreshToken) error {
	if m.createErr != nil {
		return m.createErr
	}
	m.tokens[rt.TokenHash] = &auth_repo.RefreshTokenRow{
		RefreshToken: *rt,
		Username:     "testuser",
		Role:         "user",
		Status:       "active",
	}
	return nil
}

func (m *mockAuthRepo) FindByHash(_ context.Context, tokenHash string) (*auth_repo.RefreshTokenRow, error) {
	row, ok := m.tokens[tokenHash]
	if !ok {
		return nil, errors.New("refresh token not found")
	}
	return row, nil
}

func (m *mockAuthRepo) DeleteByHash(_ context.Context, tokenHash string) error {
	delete(m.tokens, tokenHash)
	return nil
}

func (m *mockAuthRepo) FindTenantsByUserID(_ context.Context, userID string) ([]string, error) {
	t, ok := m.tenants[userID]
	if !ok {
		return []string{}, nil
	}
	return t, nil
}

// mockHasher provides deterministic password hashing for tests.
type mockHasher struct {
	hashVal    string // fixed hash output
	hashErr    error
	compareErr error
}

func (m mockHasher) hash(_ string) (string, error) {
	if m.hashErr != nil {
		return "", m.hashErr
	}
	if m.hashVal != "" {
		return m.hashVal, nil
	}
	return "hashed:" + m.hashVal, nil
}

func (m mockHasher) compare(_, _ string) error {
	return m.compareErr
}

// Test helpers

func newTestService(userRepo *mockUserRepo, authRepo *mockAuthRepo) *Service {
	s := &Service{
		userRepo:  userRepo,
		authRepo:  authRepo,
		jwtSecret: "test-secret-key",
		hasher: mockHasher{
			hashVal: "$2a$12$fakehashfortesting1234567890abcdef",
		},
	}
	return s
}

func TestRegister_Success(t *testing.T) {
	ur := &mockUserRepo{usersByUsername: map[string]*user_models.User{}, usersByID: map[string]*user_models.User{}}
	ar := &mockAuthRepo{tokens: map[string]*auth_repo.RefreshTokenRow{}, tenants: map[string][]string{}}
	svc := newTestService(ur, ar)

	resp, err := svc.Register(context.Background(), &models.RegisterRequest{
		Username: "newuser",
		Password: "password123",
		Email:    "new@test.com",
	}, "")

	if err != nil {
		t.Fatalf("expected no error, got %v", err)
	}
	if resp.Username != "newuser" {
		t.Errorf("expected username newuser, got %s", resp.Username)
	}
	if resp.Role != "user" {
		t.Errorf("expected role user, got %s", resp.Role)
	}
	if resp.Message != "registration successful" {
		t.Errorf("expected registration successful, got %s", resp.Message)
	}
}

func TestRegister_DuplicateUsername(t *testing.T) {
	ur := &mockUserRepo{
		usersByUsername: map[string]*user_models.User{
			"existing": {ID: "1", Username: "existing"},
		},
		usersByID: map[string]*user_models.User{},
	}
	ar := &mockAuthRepo{tokens: map[string]*auth_repo.RefreshTokenRow{}, tenants: map[string][]string{}}
	svc := newTestService(ur, ar)

	_, err := svc.Register(context.Background(), &models.RegisterRequest{
		Username: "existing",
		Password: "password123",
	}, "")

	if err != ErrUsernameExists {
		t.Errorf("expected ErrUsernameExists, got %v", err)
	}
}

func TestRegister_PasswordTooShort(t *testing.T) {
	ur := &mockUserRepo{usersByUsername: map[string]*user_models.User{}, usersByID: map[string]*user_models.User{}}
	ar := &mockAuthRepo{tokens: map[string]*auth_repo.RefreshTokenRow{}, tenants: map[string][]string{}}
	svc := newTestService(ur, ar)

	_, err := svc.Register(context.Background(), &models.RegisterRequest{
		Username: "newuser",
		Password: "1234567",
	}, "")

	if err != ErrPasswordTooShort {
		t.Errorf("expected ErrPasswordTooShort, got %v", err)
	}
}

func TestRegister_EmptyFields(t *testing.T) {
	ur := &mockUserRepo{usersByUsername: map[string]*user_models.User{}, usersByID: map[string]*user_models.User{}}
	ar := &mockAuthRepo{tokens: map[string]*auth_repo.RefreshTokenRow{}, tenants: map[string][]string{}}
	svc := newTestService(ur, ar)

	_, err := svc.Register(context.Background(), &models.RegisterRequest{}, "")
	if err == nil {
		t.Fatal("expected error for empty fields")
	}
}

func TestLogin_Success(t *testing.T) {
	now := time.Now()
	ur := &mockUserRepo{
		usersByUsername: map[string]*user_models.User{
			"testuser": {
				ID:        "user-1",
				Username:  "testuser",
				Password:  "hashed:password123",
				Role:      "user",
				Status:    "active",
				CreatedAt: now,
				UpdatedAt: now,
			},
		},
		usersByID: map[string]*user_models.User{},
	}
	ar := &mockAuthRepo{
		tokens:  map[string]*auth_repo.RefreshTokenRow{},
		tenants: map[string][]string{"user-1": {"tenant-1"}},
	}
	svc := newTestService(ur, ar)
	svc.hasher = mockHasher{compareErr: nil}

	resp, err := svc.Login(context.Background(), &models.LoginRequest{
		Username: "testuser",
		Password: "password123",
	}, "")

	if err != nil {
		t.Fatalf("expected no error, got %v", err)
	}
	if resp.AccessToken == "" {
		t.Error("expected non-empty access token")
	}
	if resp.RefreshToken == "" {
		t.Error("expected non-empty refresh token")
	}
	if resp.TenantID != "tenant-1" {
		t.Errorf("expected tenant-1, got %s", resp.TenantID)
	}
	if resp.User.Username != "testuser" {
		t.Errorf("expected testuser, got %s", resp.User.Username)
	}
}

func TestLogin_InvalidCredentials(t *testing.T) {
	ur := &mockUserRepo{usersByUsername: map[string]*user_models.User{}, usersByID: map[string]*user_models.User{}}
	ar := &mockAuthRepo{tokens: map[string]*auth_repo.RefreshTokenRow{}, tenants: map[string][]string{}}
	svc := newTestService(ur, ar)

	_, err := svc.Login(context.Background(), &models.LoginRequest{
		Username: "nonexistent",
		Password: "password123",
	}, "")

	if err != ErrInvalidCredentials {
		t.Errorf("expected ErrInvalidCredentials, got %v", err)
	}
}

func TestLogin_WrongPassword(t *testing.T) {
	ur := &mockUserRepo{
		usersByUsername: map[string]*user_models.User{
			"testuser": {ID: "user-1", Username: "testuser", Password: "hashed:correct", Role: "user", Status: "active"},
		},
		usersByID: map[string]*user_models.User{},
	}
	ar := &mockAuthRepo{tokens: map[string]*auth_repo.RefreshTokenRow{}, tenants: map[string][]string{}}
	svc := newTestService(ur, ar)
	svc.hasher = mockHasher{compareErr: ErrInvalidCredentials}

	_, err := svc.Login(context.Background(), &models.LoginRequest{
		Username: "testuser",
		Password: "wrong",
	}, "")

	if err != ErrInvalidCredentials {
		t.Errorf("expected ErrInvalidCredentials, got %v", err)
	}
}

func TestLogin_UserDisabled(t *testing.T) {
	ur := &mockUserRepo{
		usersByUsername: map[string]*user_models.User{
			"disabled": {ID: "user-2", Username: "disabled", Password: "hash", Status: "terminated"},
		},
		usersByID: map[string]*user_models.User{},
	}
	ar := &mockAuthRepo{tokens: map[string]*auth_repo.RefreshTokenRow{}, tenants: map[string][]string{}}
	svc := newTestService(ur, ar)
	svc.hasher = mockHasher{compareErr: nil}

	_, err := svc.Login(context.Background(), &models.LoginRequest{
		Username: "disabled",
		Password: "password123",
	}, "")

	if err != ErrUserDisabled {
		t.Errorf("expected ErrUserDisabled, got %v", err)
	}
}

func TestLogin_UserSuspended(t *testing.T) {
	ur := &mockUserRepo{
		usersByUsername: map[string]*user_models.User{
			"suspended": {ID: "user-3", Username: "suspended", Password: "hash", Status: "suspended"},
		},
		usersByID: map[string]*user_models.User{},
	}
	ar := &mockAuthRepo{tokens: map[string]*auth_repo.RefreshTokenRow{}, tenants: map[string][]string{}}
	svc := newTestService(ur, ar)
	svc.hasher = mockHasher{compareErr: nil}

	_, err := svc.Login(context.Background(), &models.LoginRequest{
		Username: "suspended",
		Password: "password123",
	}, "")

	if err != ErrUserSuspended {
		t.Errorf("expected ErrUserSuspended, got %v", err)
	}
}

func TestLogin_MultipleTenantsNoHeader(t *testing.T) {
	ur := &mockUserRepo{
		usersByUsername: map[string]*user_models.User{
			"multi": {ID: "user-4", Username: "multi", Password: "hash", Status: "active"},
		},
		usersByID: map[string]*user_models.User{},
	}
	ar := &mockAuthRepo{
		tokens:  map[string]*auth_repo.RefreshTokenRow{},
		tenants: map[string][]string{"user-4": {"tenant-1", "tenant-2"}},
	}
	svc := newTestService(ur, ar)
	svc.hasher = mockHasher{compareErr: nil}

	_, err := svc.Login(context.Background(), &models.LoginRequest{
		Username: "multi",
		Password: "password123",
	}, "")

	if err != ErrMultipleTenants {
		t.Errorf("expected ErrMultipleTenants, got %v", err)
	}
}

func TestLogin_EmptyFields(t *testing.T) {
	ur := &mockUserRepo{usersByUsername: map[string]*user_models.User{}, usersByID: map[string]*user_models.User{}}
	ar := &mockAuthRepo{tokens: map[string]*auth_repo.RefreshTokenRow{}, tenants: map[string][]string{}}
	svc := newTestService(ur, ar)

	_, err := svc.Login(context.Background(), &models.LoginRequest{}, "")
	if err != ErrInvalidCredentials {
		t.Errorf("expected ErrInvalidCredentials, got %v", err)
	}
}

func TestRefresh_Success(t *testing.T) {
	oldToken := "oldtoken"
	oldHash := hashToken(oldToken)
	ar := &mockAuthRepo{
		tokens: map[string]*auth_repo.RefreshTokenRow{
			oldHash: {
				RefreshToken: models.RefreshToken{
					ID:        "rt-1",
					UserID:    "user-1",
					TokenHash: oldHash,
					ExpiresAt: time.Now().Add(24 * time.Hour),
					TenantID:  "tenant-1",
				},
				Username: "testuser",
				Role:     "user",
				Status:   "active",
			},
		},
		tenants: map[string][]string{},
	}
	ur := &mockUserRepo{usersByUsername: map[string]*user_models.User{}, usersByID: map[string]*user_models.User{}}
	svc := newTestService(ur, ar)

	resp, err := svc.Refresh(context.Background(), &models.RefreshRequest{
		RefreshToken: oldToken,
	})

	if err != nil {
		t.Fatalf("expected no error, got %v", err)
	}
	if resp.AccessToken == "" {
		t.Error("expected non-empty access token")
	}
	if resp.RefreshToken == "" {
		t.Error("expected non-empty refresh token")
	}
	if resp.TenantID != "tenant-1" {
		t.Errorf("expected tenant-1, got %s", resp.TenantID)
	}

	// old token should be deleted (rotated)
	if _, ok := ar.tokens[oldHash]; ok {
		t.Error("expected old token to be deleted (rotated)")
	}
}

func TestRefresh_InvalidToken(t *testing.T) {
	ar := &mockAuthRepo{tokens: map[string]*auth_repo.RefreshTokenRow{}, tenants: map[string][]string{}}
	ur := &mockUserRepo{usersByUsername: map[string]*user_models.User{}, usersByID: map[string]*user_models.User{}}
	svc := newTestService(ur, ar)

	_, err := svc.Refresh(context.Background(), &models.RefreshRequest{
		RefreshToken: "invalid",
	})

	if err != ErrInvalidRefreshToken {
		t.Errorf("expected ErrInvalidRefreshToken, got %v", err)
	}
}

func TestRefresh_EmptyToken(t *testing.T) {
	ur := &mockUserRepo{usersByUsername: map[string]*user_models.User{}, usersByID: map[string]*user_models.User{}}
	ar := &mockAuthRepo{tokens: map[string]*auth_repo.RefreshTokenRow{}, tenants: map[string][]string{}}
	svc := newTestService(ur, ar)

	_, err := svc.Refresh(context.Background(), &models.RefreshRequest{RefreshToken: ""})
	if err != ErrInvalidRefreshToken {
		t.Errorf("expected ErrInvalidRefreshToken, got %v", err)
	}
}

func TestRefresh_UserDisabled(t *testing.T) {
	token := "disabledtoken"
	tokenHash := hashToken(token)
	ar := &mockAuthRepo{
		tokens: map[string]*auth_repo.RefreshTokenRow{
			tokenHash: {
				RefreshToken: models.RefreshToken{ID: "rt-1", UserID: "user-1", TokenHash: tokenHash, ExpiresAt: time.Now().Add(24 * time.Hour)},
				Username:     "testuser",
				Role:         "user",
				Status:       "deleted",
			},
		},
		tenants: map[string][]string{},
	}
	ur := &mockUserRepo{usersByUsername: map[string]*user_models.User{}, usersByID: map[string]*user_models.User{}}
	svc := newTestService(ur, ar)

	_, err := svc.Refresh(context.Background(), &models.RefreshRequest{RefreshToken: token})
	if err != ErrUserDisabled {
		t.Errorf("expected ErrUserDisabled, got %v", err)
	}
}

func TestRefresh_UserSuspended(t *testing.T) {
	token := "suspendedtoken"
	tokenHash := hashToken(token)
	ar := &mockAuthRepo{
		tokens: map[string]*auth_repo.RefreshTokenRow{
			tokenHash: {
				RefreshToken: models.RefreshToken{ID: "rt-1", UserID: "user-1", TokenHash: tokenHash, ExpiresAt: time.Now().Add(24 * time.Hour)},
				Username:     "testuser",
				Role:         "user",
				Status:       "suspended",
			},
		},
		tenants: map[string][]string{},
	}
	ur := &mockUserRepo{usersByUsername: map[string]*user_models.User{}, usersByID: map[string]*user_models.User{}}
	svc := newTestService(ur, ar)

	_, err := svc.Refresh(context.Background(), &models.RefreshRequest{RefreshToken: token})
	if err != ErrUserSuspended {
		t.Errorf("expected ErrUserSuspended, got %v", err)
	}
}

func TestLogout_Success(t *testing.T) {
	token := "sometoken"
	tokenHash := hashToken(token)
	ar := &mockAuthRepo{
		tokens:  map[string]*auth_repo.RefreshTokenRow{tokenHash: {}},
		tenants: map[string][]string{},
	}
	ur := &mockUserRepo{usersByUsername: map[string]*user_models.User{}, usersByID: map[string]*user_models.User{}}
	svc := newTestService(ur, ar)

	err := svc.Logout(context.Background(), &models.LogoutRequest{RefreshToken: token})
	if err != nil {
		t.Fatalf("expected no error, got %v", err)
	}
}

func TestLogout_EmptyToken(t *testing.T) {
	svc := newTestService(
		&mockUserRepo{usersByUsername: map[string]*user_models.User{}, usersByID: map[string]*user_models.User{}},
		&mockAuthRepo{tokens: map[string]*auth_repo.RefreshTokenRow{}, tenants: map[string][]string{}},
	)

	err := svc.Logout(context.Background(), &models.LogoutRequest{})
	if err != nil {
		t.Fatalf("expected no error for empty token, got %v", err)
	}
}

func TestGetProfile_Success(t *testing.T) {
	now := time.Now()
	ur := &mockUserRepo{
		usersByUsername: map[string]*user_models.User{},
		usersByID: map[string]*user_models.User{
			"tenant-1:user-1": {
				ID:        "user-1",
				Username:  "testuser",
				Email:     "test@test.com",
				FullName:  "Test User",
				Role:      "user",
				Status:    "active",
				CreatedAt: now,
				UpdatedAt: now,
			},
		},
	}
	ar := &mockAuthRepo{
		tokens:  map[string]*auth_repo.RefreshTokenRow{},
		tenants: map[string][]string{"user-1": {"tenant-1", "tenant-2"}},
	}
	svc := newTestService(ur, ar)

	resp, err := svc.GetProfile(context.Background(), "tenant-1", "user-1")
	if err != nil {
		t.Fatalf("expected no error, got %v", err)
	}
	if resp.Username != "testuser" {
		t.Errorf("expected testuser, got %s", resp.Username)
	}
	if resp.Email != "test@test.com" {
		t.Errorf("expected test@test.com, got %s", resp.Email)
	}
	if len(resp.Tenants) != 2 {
		t.Errorf("expected 2 tenants, got %d", len(resp.Tenants))
	}
	if resp.CurrentTenantID != "tenant-1" {
		t.Errorf("expected tenant-1, got %s", resp.CurrentTenantID)
	}
}

func TestGetProfile_NotFound(t *testing.T) {
	ur := &mockUserRepo{usersByUsername: map[string]*user_models.User{}, usersByID: map[string]*user_models.User{}}
	ar := &mockAuthRepo{tokens: map[string]*auth_repo.RefreshTokenRow{}, tenants: map[string][]string{}}
	svc := newTestService(ur, ar)

	_, err := svc.GetProfile(context.Background(), "tenant-1", "nonexistent")
	if err != ErrUserNotFound {
		t.Errorf("expected ErrUserNotFound, got %v", err)
	}
}

func TestGetProfile_EmptyTenant(t *testing.T) {
	now := time.Now()
	ur := &mockUserRepo{
		usersByUsername: map[string]*user_models.User{},
		usersByID: map[string]*user_models.User{
			":user-1": {
				ID:        "user-1",
				Username:  "testuser",
				Role:      "user",
				Status:    "active",
				CreatedAt: now,
				UpdatedAt: now,
			},
		},
	}
	ar := &mockAuthRepo{
		tokens:  map[string]*auth_repo.RefreshTokenRow{},
		tenants: map[string][]string{"user-1": {"tenant-1"}},
	}
	svc := newTestService(ur, ar)

	resp, err := svc.GetProfile(context.Background(), "", "user-1")
	if err != nil {
		t.Fatalf("expected no error, got %v", err)
	}
	if resp.CurrentTenantID != "tenant-1" {
		t.Errorf("expected tenant-1, got %s", resp.CurrentTenantID)
	}
}

func Test_hashToken(t *testing.T) {
	h := hashToken("testtoken")
	if len(h) != 64 {
		t.Errorf("expected 64-char hex hash, got %d", len(h))
	}
	// Deterministic
	h2 := hashToken("testtoken")
	if h != h2 {
		t.Error("expected deterministic hash")
	}
}

func Test_buildAvatarURL(t *testing.T) {
	url := buildAvatarURL("testuser")
	if url == "" {
		t.Error("expected non-empty URL")
	}
}

func TestServiceErrors(t *testing.T) {
	tests := []struct {
		err  error
		msg  string
	}{
		{ErrInvalidCredentials, "invalid username or password"},
		{ErrUserDisabled, "account is disabled"},
		{ErrUserSuspended, "account is suspended"},
		{ErrInvalidRefreshToken, "invalid or expired refresh token"},
		{ErrUsernameExists, "username already exists"},
		{ErrTenantAccessDenied, "user does not have access to the specified tenant"},
		{ErrMultipleTenants, "user belongs to multiple tenants, specify X-Tenant-ID header"},
		{ErrPasswordTooShort, "password must be at least 8 characters"},
		{ErrUserNotFound, "user not found"},
	}
	for _, tt := range tests {
		if tt.err.Error() != tt.msg {
			t.Errorf("expected %q, got %q", tt.msg, tt.err.Error())
		}
	}
}