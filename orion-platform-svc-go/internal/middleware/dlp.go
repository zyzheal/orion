package middleware

import (
	"bytes"
	"encoding/json"
	"fmt"
	"go.opentelemetry.io/otel"
	"io"
	"net/http"
	"regexp"
	"strings"
	"sync"
	"time"

	"github.com/gin-gonic/gin"
	"go.uber.org/zap"
)

// DLPAction defines what happens when a rule matches.
type DLPAction string

const (
	DLPActionLog   DLPAction = "log"
	DLPActionMask  DLPAction = "mask"
	DLPActionBlock DLPAction = "block"
	DLPActionAlert DLPAction = "alert"
)

// DLPRule defines a single DLP detection rule.
type DLPRule struct {
	ID           string         `json:"id"`
	Name         string         `json:"name"`
	Description  string         `json:"description"`
	Pattern      *regexp.Regexp `json:"-"`
	PatternStr   string         `json:"pattern"`
	DataType     string         `json:"dataType"`
	Action       DLPAction      `json:"action"`
	Replacement  string         `json:"replacement,omitempty"`
	Threshold    int            `json:"threshold,omitempty"`
	Enabled      bool           `json:"enabled"`
	PathPatterns []string       `json:"pathPatterns,omitempty"`
}

// DLPResult describes one rule match during a scan.
type DLPResult struct {
	RuleID     string    `json:"ruleId"`
	RuleName   string    `json:"ruleName"`
	DataType   string    `json:"dataType"`
	Action     DLPAction `json:"action"`
	MatchCount int       `json:"matchCount"`
	Sample     string    `json:"sample,omitempty"`
	Path       string    `json:"path"`
	Method     string    `json:"method"`
	Timestamp  time.Time `json:"timestamp"`
	TenantID   string    `json:"tenantId,omitempty"`
}

// DLPStats accumulates per-tenant scan metrics.
type DLPStats struct {
	TotalScanned int64
	TotalMatches int64
	TotalBlocked int64
	TotalMasked  int64
	TotalLogged  int64
}

// --- Scanner ---

// DLPScanner holds rules, state, and statistics.
type DLPScanner struct {
	rules   []DLPRule
	mu      sync.RWMutex
	logger  *zap.Logger
	stats   map[string]*DLPStats
	statsMu sync.Mutex
}

// NewDLPScanner creates a scanner with built-in rules.
func NewDLPScanner(logger *zap.Logger) *DLPScanner {
	s := &DLPScanner{
		logger: logger,
		stats:  make(map[string]*DLPStats),
	}
	s.loadDefaultRules()
	return s
}

func (s *DLPScanner) loadDefaultRules() {
	defaults := []DLPRule{
		{
			ID: "email", Name: "Email Address", DataType: "email",
			PatternStr: `\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b`,
			Action:     DLPActionMask, Replacement: "***@***.***", Enabled: true,
		},
		{
			ID: "phone", Name: "Phone Number (CN)", DataType: "phone",
			PatternStr: `(?:(?:\+|00)86)?1[3-9]\d{9}`,
			Action:     DLPActionMask, Replacement: "1**********", Enabled: true,
		},
		{
			ID: "id_card", Name: "ID Card (CN)", DataType: "id_card",
			PatternStr: `\b\d{17}[\dXx]\b`,
			Action:     DLPActionMask, Replacement: "******************", Enabled: true,
		},
		{
			ID: "credit_card", Name: "Credit Card", DataType: "credit_card",
			PatternStr: `\b(?:\d[ -]*?){13,19}\b`,
			Action:     DLPActionBlock, Enabled: true,
		},
		{
			ID: "api_key", Name: "API Key", DataType: "api_key",
			PatternStr: `\b(?:sk|pk|rk)_[a-zA-Z0-9]{32,}\b`,
			Action:     DLPActionBlock, Enabled: true,
		},
		{
			ID: "jwt", Name: "JWT Token", DataType: "jwt",
			PatternStr: `\beyJ[a-zA-Z0-9_-]*\.eyJ[a-zA-Z0-9_-]*\.[a-zA-Z0-9_-]*\b`,
			Action:     DLPActionBlock, Enabled: true,
		},
		{
			ID: "aws_key", Name: "AWS Access Key", DataType: "aws_access_key",
			PatternStr: `\bAKIA[0-9A-Z]{16}\b`,
			Action:     DLPActionBlock, Enabled: true,
		},
		{
			ID: "private_key", Name: "Private Key", DataType: "private_key",
			PatternStr: `-----BEGIN (?:RSA |EC |DSA |OPENSSH )?PRIVATE KEY-----`,
			Action:     DLPActionBlock, Enabled: true,
		},
	}
	for i := range defaults {
		re, err := regexp.Compile(defaults[i].PatternStr)
		if err != nil {
			continue
		}
		defaults[i].Pattern = re
		if defaults[i].Threshold <= 0 {
			defaults[i].Threshold = 1
		}
	}
	s.mu.Lock()
	s.rules = defaults
	s.mu.Unlock()
}

// AddRule registers a custom rule.
func (s *DLPScanner) AddRule(rule DLPRule) error {
	if rule.PatternStr != "" {
		re, err := regexp.Compile(rule.PatternStr)
		if err != nil {
			return fmt.Errorf("compile pattern: %w", err)
		}
		rule.Pattern = re
	}
	if rule.Threshold <= 0 {
		rule.Threshold = 1
	}
	s.mu.Lock()
	s.rules = append(s.rules, rule)
	s.mu.Unlock()
	return nil
}

// Scan scans text and returns masked text plus results.
// An empty modified string indicates the response should be blocked.
func (s *DLPScanner) Scan(content, path, method, tenantID string) (string, []DLPResult) {
	s.mu.RLock()
	rules := s.rules
	s.mu.RUnlock()

	var results []DLPResult
	var shouldBlock bool
	// Apply masks in order, accumulating replacements on a shared buffer.
	modified := content

	for _, rule := range rules {
		if !rule.Enabled || rule.Pattern == nil {
			continue
		}
		if len(rule.PathPatterns) > 0 && !matchPath(path, rule.PathPatterns) {
			continue
		}

		// Always search in the original content so masking doesn't
		// destroy matches for subsequent rules.
		matches := rule.Pattern.FindAllString(content, -1)
		if len(matches) < rule.Threshold {
			continue
		}

		result := DLPResult{
			RuleID: rule.ID, RuleName: rule.Name, DataType: rule.DataType,
			Action: rule.Action, MatchCount: len(matches),
			Path: path, Method: method, Timestamp: time.Now(), TenantID: tenantID,
		}
		if len(matches) > 0 {
			m := matches[0]
			if len(m) > 10 {
				result.Sample = m[:3] + "..." + m[len(m)-3:]
			} else {
				result.Sample = m
			}
		}

		switch rule.Action {
		case DLPActionBlock:
			shouldBlock = true
			results = append(results, result)
		case DLPActionMask:
			results = append(results, result)
			// Apply masking on the accumulated buffer.
			if rule.Replacement != "" {
				modified = rule.Pattern.ReplaceAllString(modified, rule.Replacement)
			} else {
				modified = rule.Pattern.ReplaceAllStringFunc(modified, func(m string) string {
					if len(m) <= 4 {
						return strings.Repeat("*", len(m))
					}
					return m[:2] + strings.Repeat("*", len(m)-4) + m[len(m)-2:]
				})
			}
		case DLPActionLog, DLPActionAlert:
			results = append(results, result)
		}
	}

	s.updateStats(results, shouldBlock)
	if shouldBlock {
		return "", results
	}
	return modified, results
}

func matchPath(path string, patterns []string) bool {
	for _, p := range patterns {
		if strings.Contains(path, p) {
			return true
		}
		if strings.Contains(p, "*") {
			parts := strings.Split(p, "*")
			pos, matched := 0, true
			for _, part := range parts {
				if part == "" {
					continue
				}
				idx := strings.Index(path[pos:], part)
				if idx < 0 {
					matched = false
					break
				}
				pos += idx + len(part)
			}
			if matched {
				return true
			}
		}
	}
	return false
}

func (s *DLPScanner) updateStats(results []DLPResult, blocked bool) {
	s.statsMu.Lock()
	defer s.statsMu.Unlock()
	tenant := "default"
	if len(results) > 0 && results[0].TenantID != "" {
		tenant = results[0].TenantID
	}
	stats, ok := s.stats[tenant]
	if !ok {
		stats = &DLPStats{}
		s.stats[tenant] = stats
	}
	stats.TotalScanned++
	stats.TotalMatches += int64(len(results))
	if blocked {
		stats.TotalBlocked++
	}
	for _, r := range results {
		switch r.Action {
		case DLPActionMask:
			stats.TotalMasked++
		case DLPActionLog, DLPActionAlert:
			stats.TotalLogged++
		}
	}
}

// GetStats returns a copy of all tenant stats.
func (s *DLPScanner) GetStats() map[string]*DLPStats {
	s.statsMu.Lock()
	defer s.statsMu.Unlock()
	out := make(map[string]*DLPStats, len(s.stats))
	for k, v := range s.stats {
		out[k] = &DLPStats{TotalScanned: v.TotalScanned, TotalMatches: v.TotalMatches,
			TotalBlocked: v.TotalBlocked, TotalMasked: v.TotalMasked, TotalLogged: v.TotalLogged}
	}
	return out
}

// --- Gin Middleware ---

type dlpResponseWriter struct {
	gin.ResponseWriter
	body   *bytes.Buffer
	writer *http.ResponseWriter
}

// DLP returns a Gin middleware that scans JSON responses for sensitive data.
func DLP(scanner *DLPScanner) gin.HandlerFunc {
	return func(c *gin.Context) {
		path := c.Request.URL.Path
		if shouldSkipDLP(path) {
			c.Next()
			return
		}

		tenantID := c.GetString("tenant_id")

		var buf bytes.Buffer
		originalWriter := c.Writer
		c.Writer = &dlpResponseWriter{
			ResponseWriter: originalWriter,
			body:           &buf,
		}

		c.Next()

		ct := c.Writer.Header().Get("Content-Type")
		if !strings.Contains(ct, "application/json") {
			return
		}

		body := buf.String()
		if body == "" {
			return
		}

		modified, results := scanner.Scan(body, path, c.Request.Method, tenantID)
		if len(results) == 0 {
			return
		}

		for _, r := range results {
			scanner.logger.Info("DLP match",
				zap.String("rule", r.RuleName),
				zap.String("type", r.DataType),
				zap.String("action", string(r.Action)),
				zap.Int("count", r.MatchCount),
				zap.String("path", path))

			if r.Action == DLPActionBlock {
				_ = json.NewEncoder(c.Writer).Encode(gin.H{
					"success": false,
					"error": gin.H{
						"code":    "DLP_BLOCKED",
						"message": "response blocked by DLP policy",
						"rule":    r.RuleID,
					},
				})
				c.Status(http.StatusForbidden)
				return
			}
		}

		if modified != body {
			_ = json.NewEncoder(c.Writer).Encode(modified)
		}
	}
}

func shouldSkipDLP(path string) bool {
	for _, p := range []string{"/swagger", "/health", "/metrics", "/api/v1/metrics"} {
		if strings.HasPrefix(path, p) {
			return true
		}
	}
	return false
}

// ScanExport scans exported file content and blocks on dangerous matches.
func (s *DLPScanner) ScanExport(content, format, path, tenantID string) (string, error) {
	modified, results := s.Scan(content, path, "EXPORT", tenantID)
	for _, r := range results {
		if r.Action == DLPActionBlock {
			return "", fmt.Errorf("export blocked by DLP policy: %s (rule: %s, matches: %d)",
				r.DataType, r.RuleName, r.MatchCount)
		}
	}
	return modified, nil
}

// ScanRequest reads the request body, scans it, and aborts on block actions.
func (s *DLPScanner) ScanRequest(c *gin.Context) {
	_, span := otel.Tracer("orion-platform-svc").Start(c.Request.Context(), "DLPScanRequest")
	defer span.End()
	if c.Request.Body == nil {
		return
	}
	body, err := io.ReadAll(c.Request.Body)
	if err != nil {
		return
	}
	c.Request.Body = io.NopCloser(bytes.NewBuffer(body))

	content := string(body)
	_, results := s.Scan(content, c.Request.URL.Path, c.Request.Method, c.GetString("tenant_id"))
	for _, r := range results {
		if r.Action == DLPActionBlock {
			c.AbortWithStatusJSON(http.StatusForbidden, gin.H{
				"success": false,
				"error": gin.H{
					"code": "DLP_REQUEST_BLOCKED", "message": "request blocked by DLP policy",
					"rule": r.RuleID, "type": r.DataType,
				},
			})
			return
		}
	}
}
