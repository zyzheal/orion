// Package middleware provides the source-guard middleware for dual-write
// conflict prevention between the TS monolith and the Go microservice.
//
// The SourceGuard reads its configuration from the SOURCE_GUARD_MODE
// environment variable (default: "readwrite").

package middleware

import "os"

const sourceGuardEnv = "SOURCE_GUARD_MODE"

// Known source-guard modes.
const (
	ModeReadWrite = "readwrite"
	ModeReadOnly  = "readonly"
)

// Mode returns the current source-guard mode from SOURCE_GUARD_MODE.
// Defaults to ModeReadWrite when the environment variable is unset or empty.
// Returns one of ModeReadWrite or ModeReadOnly.
func Mode() string {
	if v := os.Getenv(sourceGuardEnv); v != "" {
		switch v {
		case ModeReadWrite:
			return ModeReadWrite
		case ModeReadOnly:
			return ModeReadOnly
		}
		// Unrecognized value: fall through to default (readwrite) for safety.
	}
	return ModeReadWrite
}
