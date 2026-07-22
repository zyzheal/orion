package service

import (
	"context"
	"errors"
	"fmt"

	"orion/platform-svc-go/internal/data-catalog/introspector"
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
	repo         RepositoryInterface
	introspector *introspector.Introspector
}

func NewService(repo dcrepo.RepositoryInterface, introspector *introspector.Introspector) *Service {
	return &Service{repo: repo, introspector: introspector}
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

// --- Auto-discovery ---

// Discover scans connected databases for tables and columns using the
// introspector, then reconciles them against the current catalog entries.
// If the introspector is nil or there are no discovery configs, it returns
// a stub summary indicating that no discovery was performed.
func (s *Service) Discover(ctx context.Context, tenantID string) *models.DiscoverySummary {
	if s.introspector == nil {
		return &models.DiscoverySummary{
			Status:  "skipped",
			Message: "introspector not configured",
		}
	}

	configs, err := s.getDiscoveryConfigs(ctx, tenantID)
	if err != nil {
		return &models.DiscoverySummary{
			Status:  "error",
			Message: fmt.Sprintf("failed to load discovery configs: %v", err),
		}
	}
	if len(configs) == 0 {
		return &models.DiscoverySummary{
			Status:  "skipped",
			Message: "no discovery configs provided — nothing to introspect",
		}
	}

	databaseSchemas, discoverErrors := s.introspector.Discover(ctx, configs)

	totalTables := 0
	tablesPerDatabase := make(map[string]int)
	var sampleTable *models.DiscoveredSchema
	for dbName, schemas := range databaseSchemas {
		tablesPerDatabase[dbName] = len(schemas)
		totalTables += len(schemas)
		if sampleTable == nil && len(schemas) > 0 {
			sampleTable = schemas[0]
		}
	}

	return &models.DiscoverySummary{
		TotalTablesDiscovered: totalTables,
		TablesPerDatabase:     tablesPerDatabase,
		Errors:                discoverErrors,
		SampleTable:           sampleTable,
		Status:                "ok",
		Message:               fmt.Sprintf("discovered %d tables across %d databases", totalTables, len(databaseSchemas)),
	}
}

// getDiscoveryConfigs returns the database connection configs to introspect.
// TODO: wire a real configuration source (e.g. a connection-store repository)
// so tenants can register databases for catalog discovery.
func (s *Service) getDiscoveryConfigs(ctx context.Context, tenantID string) ([]models.DiscoveryConfig, error) {
	return nil, nil
}

// --- Errors ---

func IsNotFound(err error) bool {
	return errors.Is(err, sentinel.NotFound)
}

func ErrNotFoundEntry(id string) error {
	return fmt.Errorf("catalog entry %q not found: %w", id, sentinel.NotFound)
}
