package models

import "database/sql"

// --- Enums ---

// PluginStatus represents the lifecycle state of a plugin in the marketplace.
type PluginStatus string

const (
	PluginStatusActive     PluginStatus = "active"
	PluginStatusDisabled   PluginStatus = "disabled"
	PluginStatusPending    PluginStatus = "pending"
	PluginStatusUninstalled PluginStatus = "uninstalled"
)

// --- Core entity: Plugin ---

// Plugin represents a plugin listing in the marketplace.
type Plugin struct {
	ID                  string         `db:"id" json:"id"`
	TenantID            string         `db:"tenant_id" json:"tenantId"`
	Name                string         `db:"name" json:"name"`
	Description         sql.NullString `db:"description" json:"description"`
	Author              sql.NullString `db:"author" json:"author"`
	Category            sql.NullString `db:"category" json:"category"`
	Version             string         `db:"version" json:"version"`
	Tags                sql.NullString `db:"tags" json:"tags"`            // JSONB
	IconURL             sql.NullString `db:"icon_url" json:"iconUrl"`
	RepositoryURL       sql.NullString `db:"repository_url" json:"repositoryUrl"`
	DocumentationURL    sql.NullString `db:"documentation_url" json:"documentationUrl"`
	PriceCents          sql.NullInt64  `db:"price_cents" json:"priceCents"`
	MainEntry           sql.NullString `db:"main_entry" json:"mainEntry"`
	Code                sql.NullString `db:"code" json:"-"`               // omitted from API response
	Dependencies        sql.NullString `db:"dependencies" json:"dependencies"` // JSONB
	PlatformAPIVersion  sql.NullString `db:"platform_api_version" json:"platformApiVersion"`
	Permissions         sql.NullString `db:"permissions" json:"permissions"` // JSONB
	ConfigSchema        sql.NullString `db:"config_schema" json:"configSchema"` // JSONB
	Verified            bool           `db:"verified" json:"verified"`
	RatingAvg           sql.NullFloat64 `db:"rating_avg" json:"ratingAvg"`
	RatingCount         int64          `db:"rating_count" json:"ratingCount"`
	DownloadCount       int64          `db:"download_count" json:"downloadCount"`
	Status              PluginStatus   `db:"status" json:"status"`
	CreatedAt           int64          `db:"created_at" json:"createdAt"` // unix seconds
	UpdatedAt           sql.NullInt64  `db:"updated_at" json:"updatedAt"` // unix seconds
}

// --- Core entity: PluginReview ---

// PluginReview records a user rating/comment on a plugin.
type PluginReview struct {
	ID       string         `db:"id" json:"id"`
	PluginID string         `db:"plugin_id" json:"pluginId"`
	TenantID sql.NullString `db:"tenant_id" json:"tenantId"`
	UserID   string         `db:"user_id" json:"userId"`
	Rating   int16          `db:"rating" json:"rating"`
	Comment  sql.NullString `db:"comment" json:"comment"`
	CreatedAt int64         `db:"created_at" json:"createdAt"` // unix seconds
}

// --- Core entity: QualityScore ---

// QualityScore holds computed quality metrics for a plugin.
type QualityScore struct {
	PluginID      string        `db:"plugin_id" json:"pluginId"`
	Score         float64       `db:"score" json:"score"`
	CodeQuality   int16         `db:"code_quality" json:"codeQuality"`
	Security      int16         `db:"security" json:"security"`
	Completeness  int16         `db:"completeness" json:"completeness"`
	Performance   int16         `db:"performance" json:"performance"`
	Documentation int16         `db:"documentation" json:"documentation"`
	ComputedAt    int64         `db:"computed_at" json:"computedAt"` // unix seconds
}

// --- Request types ---

// PublishPluginRequest is the body for publishing a plugin.
type PublishPluginRequest struct {
	Name               string                 `json:"name" binding:"required"`
	Description        string                 `json:"description" binding:"required"`
	Author             string                 `json:"author"`
	Category           string                 `json:"category" binding:"required"`
	Version            string                 `json:"version" binding:"required"`
	Tags               []string               `json:"tags"`
	IconURL            string                 `json:"iconUrl"`
	RepositoryURL      string                 `json:"repositoryUrl"`
	DocumentationURL   string                 `json:"documentationUrl"`
	PriceCents         *int64                 `json:"priceCents"`
	MainEntry          string                 `json:"mainEntry"`
	Code               string                 `json:"code"`
	Dependencies       map[string]string      `json:"dependencies"`
	PlatformAPIVersion string                 `json:"platformApiVersion"`
	Permissions        []string               `json:"permissions"`
	ConfigSchema       map[string]interface{} `json:"configSchema"`
}

// InstallPluginRequest is the body for installing a plugin.
type InstallPluginRequest struct {
	Version string `json:"version"`
}

// ReviewPluginRequest is the body for rating a plugin.
type ReviewPluginRequest struct {
	Rating  int    `json:"rating" binding:"required,min=1,max=5"`
	Comment string `json:"comment"`
	UserID  string `json:"userId" binding:"required"`
}

// --- Response types ---

// PluginInfo is the API-facing representation of a plugin.
type PluginInfo struct {
	ID               string                 `json:"id"`
	TenantID         string                 `json:"tenantId"`
	Name             string                 `json:"name"`
	Description      string                 `json:"description"`
	Author           string                 `json:"author"`
	Category         string                 `json:"category"`
	Version          string                 `json:"version"`
	Tags             []string               `json:"tags"`
	IconURL          string                 `json:"iconUrl"`
	RepositoryURL    string                 `json:"repositoryUrl"`
	DocumentationURL string                 `json:"documentationUrl"`
	PriceCents       *int64                 `json:"priceCents"`
	MainEntry        string                 `json:"mainEntry"`
	Dependencies     map[string]string      `json:"dependencies"`
	PlatformAPIVersion string              `json:"platformApiVersion"`
	Permissions      []string               `json:"permissions"`
	ConfigSchema     map[string]interface{} `json:"configSchema"`
	Verified         bool                   `json:"verified"`
	RatingAvg        float64                `json:"ratingAvg"`
	RatingCount      int64                  `json:"ratingCount"`
	DownloadCount    int64                  `json:"downloadCount"`
	Status           PluginStatus           `json:"status"`
	CreatedAt        int64                  `json:"createdAt"`
	UpdatedAt        *int64                 `json:"updatedAt"`
}

// PluginInstallResult represents a successful plugin installation.
type PluginInstallResult struct {
	ID         string `json:"id"`
	PluginID   string `json:"pluginId"`
	TenantID   string `json:"tenantId"`
	Version    string `json:"version"`
	InstalledAt int64 `json:"installedAt"`
	Status     string `json:"status"`
}

// QualityScoreResponse is the API-facing quality score.
type QualityScoreResponse struct {
	PluginID         string  `json:"pluginId"`
	OverallScore     int     `json:"overallScore"`
	SecurityScore    int     `json:"securityScore"`
	ReliabilityScore int     `json:"reliabilityScore"`
	MaintainabilityScore int `json:"maintainabilityScore"`
	DocumentationScore int   `json:"documentationScore"`
	ReviewsCount     int64   `json:"reviewsCount"`
	AverageRating    float64 `json:"averageRating"`
}

// PluginStats aggregates marketplace statistics.
type PluginStats struct {
	TotalPlugins     int64              `json:"totalPlugins"`
	TotalInstalls    int64              `json:"totalInstalls"`
	AverageRating    float64            `json:"averageRating"`
	PluginsByCategory map[string]int64 `json:"pluginsByCategory"`
}

// --- List filter ---

// ListPluginFilter is the query filter for listing plugins.
type ListPluginFilter struct {
	Category *string
	Verified *bool
	Search   *string
	Limit    *int
	Offset   *int
}
