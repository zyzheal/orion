package service

import (
	"fmt"
	"strings"
	"sync"
	"time"
)

// VersionStatus represents the lifecycle state of an API version.
type VersionStatus string

const (
	StatusStable     VersionStatus = "stable"
	StatusBeta       VersionStatus = "beta"
	StatusDeprecated VersionStatus = "deprecated"
	StatusRetired    VersionStatus = "retired"
)

// VersionDefinition describes a registered API version.
type VersionDefinition struct {
	Version         string        `json:"version"`
	Status          VersionStatus `json:"status"`
	ReleaseDate     *time.Time    `json:"releaseDate,omitempty"`
	Features        []string      `json:"features,omitempty"`
	DeprecationDate *time.Time    `json:"deprecationDate,omitempty"`
	SunsetDate      *time.Time    `json:"sunsetDate,omitempty"`
	MigrationGuide  string        `json:"migrationGuide,omitempty"`
}

// DeprecationNotice describes a deprecation warning for a version.
type DeprecationNotice struct {
	Version        string    `json:"version"`
	Warning        string    `json:"warning"`
	DeprecationDate time.Time `json:"deprecationDate"`
	SunsetDate     time.Time `json:"sunsetDate"`
	MigrationGuide string    `json:"migrationGuide,omitempty"`
}

// VersionNegotiationResult holds the result of version negotiation.
type VersionNegotiationResult struct {
	RequestedVersion   string
	ResolvedVersion    string
	Source             string // "header", "url", "default"
	IsDeprecated       bool
	DeprecationNotice  *DeprecationNotice
}

// ApiVersionRegistry manages registered API versions.
type ApiVersionRegistry struct {
	mu             sync.RWMutex
	versions       map[string]*VersionDefinition
	currentVersion string
}

// NewApiVersionRegistry creates a registry with default versions.
func NewApiVersionRegistry(currentVersion string) *ApiVersionRegistry {
	r := &ApiVersionRegistry{
		versions:       make(map[string]*VersionDefinition),
		currentVersion: currentVersion,
	}
	now := time.Now()
	r.RegisterVersion(&VersionDefinition{
		Version:     currentVersion,
		Status:      StatusStable,
		ReleaseDate: &now,
		Features:    []string{"core"},
	})
	return r
}

// RegisterVersion adds or updates a version.
func (r *ApiVersionRegistry) RegisterVersion(v *VersionDefinition) {
	r.mu.Lock()
	defer r.mu.Unlock()
	r.versions[v.Version] = v
}

// HasVersion checks if a version exists.
func (r *ApiVersionRegistry) HasVersion(version string) bool {
	r.mu.RLock()
	defer r.mu.RUnlock()
	_, ok := r.versions[version]
	return ok
}

// GetVersion returns a version definition.
func (r *ApiVersionRegistry) GetVersion(version string) *VersionDefinition {
	r.mu.RLock()
	defer r.mu.RUnlock()
	return r.versions[version]
}

// GetCurrentVersion returns the current (latest stable) version.
func (r *ApiVersionRegistry) GetCurrentVersion() *VersionDefinition {
	r.mu.RLock()
	defer r.mu.RUnlock()
	return r.versions[r.currentVersion]
}

// GetAllVersions returns all registered versions.
func (r *ApiVersionRegistry) GetAllVersions() []*VersionDefinition {
	r.mu.RLock()
	defer r.mu.RUnlock()
	result := make([]*VersionDefinition, 0, len(r.versions))
	for _, v := range r.versions {
		result = append(result, v)
	}
	return result
}

// GetSupportedVersions returns all non-retired versions.
func (r *ApiVersionRegistry) GetSupportedVersions() []*VersionDefinition {
	r.mu.RLock()
	defer r.mu.RUnlock()
	var result []*VersionDefinition
	for _, v := range r.versions {
		if v.Status != StatusRetired {
			result = append(result, v)
		}
	}
	return result
}

// GetAllDeprecationNotices returns deprecation notices for deprecated versions.
func (r *ApiVersionRegistry) GetAllDeprecationNotices() []*DeprecationNotice {
	r.mu.RLock()
	defer r.mu.RUnlock()
	var result []*DeprecationNotice
	for _, v := range r.versions {
		if v.Status == StatusDeprecated && v.DeprecationDate != nil {
			notice := &DeprecationNotice{
				Version:         v.Version,
				Warning:         fmt.Sprintf("API version %s is deprecated and will be sunset on %s", v.Version, v.SunsetDate.Format(time.RFC3339)),
				DeprecationDate: *v.DeprecationDate,
				MigrationGuide:  v.MigrationGuide,
			}
			if v.SunsetDate != nil {
				notice.SunsetDate = *v.SunsetDate
			}
			result = append(result, notice)
		}
	}
	return result
}

// ApiVersionManager handles version negotiation and deprecation warnings.
type ApiVersionManager struct {
	registry   *ApiVersionRegistry
	headerName string
	urlPrefix  string
}

// NewApiVersionManager creates a version manager.
func NewApiVersionManager(registry *ApiVersionRegistry) *ApiVersionManager {
	return &ApiVersionManager{
		registry:   registry,
		headerName: "x-api-version",
		urlPrefix:  "/api/",
	}
}

// NegotiateVersion extracts the API version from a request and validates it.
func (m *ApiVersionManager) NegotiateVersion(path, headerVersion string) (*VersionNegotiationResult, error) {
	requestedVersion := ""
	source := "default"

	if headerVersion != "" {
		requestedVersion = headerVersion
		source = "header"
	} else {
		// Try to extract from URL: /api/v1/... -> v1
		if strings.HasPrefix(path, m.urlPrefix) {
			rest := path[len(m.urlPrefix):]
			if strings.HasPrefix(rest, "v") {
				parts := strings.SplitN(rest, "/", 2)
				if len(parts) > 0 {
					requestedVersion = parts[0]
					source = "url"
				}
			}
		}
	}

	if requestedVersion == "" {
		current := m.registry.GetCurrentVersion()
		if current == nil {
			return nil, fmt.Errorf("unable to determine API version and no default available")
		}
		return &VersionNegotiationResult{
			RequestedVersion: "",
			ResolvedVersion:  current.Version,
			Source:           "default",
		}, nil
	}

	versionDef := m.registry.GetVersion(requestedVersion)
	if versionDef == nil {
		return nil, fmt.Errorf("unsupported API version: %s", requestedVersion)
	}

	if versionDef.Status == StatusRetired {
		return nil, fmt.Errorf("API version %s has been retired", requestedVersion)
	}

	result := &VersionNegotiationResult{
		RequestedVersion: requestedVersion,
		ResolvedVersion:  requestedVersion,
		Source:           source,
		IsDeprecated:     versionDef.Status == StatusDeprecated,
	}

	if versionDef.Status == StatusDeprecated && versionDef.DeprecationDate != nil {
		notice := &DeprecationNotice{
			Version:         versionDef.Version,
			DeprecationDate: *versionDef.DeprecationDate,
			MigrationGuide:  versionDef.MigrationGuide,
		}
		if versionDef.SunsetDate != nil {
			notice.SunsetDate = *versionDef.SunsetDate
		}
		notice.Warning = fmt.Sprintf("API version %s is deprecated and will be sunset on %s",
			versionDef.Version, notice.SunsetDate.Format(time.RFC3339))
		result.DeprecationNotice = notice
	}

	return result, nil
}

// GetRegistry returns the underlying version registry.
func (m *ApiVersionManager) GetRegistry() *ApiVersionRegistry {
	return m.registry
}

// GetVersionWarningHeaders returns deprecation warning headers.
func (m *ApiVersionManager) GetVersionWarningHeaders(result *VersionNegotiationResult) map[string]string {
	headers := map[string]string{
		"X-API-Version": result.ResolvedVersion,
	}
	if result.DeprecationNotice != nil {
		headers["X-API-Deprecated"] = "true"
		headers["X-API-Deprecation-Date"] = result.DeprecationNotice.DeprecationDate.Format(time.RFC3339)
		headers["X-API-Sunset-Date"] = result.DeprecationNotice.SunsetDate.Format(time.RFC3339)
		if result.DeprecationNotice.MigrationGuide != "" {
			headers["X-API-Migration-Guide"] = result.DeprecationNotice.MigrationGuide
		}
		headers["Warning"] = fmt.Sprintf(`299 - "API version %s is deprecated"`, result.DeprecationNotice.Version)
	}
	return headers
}
