package audit

import (
	"context"
	"fmt"
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
