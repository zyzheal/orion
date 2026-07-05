package audit

import (
	"context"
	"fmt"
	"log"
	"strings"
	"sync"
	"time"
)

// WorkingHoursConfig defines working hours for a tenant (supports timezone).
type WorkingHoursConfig struct {
	StartHour int    // 0-23, default 9
	EndHour   int    // 0-23, default 18
	Timezone  string // IANA timezone, e.g. "Asia/Shanghai", default UTC
}

// DefaultWorkingHoursConfig returns the default working hours config (9-18 UTC).
func DefaultWorkingHoursConfig() WorkingHoursConfig {
	return WorkingHoursConfig{StartHour: 9, EndHour: 18, Timezone: "UTC"}
}

// UEBAEngine implements User and Entity Behavior Analytics.
// It detects anomalous authorization patterns based on configurable rules.
type UEBAEngine struct {
	rules        []UEBARule
	store        UEBAStore
	alertFn      AlertFunc
	workingHours WorkingHoursConfig
	mu           sync.RWMutex
}

// UEBAStore provides access to audit log data for UEBA analysis.
type UEBAStore interface {
	// CountDenialsByUser counts denial events for a user within a time window.
	CountDenialsByUser(ctx context.Context, tenantID, userID string, since time.Time) (int, error)

	// GetUniqueResourcesByUser returns unique resources accessed by a user within a time window.
	GetUniqueResourcesByUser(ctx context.Context, tenantID, userID string, since time.Time) ([]string, error)

	// GetDenialsByTenant returns denial counts grouped by user for a tenant.
	GetDenialsByTenant(ctx context.Context, tenantID string, since time.Time) (map[string]int, error)

	// GetRecentEntries returns the most recent audit entries for a user.
	GetRecentEntries(ctx context.Context, tenantID, userID string, limit int) ([]*AuditEntry, error)
}

// AlertFunc is called when a UEBA rule triggers.
type AlertFunc func(ctx context.Context, alert UEBAAlert)

// EvaluateFunc is the signature for rule evaluation functions.
type EvaluateFunc func(ctx context.Context, store UEBAStore, tenantID string, window time.Duration, threshold int, whCfg WorkingHoursConfig) ([]UEBAAlert, error)

// UEBARule defines a behavior detection rule.
type UEBARule struct {
	ID          string        `json:"id"`
	Name        string        `json:"name"`
	Description string        `json:"description"`
	Severity    AlertSeverity `json:"severity"`
	Window      time.Duration `json:"window"`
	Threshold   int           `json:"threshold"`
	Enabled     bool          `json:"enabled"`
	Evaluate    EvaluateFunc  `json:"-"`
}

// AlertSeverity represents the severity of a UEBA alert.
type AlertSeverity string

const (
	SeverityLow      AlertSeverity = "low"
	SeverityMedium   AlertSeverity = "medium"
	SeverityHigh     AlertSeverity = "high"
	SeverityCritical AlertSeverity = "critical"
)

// UEBAAlert represents a triggered UEBA alert.
type UEBAAlert struct {
	RuleID    string                 `json:"rule_id"`
	RuleName  string                 `json:"rule_name"`
	Severity  AlertSeverity          `json:"severity"`
	TenantID  string                 `json:"tenant_id"`
	UserID    string                 `json:"user_id"`
	Detail    string                 `json:"detail"`
	Timestamp time.Time              `json:"timestamp"`
	Metadata  map[string]interface{} `json:"metadata,omitempty"`
}

// NewUEBAEngine creates a new UEBA engine with the 6 default detection rules.
func NewUEBAEngine(store UEBAStore, alertFn AlertFunc) *UEBAEngine {
	engine := &UEBAEngine{
		store:        store,
		alertFn:      alertFn,
		workingHours: DefaultWorkingHoursConfig(),
	}
	engine.rules = DefaultUEBARules()
	return engine
}

// NewUEBAEngineWithConfig creates a new UEBA engine with custom working hours config.
func NewUEBAEngineWithConfig(store UEBAStore, alertFn AlertFunc, whCfg WorkingHoursConfig) *UEBAEngine {
	engine := &UEBAEngine{
		store:        store,
		alertFn:      alertFn,
		workingHours: whCfg,
	}
	engine.rules = DefaultUEBARules()
	return engine
}

// SetWorkingHours updates the working hours configuration.
func (e *UEBAEngine) SetWorkingHours(cfg WorkingHoursConfig) {
	e.mu.Lock()
	defer e.mu.Unlock()
	e.workingHours = cfg
}

// AddRule adds a custom UEBA rule.
func (e *UEBAEngine) AddRule(rule UEBARule) {
	e.mu.Lock()
	defer e.mu.Unlock()
	e.rules = append(e.rules, rule)
}

// Run evaluates all enabled rules for a tenant.
func (e *UEBAEngine) Run(ctx context.Context, tenantID string) ([]UEBAAlert, error) {
	e.mu.RLock()
	rules := make([]UEBARule, len(e.rules))
	copy(rules, e.rules)
	whCfg := e.workingHours
	e.mu.RUnlock()

	var allAlerts []UEBAAlert
	for _, rule := range rules {
		if !rule.Enabled {
			continue
		}
		alerts, err := rule.Evaluate(ctx, e.store, tenantID, rule.Window, rule.Threshold, whCfg)
		if err != nil {
			continue // skip failing rules
		}
		allAlerts = append(allAlerts, alerts...)
	}

	// Fire alert callback for each triggered alert
	if e.alertFn != nil {
		for _, alert := range allAlerts {
			e.alertFn(ctx, alert)
		}
	}

	return allAlerts, nil
}

// DefaultUEBARules returns the 6 default UEBA detection rules.
func DefaultUEBARules() []UEBARule {
	return []UEBARule{
		{
			ID:          "excessive-denials",
			Name:        "Excessive permission denials",
			Description: "User has too many denied authorization attempts in a short window",
			Severity:    SeverityHigh,
			Window:      15 * time.Minute,
			Threshold:   10,
			Enabled:     true,
			Evaluate:    evaluateExcessiveDenials,
		},
		{
			ID:          "privilege-escalation-attempt",
			Name:        "Privilege escalation attempt",
			Description: "User repeatedly tries to access resources above their role level",
			Severity:    SeverityCritical,
			Window:      30 * time.Minute,
			Threshold:   5,
			Enabled:     true,
			Evaluate:    evaluatePrivilegeEscalation,
		},
		{
			ID:          "unusual-resource-access",
			Name:        "Unusual resource access pattern",
			Description: "User accesses an unusually high number of distinct resources",
			Severity:    SeverityMedium,
			Window:      1 * time.Hour,
			Threshold:   20,
			Enabled:     true,
			Evaluate:    evaluateUnusualResourceAccess,
		},
		{
			ID:          "off-hours-access",
			Name:        "Off-hours privileged access",
			Description: "Privileged operations attempted outside business hours",
			Severity:    SeverityMedium,
			Window:      1 * time.Hour,
			Threshold:   3,
			Enabled:     true,
			Evaluate:    evaluateOffHoursAccess,
		},
		{
			ID:          "brute-force-permission",
			Name:        "Brute force permission probing",
			Description: "Rapid sequential denial attempts suggesting automated probing",
			Severity:    SeverityHigh,
			Window:      5 * time.Minute,
			Threshold:   15,
			Enabled:     true,
			Evaluate:    evaluateBruteForcePermission,
		},
		{
			ID:          "cross-tenant-attempt",
			Name:        "Cross-tenant access attempt",
			Description: "User attempts to access resources in a different tenant",
			Severity:    SeverityCritical,
			Window:      1 * time.Hour,
			Threshold:   1,
			Enabled:     true,
			Evaluate:    evaluateCrossTenantAttempt,
		},
	}
}

// evaluateExcessiveDenials detects users with too many denied attempts.
func evaluateExcessiveDenials(ctx context.Context, store UEBAStore, tenantID string, window time.Duration, threshold int, _ WorkingHoursConfig) ([]UEBAAlert, error) {
	since := time.Now().Add(-window)
	denials, err := store.GetDenialsByTenant(ctx, tenantID, since)
	if err != nil {
		return nil, err
	}

	var alerts []UEBAAlert
	for userID, count := range denials {
		if count >= threshold {
			alerts = append(alerts, UEBAAlert{
				RuleID:    "excessive-denials",
				RuleName:  "Excessive permission denials",
				Severity:  SeverityHigh,
				TenantID:  tenantID,
				UserID:    userID,
				Detail:    fmt.Sprintf("%d denial attempts in %v", count, window),
				Timestamp: time.Now(),
				Metadata:  map[string]interface{}{"denial_count": count},
			})
		}
	}
	return alerts, nil
}

// evaluatePrivilegeEscalation detects repeated access to elevated resources.
func evaluatePrivilegeEscalation(ctx context.Context, store UEBAStore, tenantID string, window time.Duration, threshold int, _ WorkingHoursConfig) ([]UEBAAlert, error) {
	since := time.Now().Add(-window)
	denials, err := store.GetDenialsByTenant(ctx, tenantID, since)
	if err != nil {
		return nil, err
	}

	// High-value resources that indicate privilege escalation
	privilegedResources := map[string]bool{
		"roles": true, "config": true, "secrets": true, "users": true, "audit": true,
	}

	var alerts []UEBAAlert
	for userID, count := range denials {
		if count >= threshold {
			entries, _ := store.GetRecentEntries(ctx, tenantID, userID, 20)
			privCount := 0
			for _, e := range entries {
				if e.Decision == "deny" && privilegedResources[e.Resource] {
					privCount++
				}
			}
			if privCount >= threshold {
				alerts = append(alerts, UEBAAlert{
					RuleID:    "privilege-escalation-attempt",
					RuleName:  "Privilege escalation attempt",
					Severity:  SeverityCritical,
					TenantID:  tenantID,
					UserID:    userID,
					Detail:    fmt.Sprintf("%d privileged resource denial attempts in %v", privCount, window),
					Timestamp: time.Now(),
					Metadata:  map[string]interface{}{"privileged_denials": privCount},
				})
			}
		}
	}
	return alerts, nil
}

// evaluateUnusualResourceAccess detects access to many distinct resources.
func evaluateUnusualResourceAccess(ctx context.Context, store UEBAStore, tenantID string, window time.Duration, threshold int, _ WorkingHoursConfig) ([]UEBAAlert, error) {
	since := time.Now().Add(-window)
	denials, err := store.GetDenialsByTenant(ctx, tenantID, since)
	if err != nil {
		return nil, err
	}

	var alerts []UEBAAlert
	for userID := range denials {
		resources, _ := store.GetUniqueResourcesByUser(ctx, tenantID, userID, since)
		if len(resources) >= threshold {
			alerts = append(alerts, UEBAAlert{
				RuleID:    "unusual-resource-access",
				RuleName:  "Unusual resource access pattern",
				Severity:  SeverityMedium,
				TenantID:  tenantID,
				UserID:    userID,
				Detail:    fmt.Sprintf("accessed %d distinct resources in %v", len(resources), window),
				Timestamp: time.Now(),
				Metadata:  map[string]interface{}{"resource_count": len(resources)},
			})
		}
	}
	return alerts, nil
}

// evaluateOffHoursAccess detects privileged operations outside business hours.
// Uses configurable working hours and timezone from WorkingHoursConfig.
func evaluateOffHoursAccess(ctx context.Context, store UEBAStore, tenantID string, window time.Duration, threshold int, whCfg WorkingHoursConfig) ([]UEBAAlert, error) {
	since := time.Now().Add(-window)
	denials, err := store.GetDenialsByTenant(ctx, tenantID, since)
	if err != nil {
		return nil, err
	}

	// Load timezone, fallback to UTC
	loc := time.UTC
	if whCfg.Timezone != "" {
		if parsed, err := time.LoadLocation(whCfg.Timezone); err == nil {
			loc = parsed
		}
	}
	startHour := whCfg.StartHour
	endHour := whCfg.EndHour
	if startHour <= 0 && endHour <= 0 {
		startHour, endHour = 9, 18
	}

	var alerts []UEBAAlert
	for userID := range denials {
		entries, _ := store.GetRecentEntries(ctx, tenantID, userID, 50)
		offHoursCount := 0
		for _, e := range entries {
			localHour := e.Timestamp.In(loc).Hour()
			isOffHours := localHour < startHour || localHour >= endHour
			if isOffHours && e.Decision == "deny" {
				offHoursCount++
			}
		}
		if offHoursCount >= threshold {
			alerts = append(alerts, UEBAAlert{
				RuleID:    "off-hours-access",
				RuleName:  "Off-hours privileged access",
				Severity:  SeverityMedium,
				TenantID:  tenantID,
				UserID:    userID,
				Detail:    fmt.Sprintf("%d off-hours access attempts in %v (working hours %d:00-%d:00 %s)", offHoursCount, window, startHour, endHour, whCfg.Timezone),
				Timestamp: time.Now(),
				Metadata:  map[string]interface{}{"off_hours_count": offHoursCount},
			})
		}
	}
	return alerts, nil
}

// evaluateBruteForcePermission detects rapid automated probing.
func evaluateBruteForcePermission(ctx context.Context, store UEBAStore, tenantID string, window time.Duration, threshold int, _ WorkingHoursConfig) ([]UEBAAlert, error) {
	since := time.Now().Add(-window)
	denials, err := store.GetDenialsByTenant(ctx, tenantID, since)
	if err != nil {
		return nil, err
	}

	var alerts []UEBAAlert
	for userID, count := range denials {
		if count >= threshold {
			alerts = append(alerts, UEBAAlert{
				RuleID:    "brute-force-permission",
				RuleName:  "Brute force permission probing",
				Severity:  SeverityHigh,
				TenantID:  tenantID,
				UserID:    userID,
				Detail:    fmt.Sprintf("%d denial attempts in %v (possible automated probing)", count, window),
				Timestamp: time.Now(),
				Metadata:  map[string]interface{}{"attempt_count": count},
			})
		}
	}
	return alerts, nil
}

// evaluateCrossTenantAttempt detects cross-tenant access attempts.
func evaluateCrossTenantAttempt(ctx context.Context, store UEBAStore, tenantID string, window time.Duration, threshold int, _ WorkingHoursConfig) ([]UEBAAlert, error) {
	since := time.Now().Add(-window)
	denials, err := store.GetDenialsByTenant(ctx, tenantID, since)
	if err != nil {
		return nil, err
	}

	var alerts []UEBAAlert
	for userID := range denials {
		entries, _ := store.GetRecentEntries(ctx, tenantID, userID, 50)
		for _, e := range entries {
			if e.Decision == "deny" && e.Source == "abac" &&
				(e.Reason == "ABAC deny policy: Tenant isolation" ||
					e.Reason == "tenant isolation violation") {
				alerts = append(alerts, UEBAAlert{
					RuleID:    "cross-tenant-attempt",
					RuleName:  "Cross-tenant access attempt",
					Severity:  SeverityCritical,
					TenantID:  tenantID,
					UserID:    userID,
					Detail:    "cross-tenant access attempt detected",
					Timestamp: time.Now(),
				})
				break // one alert per user
			}
		}
	}
	return alerts, nil
}

// ──────────────────────────────────────────────────────────────────────────────
// Real-time UEBA Detector — Event-based evaluation
// ──────────────────────────────────────────────────────────────────────────────

// SecurityEvent represents a real-time security event for UEBA evaluation.
type SecurityEvent struct {
	Type      string                 `json:"type"`       // "auth", "export", "login", "access"
	TenantID  string                 `json:"tenant_id"`
	UserID    string                 `json:"user_id"`
	Resource  string                 `json:"resource"`
	Action    string                 `json:"action"`
	Decision  string                 `json:"decision"`   // "allow" or "deny"
	IPAddress string                 `json:"ip_address"`
	UserAgent string                 `json:"user_agent"`
	Timestamp time.Time              `json:"timestamp"`
	Metadata  map[string]interface{} `json:"metadata,omitempty"`
}

// UEBADetectorRule defines a rule for real-time event-based UEBA detection.
type UEBADetectorRule struct {
	ID          string        `json:"id"`
	Name        string        `json:"name"`
	Description string        `json:"description"`
	Severity    AlertSeverity `json:"severity"`
	Enabled     bool          `json:"enabled"`
	// Evaluate evaluates a single security event against this rule.
	// Returns a UEBAAlert if the rule triggers, nil otherwise.
	Evaluate func(ctx context.Context, event SecurityEvent, store UEBAStore) (*UEBAAlert, error) `json:"-"`
}

// UEBADetector evaluates security events against UEBA rules in real-time.
// Unlike UEBAEngine which runs periodic batch analysis, UEBADetector evaluates
// individual events as they occur — suitable for inline authorization checks.
type UEBADetector struct {
	store   UEBAStore
	rules   []UEBADetectorRule
	alerts  []UEBAAlert
	alertFn AlertFunc
	mu      sync.RWMutex
}

// NewUEBADetector creates a new UEBA detector with the 6 default detection rules.
func NewUEBADetector(store UEBAStore, alertFn AlertFunc) *UEBADetector {
	d := &UEBADetector{
		store:   store,
		alertFn: alertFn,
	}
	d.rules = DefaultUEBADetectorRules()
	return d
}

// Evaluate evaluates a security event against all enabled rules.
// Returns any triggered alerts. Also stores alerts and fires the alert callback.
func (d *UEBADetector) Evaluate(ctx context.Context, event SecurityEvent) ([]UEBAAlert, error) {
	d.mu.RLock()
	rules := make([]UEBADetectorRule, len(d.rules))
	copy(rules, d.rules)
	d.mu.RUnlock()

	var alerts []UEBAAlert
	for _, rule := range rules {
		if !rule.Enabled {
			continue
		}
		alert, err := rule.Evaluate(ctx, event, d.store)
		if err != nil {
			log.Printf("[WARN] UEBA rule %q evaluate failed: %v", rule.Name, err)
			continue
		}
		if alert != nil {
			alerts = append(alerts, *alert)
		}
	}

	// Store and dispatch alerts
	if len(alerts) > 0 {
		d.mu.Lock()
		d.alerts = append(d.alerts, alerts...)
		d.mu.Unlock()

		if d.alertFn != nil {
			for _, alert := range alerts {
				d.alertFn(ctx, alert)
			}
		}
	}

	return alerts, nil
}

// AddRule adds a custom UEBA detector rule.
func (d *UEBADetector) AddRule(rule UEBADetectorRule) {
	d.mu.Lock()
	defer d.mu.Unlock()
	d.rules = append(d.rules, rule)
}

// GetAlerts returns alerts triggered since the given time for a tenant.
func (d *UEBADetector) GetAlerts(ctx context.Context, tenantID string, since time.Time) ([]UEBAAlert, error) {
	d.mu.RLock()
	defer d.mu.RUnlock()

	var result []UEBAAlert
	for _, alert := range d.alerts {
		if tenantID != "" && alert.TenantID != tenantID {
			continue
		}
		if alert.Timestamp.Before(since) {
			continue
		}
		result = append(result, alert)
	}
	return result, nil
}

// RuleCount returns the number of configured rules.
func (d *UEBADetector) RuleCount() int {
	d.mu.RLock()
	defer d.mu.RUnlock()
	return len(d.rules)
}

// DefaultUEBADetectorRules returns the 6 default real-time UEBA detection rules.
func DefaultUEBADetectorRules() []UEBADetectorRule {
	return []UEBADetectorRule{
		{
			ID:          "mass-data-export",
			Name:        "Mass data export",
			Description: "User exports data more than 10 times in 1 hour",
			Severity:    SeverityHigh,
			Enabled:     true,
			Evaluate:    evaluateMassDataExport,
		},
		{
			ID:          "unauthorized-attempt",
			Name:        "Unauthorized access attempt",
			Description: "User has more than 20 permission denials in 30 minutes",
			Severity:    SeverityCritical,
			Enabled:     true,
			Evaluate:    evaluateUnauthorizedAttempt,
		},
		{
			ID:          "off-hours-sensitive-access",
			Name:        "Off-hours sensitive access",
			Description: "User accesses prod/secrets resources outside 9:00-18:00",
			Severity:    SeverityMedium,
			Enabled:     true,
			Evaluate:    evaluateOffHoursSensitiveAccess,
		},
		{
			ID:          "api-pattern-anomaly",
			Name:        "API pattern anomaly",
			Description: "ML anomaly score exceeds 0.8 threshold",
			Severity:    SeverityMedium,
			Enabled:     true,
			Evaluate:    evaluateAPIPatternAnomaly,
		},
		{
			ID:          "multi-location-login",
			Name:        "Multi-location login",
			Description: "Same account accessed from more than 3 different IPs",
			Severity:    SeverityMedium,
			Enabled:     true,
			Evaluate:    evaluateMultiLocationLogin,
		},
		{
			ID:          "service-account-abuse",
			Name:        "Service account abuse",
			Description: "Service account used via human browser user agent",
			Severity:    SeverityHigh,
			Enabled:     true,
			Evaluate:    evaluateServiceAccountAbuse,
		},
	}
}

// evaluateMassDataExport detects mass data export (>10 exports in 1h).
// Triggers HIGH alert with "block" action recommendation.
func evaluateMassDataExport(ctx context.Context, event SecurityEvent, store UEBAStore) (*UEBAAlert, error) {
	if event.Action != "export" {
		return nil, nil
	}

	since := time.Now().Add(-1 * time.Hour)
	entries, err := store.GetRecentEntries(ctx, event.TenantID, event.UserID, 100)
	if err != nil {
		return nil, err
	}

	exportCount := 0
	for _, e := range entries {
		if e.Action == "export" && e.Timestamp.After(since) {
			exportCount++
		}
	}

	if exportCount > 10 {
		return &UEBAAlert{
			RuleID:    "mass-data-export",
			RuleName:  "Mass data export",
			Severity:  SeverityHigh,
			TenantID:  event.TenantID,
			UserID:    event.UserID,
			Detail:    fmt.Sprintf("User exported data %d times in the last hour (threshold: 10)", exportCount),
			Timestamp: time.Now(),
			Metadata: map[string]interface{}{
				"export_count": exportCount,
				"action":       "block",
			},
		}, nil
	}
	return nil, nil
}

// evaluateUnauthorizedAttempt detects excessive permission denials (>20 in 30min).
// Triggers CRITICAL alert with "lock_account" action recommendation.
func evaluateUnauthorizedAttempt(ctx context.Context, event SecurityEvent, store UEBAStore) (*UEBAAlert, error) {
	if event.Decision != "deny" {
		return nil, nil
	}

	since := time.Now().Add(-30 * time.Minute)
	count, err := store.CountDenialsByUser(ctx, event.TenantID, event.UserID, since)
	if err != nil {
		return nil, err
	}

	if count > 20 {
		return &UEBAAlert{
			RuleID:    "unauthorized-attempt",
			RuleName:  "Unauthorized access attempt",
			Severity:  SeverityCritical,
			TenantID:  event.TenantID,
			UserID:    event.UserID,
			Detail:    fmt.Sprintf("User had %d permission denials in 30 minutes (threshold: 20)", count),
			Timestamp: time.Now(),
			Metadata: map[string]interface{}{
				"denial_count": count,
				"action":       "lock_account",
			},
		}, nil
	}
	return nil, nil
}

// evaluateOffHoursSensitiveAccess detects access to prod/secrets outside 9:00-18:00.
// Triggers MEDIUM alert for sensitive resource access during non-working hours.
func evaluateOffHoursSensitiveAccess(ctx context.Context, event SecurityEvent, store UEBAStore) (*UEBAAlert, error) {
	sensitiveResources := map[string]bool{
		"prod": true, "production": true, "secrets": true, "secret": true,
		"config": true, "credentials": true, "database": true,
	}

	if !sensitiveResources[event.Resource] {
		return nil, nil
	}

	hour := event.Timestamp.Hour()
	if hour >= 9 && hour < 18 {
		return nil, nil // within working hours
	}

	return &UEBAAlert{
		RuleID:    "off-hours-sensitive-access",
		RuleName:  "Off-hours sensitive access",
		Severity:  SeverityMedium,
		TenantID:  event.TenantID,
		UserID:    event.UserID,
		Detail:    fmt.Sprintf("Access to '%s' at %02d:00 outside working hours (9:00-18:00)", event.Resource, hour),
		Timestamp: time.Now(),
		Metadata: map[string]interface{}{
			"resource": event.Resource,
			"hour":     hour,
			"action":   event.Action,
		},
	}, nil
}

// evaluateAPIPatternAnomaly detects ML anomaly scores above 0.8.
// Expects "anomaly_score" key in event metadata.
func evaluateAPIPatternAnomaly(ctx context.Context, event SecurityEvent, store UEBAStore) (*UEBAAlert, error) {
	scoreRaw, ok := event.Metadata["anomaly_score"]
	if !ok {
		return nil, nil
	}

	var score float64
	switch v := scoreRaw.(type) {
	case float64:
		score = v
	case float32:
		score = float64(v)
	case int:
		score = float64(v)
	default:
		return nil, nil
	}

	if score <= 0.8 {
		return nil, nil
	}

	return &UEBAAlert{
		RuleID:    "api-pattern-anomaly",
		RuleName:  "API pattern anomaly",
		Severity:  SeverityMedium,
		TenantID:  event.TenantID,
		UserID:    event.UserID,
		Detail:    fmt.Sprintf("API anomaly score %.2f exceeds threshold 0.80", score),
		Timestamp: time.Now(),
		Metadata: map[string]interface{}{
			"anomaly_score": score,
			"resource":      event.Resource,
			"action":        event.Action,
		},
	}, nil
}

// evaluateMultiLocationLogin detects same account accessed from >3 different IPs.
// Triggers MEDIUM alert when IP diversity exceeds threshold.
func evaluateMultiLocationLogin(ctx context.Context, event SecurityEvent, store UEBAStore) (*UEBAAlert, error) {
	if event.IPAddress == "" {
		return nil, nil
	}

	since := time.Now().Add(-1 * time.Hour)
	entries, err := store.GetRecentEntries(ctx, event.TenantID, event.UserID, 100)
	if err != nil {
		return nil, err
	}

	ips := make(map[string]bool)
	ips[event.IPAddress] = true
	for _, e := range entries {
		if e.Timestamp.After(since) && e.IPAddress != "" {
			ips[e.IPAddress] = true
		}
	}

	if len(ips) > 3 {
		ipList := make([]string, 0, len(ips))
		for ip := range ips {
			ipList = append(ipList, ip)
		}
		return &UEBAAlert{
			RuleID:    "multi-location-login",
			RuleName:  "Multi-location login",
			Severity:  SeverityMedium,
			TenantID:  event.TenantID,
			UserID:    event.UserID,
			Detail:    fmt.Sprintf("Account accessed from %d different IPs in the last hour (threshold: 3)", len(ips)),
			Timestamp: time.Now(),
			Metadata: map[string]interface{}{
				"ip_count": len(ips),
				"ip_list":  ipList,
			},
		}, nil
	}
	return nil, nil
}

// evaluateServiceAccountAbuse detects service accounts accessed via human browser.
// Triggers HIGH alert with "revoke" action recommendation.
func evaluateServiceAccountAbuse(ctx context.Context, event SecurityEvent, store UEBAStore) (*UEBAAlert, error) {
	// Service accounts typically have prefixes: svc_, service_, bot_
	userID := event.UserID
	isServiceAccount := strings.HasPrefix(userID, "svc_") ||
		strings.HasPrefix(userID, "service_") ||
		strings.HasPrefix(userID, "bot_")

	if !isServiceAccount {
		return nil, nil
	}

	// Check if user agent looks like a browser (human)
	ua := event.UserAgent
	humanIndicators := []string{"Mozilla", "Chrome", "Safari", "Firefox", "Edge"}
	isHuman := false
	for _, indicator := range humanIndicators {
		if strings.Contains(ua, indicator) {
			isHuman = true
			break
		}
	}

	if !isHuman {
		return nil, nil
	}

	return &UEBAAlert{
		RuleID:    "service-account-abuse",
		RuleName:  "Service account abuse",
		Severity:  SeverityHigh,
		TenantID:  event.TenantID,
		UserID:    event.UserID,
		Detail:    fmt.Sprintf("Service account '%s' accessed via human user agent: %s", event.UserID, ua),
		Timestamp: time.Now(),
		Metadata: map[string]interface{}{
			"user_agent": ua,
			"action":     "revoke",
		},
	}, nil
}
