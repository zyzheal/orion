package sla

import (
	"context"
	"fmt"
	"sync"
	"time"
)

// SLAMonitor continuously checks for SLA breaches and triggers alerts.
type SLAMonitor struct {
	cache     sync.Map // key=ticketID -> *SLARecord
	interval  time.Duration
	mu        sync.RWMutex
}

// SLARecord tracks SLA state for a single task.
type SLARecord struct {
	ID                   string     `json:"id"`
	TicketID             string     `json:"ticket_id"`
	TaskID               string     `json:"task_id"`
	WorkflowID           string     `json:"workflow_id"`
	NodeID               string     `json:"node_id"`
	AssignedAt           time.Time  `json:"assigned_at"`
	ResponseDeadlineAt   time.Time  `json:"response_deadline_at"`
	ResolutionDeadlineAt time.Time  `json:"resolution_deadline_at"`
	RespondedAt          *time.Time `json:"responded_at,omitempty"`
	ResolvedAt           *time.Time `json:"resolved_at,omitempty"`
	Breached             bool       `json:"breached"`
	BreachType           string     `json:"breach_type,omitempty"`
	UtilizedRatio        float64    `json:"utilized_ratio"`
}

// NewSLAMonitor creates a monitor with a default check interval.
func NewSLAMonitor(checkInterval time.Duration) *SLAMonitor {
	if checkInterval == 0 {
		checkInterval = 30 * time.Second
	}
	return &SLAMonitor{
		interval: checkInterval,
	}
}

// Register adds a ticket to monitoring.
func (m *SLAMonitor) Register(rec *SLARecord) {
	m.cache.Store(rec.TicketID, rec)
}

// Unregister removes a ticket from monitoring (completed/closed).
func (m *SLAMonitor) Unregister(ticketID string) {
	m.cache.Delete(ticketID)
}

// GetRecord returns the SLA record for a ticket.
func (m *SLAMonitor) GetRecord(ticketID string) (*SLARecord, bool) {
	v, ok := m.cache.Load(ticketID)
	if !ok {
		return nil, false
	}
	return v.(*SLARecord), true
}

// UpdateRatio recalculates the utilized ratio for a record.
func (m *SLAMonitor) UpdateRatio(rec *SLARecord, now time.Time) {
	if rec.ResolutionDeadlineAt.IsZero() {
		return
	}
	elapsed := now.Sub(rec.AssignedAt)
	total := rec.ResolutionDeadlineAt.Sub(rec.AssignedAt)
	if total > 0 {
		rec.UtilizedRatio = float64(elapsed) / float64(total)
	}
}

// CheckBreaches scans all records and returns breached + at-risk items.
// This is the core monitoring function — call from a cron or the background goroutine.
func (m *SLAMonitor) CheckBreaches(ctx context.Context) (*SLABreachResult, error) {
	now := time.Now()
	var breached, atRisk []SLABreachInfo

	m.cache.Range(func(key, value interface{}) bool {
		rec := value.(*SLARecord)
		if rec.Breached {
			return true // already breached, skip
		}

		select {
		case <-ctx.Done():
			return false
		default:
		}

		// Check resolution breach
		if now.After(rec.ResolutionDeadlineAt) {
			rec.Breached = true
			rec.BreachType = "resolution"
			breached = append(breached, SLABreachInfo{
				Record:      *rec,
				Reason:      fmt.Sprintf("Resolution SLA exceeded at %s", now.Format(time.RFC3339)),
				AtRisk:      false,
				UtilizedRatio: 1.0,
			})
			return true
		}

		// Check response breach (only if not yet responded)
		if rec.RespondedAt == nil && now.After(rec.ResponseDeadlineAt) {
			rec.Breached = true
			rec.BreachType = "response"
			breached = append(breached, SLABreachInfo{
				Record:      *rec,
				Reason:      fmt.Sprintf("Response SLA exceeded at %s", now.Format(time.RFC3339)),
				AtRisk:      false,
				UtilizedRatio: 1.0,
			})
			return true
		}

		// At-risk: > 75% of SLA consumed
		m.UpdateRatio(rec, now)
		if rec.UtilizedRatio >= 0.75 && rec.UtilizedRatio < 1.0 {
			atRisk = append(atRisk, SLABreachInfo{
                Record:        *rec,
                Reason:        fmt.Sprintf("SLA utilization %.0f%%", rec.UtilizedRatio*100),
                AtRisk:        true,
                UtilizedRatio: rec.UtilizedRatio,
            })
		}
		return true
	})

	return &SLABreachResult{
		Breached: breached,
		AtRisk:   atRisk,
		Total:    len(breached) + len(atRisk),
	}, nil
}

// Run starts the background monitoring loop.
// Call this once during service initialization.
func (m *SLAMonitor) Run(ctx context.Context, onBreach SLABreachCallback) error {
	if onBreach == nil {
		onBreach = func(b SLABreachInfo) {} // no-op
	}

	ticker := time.NewTicker(m.interval)
	defer ticker.Stop()

	for {
		select {
		case <-ctx.Done():
			return ctx.Err()
		case <-ticker.C:
			result, err := m.CheckBreaches(ctx)
			if err != nil {
				continue
			}
			for _, b := range result.Breached {
				onBreach(b)
			}
			for _, r := range result.AtRisk {
				onBreach(r)
			}
		}
	}
}

// SLABreachInfo carries breach or at-risk notification data.
type SLABreachInfo struct {
	Record        SLARecord `json:"record"`
	Reason        string    `json:"reason"`
	AtRisk        bool      `json:"at_risk"`
	UtilizedRatio float64   `json:"utilized_ratio"`
}

// SLABreachResult is the output of a breach check.
type SLABreachResult struct {
	Breached []SLABreachInfo `json:"breached"`
	AtRisk   []SLABreachInfo `json:"at_risk"`
	Total    int             `json:"total"`
}

// SLABreachCallback is called when a breach or at-risk event is detected.
type SLABreachCallback func(breach SLABreachInfo)
