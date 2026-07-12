package models

import "time"

// InternalLibrary represents an internal library record.
type InternalLibrary struct {
	ID            string    `json:"id" db:"id"`
	TenantID      string    `json:"tenant_id" db:"tenant_id"`
	Name          string    `json:"name" db:"name"`
	DisplayName   string    `json:"display_name" db:"display_name"`
	Description   string    `json:"description" db:"description"`
	Language      string    `json:"language" db:"language"`          // java, node, python, go, rust, dotnet
	Status        string    `json:"status" db:"status"`              // active, deprecated, archived, development
	Owner         string    `json:"owner" db:"owner"`                // team name
	Repository    string    `json:"repository" db:"repository"`      // Git URL
	Documentation string    `json:"documentation" db:"documentation"`
	CurrentVersion      string  `json:"current_version" db:"current_version"`
	LatestStableVersion string  `json:"latest_stable_version" db:"latest_stable_version"`
	DependentsTotal     int     `json:"dependents_total" db:"dependents_total"`
	QualityTestCoverage *float64 `json:"quality_test_coverage" db:"quality_test_coverage"`
	QualitySecurityScore *float64 `json:"quality_security_score" db:"quality_security_score"`
	Labels            string `json:"labels" db:"labels"`
	Annotations       string `json:"annotations" db:"annotations"`
	CreatedAt         time.Time `json:"created_at" db:"created_at"`
	UpdatedAt         time.Time `json:"updated_at" db:"updated_at"`
}

// CreateInternalLibraryRequest mirrors TS CreateLibraryInput.
type CreateInternalLibraryRequest struct {
	Name        string `json:"name" binding:"required"`
	DisplayName string `json:"display_name"`
	Description string `json:"description"`
	Language    string `json:"language"`
	Owner       string `json:"owner" binding:"required"`
	Repository  string `json:"repository"`
	Documentation string `json:"documentation"`
}

// UpdateInternalLibraryRequest mirrors TS update fields.
type UpdateInternalLibraryRequest struct {
	Name           *string  `json:"name"`
	DisplayName    *string  `json:"display_name"`
	Description    *string  `json:"description"`
	Language       *string  `json:"language"`
	Owner          *string  `json:"owner"`
	Repository     *string  `json:"repository"`
	Documentation  *string  `json:"documentation"`
}

// LibraryVersion represents a published version of an internal library.
type LibraryVersion struct {
	ID                string     `json:"id" db:"id"`
	LibraryID         string     `json:"library_id" db:"library_id"`
	Version           string     `json:"version" db:"version"`
	Status            string     `json:"status" db:"status"`        // snapshot, alpha, beta, rc, stable, deprecated
	ReleasedAt        *time.Time `json:"released_at" db:"released_at"`
	Changelog         string     `json:"changelog" db:"changelog"`
	SecurityScore     *float64   `json:"security_score" db:"security_score"`
	TestCoverage      *float64   `json:"test_coverage" db:"test_coverage"`
	EOLDate           *time.Time `json:"eol_date" db:"eol_date"`
	DeprecationReason string     `json:"deprecation_reason" db:"deprecation_reason"`
	MigrationGuide    string     `json:"migration_guide" db:"migration_guide"`
	ArtifactID        string     `json:"artifact_id" db:"artifact_id"`
	CreatedAt         time.Time  `json:"created_at" db:"created_at"`
}

// PublishVersionRequest mirrors TS PublishVersionInput.
type PublishVersionRequest struct {
	Version       string   `json:"version" binding:"required"`
	Status        string   `json:"status"`
	Changelog     string   `json:"changelog"`
	ArtifactID    string   `json:"artifact_id"`
	SecurityScore *float64 `json:"security_score"`
	TestCoverage  *float64 `json:"test_coverage"`
}

// DeprecateVersionRequest body for deprecating a single version.
type DeprecateVersionRequest struct {
	Reason         string     `json:"reason"`
	EOLDate        *time.Time `json:"eol_date"`
	MigrationGuide string     `json:"migration_guide"`
}

// DeprecateLibraryRequest mirrors TS DeprecateLibraryInput.
type DeprecateLibraryRequest struct {
	Reason           string     `json:"reason"`
	EOLDate          *time.Time `json:"eol_date"`
	MigrationGuide   string     `json:"migration_guide"`
	ReplacementLibrary string   `json:"replacement_library"`
}

// LibraryDependent represents a dependent relationship (repo → library).
type LibraryDependent struct {
	ID                    string     `json:"id" db:"id"`
	LibraryID             string     `json:"library_id" db:"library_id"`
	RepoName              string     `json:"repo_name" db:"repo_name"`
	TeamName              string     `json:"team_name" db:"team_name"`
	CurrentVersion        string     `json:"current_version" db:"current_version"`
	LatestCompatibleVersion string   `json:"latest_compatible_version" db:"latest_compatible_version"`
	UpgradeAvailable      bool       `json:"upgrade_available" db:"upgrade_available"`
	UpgradeType           string     `json:"upgrade_type" db:"upgrade_type"`      // patch, minor, major, breaking
	LastUpdated           *time.Time `json:"last_updated" db:"last_updated"`
	CreatedAt             time.Time  `json:"created_at" db:"created_at"`
}

// AddDependentRequest body for adding a dependent.
type AddDependentRequest struct {
	RepoName string `json:"repoName" binding:"required"`
	TeamName string `json:"teamName"`
	Version  string `json:"version"`
}

// UpdateDependentRequest body for updating dependent version.
type UpdateDependentRequest struct {
	Version string `json:"version" binding:"required"`
}

// DependencyCheckResult mirrors TS DependencyCheckResult.
type DependencyCheckResult struct {
	LibraryName    string  `json:"library_name"`
	CurrentVersion string  `json:"current_version"`
	LatestVersion  string  `json:"latest_version"`
	Status         string  `json:"status"`              // latest, upgrade_available, breaking_change, deprecated
	UpgradeType    string  `json:"upgrade_type,omitempty"`
	SecurityScore  *float64 `json:"security_score,omitempty"`
}

// UpdateStatsResult contains recalculated stats after UpdateStats.
type UpdateStatsResult struct {
	TotalRepos        int `json:"total_repos"`
	TotalTeams        int `json:"total_teams"`
	ReposUsingLatest  int `json:"repos_using_latest"`
	ReposNeedingUpgrade int `json:"repos_needing_upgrade"`
}
