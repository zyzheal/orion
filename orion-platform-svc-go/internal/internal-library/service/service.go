package service

import (
	"context"
	"errors"
	"fmt"
	"strconv"
	"strings"
	"time"

	"orion/platform-svc-go/internal/internal-library/models"
	"orion/go-common/pkg/sentinel"
)

// RepositoryInterface defines the repository methods used by the service.
type RepositoryInterface interface {
	AddDependent(ctx context.Context, d *models.LibraryDependent) error
	CheckDependencies(ctx context.Context, repoName string) ([]models.DependencyCheckResult, error)
	Create(ctx context.Context, m *models.InternalLibrary) error
	CreateVersion(ctx context.Context, v *models.LibraryVersion) error
	Delete(ctx context.Context, tenantID, id string) error
	DeprecateVersion(ctx context.Context, libraryID, version, reason, migrationGuide string, eolDate *time.Time) (*models.LibraryVersion, error)
	GetByID(ctx context.Context, tenantID, id string) (*models.InternalLibrary, error)
	GetByName(ctx context.Context, tenantID, name string) (*models.InternalLibrary, error)
	GetVersion(ctx context.Context, libraryID, version string) (*models.LibraryVersion, error)
	List(ctx context.Context, tenantID string, limit, offset int) ([]models.InternalLibrary, error)
	ListByLanguage(ctx context.Context, tenantID, language string, limit, offset int) ([]models.InternalLibrary, error)
	ListByOwner(ctx context.Context, tenantID, owner string, limit, offset int) ([]models.InternalLibrary, error)
	ListDependents(ctx context.Context, libraryID string) ([]models.LibraryDependent, error)
	ListVersions(ctx context.Context, libraryID string) ([]models.LibraryVersion, error)
	Update(ctx context.Context, tenantID, id string, updates map[string]interface{}) (*models.InternalLibrary, error)
	UpdateDependentVersion(ctx context.Context, libraryID, repoName, newVersion string, upgradeAvailable bool, upgradeType string) error
	UpdateDependentsStats(ctx context.Context, libraryID string, totalRepos, totalTeams, usingLatest, needingUpgrade int) error
	UpdateStatus(ctx context.Context, tenantID, id, status string) (*models.InternalLibrary, error)
	UpdateVersionFields(ctx context.Context, libraryID string, currentVersion string, stableVersion string) error
	VersionExists(ctx context.Context, libraryID, version string) (bool, error)
}

type Service struct {
	repo RepositoryInterface
}

func NewService(repo RepositoryInterface) *Service {
	return &Service{repo: repo}
}

// ---------------------------------------------------------------------------
// CRUD
// ---------------------------------------------------------------------------

func (s *Service) Create(ctx context.Context, tenantID string, req models.CreateInternalLibraryRequest) (*models.InternalLibrary, error) {
	m := &models.InternalLibrary{
		TenantID:      tenantID,
		Name:          req.Name,
		DisplayName:   req.DisplayName,
		Description:   req.Description,
		Language:      req.Language,
		Owner:         req.Owner,
		Repository:    req.Repository,
		Documentation: req.Documentation,
	}
	if err := s.repo.Create(ctx, m); err != nil {
		return nil, err
	}
	return m, nil
}

func (s *Service) Get(ctx context.Context, tenantID, id string) (*models.InternalLibrary, error) {
	return s.repo.GetByID(ctx, tenantID, id)
}

func (s *Service) GetByName(ctx context.Context, tenantID, name string) (*models.InternalLibrary, error) {
	return s.repo.GetByName(ctx, tenantID, name)
}

func (s *Service) List(ctx context.Context, tenantID string, limit, offset int) ([]models.InternalLibrary, error) {
	return s.repo.List(ctx, tenantID, limit, offset)
}

func (s *Service) ListByLanguage(ctx context.Context, tenantID, language string, limit, offset int) ([]models.InternalLibrary, error) {
	return s.repo.ListByLanguage(ctx, tenantID, language, limit, offset)
}

func (s *Service) ListByOwner(ctx context.Context, tenantID, owner string, limit, offset int) ([]models.InternalLibrary, error) {
	return s.repo.ListByOwner(ctx, tenantID, owner, limit, offset)
}

func (s *Service) Update(ctx context.Context, tenantID, id string, req models.UpdateInternalLibraryRequest) (*models.InternalLibrary, error) {
	updates := make(map[string]interface{})
	if req.Name != nil {
		updates["name"] = *req.Name
	}
	if req.DisplayName != nil {
		updates["display_name"] = *req.DisplayName
	}
	if req.Description != nil {
		updates["description"] = *req.Description
	}
	if req.Language != nil {
		updates["language"] = *req.Language
	}
	if req.Owner != nil {
		updates["owner"] = *req.Owner
	}
	if req.Repository != nil {
		updates["repository"] = *req.Repository
	}
	if req.Documentation != nil {
		updates["documentation"] = *req.Documentation
	}
	return s.repo.Update(ctx, tenantID, id, updates)
}

func (s *Service) Delete(ctx context.Context, tenantID, id string) error {
	return s.repo.Delete(ctx, tenantID, id)
}

// ---------------------------------------------------------------------------
// Version management
// ---------------------------------------------------------------------------

func (s *Service) PublishVersion(ctx context.Context, libraryID string, req models.PublishVersionRequest) (*models.LibraryVersion, error) {
	lib, err := s.repo.GetByID(ctx, "", libraryID)
	if err != nil {
		return nil, err
	}

	exists, err := s.repo.VersionExists(ctx, libraryID, req.Version)
	if err != nil {
		return nil, err
	}
	if exists {
		return nil, fmt.Errorf("version already exists: %w", ErrVersionExists)
	}

	v := &models.LibraryVersion{
		LibraryID:     libraryID,
		Version:       req.Version,
		Status:        req.Status,
		Changelog:     req.Changelog,
		ArtifactID:    req.ArtifactID,
		SecurityScore: req.SecurityScore,
		TestCoverage:  req.TestCoverage,
	}
	released := time.Now().UTC()
	v.ReleasedAt = &released

	if err := s.repo.CreateVersion(ctx, v); err != nil {
		return nil, err
	}

	// Update library version fields
	status := req.Status
	if status == "" {
		status = "stable"
	}
	stableVersion := lib.LatestStableVersion
	if status == "stable" {
		stableVersion = req.Version
	}
	if err := s.repo.UpdateVersionFields(ctx, libraryID, req.Version, stableVersion); err != nil {
		return nil, err
	}

	return v, nil
}

func (s *Service) ListVersions(ctx context.Context, libraryID string) ([]models.LibraryVersion, error) {
	// Verify library exists
	_, err := s.repo.GetByID(ctx, "", libraryID)
	if err != nil {
		return nil, err
	}
	return s.repo.ListVersions(ctx, libraryID)
}

func (s *Service) GetVersion(ctx context.Context, libraryID, version string) (*models.LibraryVersion, error) {
	_, err := s.repo.GetByID(ctx, "", libraryID)
	if err != nil {
		return nil, err
	}
	return s.repo.GetVersion(ctx, libraryID, version)
}

func (s *Service) DeprecateVersion(ctx context.Context, libraryID, version, reason, migrationGuide string, eolDate *time.Time) (*models.LibraryVersion, error) {
	return s.repo.DeprecateVersion(ctx, libraryID, version, reason, migrationGuide, eolDate)
}

// ---------------------------------------------------------------------------
// Deprecation
// ---------------------------------------------------------------------------

func (s *Service) Deprecate(ctx context.Context, tenantID, id, reason, migrationGuide string, eolDate *time.Time) (*models.InternalLibrary, error) {
	lib, err := s.repo.GetByID(ctx, tenantID, id)
	if err != nil {
		return nil, err
	}
	if lib.Status == "deprecated" {
		return nil, fmt.Errorf("library already deprecated: %w", ErrAlreadyDeprecated)
	}
	lib, err = s.repo.UpdateStatus(ctx, tenantID, id, "deprecated")
	if err != nil {
		return nil, err
	}
	return lib, nil
}

func (s *Service) Activate(ctx context.Context, tenantID, id string) (*models.InternalLibrary, error) {
	lib, err := s.repo.GetByID(ctx, tenantID, id)
	if err != nil {
		return nil, err
	}
	if lib.Status == "active" {
		return nil, fmt.Errorf("library already active: %w", ErrAlreadyActive)
	}
	lib, err = s.repo.UpdateStatus(ctx, tenantID, id, "active")
	if err != nil {
		return nil, err
	}
	return lib, nil
}

// ---------------------------------------------------------------------------
// Dependency tracking
// ---------------------------------------------------------------------------

func (s *Service) ListDependents(ctx context.Context, libraryID string) ([]models.LibraryDependent, error) {
	_, err := s.repo.GetByID(ctx, "", libraryID)
	if err != nil {
		return nil, err
	}
	return s.repo.ListDependents(ctx, libraryID)
}

func (s *Service) AddDependent(ctx context.Context, libraryID string, req models.AddDependentRequest) (*models.LibraryDependent, error) {
	lib, err := s.repo.GetByID(ctx, "", libraryID)
	if err != nil {
		return nil, err
	}

	d := &models.LibraryDependent{
		LibraryID:        libraryID,
		RepoName:         req.RepoName,
		TeamName:         req.TeamName,
		CurrentVersion:   req.Version,
		UpgradeAvailable: false,
	}

	// Check if upgrade available
	latest := lib.LatestStableVersion
	if req.Version != "" && latest != "" && req.Version != latest {
		d.UpgradeAvailable = true
		d.UpgradeType = determineUpgradeType(req.Version, latest)
		d.LatestCompatibleVersion = latest
	}

	if err := s.repo.AddDependent(ctx, d); err != nil {
		return nil, err
	}
	return d, nil
}

func (s *Service) UpdateDependentVersion(ctx context.Context, libraryID, repoName, newVersion string) error {
	lib, err := s.repo.GetByID(ctx, "", libraryID)
	if err != nil {
		return err
	}

	upgradeAvailable := false
	upgradeType := ""
	latest := lib.LatestStableVersion
	if newVersion != "" && latest != "" && newVersion != latest {
		upgradeAvailable = true
		upgradeType = determineUpgradeType(newVersion, latest)
	}

	return s.repo.UpdateDependentVersion(ctx, libraryID, repoName, newVersion, upgradeAvailable, upgradeType)
}

func (s *Service) CheckDependencies(ctx context.Context, repoName string) ([]models.DependencyCheckResult, error) {
	return s.repo.CheckDependencies(ctx, repoName)
}

func (s *Service) UpdateStats(ctx context.Context, libraryID string) (*models.UpdateStatsResult, error) {
	dependents, err := s.repo.ListDependents(ctx, libraryID)
	if err != nil {
		return nil, err
	}

	lib, err := s.repo.GetByID(ctx, "", libraryID)
	if err != nil {
		return nil, err
	}

	latest := lib.LatestStableVersion
	teams := make(map[string]bool)
	usingLatest := 0

	for _, d := range dependents {
		if d.TeamName != "" {
			teams[d.TeamName] = true
		}
		if d.CurrentVersion == latest {
			usingLatest++
		}
	}

	totalRepos := len(dependents)
	totalTeams := len(teams)
	needingUpgrade := totalRepos - usingLatest

	if err := s.repo.UpdateDependentsStats(ctx, libraryID, totalRepos, totalTeams, usingLatest, needingUpgrade); err != nil {
		return nil, err
	}

	return &models.UpdateStatsResult{
		TotalRepos:          totalRepos,
		TotalTeams:          totalTeams,
		ReposUsingLatest:    usingLatest,
		ReposNeedingUpgrade: needingUpgrade,
	}, nil
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

func determineUpgradeType(current, target string) string {
	currentParts := strings.Split(current, ".")
	targetParts := strings.Split(target, ".")

	for len(currentParts) < len(targetParts) {
		currentParts = append(currentParts, "0")
	}
	for len(targetParts) < len(currentParts) {
		targetParts = append(targetParts, "0")
	}

	for i := 0; i < len(currentParts); i++ {
		c, _ := strconv.Atoi(currentParts[i])
		t, _ := strconv.Atoi(targetParts[i])
		if t > c {
			if i == 0 {
				return "major"
			}
			if i == 1 {
				return "minor"
			}
			return "patch"
		}
		if t < c {
			return "breaking"
		}
	}
	return "patch"
}

// ---------------------------------------------------------------------------
// Errors
// ---------------------------------------------------------------------------

var (

	ErrVersionExists     = errors.New("version already exists")
	ErrAlreadyDeprecated = errors.New("already deprecated")
	ErrAlreadyActive     = errors.New("already active")
)

func IsNotFound(err error) bool {
	return errors.Is(err, sentinel.NotFound)
}

func IsVersionExists(err error) bool {
	return errors.Is(err, ErrVersionExists)
}

func IsAlreadyDeprecated(err error) bool {
	return errors.Is(err, ErrAlreadyDeprecated)
}

func IsAlreadyActive(err error) bool {
	return errors.Is(err, ErrAlreadyActive)
}
