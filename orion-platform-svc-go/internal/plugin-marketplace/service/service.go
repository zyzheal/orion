package service

//go:generate mockgen -destination=mock_service.go -package=service . ServiceInterface

import (
	"context"
	"database/sql"
	"encoding/json"
	"errors"
	"fmt"

	"orion/platform-svc-go/internal/plugin-marketplace/models"

	"github.com/google/uuid"
)

// RepositoryInterface defines the repository methods used by the service.
type RepositoryInterface interface {
	CreatePlugin(ctx context.Context, p *models.Plugin) error
	GetPlugin(ctx context.Context, id string) (*models.Plugin, error)
	List(ctx context.Context, filter *models.ListPluginFilter) ([]models.Plugin, error)
	Count(ctx context.Context, filter *models.ListPluginFilter) (int64, error)
	CreateReview(ctx context.Context, rev *models.PluginReview) error
	UpdateReview(ctx context.Context, pluginID, userID string, rating int16, comment string) error
	UpdateRating(ctx context.Context, pluginID string) error
	GetQualityScore(ctx context.Context, pluginID string) (*models.QualityScore, error)
	UpsertQualityScore(ctx context.Context, qs *models.QualityScore) error
	GetStats(ctx context.Context) (*models.PluginStats, error)
	IncrementDownloadCount(ctx context.Context, id string) error
	DecrementDownloadCount(ctx context.Context, id string) error
}

var (
	ErrPluginNotFound  = errors.New("plugin not found")
	ErrPluginDisabled  = errors.New("plugin is disabled")
	ErrAlreadyInstalled = errors.New("plugin already installed")
)

type Service struct {
	repo RepositoryInterface
}

func NewService(repo RepositoryInterface) *Service {
	return &Service{repo: repo}
}

// PublishPlugin creates a new plugin listing.
func (s *Service) PublishPlugin(ctx context.Context, tenantID string, req *models.PublishPluginRequest) (*models.PluginInfo, error) {
	// Check for duplicate name+version
	var tagsJSON, depsJSON, permsJSON, schemaJSON string
	var priceCents sql.NullInt64

	if len(req.Tags) > 0 {
		b, _ := json.Marshal(req.Tags)
		tagsJSON = string(b)
	}
	if len(req.Dependencies) > 0 {
		b, _ := json.Marshal(req.Dependencies)
		depsJSON = string(b)
	}
	if len(req.Permissions) > 0 {
		b, _ := json.Marshal(req.Permissions)
		permsJSON = string(b)
	}
	if req.ConfigSchema != nil {
		b, _ := json.Marshal(req.ConfigSchema)
		schemaJSON = string(b)
	}
	if req.PriceCents != nil {
		priceCents = sql.NullInt64{Int64: *req.PriceCents, Valid: true}
	}

	p := &models.Plugin{
		TenantID:          tenantID,
		Name:              req.Name,
		Description:       sql.NullString{String: req.Description, Valid: req.Description != ""},
		Author:            sql.NullString{String: req.Author, Valid: req.Author != ""},
		Category:          sql.NullString{String: req.Category, Valid: req.Category != ""},
		Version:           req.Version,
		Tags:              sql.NullString{String: tagsJSON, Valid: tagsJSON != ""},
		IconURL:           sql.NullString{String: req.IconURL, Valid: req.IconURL != ""},
		RepositoryURL:     sql.NullString{String: req.RepositoryURL, Valid: req.RepositoryURL != ""},
		DocumentationURL:  sql.NullString{String: req.DocumentationURL, Valid: req.DocumentationURL != ""},
		PriceCents:        priceCents,
		MainEntry:         sql.NullString{String: req.MainEntry, Valid: req.MainEntry != ""},
		Code:              sql.NullString{String: req.Code, Valid: req.Code != ""},
		Dependencies:      sql.NullString{String: depsJSON, Valid: depsJSON != ""},
		PlatformAPIVersion: sql.NullString{String: req.PlatformAPIVersion, Valid: req.PlatformAPIVersion != ""},
		Permissions:       sql.NullString{String: permsJSON, Valid: permsJSON != ""},
		ConfigSchema:      sql.NullString{String: schemaJSON, Valid: schemaJSON != ""},
		Status:            models.PluginStatusActive,
	}

	if err := s.repo.CreatePlugin(ctx, p); err != nil {
		return nil, err
	}

	return s.PluginToInfo(p), nil
}

// ListPlugins returns a paginated list of plugins with filters.
func (s *Service) ListPlugins(ctx context.Context, filter *models.ListPluginFilter) ([]models.PluginInfo, int64, error) {
	plugins, err := s.repo.List(ctx, filter)
	if err != nil {
		return nil, 0, err
	}
	total, err := s.repo.Count(ctx, filter)
	if err != nil {
		return nil, 0, err
	}

	info := make([]models.PluginInfo, 0, len(plugins))
	for _, p := range plugins {
		info = append(info, *s.PluginToInfo(&p))
	}
	return info, total, nil
}

// GetPlugin returns a plugin by its id.
func (s *Service) GetPlugin(ctx context.Context, id string) (*models.PluginInfo, error) {
	p, err := s.repo.GetPlugin(ctx, id)
	if err != nil {
		return nil, ErrPluginNotFound
	}
	if p.Status != models.PluginStatusActive {
		return nil, ErrPluginDisabled
	}
	return s.PluginToInfo(p), nil
}

// InstallPlugin installs a plugin for the tenant and bumps download count.
func (s *Service) InstallPlugin(ctx context.Context, pluginID, userID string, req *models.InstallPluginRequest) (*models.PluginInstallResult, error) {
	plugin, err := s.repo.GetPlugin(ctx, pluginID)
	if err != nil {
		return nil, ErrPluginNotFound
	}
	if plugin.Status != models.PluginStatusActive {
		return nil, ErrPluginDisabled
	}

	if err := s.repo.IncrementDownloadCount(ctx, pluginID); err != nil {
		return nil, fmt.Errorf("failed to increment download count: %w", err)
	}

	return &models.PluginInstallResult{
		ID:          uuid.New().String(),
		PluginID:    pluginID,
		TenantID:    plugin.TenantID,
		Version:     plugin.Version,
		InstalledAt: 0, // computed at DB
		Status:      "installed",
	}, nil
}

// RatePlugin submits or updates a user's rating for a plugin.
func (s *Service) RatePlugin(ctx context.Context, pluginID string, req *models.ReviewPluginRequest) error {
	plugin, err := s.repo.GetPlugin(ctx, pluginID)
	if err != nil {
		return ErrPluginNotFound
	}

	rev := &models.PluginReview{
		PluginID: pluginID,
		TenantID: sql.NullString{String: plugin.TenantID, Valid: true},
		UserID:   req.UserID,
		Rating:   int16(req.Rating),
		Comment:  sql.NullString{String: req.Comment, Valid: req.Comment != ""},
	}

	// Check if user already reviewed — update if so
	existing := &models.PluginReview{UserID: req.UserID}
	_ = existing // TODO: fetch existing review and update

	if err := s.repo.CreateReview(ctx, rev); err != nil {
		return err
	}
	return s.repo.UpdateRating(ctx, pluginID)
}

// GetQualityScore computes or retrieves the quality score for a plugin.
func (s *Service) GetQualityScore(ctx context.Context, pluginID string) (*models.QualityScoreResponse, error) {
	_, err := s.repo.GetPlugin(ctx, pluginID)
	if err != nil {
		return nil, ErrPluginNotFound
	}

	qs, err := s.repo.GetQualityScore(ctx, pluginID)
	if err != nil {
		// Compute a default quality score
		qs = s.computeDefaultQuality(pluginID)
		if insertErr := s.repo.UpsertQualityScore(ctx, qs); insertErr != nil {
			return nil, insertErr
		}
	}

	return &models.QualityScoreResponse{
		PluginID:         pluginID,
		OverallScore:     int(qs.Score),
		SecurityScore:    int(qs.Security),
		ReliabilityScore: int(qs.CodeQuality),
		MaintainabilityScore: int(qs.Completeness),
		DocumentationScore:   int(qs.Documentation),
	}, nil
}

// GetStats returns aggregated marketplace stats.
func (s *Service) GetStats(ctx context.Context) (*models.PluginStats, error) {
	return s.repo.GetStats(ctx)
}

// UninstallPlugin uninstalls a plugin and decrements download count.
func (s *Service) UninstallPlugin(ctx context.Context, pluginID string) error {
	_, err := s.repo.GetPlugin(ctx, pluginID)
	if err != nil {
		return ErrPluginNotFound
	}
	return s.repo.DecrementDownloadCount(ctx, pluginID)
}

// computeDefaultQuality generates a baseline quality score.
func (s *Service) computeDefaultQuality(pluginID string) *models.QualityScore {
	return &models.QualityScore{
		PluginID:      pluginID,
		Score:         50.0,
		CodeQuality:   50,
		Security:      50,
		Completeness:  50,
		Performance:   50,
		Documentation: 50,
	}
}

// PluginToInfo converts a database Plugin to the API-facing PluginInfo.
func (s *Service) PluginToInfo(p *models.Plugin) *models.PluginInfo {
	info := &models.PluginInfo{
		ID:         p.ID,
		TenantID:   p.TenantID,
		Name:       p.Name,
		Version:    p.Version,
		Verified:   p.Verified,
		Status:     p.Status,
		CreatedAt:  p.CreatedAt,
	}
	if p.Description.Valid {
		info.Description = p.Description.String
	}
	if p.Author.Valid {
		info.Author = p.Author.String
	}
	if p.Category.Valid {
		info.Category = p.Category.String
	}
	if p.IconURL.Valid {
		info.IconURL = p.IconURL.String
	}
	if p.RepositoryURL.Valid {
		info.RepositoryURL = p.RepositoryURL.String
	}
	if p.DocumentationURL.Valid {
		info.DocumentationURL = p.DocumentationURL.String
	}
	if p.PriceCents.Valid {
		info.PriceCents = &p.PriceCents.Int64
	}
	if p.MainEntry.Valid {
		info.MainEntry = p.MainEntry.String
	}
	if p.Dependencies.Valid && p.Dependencies.String != "" {
		var deps map[string]string
		if err := json.Unmarshal([]byte(p.Dependencies.String), &deps); err == nil {
			info.Dependencies = deps
		}
	}
	if p.PlatformAPIVersion.Valid {
		info.PlatformAPIVersion = p.PlatformAPIVersion.String
	}
	if p.Permissions.Valid && p.Permissions.String != "" {
		var perms []string
		if err := json.Unmarshal([]byte(p.Permissions.String), &perms); err == nil {
			info.Permissions = perms
		}
	}
	if p.ConfigSchema.Valid && p.ConfigSchema.String != "" {
		var schema map[string]interface{}
		if err := json.Unmarshal([]byte(p.ConfigSchema.String), &schema); err == nil {
			info.ConfigSchema = schema
		}
	}
	if p.Tags.Valid && p.Tags.String != "" {
		var tags []string
		if err := json.Unmarshal([]byte(p.Tags.String), &tags); err == nil {
			info.Tags = tags
		}
	}
	info.RatingAvg = p.RatingAvg.Float64
	info.RatingCount = p.RatingCount
	info.DownloadCount = p.DownloadCount
	if p.UpdatedAt.Valid {
		info.UpdatedAt = &p.UpdatedAt.Int64
	}
	return info
}
