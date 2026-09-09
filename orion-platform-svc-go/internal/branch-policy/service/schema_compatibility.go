package service

import (
	"context"

	"orion/platform-svc-go/internal/branch-policy/models"
)

// SchemaCompatibilityResult is the outcome of a schema-compatibility check
// against a single deploy request. It captures:
//
//   - Compatible: true means the deploy can proceed against the current
//     target-env schema without schema-breaking changes.
//   - Breaking: descriptions of each breaking change detected (empty when
//     Compatible is true, or when the checker only saw non-breaking deltas).
//   - Warnings: non-blocking observations (deprecations, planned migrations).
//     These never flip Compatible=false on their own.
//   - CheckedAgainstSchemaVersion: the target-env schema version we compared
//     against. Empty when the checker had no version source.
//   - CheckedAgainstArtifactSchemaVersion: the schema version stamped on
//     req.ArtifactID (or req.SourceCommit when only a commit SHA is known).
//     Empty when the artifact carries no schema version.
type SchemaCompatibilityResult struct {
	Compatible                 bool
	Breaking                   []string
	Warnings                   []string
	CheckedAgainstSchemaVersion string
	CheckedAgainstArtifactSchemaVersion string
}

// SchemaCompatibilityChecker is the pluggable contract behind PreDeployGate
// R6. Implementations can be backed by anything — a migrations service, a
// schema registry, a static config — as long as they can answer "is this
// deploy compatible with the target environment's schema" for a given
// DeployRequest.
//
// The service treats any returned error as a rule failure (fail-closed for
// the caller, recorded with the error detail). Return nil result + nil error
// when the checker has nothing to say (e.g. no schema version on the artifact);
// the caller will record an informational warning.
type SchemaCompatibilityChecker interface {
	CheckSchemaCompatibility(ctx context.Context, req *models.DeployRequest) (*SchemaCompatibilityResult, error)
}

// schemaCompatDetail renders a SchemaCompatibilityResult into the short
// human-readable string that goes into GateRuleResult.Detail. It keeps the
// shape stable so tests and downstream consumers can pattern-match on it.
func schemaCompatDetail(res *SchemaCompatibilityResult) string {
	if res == nil {
		return "schema-compatibility checker returned nil result"
	}
	if !res.Compatible {
		if len(res.Breaking) == 0 {
			return "schema-compatibility failed (reason not reported by checker)"
		}
		return "schema-incompatible: " + joinStrings(res.Breaking, "; ")
	}
	if len(res.Warnings) > 0 {
		return "schema-compatible with " + itoa(len(res.Warnings)) + " warning(s): " + joinStrings(res.Warnings, "; ")
	}
	return "schema-compatible"
}

// joinStrings is a tiny local helper so we don't pull in strings.Join just for
// one call site. Deliberately small — the schema compat detail string is a
// single-line message and we want to keep this file self-contained.
func joinStrings(items []string, sep string) string {
	if len(items) == 0 {
		return ""
	}
	out := items[0]
	for _, s := range items[1:] {
		out += sep + s
	}
	return out
}

// itoa is a local int→string for the tiny detail formatter. Avoids pulling
// fmt.Sprintf into the render path (which allocates a bit for every gate
// evaluation).
func itoa(n int) string {
	if n == 0 {
		return "0"
	}
	buf := make([]byte, 0, 4)
	for n > 0 {
		buf = append(buf, byte('0'+n%10))
		n /= 10
	}
	// reverse
	for i, j := 0, len(buf)-1; i < j; i, j = i+1, j-1 {
		buf[i], buf[j] = buf[j], buf[i]
	}
	return string(buf)
}
