// Package registry provides the ActionRegistry: a centralized catalog of 42
// automation action types organized across 6 operational domains.
//
// Action categories (NeatLogic-aligned):
//   - File:        file copy/move/delete/list/read/write/diff/grep/compress
//   - Network:     ping/curl/telnet/nc/port-check/ssl-check/dns-lookup/traceroute
//   - Database:    sql-query/mysql-backup/pg-dump/redis-cli/health-check
//   - System:      shell/python/script/docker/kubernetes/ssh/cron/ls/process
//   - Notification: slack/webhook/email/sms/log
//   - Security:    scan/encrypt/hash/sudo/perm-check/sandbox/audit
//
// Each Action defines:
//   - a unique name and human-readable description
//   - the category it belongs to
//   - the required parameters schema
//   - the default timeout and retry policy
package registry

import (
	"fmt"
	"sync"
)

// =============================================================================
// Constants — action categories
// =============================================================================

const (
	CategoryFile         = "file"
	CategoryNetwork      = "network"
	CategoryDatabase     = "database"
	CategorySystem       = "system"
	CategoryNotification = "notification"
	CategorySecurity     = "security"
)

// =============================================================================
// Action — a single automation action type
// =============================================================================

// Action defines one atomic automation operation.
type Action struct {
	Name           string                 `json:"name"`
	Category       string                 `json:"category"`
	Description    string                 `json:"description"`
	Params         map[string]ParamSchema `json:"params"`
	DefaultTimeout int                    `json:"default_timeout_sec"`
	DefaultRetries int                    `json:"default_retries"`
	Tags           []string               `json:"tags"`
}

// ParamSchema describes a single action parameter.
type ParamSchema struct {
	Type        string `json:"type"`
	Required    bool   `json:"required"`
	Description string `json:"description"`
	// PluginType identifies the parameter-plugin responsible for validation.
	// Empty string means the built-in type checker is used.
	PluginType  string `json:"plugin_type,omitempty"`
}

// =============================================================================
// ActionRegistry — thread-safe registry for all 42 actions
// =============================================================================

type ActionRegistry struct {
	mu      sync.RWMutex
	actions map[string]*Action // keyed by name
}

// NewActionRegistry creates a fresh registry and populates it with the 42
// built-in actions defined in DefaultActions().
func NewActionRegistry() *ActionRegistry {
	actions := make(map[string]*Action)
	r := &ActionRegistry{actions: actions}
	for _, a := range DefaultActions() {
		r.actions[a.Name] = a
	}
	return r
}

// Get returns the Action with the given name, or nil if not found.
func (r *ActionRegistry) Get(name string) *Action {
	r.mu.RLock()
	defer r.mu.RUnlock()
	return r.actions[name]
}

// ListByCategory returns all actions belonging to the given category.
func (r *ActionRegistry) ListByCategory(category string) []*Action {
	r.mu.RLock()
	defer r.mu.RUnlock()
	var out []*Action
	for _, a := range r.actions {
		if a.Category == category {
			out = append(out, a)
		}
	}
	return out
}

// ListAll returns every registered action.
func (r *ActionRegistry) ListAll() []*Action {
	r.mu.RLock()
	defer r.mu.RUnlock()
	var out []*Action
	for _, a := range r.actions {
		out = append(out, a)
	}
	return out
}

// Register adds a custom action to the registry. Returns an error if the name
// conflicts with a built-in action.
func (r *ActionRegistry) Register(a *Action) error {
	r.mu.Lock()
	defer r.mu.Unlock()
	if _, ok := r.actions[a.Name]; ok {
		return fmt.Errorf("action already registered: %s", a.Name)
	}
	r.actions[a.Name] = a
	return nil
}

// Unregister removes an action by name. Returns an error if not found.
func (r *ActionRegistry) Unregister(name string) error {
	r.mu.Lock()
	defer r.mu.Unlock()
	if _, ok := r.actions[name]; !ok {
		return fmt.Errorf("action not found: %s", name)
	}
	delete(r.actions, name)
	return nil
}

// Count returns the total number of registered actions.
func (r *ActionRegistry) Count() int {
	r.mu.RLock()
	defer r.mu.RUnlock()
	return len(r.actions)
}

// ---------------------------------------------------------------------------
// Helper: build params with/without plugin type
// ---------------------------------------------------------------------------

func param(name, typ, desc string, required bool) ParamSchema {
	return ParamSchema{
		Type:        typ,
		Required:    required,
		Description: desc,
	}
}

func paramWithPlugin(name, typ, desc string, required bool, plugin string) ParamSchema {
	p := param(name, typ, desc, required)
	p.PluginType = plugin
	return p
}

// =============================================================================
// DefaultActions — the canonical 42 action types
// =============================================================================

func DefaultActions() []*Action {
	return []*Action{
		// ------------------------------------------------------------------
		// File (8 actions)
		// ------------------------------------------------------------------
		{
			Name:           "file.copy",
			Category:       CategoryFile,
			Description:    "Copy a file or directory from source to destination",
			Params: map[string]ParamSchema{
				"src":      param("src", "string", "Source path", true),
				"dst":      param("dst", "string", "Destination path", true),
				"recursive": param("recursive", "boolean", "Copy directories recursively", false),
			},
			DefaultTimeout: 300,
			DefaultRetries: 1,
			Tags:           []string{"file", "copy"},
		},
		{
			Name:           "file.move",
			Category:       CategoryFile,
			Description:    "Move or rename a file or directory",
			Params: map[string]ParamSchema{
				"src": param("src", "string", "Source path", true),
				"dst": param("dst", "string", "Destination path", true),
			},
			DefaultTimeout: 300,
			DefaultRetries: 1,
			Tags:           []string{"file", "move"},
		},
		{
			Name:           "file.delete",
			Category:       CategoryFile,
			Description:    "Delete a file or directory",
			Params: map[string]ParamSchema{
				"path":     param("path", "string", "Path to delete", true),
				"recursive": param("recursive", "boolean", "Delete directories recursively", false),
			},
			DefaultTimeout: 120,
			DefaultRetries: 0,
			Tags:           []string{"file", "delete"},
		},
		{
			Name:           "file.list",
			Category:       CategoryFile,
			Description:    "List files and directories in a path",
			Params: map[string]ParamSchema{
				"path":  param("path", "string", "Directory to list", true),
				"depth": param("depth", "integer", "Max recursion depth", false),
			},
			DefaultTimeout: 60,
			DefaultRetries: 0,
			Tags:           []string{"file", "list"},
		},
		{
			Name:           "file.read",
			Category:       CategoryFile,
			Description:    "Read the contents of a file",
			Params: map[string]ParamSchema{
				"path":  param("path", "string", "File to read", true),
				"limit": param("limit", "integer", "Max bytes to read", false),
			},
			DefaultTimeout: 30,
			DefaultRetries: 0,
			Tags:           []string{"file", "read"},
		},
		{
			Name:           "file.write",
			Category:       CategoryFile,
			Description:    "Write content to a file (creates parents)",
			Params: map[string]ParamSchema{
				"path":    param("path", "string", "Target file path", true),
				"content": param("content", "string", "Content to write", true),
				"mode":    param("mode", "string", "Unix file mode (e.g. 0644)", false),
			},
			DefaultTimeout: 60,
			DefaultRetries: 1,
			Tags:           []string{"file", "write"},
		},
		{
			Name:           "file.diff",
			Category:       CategoryFile,
			Description:    "Show the diff between two files",
			Params: map[string]ParamSchema{
				"file_a": param("file_a", "string", "First file path", true),
				"file_b": param("file_b", "string", "Second file path", true),
			},
			DefaultTimeout: 120,
			DefaultRetries: 0,
			Tags:           []string{"file", "diff"},
		},
		{
			Name:           "file.grep",
			Category:       CategoryFile,
			Description:    "Search for a pattern in files using grep",
			Params: map[string]ParamSchema{
				"pattern": param("pattern", "string", "Regex pattern to search", true),
				"path":    param("path", "string", "File or directory to search", true),
				"flags":   param("flags", "string", "grep flags (e.g. -i -r)", false),
			},
			DefaultTimeout: 120,
			DefaultRetries: 0,
			Tags:           []string{"file", "search"},
		},
		// ------------------------------------------------------------------
		// Network (8 actions)
		// ------------------------------------------------------------------
		{
			Name:           "network.ping",
			Category:       CategoryNetwork,
			Description:    "Ping a host and report latency",
			Params: map[string]ParamSchema{
				"host":   param("host", "string", "Host or IP to ping", true),
				"count":  param("count", "integer", "Number of pings", false),
				"timeout": param("timeout", "integer", "Per-ping timeout (s)", false),
			},
			DefaultTimeout: 30,
			DefaultRetries: 0,
			Tags:           []string{"network", "ping"},
		},
		{
			Name:           "network.curl",
			Category:       CategoryNetwork,
			Description:    "Send an HTTP request (curl wrapper)",
			Params: map[string]ParamSchema{
				"url":     param("url", "string", "Target URL", true),
				"method":  param("method", "string", "HTTP method", false),
				"headers": param("headers", "object", "Request headers", false),
				"body":    param("body", "string", "Request body", false),
			},
			DefaultTimeout: 60,
			DefaultRetries: 1,
			Tags:           []string{"network", "http"},
		},
		{
			Name:           "network.telnet",
			Category:       CategoryNetwork,
			Description:    "Test TCP connectivity via telnet",
			Params: map[string]ParamSchema{
				"host":  param("host", "string", "Target host", true),
				"port":  param("port", "integer", "Target port", true),
				"timeout": param("timeout", "integer", "Connection timeout (s)", false),
			},
			DefaultTimeout: 15,
			DefaultRetries: 0,
			Tags:           []string{"network", "tcp"},
		},
		{
			Name:           "network.nc",
			Category:       CategoryNetwork,
			Description:    "Netcat port test or banner grab",
			Params: map[string]ParamSchema{
				"host":  param("host", "string", "Target host", true),
				"port":  param("port", "integer", "Target port", true),
				"payload": param("payload", "string", "Optional payload to send", false),
			},
			DefaultTimeout: 15,
			DefaultRetries: 0,
			Tags:           []string{"network", "nc"},
		},
		{
			Name:           "network.port-check",
			Category:       CategoryNetwork,
			Description:    "Check if a range of ports are open",
			Params: map[string]ParamSchema{
				"host":     param("host", "string", "Target host", true),
				"ports":    paramWithPlugin("ports", "array", "Port numbers to check", true, "array"),
				"timeout":  param("timeout", "integer", "Per-port timeout (s)", false),
			},
			DefaultTimeout: 120,
			DefaultRetries: 0,
			Tags:           []string{"network", "port-scan"},
		},
		{
			Name:           "network.ssl-check",
			Category:       CategoryNetwork,
			Description:    "Inspect TLS certificate for a host:port",
			Params: map[string]ParamSchema{
				"host":  param("host", "string", "Target host", true),
				"port":  param("port", "integer", "TLS port (default 443)", false),
			},
			DefaultTimeout: 30,
			DefaultRetries: 0,
			Tags:           []string{"network", "tls"},
		},
		{
			Name:           "network.dns-lookup",
			Category:       CategoryNetwork,
			Description:    "Perform DNS lookup for a domain",
			Params: map[string]ParamSchema{
				"domain": param("domain", "string", "Domain name", true),
				"record": param("record", "string", "Record type (A/AAAA/MX/CNAME)", false),
			},
			DefaultTimeout: 15,
			DefaultRetries: 0,
			Tags:           []string{"network", "dns"},
		},
		{
			Name:           "network.traceroute",
			Category:       CategoryNetwork,
			Description:    "Trace network route to a host",
			Params: map[string]ParamSchema{
				"host":  param("host", "string", "Target host", true),
				"max_hops": param("max_hops", "integer", "Max hops (default 30)", false),
			},
			DefaultTimeout: 120,
			DefaultRetries: 0,
			Tags:           []string{"network", "traceroute"},
		},
		// ------------------------------------------------------------------
		// Database (5 actions)
		// ------------------------------------------------------------------
		{
			Name:           "database.sql-query",
			Category:       CategoryDatabase,
			Description:    "Execute a SQL query against a database",
			Params: map[string]ParamSchema{
				"connection": param("connection", "string", "DSN or connection name", true),
				"query":      param("query", "string", "SQL query to execute", true),
				"params":     param("params", "object", "Query parameters", false),
			},
			DefaultTimeout: 60,
			DefaultRetries: 1,
			Tags:           []string{"database", "sql"},
		},
		{
			Name:           "database.mysql-backup",
			Category:       CategoryDatabase,
			Description:    "Create a mysqldump backup",
			Params: map[string]ParamSchema{
				"connection": param("connection", "string", "MySQL DSN", true),
				"database":   param("database", "string", "Database name", true),
				"output":     param("output", "string", "Backup file path", true),
			},
			DefaultTimeout: 3600,
			DefaultRetries: 1,
			Tags:           []string{"database", "mysql", "backup"},
		},
		{
			Name:           "database.pg-dump",
			Category:       CategoryDatabase,
			Description:    "Create a pg_dump backup",
			Params: map[string]ParamSchema{
				"connection": param("connection", "string", "PostgreSQL DSN", true),
				"database":   param("database", "string", "Database name", true),
				"output":     param("output", "string", "Dump file path", true),
			},
			DefaultTimeout: 3600,
			DefaultRetries: 1,
			Tags:           []string{"database", "postgres", "backup"},
		},
		{
			Name:           "database.redis-cli",
			Category:       CategoryDatabase,
			Description:    "Execute a redis-cli command",
			Params: map[string]ParamSchema{
				"host":   param("host", "string", "Redis host", true),
				"port":   param("port", "integer", "Redis port", false),
				"command": param("command", "string", "Redis command (e.g. GET key)", true),
			},
			DefaultTimeout: 30,
			DefaultRetries: 0,
			Tags:           []string{"database", "redis"},
		},
		{
			Name:           "database.health-check",
			Category:       CategoryDatabase,
			Description:    "Ping a database to verify connectivity",
			Params: map[string]ParamSchema{
				"connection": param("connection", "string", "DSN or connection name", true),
				"database":   param("database", "string", "Database to check", false),
			},
			DefaultTimeout: 15,
			DefaultRetries: 2,
			Tags:           []string{"database", "health"},
		},
		// ------------------------------------------------------------------
		// System (9 actions)
		// ------------------------------------------------------------------
		{
			Name:           "system.shell",
			Category:       CategorySystem,
			Description:    "Execute a shell command",
			Params: map[string]ParamSchema{
				"command":  param("command", "string", "Shell command to execute", true),
				"args":     param("args", "array", "Command arguments", false),
				"workdir":  param("workdir", "string", "Working directory", false),
			},
			DefaultTimeout: 300,
			DefaultRetries: 0,
			Tags:           []string{"system", "shell"},
		},
		{
			Name:           "system.python",
			Category:       CategorySystem,
			Description:    "Execute a Python script",
			Params: map[string]ParamSchema{
				"script":   param("script", "string", "Python script content", true),
				"args":     param("args", "array", "Script arguments", false),
				"workdir":  param("workdir", "string", "Working directory", false),
			},
			DefaultTimeout: 600,
			DefaultRetries: 0,
			Tags:           []string{"system", "python"},
		},
		{
			Name:           "system.script",
			Category:       CategorySystem,
			Description:    "Execute a script by interpreter (sh/python/ruby)",
			Params: map[string]ParamSchema{
				"interpreter": param("interpreter", "string", "Interpreter (sh/python/ruby)", true),
				"script":      param("script", "string", "Script content", true),
			},
			DefaultTimeout: 300,
			DefaultRetries: 0,
			Tags:           []string{"system", "script"},
		},
		{
			Name:           "system.docker",
			Category:       CategorySystem,
			Description:    "Execute a docker CLI command",
			Params: map[string]ParamSchema{
				"command": param("command", "string", "Docker subcommand (run/ps/logs)", true),
				"args":    param("args", "array", "Docker arguments", false),
			},
			DefaultTimeout: 300,
			DefaultRetries: 0,
			Tags:           []string{"system", "docker"},
		},
		{
			Name:           "system.kubernetes",
			Category:       CategorySystem,
			Description:    "Execute a kubectl CLI command",
			Params: map[string]ParamSchema{
				"command":  param("command", "string", "Kubectl subcommand", true),
				"args":     param("args", "array", "Kubectl arguments", false),
				"namespace": param("namespace", "string", "K8s namespace", false),
			},
			DefaultTimeout: 120,
			DefaultRetries: 1,
			Tags:           []string{"system", "kubernetes"},
		},
		{
			Name:           "system.ssh",
			Category:       CategorySystem,
			Description:    "Execute a command over SSH",
			Params: map[string]ParamSchema{
				"host":     param("host", "string", "SSH host", true),
				"command":  param("command", "string", "Remote command", true),
				"user":     param("user", "string", "SSH user", false),
				"key_path": param("key_path", "string", "SSH private key path", false),
			},
			DefaultTimeout: 120,
			DefaultRetries: 1,
			Tags:           []string{"system", "ssh"},
		},
		{
			Name:           "system.cron",
			Category:       CategorySystem,
			Description:    "Manage crontab (list/add/remove)",
			Params: map[string]ParamSchema{
				"operation": param("operation", "enum", "Operation (list/add/remove)", true),
				"schedule":  param("schedule", "string", "Cron expression (for add/remove)", false),
				"command":   param("command", "string", "Command to schedule (for add)", false),
			},
			DefaultTimeout: 30,
			DefaultRetries: 0,
			Tags:           []string{"system", "cron"},
		},
		{
			Name:           "system.process",
			Category:       CategorySystem,
			Description:    "List, start, or kill processes",
			Params: map[string]ParamSchema{
				"operation": param("operation", "enum", "Operation (list/start/kill)", true),
				"name":      param("name", "string", "Process name/pattern", false),
				"signal":    param("signal", "string", "Signal to send (for kill)", false),
			},
			DefaultTimeout: 30,
			DefaultRetries: 0,
			Tags:           []string{"system", "process"},
		},
		// ------------------------------------------------------------------
		// Notification (5 actions)
		// ------------------------------------------------------------------
		{
			Name:           "notification.slack",
			Category:       CategoryNotification,
			Description:    "Send a Slack message via webhook",
			Params: map[string]ParamSchema{
				"webhook": param("webhook", "string", "Slack webhook URL", true),
				"channel": param("channel", "string", "Slack channel", true),
				"text":    param("text", "string", "Message text", true),
				"blocks":  param("blocks", "object", "Block kit payload", false),
			},
			DefaultTimeout: 15,
			DefaultRetries: 2,
			Tags:           []string{"notification", "slack"},
		},
		{
			Name:           "notification.webhook",
			Category:       CategoryNotification,
			Description:    "Send an HTTP webhook POST",
			Params: map[string]ParamSchema{
				"url":    param("url", "string", "Webhook URL", true),
				"payload": param("payload", "object", "JSON body", true),
				"headers": param("headers", "object", "Request headers", false),
			},
			DefaultTimeout: 30,
			DefaultRetries: 2,
			Tags:           []string{"notification", "webhook"},
		},
		{
			Name:           "notification.email",
			Category:       CategoryNotification,
			Description:    "Send an email notification",
			Params: map[string]ParamSchema{
				"to":      param("to", "string", "Recipient email", true),
				"subject": param("subject", "string", "Email subject", true),
				"body":    param("body", "string", "Email body", true),
			},
			DefaultTimeout: 30,
			DefaultRetries: 2,
			Tags:           []string{"notification", "email"},
		},
		{
			Name:           "notification.sms",
			Category:       CategoryNotification,
			Description:    "Send an SMS notification",
			Params: map[string]ParamSchema{
				"phone": param("phone", "string", "Recipient phone number", true),
				"message": param("message", "string", "SMS body", true),
			},
			DefaultTimeout: 30,
			DefaultRetries: 2,
			Tags:           []string{"notification", "sms"},
		},
		{
			Name:           "notification.log",
			Category:       CategoryNotification,
			Description:    "Write a structured log entry",
			Params: map[string]ParamSchema{
				"level":   param("level", "enum", "Log level (info/warn/error)", true),
				"message": param("message", "string", "Log message", true),
				"tags":    param("tags", "array", "Additional log tags", false),
			},
			DefaultTimeout: 5,
			DefaultRetries: 0,
			Tags:           []string{"notification", "log"},
		},
		// ------------------------------------------------------------------
		// Security (7 actions)
		// ------------------------------------------------------------------
		{
			Name:           "security.scan",
			Category:       CategorySecurity,
			Description:    "Run a security scan (trivy/cycloneDX)",
			Params: map[string]ParamSchema{
				"target":    param("target", "string", "Target to scan (image/path)", true),
				"tool":      param("tool", "string", "Scanner tool (trivy)", false),
				"severity":  param("severity", "enum", "Severity filter", false),
			},
			DefaultTimeout: 1800,
			DefaultRetries: 1,
			Tags:           []string{"security", "scan"},
		},
		{
			Name:           "security.encrypt",
			Category:       CategorySecurity,
			Description:    "Encrypt a value using the platform KMS",
			Params: map[string]ParamSchema{
				"plaintext": param("plaintext", "string", "Value to encrypt", true),
				"algorithm": param("algorithm", "string", "Encryption algorithm", false),
			},
			DefaultTimeout: 10,
			DefaultRetries: 0,
			Tags:           []string{"security", "encrypt"},
		},
		{
			Name:           "security.hash",
			Category:       CategorySecurity,
			Description:    "Compute a cryptographic hash",
			Params: map[string]ParamSchema{
				"value":   param("value", "string", "Value to hash", true),
				"algorithm": param("algorithm", "enum", "Hash algorithm (sha256/md5/sha512)", false),
			},
			DefaultTimeout: 10,
			DefaultRetries: 0,
			Tags:           []string{"security", "hash"},
		},
		{
			Name:           "security.sudo",
			Category:       CategorySecurity,
			Description:    "Execute a privileged shell command via sudo",
			Params: map[string]ParamSchema{
				"command":  param("command", "string", "Command to run as root", true),
				"timeout":  param("timeout", "integer", "Command timeout (s)", false),
			},
			DefaultTimeout: 300,
			DefaultRetries: 0,
			Tags:           []string{"security", "sudo"},
		},
		{
			Name:           "security.perm-check",
			Category:       CategorySecurity,
			Description:    "Check file permissions against policy",
			Params: map[string]ParamSchema{
				"path":    param("path", "string", "File or directory to check", true),
				"mode":    param("mode", "string", "Expected octal mode (e.g. 0755)", false),
			},
			DefaultTimeout: 15,
			DefaultRetries: 0,
			Tags:           []string{"security", "permissions"},
		},
		{
			Name:           "security.sandbox",
			Category:       CategorySecurity,
			Description:    "Execute an untrusted command in an isolated sandbox",
			Params: map[string]ParamSchema{
				"command":   param("command", "string", "Command to sandbox", true),
				"resources": param("resources", "object", "Resource limits (cpu/mem)", false),
			},
			DefaultTimeout: 120,
			DefaultRetries: 0,
			Tags:           []string{"security", "sandbox"},
		},
		{
			Name:           "security.audit",
			Category:       CategorySecurity,
			Description:    "Record an audit event for the action",
			Params: map[string]ParamSchema{
				"actor":   param("actor", "string", "User or system performing action", true),
				"action":  param("action", "string", "Action being audited", true),
				"resource": param("resource", "string", "Target resource", true),
				"result":  param("result", "enum", "Outcome (success/failure)", false),
			},
			DefaultTimeout: 10,
			DefaultRetries: 1,
			Tags:           []string{"security", "audit"},
		},
	}
}

// ---------------------------------------------------------------------------
// Category stats
// ---------------------------------------------------------------------------

// CategoryStats returns the count of actions per category.
func (r *ActionRegistry) CategoryStats() map[string]int {
	r.mu.RLock()
	defer r.mu.RUnlock()
	stats := make(map[string]int)
	for _, a := range r.actions {
		stats[a.Category]++
	}
	return stats
}
