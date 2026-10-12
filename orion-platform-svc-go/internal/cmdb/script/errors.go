package script

import "errors"

// Sentinel errors for ExecuteScript. Returned via errors.Is so handler
// layer can map them to specific OrionError codes without string sniffing.
var (
	// ErrScriptTypeUnsupported — ScriptType not registered in Router.
	ErrScriptTypeUnsupported = errors.New("cmdb.script: unsupported script type")

	// ErrScriptTypeNotAllowed — ScriptType not in tenant whitelist.
	ErrScriptTypeNotAllowed = errors.New("cmdb.script: script type not whitelisted")

	// ErrScriptBodyEmpty — Script body is empty/whitespace.
	ErrScriptBodyEmpty = errors.New("cmdb.script: script body empty")

	// ErrScriptTooLong — Script body exceeds max length (guard against
	// memory exhaustion + log flooding).
	ErrScriptTooLong = errors.New("cmdb.script: script body too long")

	// ErrSSHNotConfigured — SSH executor requested but no host/port/creds.
	ErrSSHNotConfigured = errors.New("cmdb.script: ssh executor not configured")

	// ErrTargetEmpty — no TargetCiIds supplied (defense-in-depth; handler
	// also validates binding:required, but service must not depend on it).
	ErrTargetEmpty = errors.New("cmdb.script: no target ci ids")
)

// MaxScriptBytes is the hard cap for any single script body.
const MaxScriptBytes = 64 * 1024 // 64 KiB

// MaxPerTargetTimeout bounds how long a single target's script run can
// take. The parent ctx may still cancel earlier.
const MaxPerTargetTimeout = 300_000 // 5 minutes
