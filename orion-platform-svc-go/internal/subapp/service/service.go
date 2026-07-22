package service
//go:generate mockgen -destination=mock_service.go -package=service . ServiceInterface
//go:generate mockgen -destination=mock_repository.go -package=service . RepositoryInterface

import (
	"context"
	"errors"
	"net/url"
	"regexp"
	"strconv"
	"strings"
	"time"

	"orion/platform-svc-go/internal/subapp/models"
)

// RepositoryInterface defines the repository methods used by the service.
type RepositoryInterface interface {
	AddHistory(ctx context.Context, h *models.SubAppConfigHistory) error
	Create(ctx context.Context, m *models.SubApp) error
	Delete(ctx context.Context, tenantID, key string) error
	GetAll(ctx context.Context, tenantID string) ([]models.SubApp, error)
	GetByKey(ctx context.Context, tenantID, key string) (*models.SubApp, error)
	GetEnabled(ctx context.Context, tenantID string) ([]models.SubApp, error)
	GetHistory(ctx context.Context, tenantID, key string) ([]models.SubAppConfigHistory, error)
	ToggleStatus(ctx context.Context, tenantID, key string) (*models.SubApp, error)
	Update(ctx context.Context, m *models.SubApp) error
}

var (
	ErrSubAppNotFound     = errors.New("sub-app not found")
	ErrSubAppKeyExists    = errors.New("sub-app key already exists")
	ErrSubAppKeyImmutable = errors.New("cannot change sub-app key")
)

// IsNotFound reports whether an error indicates a missing sub-app.
func IsNotFound(err error) bool {
	return errors.Is(err, ErrSubAppNotFound)
}

type Service struct {
	repo RepositoryInterface
}

func NewService(repo RepositoryInterface) *Service {
	return &Service{repo: repo}
}

// ---------------------------------------------------------------------------
// List / Get
// ---------------------------------------------------------------------------

func (s *Service) GetAll(ctx context.Context, tenantID string) ([]models.SubApp, error) {
	return s.repo.GetAll(ctx, tenantID)
}

func (s *Service) GetEnabled(ctx context.Context, tenantID string) ([]models.SubApp, error) {
	return s.repo.GetEnabled(ctx, tenantID)
}

func (s *Service) GetByKey(ctx context.Context, tenantID, key string) (*models.SubApp, error) {
	m, err := s.repo.GetByKey(ctx, tenantID, key)
	if err != nil {
		return nil, ErrSubAppNotFound
	}
	return m, nil
}

// ---------------------------------------------------------------------------
// Create
// ---------------------------------------------------------------------------

func (s *Service) Create(ctx context.Context, tenantID string, createdBy *string, req models.CreateSubAppRequest) (*models.SubApp, error) {
	if err := s.validateCreate(req); err != nil {
		return nil, err
	}

	// Key uniqueness check (global, not tenant-scoped — matches TS behavior)
	_, err := s.repo.GetByKey(ctx, tenantID, req.Key)
	if err == nil {
		return nil, ErrSubAppKeyExists
	}

	// Defaults
	status := models.SubAppStatusEnabled
	if req.Status != nil {
		status = *req.Status
	}
	sortOrder := 0
	if req.SortOrder != nil {
		sortOrder = *req.SortOrder
	}

	m := &models.SubApp{
		TenantID:    tenantID,
		Name:        req.Name,
		Key:         req.Key,
		Version:     "1.0.0",
		EntryDev:    req.EntryDev,
		EntryProd:   req.EntryProd,
		Routes:      models.StringArray(req.Routes),
		Permissions: models.StringArray(req.Permissions),
		KeepAlive:   derefBool(req.KeepAlive),
		Preload:     derefBool(req.Preload),
		Description: req.Description,
		Icon:        req.Icon,
		APIDomain:   req.APIDomain,
		Status:      status,
		SortOrder:   sortOrder,
		CreatedBy:   createdBy,
	}

	if req.Version != nil {
		m.Version = *req.Version
	}

	if err := s.repo.Create(ctx, m); err != nil {
		return nil, err
	}

	// Record history
	if err := s.recordHistory(ctx, m.Key, "created", nil, s.toRecord(m), createdBy, "Created sub-app '"+m.Name+"'"); err != nil {
		return nil, err
	}

	return m, nil
}

// ---------------------------------------------------------------------------
// Update
// ---------------------------------------------------------------------------

func (s *Service) Update(ctx context.Context, tenantID, key string, updatedBy *string, req models.UpdateSubAppRequest) (*models.SubApp, error) {
	current, err := s.GetByKey(ctx, tenantID, key)
	if err != nil {
		return nil, ErrSubAppNotFound
	}

	// Key is immutable — if the request carries a different key, reject.
	if req.Key != nil && *req.Key != key {
		return nil, ErrSubAppKeyImmutable
	}

	m := *current
	m.UpdatedBy = updatedBy

	// Apply non-nil fields from the request.
	if req.Name != nil {
		m.Name = *req.Name
	}
	if req.Version != nil {
		m.Version = *req.Version
	}
	if req.EntryDev != nil {
		m.EntryDev = *req.EntryDev
	}
	if req.EntryProd != nil {
		m.EntryProd = *req.EntryProd
	}
	if req.Routes != nil {
		m.Routes = models.StringArray(*req.Routes)
	}
	if req.Permissions != nil {
		m.Permissions = models.StringArray(*req.Permissions)
	}
	if req.KeepAlive != nil {
		m.KeepAlive = *req.KeepAlive
	}
	if req.Preload != nil {
		m.Preload = *req.Preload
	}
	if req.Description != nil {
		m.Description = req.Description
	}
	if req.Icon != nil {
		m.Icon = req.Icon
	}
	if req.APIDomain != nil {
		m.APIDomain = req.APIDomain
	}
	if req.Status != nil {
		m.Status = *req.Status
	}
	if req.SortOrder != nil {
		m.SortOrder = *req.SortOrder
	}

	if err := s.repo.Update(ctx, &m); err != nil {
		return nil, err
	}

	// Record history: treat a status change as a distinct action.
	action := "updated"
	if req.Status != nil && *req.Status != current.Status {
		action = "status_changed"
	}
	if err := s.recordHistory(ctx, key, action, s.toRecord(current), s.toRecord(&m), updatedBy, "Updated sub-app '"+current.Name+"'"); err != nil {
		return nil, err
	}

	// Return refreshed row
	return s.GetByKey(ctx, tenantID, key)
}

// ---------------------------------------------------------------------------
// ToggleStatus
// ---------------------------------------------------------------------------

func (s *Service) ToggleStatus(ctx context.Context, tenantID, key string, changedBy *string) (*models.SubApp, error) {
	current, err := s.GetByKey(ctx, tenantID, key)
	if err != nil {
		return nil, ErrSubAppNotFound
	}

	m, err := s.repo.ToggleStatus(ctx, tenantID, key)
	if err != nil {
		return nil, err
	}

	if err := s.recordHistory(ctx, key, "status_changed", s.toRecord(current), s.toRecord(m), changedBy,
		"Changed status from '"+string(current.Status)+"' to '"+string(m.Status)+"'"); err != nil {
		return nil, err
	}

	return m, nil
}

// ---------------------------------------------------------------------------
// Delete
// ---------------------------------------------------------------------------

func (s *Service) Delete(ctx context.Context, tenantID, key string, changedBy *string) error {
	current, err := s.GetByKey(ctx, tenantID, key)
	if err != nil {
		return ErrSubAppNotFound
	}

	if err := s.repo.Delete(ctx, tenantID, key); err != nil {
		return err
	}

	return s.recordHistory(ctx, key, "deleted", s.toRecord(current), nil, changedBy, "Deleted sub-app '"+current.Name+"'")
}

// ---------------------------------------------------------------------------
// History
// ---------------------------------------------------------------------------

func (s *Service) GetHistory(ctx context.Context, tenantID, key string) ([]models.SubAppConfigHistory, error) {
	return s.repo.GetHistory(ctx, tenantID, key)
}

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

var keyRegexp = regexp.MustCompile(`^[a-z][a-z0-9-]*$`)

func (s *Service) validateCreate(req models.CreateSubAppRequest) error {
	if !keyRegexp.MatchString(req.Key) {
		return errors.New("key must start with a lowercase letter and contain only lowercase letters, numbers, and hyphens")
	}
	if err := validateURL(req.EntryDev); err != nil {
		return err
	}
	if req.EntryProd != "" && !isPathAbsolute(req.EntryProd) && !isHTTPURL(req.EntryProd) {
		return errors.New("production entry must be a path starting with '/' or a full URL")
	}
	for i, r := range req.Routes {
		if !isPathAbsolute(r) {
			return errors.New("each route must start with '/' (invalid route at index " + strconv.Itoa(i) + ")")
		}
	}
	return nil
}

func validateURL(raw string) error {
	if !isHTTPURL(raw) {
		// Must at least parse as a URL
		if _, err := url.Parse(raw); err != nil {
			return errors.New("invalid development entry URL: " + err.Error())
		}
		return errors.New("development entry must use HTTP or HTTPS")
	}
	return nil
}

func isHTTPURL(raw string) bool {
	u, err := url.Parse(raw)
	return err == nil && (u.Scheme == "http" || u.Scheme == "https")
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

func derefBool(p *bool) bool {
	if p == nil {
		return false
	}
	return *p
}

func isPathAbsolute(path string) bool {
	return strings.HasPrefix(path, "/")
}

func derefString(p *string) string {
	if p == nil {
		return ""
	}
	return *p
}

func (s *Service) toRecord(m *models.SubApp) models.JSONB {
	return models.JSONB{
		"id":          m.ID,
		"name":        m.Name,
		"key":         m.Key,
		"version":     m.Version,
		"entry_dev":   m.EntryDev,
		"entry_prod":  m.EntryProd,
		"routes":      m.Routes,
		"permissions": m.Permissions,
		"keep_alive":  m.KeepAlive,
		"preload":     m.Preload,
		"description": derefString(m.Description),
		"icon":        derefString(m.Icon),
		"api_domain":  derefString(m.APIDomain),
		"status":      string(m.Status),
		"sort_order":  m.SortOrder,
		"created_by":  derefString(m.CreatedBy),
		"created_at":  m.CreatedAt.Format(time.RFC3339),
		"updated_at":  m.UpdatedAt.Format(time.RFC3339),
	}
}

func (s *Service) recordHistory(ctx context.Context, key, action string, oldValue, newValue models.JSONB, changedBy *string, summary string) error {
	return s.repo.AddHistory(ctx, &models.SubAppConfigHistory{
		SubAppKey:     key,
		Action:        action,
		OldValue:      oldValue,
		NewValue:      newValue,
		ChangedBy:     changedBy,
		ChangeSummary: &summary,
	})
}
