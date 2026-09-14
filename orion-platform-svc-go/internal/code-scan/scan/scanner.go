// Package scan is a small deterministic static-analysis engine for the
// code-scan module. It walks a target directory and applies a fixed rule set
// of regular expressions, producing findings with a file, a line and a
// severity.
//
// It deliberately does not shell out to trivy, semgrep or any other tool: none
// of those binaries are part of the service image, so an exec-based scanner
// would fail on every host and the scan would report nothing at all. The rules
// here are intentionally narrow and high-precision -- each one flags a literal
// pattern that is a defect wherever it appears -- rather than broad heuristics
// that would drown the page in false positives.
package scan

import (
	"bufio"
	"bytes"
	"errors"
	"fmt"
	"io"
	"os"
	"path/filepath"
	"regexp"
	"sort"
	"strings"
	"time"

	"orion/platform-svc-go/internal/code-scan/models"
)

// Finding is one rule hit in one file at one line.
type Finding struct {
	RuleID      string
	Category    string
	Severity    string
	File        string // path relative to the scan root
	Line        int
	Description string
	Fix         string
}

// Rule is a single static-analysis rule.
type Rule struct {
	ID          string
	Category    string
	Severity    string
	Description string
	Fix         string
	Pattern     *regexp.Regexp
	// SkipPlaceholders makes the rule ignore matches whose captured credential
	// value is an obvious placeholder (example, changeme, ${ENV}, ...). Without
	// it the credential rule fires on every config template in the repo.
	SkipPlaceholders bool
}

// Option bounds the walk so a large or hostile target cannot stall the worker.
type Option struct {
	// MaxDepth is the maximum number of path components below the root.
	MaxDepth int
	// MaxFiles is the maximum number of files to consider (scanned or skipped).
	MaxFiles int
	// MaxFileSize is the largest file that is read; bigger files are skipped.
	MaxFileSize int64
	// MaxFindings caps the number of findings returned.
	MaxFindings int
	// SkipDirs is the set of directory base names to descend into not.
	SkipDirs map[string]bool
}

// DefaultOption returns the production bounds. A 5000-file, 1 MiB-per-file
// walk is enough for a service repository and keeps the worker inside the
// service timeout; both are overridable for tests.
func DefaultOption() Option {
	return Option{
		MaxDepth:    10,
		MaxFiles:    5000,
		MaxFileSize: 1 << 20,
		MaxFindings: 1000,
		SkipDirs: map[string]bool{
			".git": true, "node_modules": true, "vendor": true, "third_party": true,
			"third-party": true, "thirdparty": true, "__pycache__": true, ".venv": true,
			"venv": true, ".tox": true, "dist": true, "build": true, "coverage": true,
			".nuxt": true, ".next": true, ".cache": true, ".idea": true, ".vscode": true,
			"target": true, ".gradle": true,
		},
	}
}

// Report is the outcome of one scan: the findings plus the walk statistics
// that say how much of the target was actually examined.
type Report struct {
	Findings     []Finding
	Counts       models.Counts
	FilesScanned int
	FilesSkipped int
	// TruncatedFiles is set when the walk stopped early because MaxFiles was
	// reached. A report with this flag is not a complete picture of the target.
	TruncatedFiles bool
	Duration       time.Duration
}

// NewRule compiles a rule. It panics on a bad pattern, which is what we want:
// the rule set is a compile-time constant, so a typo is a build failure and
// not a scanner that silently matches nothing at runtime.
func NewRule(id, category, severity, description, fix, pattern string, skipPlaceholders bool) Rule {
	re, err := regexp.Compile(pattern)
	if err != nil {
		panic(fmt.Sprintf("code-scan rule %s: %v", id, err))
	}
	return Rule{
		ID:               id,
		Category:         category,
		Severity:         severity,
		Description:      description,
		Fix:              fix,
		Pattern:          re,
		SkipPlaceholders: skipPlaceholders,
	}
}

// NewDefaultRules is the production rule set. Every category it emits is in
// the frontend's VulnCategory union
// (injection | auth | xss | csrf | security_misconfig | sensitive_data | aam |
// vulnerable_components | integrity | logging), so the page never renders an
// unknown tag.
func NewDefaultRules() []Rule {
	return []Rule{
		NewRule("private-key-block", "sensitive_data", "critical",
			"Private key material embedded in source",
			"Remove the key, rotate it, and load it from a secret manager",
			`-----BEGIN[ A-Z]*PRIVATE KEY-----`, false),
		NewRule("aws-access-key-id", "sensitive_data", "critical",
			"AWS access key ID committed to source",
			"Revoke the key in IAM and move it to environment configuration",
			`\b(?:AKIA|ASIA)[0-9A-Z]{16}\b`, false),
		NewRule("github-token", "sensitive_data", "critical",
			"GitHub personal access token committed to source",
			"Revoke the token and store it in a secret manager",
			`\bgh[pousr]_[A-Za-z0-9]{20,255}\b`, false),
		NewRule("google-api-key", "sensitive_data", "high",
			"Google API key committed to source",
			"Restrict the key in the Google console and load it from configuration",
			`\bAIza[0-9A-Za-z\-_]{33,35}\b`, false),
		NewRule("stripe-live-secret-key", "sensitive_data", "critical",
			"Live payment secret key committed to source",
			"Roll the key in the Stripe dashboard and move it to a secret store",
			`\bsk_live_[0-9a-zA-Z]{16,255}\b`, false),
		NewRule("slack-token", "sensitive_data", "high",
			"Slack bot token committed to source",
			"Revoke the token in the Slack app and load it from configuration",
			`\bxox[baprs]-[0-9A-Za-z-]{10,255}\b`, false),
		NewRule("hardcoded-credential", "sensitive_data", "high",
			"Hardcoded credential assigned to a literal string",
			"Read the credential from the environment or a secret manager",
			`\b(?:password|passwd|pwd|secret|api[_-]?key|apikey|access[_-]?key|client[_-]?secret|db[_-]?password)\b\s*[:=]\s*['"][^'"\n]{4,255}['"]`, true),
		NewRule("go-sql-sprintf", "injection", "critical",
			"SQL statement built with fmt.Sprintf and a string interpolation",
			"Use a parameterised query and pass the value as an argument",
			`(?i)fmt\.Sprintf\(\s*"[^"]{0,200}?\b(?:SELECT|INSERT|UPDATE|DELETE)\b[^"]{0,200}?%s`, false),
		NewRule("shell-command-injection", "injection", "high",
			"Command executed through a shell with a composed argument",
			"Pass the argument list directly to exec.Command instead of -c",
			`exec\.Command(?:Context)?\([^)]{0,160}?"-c"\)`, false),
		NewRule("dynamic-eval", "injection", "high",
			"Dynamic code execution via eval or new Function",
			"Replace the dynamic evaluation with a static dispatch table",
			`\beval\s*\(|\bnew\s+Function\s*\(`, false),
		NewRule("dom-xss", "xss", "high",
			"Unsanitised markup assigned to the document",
			"Render text nodes or sanitise before assigning to the DOM",
			`\.innerHTML\s*=|document\.write\s*\(|dangerouslySetInnerHTML|v-html`, false),
		NewRule("tls-skip-verify", "security_misconfig", "high",
			"TLS certificate verification disabled",
			"Remove InsecureSkipVerify and use a trusted CA bundle",
			`InsecureSkipVerify\s*:\s*true`, false),
		NewRule("wildcard-cors-origin", "security_misconfig", "medium",
			"Wildcard CORS origin accepted",
			"Restrict the allowed origin list to trusted hosts",
			`(?i)access-control-allow-origin\s*[:=]\s*['"]\*['"]`, false),
		NewRule("gin-debug-mode", "security_misconfig", "medium",
			"Gin running in debug mode",
			"Set the mode from configuration and keep production on release mode",
			`gin\.SetMode\(\s*gin\.DebugMode\s*\)`, false),
		NewRule("weak-hash", "integrity", "medium",
			"MD5 or SHA-1 used for a digest",
			"Use SHA-256 or a keyed MAC for integrity checks",
			`md5\.Sum\(|sha1\.New\(`, false),
		NewRule("secret-in-log", "logging", "medium",
			"Credential-like value written to a log line",
			"Redact the value before logging",
			`(?i)\b(?:log|logger|logging|logrus|slog)\.\w+\(\s*[^)]{0,200}?\b(?:token|secret|password|passwd|credential)\b`, false),
	}
}

// placeholderMarkers are credential values that are clearly not real. They
// keep the credential rule from flagging every config template in the repo.
var placeholderMarkers = []string{
	"example", "example.", "changeme", "change_me", "change-me", "xxx", "your-",
	"your_", "your own", "todo", "tbd", "placeholder", "replace", "dummy",
	"sample", "demo", "fake", "test", "testing", "<", "${", "{{", "%s", "%v",
	"password", "secret", "apikey", "api_key",
}

func isPlaceholder(value string) bool {
	v := strings.ToLower(value)
	for _, m := range placeholderMarkers {
		if strings.Contains(v, m) {
			return true
		}
	}
	return false
}

// normalise replaces unset bounds with the production defaults. A zero value
// means "use the default", never "scan without limit": with MaxDepth = 0 every
// file is deeper than the cap and the whole tree would be skipped, which is
// how a scanner quietly reports an empty repo as clean.
func normalise(opts Option) Option {
	d := DefaultOption()
	if opts.MaxDepth <= 0 {
		opts.MaxDepth = d.MaxDepth
	}
	if opts.MaxFiles <= 0 {
		opts.MaxFiles = d.MaxFiles
	}
	if opts.MaxFileSize <= 0 {
		opts.MaxFileSize = d.MaxFileSize
	}
	if opts.MaxFindings <= 0 {
		opts.MaxFindings = d.MaxFindings
	}
	if len(opts.SkipDirs) == 0 {
		opts.SkipDirs = d.SkipDirs
	}
	return opts
}

// Scan walks root and applies rules to every text file it can read.
//
// Errors are only returned for failures that make the scan meaningless: the
// root is not a directory, or it cannot be opened at all. Per-file read
// failures are counted as skipped files, because one unreadable file in a
// five-thousand-file tree is not a reason to throw away the other findings.
func Scan(root string, rules []Rule, opts Option) (Report, error) {
	started := time.Now()
	opts = normalise(opts)

	st, err := os.Stat(root)
	if err != nil {
		return Report{}, fmt.Errorf("code scan: cannot access %q: %v", root, err)
	}
	if !st.IsDir() {
		return Report{}, fmt.Errorf("code scan: %q is not a directory", root)
	}

	rep := Report{Findings: make([]Finding, 0), TruncatedFiles: false}

	rootPath, err := filepath.Abs(root)
	if err != nil {
		rootPath = root
	}

	reported := 0
	considered := 0

	err = filepath.WalkDir(rootPath, func(path string, d os.DirEntry, werr error) error {
		if werr != nil {
			// WalkDir reports the entry and the error separately; count it and
			// keep walking the rest of the tree.
			rep.FilesSkipped++
			return nil
		}
		if d.IsDir() {
			if opts.SkipDirs[d.Name()] {
				return filepath.SkipDir
			}
			return nil
		}
		if d.Type()&os.ModeSymlink != 0 {
			rep.FilesSkipped++
			return nil
		}

		considered++
		if considered > opts.MaxFiles {
			rep.TruncatedFiles = true
			return filepath.SkipAll
		}

		rel, rerr := filepath.Rel(rootPath, path)
		if rerr != nil {
			rel = path
		}
		if depth(rel) > opts.MaxDepth {
			rep.FilesSkipped++
			return nil
		}

		findings, notExamined, err := scanFile(path, rel, rules, opts.MaxFileSize, opts.MaxFindings-reported)
		if err != nil {
			return err
		}
		if notExamined {
			// Symlink, oversized, binary or unreadable: the file was skipped,
			// not clean. Counting it as scanned would understate the tree.
			rep.FilesSkipped++
		} else {
			rep.FilesScanned++
		}
		rep.Findings = append(rep.Findings, findings...)
		reported += len(findings)
		if reported >= opts.MaxFindings {
			return filepath.SkipAll
		}
		return nil
	})
	if err != nil {
		return Report{}, err
	}

	sortFindings(rep.Findings)
	rep.Counts = countFindings(rep.Findings)
	rep.Duration = time.Since(started)
	return rep, nil
}

// scanFile reads one file and returns its findings. skipped is true when the
// file was not examined (symlink, oversized, binary or unreadable), so the
// caller can tell "clean file" from "not looked at".
func scanFile(path, rel string, rules []Rule, maxSize int64, budget int) ([]Finding, bool, error) {
	if budget <= 0 {
		return nil, false, nil
	}

	f, err := os.Open(path)
	if err != nil {
		return nil, true, nil
	}
	defer f.Close()

	st, err := f.Stat()
	if err != nil || st.IsDir() || st.Size() == 0 {
		return nil, true, nil
	}
	if maxSize > 0 && st.Size() > maxSize {
		return nil, true, nil
	}

	// Probe the first 8 KiB for a NUL byte: a large binary never needs its
	// tail read to decide it is not scannable. The line pass below re-reads
	// the whole file, so a short probe read only narrows the window.
	head := make([]byte, 8192)
	n, _ := io.ReadFull(f, head)
	if n == 0 {
		return nil, true, nil
	}
	if bytes.IndexByte(head[:n], 0) >= 0 {
		return nil, true, nil
	}

	// Seek back so the line pass sees the whole file, including the part that
	// the binary probe already read.
	if _, serr := f.Seek(0, io.SeekStart); serr != nil {
		return nil, true, nil
	}

	var findings []Finding
	sc := bufio.NewScanner(f)
	sc.Buffer(make([]byte, 64*1024), 1<<20)
	lineNo := 0
	for sc.Scan() {
		lineNo++
		line := sc.Text()
		for _, rule := range rules {
			if budget <= 0 {
				return findings, false, nil
			}
			if rule.SkipPlaceholders {
				// The pattern ends with a quoted value; drop everything up to
				// the last quote so isPlaceholder sees the credential itself.
				match := rule.Pattern.FindString(line)
				if match == "" {
					continue
				}
				if isPlaceholder(valueOf(match)) {
					continue
				}
			} else if !rule.Pattern.MatchString(line) {
				continue
			}
			findings = append(findings, Finding{
				RuleID:      rule.ID,
				Category:    rule.Category,
				Severity:    rule.Severity,
				File:        rel,
				Line:        lineNo,
				Description: rule.Description,
				Fix:         rule.Fix,
			})
			budget--
		}
	}
	if err := sc.Err(); err != nil && !errors.Is(err, bufio.ErrTooLong) {
		return findings, true, nil
	}
	return findings, false, nil
}

// valueOf pulls the quoted literal out of a credential match so the
// placeholder filter can inspect the value rather than the key.
func valueOf(match string) string {
	open := strings.IndexAny(match, "'\"")
	if open < 0 {
		return match
	}
	rest := match[open+1:]
	close := strings.IndexAny(rest, "'\"")
	if close < 0 {
		return rest
	}
	return rest[:close]
}

// depth counts path components, so a file directly in the root is depth 1.
func depth(rel string) int {
	return len(strings.Split(filepath.ToSlash(rel), "/"))
}

var severityRank = map[string]int{
	"critical": 0,
	"high":     1,
	"medium":   2,
	"low":      3,
	"info":     4,
}

// sortFindings puts the most severe hits first, then orders by file and line
// so the same tree always produces the same report.
func sortFindings(findings []Finding) {
	sort.SliceStable(findings, func(i, j int) bool {
		a, b := findings[i], findings[j]
		ra, okA := severityRank[a.Severity]
		rb, okB := severityRank[b.Severity]
		if !okA {
			ra = 99
		}
		if !okB {
			rb = 99
		}
		if ra != rb {
			return ra < rb
		}
		if a.File != b.File {
			return a.File < b.File
		}
		if a.Line != b.Line {
			return a.Line < b.Line
		}
		return a.RuleID < b.RuleID
	})
}

// countFindings aggregates the findings into the per-severity totals the
// scan record stores. An unknown severity still counts toward the total, so a
// rule that introduces a new level cannot silently hide a finding.
func countFindings(findings []Finding) models.Counts {
	c := models.Counts{Total: len(findings)}
	for _, f := range findings {
		switch f.Severity {
		case "critical":
			c.Critical++
		case "high":
			c.High++
		case "medium":
			c.Medium++
		case "low":
			c.Low++
		}
	}
	return c
}
