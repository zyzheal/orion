// Package route implements the routing stage of the alert pipeline.  It
// matches alerts against a ruleset to decide which notification channels and
// teams should be informed.
package route

import (
	"context"
	"fmt"
	"sync"
	"time"

	"orion/platform-svc-go/internal/alert-pipeline/models"

	"go.uber.org/zap"
)

// Rule defines a single routing rule.  A rule matches an alert by severity,
// labels, and status, and directs it to a list of notification targets.
type Rule struct {
	ID             string
	Name           string
	Severity       string            // empty matches any
	LabelMatches   map[string]string // empty matches any
	TargetChannels []string          // email, slack, webhook, pagerduty, etc.
	Team           string            // owning team name
}

// Stage evaluates alerts against the configured routing rules.
type Stage struct {
	mu              sync.RWMutex
	logger          *zap.Logger
	rules           []Rule
	defaultChannels []string
}

// NewStage creates a route stage.
func NewStage(logger *zap.Logger, defaultChannels []string) *Stage {
	return &Stage{
		logger:          logger,
		rules:           make([]Rule, 0),
		defaultChannels: defaultChannels,
	}
}

// AddRule registers a new routing rule.
func (s *Stage) AddRule(r Rule) {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.rules = append(s.rules, r)
}

// Rules returns a copy of the registered rules.
func (s *Stage) Rules() []Rule {
	s.mu.RLock()
	defer s.mu.RUnlock()
	out := make([]Rule, len(s.rules))
	copy(out, s.rules)
	return out
}

// Name returns the canonical stage name.
func (s *Stage) Name() string {
	return "route"
}

// Process evaluates the alert context against routing rules and populates
// AlertContext.Routes with matched channel targets.
func (s *Stage) Process(_ context.Context, alertCtx *models.AlertContext) error {
	matched := s.match(alertCtx)
	alertCtx.Routes = matched.channels
	alertCtx.Enrichments["routedAt"] = time.Now().UTC().Format(time.RFC3339)
	alertCtx.Enrichments["matchedRules"] = matched.ruleNames
	alertCtx.Enrichments["team"] = matched.team

	s.logger.Info("alert routed",
		zap.String("alert_id", alertCtx.AlertID),
		zap.Strings("channels", matched.channels),
		zap.Strings("rules", matched.ruleNames))

	return nil
}

// matchResult holds the outcome of a rule evaluation.
type matchResult struct {
	channels  []string
	ruleNames []string
	team      string
}

func (s *Stage) match(alertCtx *models.AlertContext) matchResult {
	s.mu.RLock()
	defer s.mu.RUnlock()

	var result matchResult
	for _, r := range s.rules {
		if !s.ruleMatches(r, alertCtx) {
			continue
		}
		result.ruleNames = append(result.ruleNames, r.Name)
		result.channels = appendUnique(result.channels, r.TargetChannels...)
		result.team = r.Team
	}
	if len(result.channels) == 0 {
		result.channels = s.defaultChannels
	}
	return result
}

func (s *Stage) ruleMatches(r Rule, alertCtx *models.AlertContext) bool {
	m := alertCtx.Alert
	if m == nil {
		return false
	}

	// Extract severity from payload.
	severity := ""
	if sev, ok := m["severity"]; ok {
		severity = fmt.Sprintf("%v", sev)
	}

	// Extract labels from payload.
	if labels, ok := m["labels"]; ok {
		switch l := labels.(type) {
		case map[string]string:
			for k, v := range l {
				alertCtx.Enrichments["label:"+k] = v
			}
		case map[string]interface{}:
			for k, v := range l {
				alertCtx.Enrichments["label:"+k] = fmt.Sprintf("%v", v)
			}
		}
	}

	// Severity match.
	if r.Severity != "" && severity != r.Severity {
		return false
	}
	// Label match.
	for k, v := range r.LabelMatches {
		if alertCtx.Enrichments["label:"+k] != v {
			return false
		}
	}
	return true
}

func appendUnique(s []string, v ...string) []string {
	m := make(map[string]bool)
	for _, x := range s {
		m[x] = true
	}
	for _, x := range v {
		if !m[x] {
			s = append(s, x)
			m[x] = true
		}
	}
	return s
}
