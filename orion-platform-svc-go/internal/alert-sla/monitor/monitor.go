package monitor

import (
	"context"
	"fmt"
	"sync"
	"time"

	"go.uber.org/zap"
	"orion/platform-svc-go/internal/alert-sla/models"
	slarepo "orion/platform-svc-go/internal/alert-sla/repository"
	"orion/platform-svc-go/internal/repository"
)

// Breach represents a detected SLA breach event.
type Breach struct {
	SLAID        string    `json:"slaId"`
	TenantID     string    `json:"tenantId"`
	AlertID      string    `json:"alertId"`
	Severity     string    `json:"severity"`
	BreachType   string    `json:"breachType"` // "response" or "resolve"
	ElapsedSec   int       `json:"elapsedSec"`
	ThresholdSec int       `json:"thresholdSec"`
	DetectedAt   time.Time `json:"detectedAt"`
}

// AlertSource provides active alerts for SLA checking. The alert-pipeline
// or any alert store can implement this interface.
type AlertSource interface {
	ActiveAlerts(ctx context.Context, tenantID, severity string) ([]ActiveAlert, error)
}

// ActiveAlert represents an alert to evaluate against an SLA policy.
type ActiveAlert struct {
	ID          string     `json:"id"`
	TenantID    string     `json:"tenantId"`
	Severity    string     `json:"severity"`
	CreatedAt   time.Time  `json:"createdAt"`
	AckedAt     *time.Time `json:"ackedAt,omitempty"`
	ResolvedAt  *time.Time `json:"resolvedAt,omitempty"`
}

// Monitor periodically checks for SLA breaches by comparing active alerts
// against enabled SLA policies. It runs as a background goroutine.
type Monitor struct {
	repo    *slarepo.Repository
	source  AlertSource
	logger  *zap.Logger
	tenants []string

	interval time.Duration

	mu       sync.Mutex
	breaches []Breach
	stopCh   chan struct{}
	wg       sync.WaitGroup
}

// NewMonitor creates a new SLA breach monitor for the given tenants.
func NewMonitor(repo *slarepo.Repository, source AlertSource, logger *zap.Logger, tenants ...string) *Monitor {
	return &Monitor{
		repo:     repo,
		source:   source,
		logger:   logger,
		tenants:  tenants,
		interval: 30 * time.Second,
		stopCh:   make(chan struct{}),
	}
}

// SetInterval overrides the default check interval.
func (m *Monitor) SetInterval(d time.Duration) {
	m.interval = d
}

// Start launches the background monitoring goroutine.
func (m *Monitor) Start(ctx context.Context) {
	m.wg.Add(1)
	go m.run(ctx)
}

// Stop signals the background goroutine to stop and waits for it.
func (m *Monitor) Stop() {
	close(m.stopCh)
	m.wg.Wait()
}

// Breaches returns a copy of detected breaches.
func (m *Monitor) Breaches() []Breach {
	m.mu.Lock()
	defer m.mu.Unlock()
	out := make([]Breach, len(m.breaches))
	copy(out, m.breaches)
	return out
}

// run is the main loop. It ticks at m.interval and calls checkBreaches.
func (m *Monitor) run(ctx context.Context) {
	defer m.wg.Done()
	ticker := time.NewTicker(m.interval)
	defer ticker.Stop()
	for {
		select {
		case <-m.stopCh:
			return
		case <-ctx.Done():
			return
		case <-ticker.C:
			if err := m.checkAllTenants(ctx); err != nil {
				m.logger.Error("sla breach check failed", zap.Error(err))
			}
		}
	}
}

// checkAllTenants iterates over configured tenants and checks each.
func (m *Monitor) checkAllTenants(ctx context.Context) error {
	for _, tenantID := range m.tenants {
		if err := m.checkTenant(ctx, tenantID); err != nil {
			m.logger.Warn("tenant sla check failed",
				zap.String("tenant", tenantID),
				zap.Error(err))
		}
	}
	return nil
}

// checkTenant queries enabled SLA policies and active alerts for a single
// tenant, then evaluates breaches.
func (m *Monitor) checkTenant(ctx context.Context, tenantID string) error {
	ctx = repository.WithTenant(ctx, tenantID)
	slas, _, err := m.repo.List(ctx, tenantID, 1, 1000)
	if err != nil {
		return fmt.Errorf("list sla policies: %w", err)
	}

	var detected []Breach
	now := time.Now().UTC()

	for _, sla := range slas {
		if !sla.Enabled {
			continue
		}
		alerts, err := m.source.ActiveAlerts(ctx, tenantID, sla.Severity)
		if err != nil {
			m.logger.Warn("failed to get active alerts",
				zap.String("sla", sla.ID),
				zap.String("tenant", tenantID),
				zap.Error(err))
			continue
		}
		for _, a := range alerts {
			detected = append(detected, EvaluateSLA(sla, a, now)...)
		}
	}

	if len(detected) > 0 {
		m.logger.Info("sla breaches detected",
			zap.String("tenant", tenantID),
			zap.Int("count", len(detected)))
	}

	m.mu.Lock()
	m.breaches = detected
	m.mu.Unlock()

	return nil
}

// EvaluateSLA checks a single alert against an SLA policy and returns
// breach details if any. This is a pure function that can be called
// synchronously from API handlers.
func EvaluateSLA(sla models.AlertSLA, alert ActiveAlert, now time.Time) []Breach {
	var breaches []Breach
	if !sla.Enabled {
		return nil
	}
	// Check response time breach (alert not acknowledged)
	if alert.AckedAt == nil {
		elapsed := int(now.Sub(alert.CreatedAt).Seconds())
		if elapsed > sla.ResponseTime {
			breaches = append(breaches, Breach{
				SLAID:        sla.ID,
				TenantID:     sla.TenantID,
				AlertID:      alert.ID,
				Severity:     sla.Severity,
				BreachType:   "response",
				ElapsedSec:   elapsed,
				ThresholdSec: sla.ResponseTime,
				DetectedAt:   now,
			})
		}
	}
	// Check resolve time breach (alert not resolved)
	if alert.ResolvedAt == nil {
		elapsed := int(now.Sub(alert.CreatedAt).Seconds())
		if elapsed > sla.ResolveTime {
			breaches = append(breaches, Breach{
				SLAID:        sla.ID,
				TenantID:     sla.TenantID,
				AlertID:      alert.ID,
				Severity:     sla.Severity,
				BreachType:   "resolve",
				ElapsedSec:   elapsed,
				ThresholdSec: sla.ResolveTime,
				DetectedAt:   now,
			})
		}
	}
	return breaches
}
