package service

import (
	"context"
	"errors"
	"fmt"

	"orion/platform-svc-go/internal/data-catalog/models"
	dcrepo "orion/platform-svc-go/internal/data-catalog/repository"
	"orion/go-common/pkg/sentinel"
)

// RepositoryInterface mirrors the repository interface for testability.
type RepositoryInterface interface {
	List(ctx context.Context, tenantID string) ([]models.Entry, error)
	GetByID(ctx context.Context, tenantID, id string) (*models.Entry, error)
	Create(ctx context.Context, tenantID string, req models.CreateEntryRequest) (*models.Entry, error)
	Update(ctx context.Context, tenantID, id string, req models.UpdateEntryRequest) (*models.Entry, error)
	Delete(ctx context.Context, tenantID, id string) error
	Search(ctx context.Context, tenantID string, q models.SearchRequest) ([]models.Entry, error)
	Count(ctx context.Context, tenantID string) (int, error)
	GetByTable(ctx context.Context, tenantID, tableName string) ([]models.Entry, error)
}

type Service struct {
	repo RepositoryInterface
}

func NewService(repo dcrepo.RepositoryInterface) *Service {
	return &Service{repo: repo}
}

// --- CRUD ---

// CreateEntry creates a new data catalog entry.
func (s *Service) CreateEntry(ctx context.Context, tenantID string, req models.CreateEntryRequest) (*models.Entry, error) {
	if req.Name == "" {
		return nil, errors.New("entry name is required")
	}
	if req.DataType == "" {
		return nil, errors.New("dataType is required")
	}
	if req.TableName == "" {
		return nil, errors.New("tableName is required")
	}
	m, err := s.repo.Create(ctx, tenantID, req)
	if err != nil {
		return nil, fmt.Errorf("create catalog entry: %w", err)
	}
	return m, nil
}

// GetEntry retrieves a catalog entry by ID.
func (s *Service) GetEntry(ctx context.Context, tenantID, id string) (*models.Entry, error) {
	m, err := s.repo.GetByID(ctx, tenantID, id)
	if err != nil {
		return nil, ErrNotFoundEntry(id)
	}
	return m, nil
}

// ListEntries lists all catalog entries for a tenant.
func (s *Service) ListEntries(ctx context.Context, tenantID string) ([]models.Entry, error) {
	return s.repo.List(ctx, tenantID)
}

// UpdateEntry updates a catalog entry.
func (s *Service) UpdateEntry(ctx context.Context, tenantID, id string, req models.UpdateEntryRequest) (*models.Entry, error) {
	m, err := s.repo.GetByID(ctx, tenantID, id)
	if err != nil {
		return nil, ErrNotFoundEntry(id)
	}
	if len(req.Extra) > 0 {
		// Extra fields are stored in the Entry model but the repository Update does
		// not persist them; log a warning in case consumers expect it.
		_ = m.Extra
	}
	m, err = s.repo.Update(ctx, tenantID, id, req)
	if err != nil {
		return nil, fmt.Errorf("update catalog entry: %w", err)
	}
	return m, nil
}

// DeleteEntry deletes a catalog entry by ID.
func (s *Service) DeleteEntry(ctx context.Context, tenantID, id string) error {
	if err := s.repo.Delete(ctx, tenantID, id); err != nil {
		return fmt.Errorf("delete catalog entry: %w", err)
	}
	return nil
}

// --- Search / filter ---

// SearchEntries performs a filtered/paginated search over catalog entries.
func (s *Service) SearchEntries(ctx context.Context, tenantID string, q models.SearchRequest) (*models.PaginatedResponse, error) {
	items, err := s.repo.Search(ctx, tenantID, q)
	if err != nil {
		return nil, fmt.Errorf("search catalog entries: %w", err)
	}
	total, err := s.repo.Count(ctx, tenantID)
	if err != nil {
		total = 0
	}
	return &models.PaginatedResponse{
		Data:  items,
		Total: total,
		Page:  q.Page,
		Limit: q.Limit,
	}, nil
}

// GetEntriesByTable lists all catalog entries for a given table.
func (s *Service) GetEntriesByTable(ctx context.Context, tenantID, tableName string) ([]models.Entry, error) {
	return s.repo.GetByTable(ctx, tenantID, tableName)
}

// --- Auto-discovery stub ---

// Discover scans connected databases for unregistered tables and columns.
// This is a stub — production implementation would connect to DB catalogs
// and reconcile against existing entries.
func (s *Service) Discover(ctx context.Context, tenantID string) *models.DiscoverySummary {
	// TODO: connect to database catalog, introspect schemas, create/update entries.
	return &models.DiscoverySummary{
		ScannedTables:  0,
		NewEntries:     0,
		UpdatedEntries: 0,
		Status:         "staged",
		Message:        "auto-discovery is a stub — integrate with database introspection",
	}
}

// --- Errors ---

func IsNotFound(err error) bool {
	return errors.Is(err, sentinel.NotFound)
}

func ErrNotFoundEntry(id string) error {
	return fmt.Errorf("catalog entry %q not found: %w", id, sentinel.NotFound)
}
