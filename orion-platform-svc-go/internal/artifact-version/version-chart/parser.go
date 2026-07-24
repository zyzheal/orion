package versionchart

import (
	"errors"
	"fmt"
	"strconv"
	"strings"
)

var (
	ErrInvalidVersion = errors.New("invalid semantic version")
	ErrVersionTooLong = errors.New("version string is too long")
)

// ParseSemVer parses a semantic version string into a SemVer struct.
// It handles the format: MAJOR.MINOR.PATCH[-prerelease][+build]
// Examples:
//   "1.2.3"          -> SemVer{Major: 1, Minor: 2, Patch: 3, Original: "1.2.3"}
//   "1.2.3-alpha"    -> SemVer{Major: 1, Minor: 2, Patch: 3, PreRelease: "alpha", ...}
//   "1.2.3-beta.1"   -> SemVer{Major: 1, Minor: 2, Patch: 3, PreRelease: "beta.1", ...}
//   "1.2.3-rc.1+build.42" -> SemVer{..., PreRelease: "rc.1", Build: "build.42", ...}
func ParseSemVer(version string) (*SemVer, error) {
	version = strings.TrimSpace(version)
	if version == "" {
		return nil, fmt.Errorf("%w: empty version string", ErrInvalidVersion)
	}
	if len(version) > 256 {
		return nil, fmt.Errorf("%w: length %d", ErrVersionTooLong, len(version))
	}

	// Split build metadata first
	var build string
	if idx := strings.Index(version, "+"); idx != -1 {
		build = version[idx+1:]
		version = version[:idx]
	}

	// Split pre-release
	var preRelease string
	if idx := strings.Index(version, "-"); idx != -1 {
		preRelease = version[idx+1:]
		version = version[:idx]
	}

	// Split major.minor.patch
	parts := strings.Split(version, ".")
	if len(parts) != 3 {
		return nil, fmt.Errorf("%w: expected MAJOR.MINOR.PATCH, got %q", ErrInvalidVersion, version)
	}

	major, err := strconv.Atoi(parts[0])
	if err != nil {
		return nil, fmt.Errorf("%w: invalid major %q", ErrInvalidVersion, parts[0])
	}
	if major < 0 {
		return nil, fmt.Errorf("%w: major must be non-negative", ErrInvalidVersion)
	}

	minor, err := strconv.Atoi(parts[1])
	if err != nil {
		return nil, fmt.Errorf("%w: invalid minor %q", ErrInvalidVersion, parts[1])
	}
	if minor < 0 {
		return nil, fmt.Errorf("%w: minor must be non-negative", ErrInvalidVersion)
	}

	patch, err := strconv.Atoi(parts[2])
	if err != nil {
		return nil, fmt.Errorf("%w: invalid patch %q", ErrInvalidVersion, parts[2])
	}
	if patch < 0 {
		return nil, fmt.Errorf("%w: patch must be non-negative", ErrInvalidVersion)
	}

	return &SemVer{
		Major:      major,
		Minor:      minor,
		Patch:      patch,
		PreRelease: preRelease,
		Build:      build,
		Original:   version,
	}, nil
}

// Compare compares two SemVer values and returns -1, 0, or 1.
// Pre-release versions have lower precedence than the associated normal version.
// Build metadata is ignored in comparison per semver spec.
func (v *SemVer) Compare(other *SemVer) int {
	if v == nil || other == nil {
		if v == other {
			return 0
		}
		return -1 // nil is considered smaller
	}

	// Compare major.minor.patch
	if v.Major != other.Major {
		return compareInt(v.Major, other.Major)
	}
	if v.Minor != other.Minor {
		return compareInt(v.Minor, other.Minor)
	}
	if v.Patch != other.Patch {
		return compareInt(v.Patch, other.Patch)
	}

	// Both have no pre-release
	if v.PreRelease == "" && other.PreRelease == "" {
		return 0
	}

	// Pre-release has lower precedence
	if v.PreRelease == "" {
		return 1
	}
	if other.PreRelease == "" {
		return -1
	}

	// Compare pre-release strings (simple string comparison for now)
	// A full semver implementation would split by dots and compare numerically
	return strings.Compare(v.PreRelease, other.PreRelease)
}

func compareInt(a, b int) int {
	if a < b {
		return -1
	}
	if a > b {
		return 1
	}
	return 0
}

// String returns the canonical semver string (reconstructed, not original).
func (v *SemVer) String() string {
	s := fmt.Sprintf("%d.%d.%d", v.Major, v.Minor, v.Patch)
	if v.PreRelease != "" {
		s += "-" + v.PreRelease
	}
	if v.Build != "" {
		s += "+" + v.Build
	}
	return s
}

// IsPreRelease returns true if the version has a pre-release component.
func (v *SemVer) IsPreRelease() bool {
	return v.PreRelease != ""
}

// HasBuildMetadata returns true if the version has build metadata.
func (v *SemVer) HasBuildMetadata() bool {
	return v.Build != ""
}

// IncrementMajor returns a new SemVer with the major version incremented.
func (v *SemVer) IncrementMajor() *SemVer {
	return &SemVer{
		Major:    v.Major + 1,
		Original: fmt.Sprintf("%d.0.0", v.Major+1),
	}
}

// IncrementMinor returns a new SemVer with the minor version incremented.
func (v *SemVer) IncrementMinor() *SemVer {
	return &SemVer{
		Major:    v.Major,
		Minor:    v.Minor + 1,
		Original: fmt.Sprintf("%d.%d.0", v.Major, v.Minor+1),
	}
}

// IncrementPatch returns a new SemVer with the patch version incremented.
func (v *SemVer) IncrementPatch() *SemVer {
	return &SemVer{
		Major:    v.Major,
		Minor:    v.Minor,
		Patch:    v.Patch + 1,
		Original: fmt.Sprintf("%d.%d.%d", v.Major, v.Minor, v.Patch+1),
	}
}
