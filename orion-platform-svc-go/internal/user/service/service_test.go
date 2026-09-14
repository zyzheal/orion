package service

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"testing"

	"orion/go-common/pkg/sentinel"
	"orion/platform-svc-go/internal/user/models"
)

type fakeRepo struct {
	getByIDErr       error
	getByUsernameErr error
	updateErr        error
	existing         *models.User
}

func (f *fakeRepo) Count(ctx context.Context, tenantID string) (int, error) { return 0, nil }
func (f *fakeRepo) Create(ctx context.Context, user *models.User) error     { return nil }
func (f *fakeRepo) Delete(ctx context.Context, tenantID, id string) error {
	return nil
}
func (f *fakeRepo) GetByID(ctx context.Context, tenantID, id string) (*models.User, error) {
	if f.getByIDErr != nil {
		return nil, f.getByIDErr
	}
	return f.existing, nil
}
func (f *fakeRepo) GetByUsername(ctx context.Context, username string) (*models.User, error) {
	if f.getByUsernameErr != nil {
		return nil, f.getByUsernameErr
	}
	return f.existing, nil
}
func (f *fakeRepo) List(ctx context.Context, tenantID string, filter *models.GetUserFilters, offset, limit int) ([]models.User, error) {
	return nil, nil
}
func (f *fakeRepo) Update(ctx context.Context, tenantID, id string, updates map[string]interface{}) error {
	return f.updateErr
}
func (f *fakeRepo) UpdatePassword(ctx context.Context, id string, tenantID string, newPasswordHash string) error {
	return nil
}

var errOutage = errors.New(`pq: relation "users" does not exist`)

func TestIsNotFoundRecognisesTheRepositorySentinels(t *testing.T) {
	for name, tc := range map[string]struct {
		err  error
		want bool
	}{
		"sentinel":         {sentinel.NotFound, true},
		"sql no rows":      {sql.ErrNoRows, true},
		"wrapped sentinel": {fmt.Errorf("failed to update user: %w", sentinel.NotFound), true},
		"outage":           {errOutage, false},
		"bad request":      {errors.New("username is required"), false},
		"nil":              {nil, false},
	} {
		if got := IsNotFound(tc.err); got != tc.want {
			t.Errorf("%s: want %v, got %v", name, tc.want, got)
		}
	}
}

// An unknown username must look like bad credentials, never like an outage.
func TestAuthenticateRejectsAnUnknownUserAsBadCredentials(t *testing.T) {
	s := NewService(&fakeRepo{getByUsernameErr: sentinel.NotFound})
	_, err := s.Authenticate(context.Background(), &models.AuthenticateRequest{Username: "ghost", Password: "x"})
	if !errors.Is(err, ErrInvalidPassword) {
		t.Fatalf("unknown user must be indistinguishable from a bad password, got %v", err)
	}
}

// ... and a database that will not answer must not be folded into it either.
// Before this split, Authenticate returned ErrInvalidPassword for every
// repository error, so a total outage was reported as "invalid password" on
// every login attempt.
func TestAuthenticatePropagatesARepositoryOutage(t *testing.T) {
	s := NewService(&fakeRepo{getByUsernameErr: errOutage})
	_, err := s.Authenticate(context.Background(), &models.AuthenticateRequest{Username: "ada", Password: "x"})
	if err == nil {
		t.Fatal("an outage must not authenticate anyone")
	}
	if errors.Is(err, ErrInvalidPassword) {
		t.Fatalf("an outage must not be reported as bad credentials: %v", err)
	}
	if !errors.Is(err, errOutage) {
		t.Fatalf("the underlying error was lost: %v", err)
	}
}

// The handler only sees the wrapped error, so the wrapping must not hide the
// sentinel from errors.Is.
func TestUpdateKeepsNotFoundVisibleThroughTheWrap(t *testing.T) {
	s := NewService(&fakeRepo{updateErr: sentinel.NotFound, existing: &models.User{ID: "u1"}})
	req := models.UpdateUserRequest{FullName: strPtr("Ada")}
	_, err := s.Update(context.Background(), "t1", "u1", &req)
	if err == nil {
		t.Fatal("Update succeeded against a missing row")
	}
	if !IsNotFound(err) {
		t.Fatalf("the handler cannot distinguish this from an outage: %v", err)
	}
}

// A PUT with an empty body must return the existing user, never a 404.
func TestUpdateWithNoFieldsReturnsTheExistingUser(t *testing.T) {
	s := NewService(&fakeRepo{existing: &models.User{ID: "u1", Username: "ada", Password: "$2a$10$hash"}})
	user, err := s.Update(context.Background(), "t1", "u1", &models.UpdateUserRequest{})
	if err != nil {
		t.Fatalf("an empty update must not fail: %v", err)
	}
	if user == nil || user.ID != "u1" {
		t.Fatalf("want the existing user, got %v", user)
	}
	if user.Password != "" {
		t.Fatalf("the password must be stripped from the response: %q", user.Password)
	}
}

func TestUpdatePropagatesARepositoryOutage(t *testing.T) {
	s := NewService(&fakeRepo{updateErr: errOutage, existing: &models.User{ID: "u1"}})
	req := models.UpdateUserRequest{FullName: strPtr("Ada")}
	_, err := s.Update(context.Background(), "t1", "u1", &req)
	if err == nil || IsNotFound(err) {
		t.Fatalf("an outage must not look like a missing user: %v", err)
	}
}

func strPtr(s string) *string { return &s }
