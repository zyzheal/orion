// Package correlation implements the CorrelationEngine interface for the
// alert pipeline.  It groups alerts by fingerprint similarity and tracks a
// per-group timeline of lifecycle events for root-cause analysis.
package correlation

import (
	"crypto/sha256"
	"encoding/hex"
	"fmt"
	"sync"
	"time"

	"orion/platform-svc-go/internal/alert-pipeline/event"
	"orion/platform-svc-go/internal/alert-pipeline/models"
)

// Group records correlated alerts that share a common fingerprint.
type Group struct {
	GroupID       string            `json:"groupId"`
	Fingerprint   string            `json:"fingerprint"`
	AlertIDs      []string          `json:"alertIds"`
	Alerts        []*event.AlertEvent `json:"alerts,omitempty"`
	FirstSeenAt   time.Time         `json:"firstSeenAt"`
	LastSeenAt    time.Time         `json:"lastSeenAt"`
	CommonRoot    bool              `json:"commonRoot"`
	Similarity    float64           `json:"similarity"`
}

// TimelineEntry is a single lifecycle event belonging to an alert.
type TimelineEntry struct {
	EventID    string    `json:"eventId"`
	EventType  string    `json:"eventType"`
	Timestamp  time.Time `json:"timestamp"`
	AlertID    string    `json:"alertId"`
	Summary    string    `json:"summary,omitempty"`
}

// Engine correlates alerts by fingerprint and maintains per-group timelines.
type Engine struct {
	mu          sync.RWMutex
	groups      map[string]*Group       // fingerprint -> group
	timelines   map[string][]TimelineEntry // groupID -> events
	groupCount  int64
}

// NewEngine creates a new correlation engine.
func NewEngine() *Engine {
	return &Engine{
		groups:    make(map[string]*Group),
		timelines: make(map[string][]TimelineEntry),
	}
}

// Correlate is the models.CorrelationEngine implementation.  It either
// finds an existing group for the alert or creates a new one.
func (e *Engine) Correlate(_ *models.AlertContext, related []any) (groupID string, isDuplicate bool, err error) {
	if len(related) == 0 {
		return "", false, nil
	}
	alert, ok := related[0].(*event.AlertEvent)
	if !ok {
		return "", false, fmt.Errorf("expected *event.AlertEvent, got %T", related[0])
	}
	fp := alert.Fingerprint
	if fp == "" {
		fp = generateFingerprint(alert)
	}

	e.mu.Lock()
	defer e.mu.Unlock()

	g, exists := e.groups[fp]
	if exists {
		isDuplicate = true
		return g.GroupID, isDuplicate, nil
	}

	// Create new group.
	now := time.Now().UTC()
	g = &Group{
		GroupID:     fmt.Sprintf("grp-%d", time.Now().UnixNano()),
		Fingerprint: fp,
		FirstSeenAt: now,
		LastSeenAt:  now,
		CommonRoot:  true,
		Similarity:  1.0,
	}
	e.groups[fp] = g
	e.timelines[g.GroupID] = make([]TimelineEntry, 0)
	e.groupCount++
	return g.GroupID, false, nil
}

// AddToGroup appends an alert to an existing group.
func (e *Engine) AddToGroup(groupID string, alert *event.AlertEvent) {
	e.mu.Lock()
	defer e.mu.Unlock()
	g, ok := e.findGroup(groupID)
	if !ok {
		return
	}
	g.Alerts = append(g.Alerts, alert)
	g.AlertIDs = append(g.AlertIDs, alert.BaseEvent.AlertID)
	g.LastSeenAt = time.Now().UTC()
}

// Timeline returns the lifecycle timeline for a group or alert.
func (e *Engine) Timeline(groupID, alertID string) []TimelineEntry {
	e.mu.RLock()
	defer e.mu.RUnlock()

	events, ok := e.timelines[groupID]
	if !ok {
		return nil
	}
	// Filter by alertID if specified.
	if alertID != "" {
		var out []TimelineEntry
		for _, t := range events {
			if t.AlertID == alertID {
				out = append(out, t)
			}
		}
		return out
	}
	return events
}

// AddEvent adds a lifecycle event to the timeline for a group.
func (e *Engine) AddEvent(groupID string, eventType event.EventType, alertID string, summary string) {
	e.mu.Lock()
	defer e.mu.Unlock()
	e.timelines[groupID] = append(e.timelines[groupID], TimelineEntry{
		EventID:   event.GenerateEventID(),
		EventType: string(eventType),
		Timestamp: time.Now().UTC(),
		AlertID:   alertID,
		Summary:   summary,
	})
}

// Groups returns all groups.
func (e *Engine) Groups() map[string]*Group {
	e.mu.RLock()
	defer e.mu.RUnlock()
	out := make(map[string]*Group, len(e.groups))
	for k, v := range e.groups {
		out[k] = v
	}
	return out
}

// Stats returns engine statistics.
func (e *Engine) Stats() map[string]interface{} {
	e.mu.RLock()
	defer e.mu.RUnlock()
	return map[string]interface{}{
		"totalGroups":  e.groupCount,
		"activeGroups": len(e.groups),
	}
}

func (e *Engine) findGroup(groupID string) (*Group, bool) {
	for _, g := range e.groups {
		if g.GroupID == groupID {
			return g, true
		}
	}
	return nil, false
}

func generateFingerprint(a *event.AlertEvent) string {
	data := fmt.Sprintf("%s|%s|%s|%s", a.Name, a.Severity, a.SourceType, a.SourceID)
	hash := sha256.Sum256([]byte(data))
	return "fp-" + hex.EncodeToString(hash[:16])
}
