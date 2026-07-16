package aggregates

import (
	"time"
	"orion/platform-svc-go/internal/domain/events"
)

// FeatureFlagAggregate represents the FeatureFlag aggregate root.
type FeatureFlagAggregate struct {
	BaseAggregate
	Name           string            `json:"name"`
	Key            string            `json:"key"`
	Enabled        bool              `json:"enabled"`
	RolloutPercent int               `json:"rolloutPercent"`
	Strategy       string            `json:"strategy"` // ALL/NONE/PERCENTAGE/TARGETING
	Metadata       map[string]string `json:"metadata"`
	LastToggledAt  *time.Time        `json:"lastToggledAt"`
}

// ToggleFeatureFlag creates a FeatureFlagToggledEvent.
func (f *FeatureFlagAggregate) ToggleFeatureFlag(enabled bool) events.DomainEvent {
	f.Enabled = enabled
	now := time.Now().UTC()
	f.LastToggledAt = &now
	return &events.FeatureFlagToggledEvent{
		FlagKey:    f.Key,
		OldEnabled: !enabled,
		NewEnabled: enabled,
	}
}

// UpdateRollout creates a FeatureFlagRolloutUpdatedEvent.
func (f *FeatureFlagAggregate) UpdateRollout(percent int, strategy string) events.DomainEvent {
	oldPercent := f.RolloutPercent
	f.RolloutPercent = percent
	f.Strategy = strategy
	return &events.FeatureFlagRolloutUpdatedEvent{
		FlagKey:    f.Key,
		OldPercent: oldPercent,
		NewPercent: percent,
		Strategy:   strategy,
	}
}

// Apply applies a domain event to the FeatureFlag aggregate state.
func (f *FeatureFlagAggregate) Apply(e events.DomainEvent) {
	switch ev := e.(type) {
	case *events.FeatureFlagToggledEvent:
		f.Enabled = ev.NewEnabled
	case *events.FeatureFlagRolloutUpdatedEvent:
		_ = ev.OldPercent
		f.RolloutPercent = ev.NewPercent
		_ = ev.FlagKey
		f.Strategy = ev.Strategy
	}
}
