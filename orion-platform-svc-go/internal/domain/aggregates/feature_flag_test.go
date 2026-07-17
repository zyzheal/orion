package aggregates

import (
	"testing"

	"github.com/stretchr/testify/assert"

	"orion/platform-svc-go/internal/domain/events"
)

func TestFeatureFlagAggregate_ToggleFeatureFlag(t *testing.T) {
	t.Run("enables a disabled flag", func(t *testing.T) {
		agg := &FeatureFlagAggregate{
			BaseAggregate: BaseAggregate{
				AggregateID:   "flag-1",
				AggregateType: "feature_flag",
				TenantID:      "tenant-1",
			},
			Key:     "test-flag",
			Enabled: false,
		}

		ev := agg.ToggleFeatureFlag(true)

		assert.NotNil(t, ev)
		assert.True(t, agg.Enabled)
		assert.NotNil(t, agg.LastToggledAt)

		toggled, ok := ev.(*events.FeatureFlagToggledEvent)
		assert.True(t, ok)
		assert.Equal(t, "test-flag", toggled.FlagKey)
		assert.False(t, toggled.OldEnabled)
		assert.True(t, toggled.NewEnabled)
	})

	t.Run("disables an enabled flag", func(t *testing.T) {
		agg := &FeatureFlagAggregate{
			Key:     "test-flag",
			Enabled: true,
		}

		ev := agg.ToggleFeatureFlag(false)

		assert.NotNil(t, ev)
		assert.False(t, agg.Enabled)

		toggled, ok := ev.(*events.FeatureFlagToggledEvent)
		assert.True(t, ok)
		assert.True(t, toggled.OldEnabled)
		assert.False(t, toggled.NewEnabled)
	})

	t.Run("toggles even if already in the target state", func(t *testing.T) {
		agg := &FeatureFlagAggregate{Key: "test-flag", Enabled: true}
		ev := agg.ToggleFeatureFlag(true)
		assert.NotNil(t, ev)
		assert.True(t, agg.Enabled)
	})
}

func TestFeatureFlagAggregate_UpdateRollout(t *testing.T) {
	t.Run("updates rollout percentage and strategy", func(t *testing.T) {
		agg := &FeatureFlagAggregate{
			BaseAggregate: BaseAggregate{
				AggregateID:   "flag-1",
				AggregateType: "feature_flag",
				TenantID:      "tenant-1",
			},
			Key:            "test-flag",
			RolloutPercent: 0,
			Strategy:       "NONE",
		}

		ev := agg.UpdateRollout(50, "PERCENTAGE")

		assert.NotNil(t, ev)
		assert.Equal(t, 50, agg.RolloutPercent)
		assert.Equal(t, "PERCENTAGE", agg.Strategy)

		rollout, ok := ev.(*events.FeatureFlagRolloutUpdatedEvent)
		assert.True(t, ok)
		assert.Equal(t, "test-flag", rollout.FlagKey)
		assert.Equal(t, 0, rollout.OldPercent)
		assert.Equal(t, 50, rollout.NewPercent)
		assert.Equal(t, "PERCENTAGE", rollout.Strategy)
	})

	t.Run("updates rollout from existing values", func(t *testing.T) {
		agg := &FeatureFlagAggregate{
			Key:            "test-flag",
			RolloutPercent: 30,
			Strategy:       "PERCENTAGE",
		}

		ev := agg.UpdateRollout(100, "ALL")

		assert.NotNil(t, ev)
		assert.Equal(t, 100, agg.RolloutPercent)
		assert.Equal(t, "ALL", agg.Strategy)

		rollout, ok := ev.(*events.FeatureFlagRolloutUpdatedEvent)
		assert.True(t, ok)
		assert.Equal(t, 30, rollout.OldPercent)
		assert.Equal(t, 100, rollout.NewPercent)
	})
}

func TestFeatureFlagAggregate_Apply(t *testing.T) {
	t.Run("replays FeatureFlagToggledEvent", func(t *testing.T) {
		agg := &FeatureFlagAggregate{Enabled: false}
		agg.Apply(&events.FeatureFlagToggledEvent{
			FlagKey:    "test-flag",
			NewEnabled: true,
		})
		assert.True(t, agg.Enabled)
	})

	t.Run("replays FeatureFlagRolloutUpdatedEvent", func(t *testing.T) {
		agg := &FeatureFlagAggregate{
			RolloutPercent: 0,
			Strategy:       "NONE",
		}
		agg.Apply(&events.FeatureFlagRolloutUpdatedEvent{
			FlagKey:    "test-flag",
			NewPercent: 75,
			Strategy:   "PERCENTAGE",
		})
		assert.Equal(t, 75, agg.RolloutPercent)
		assert.Equal(t, "PERCENTAGE", agg.Strategy)
	})

	t.Run("replays FeatureFlagToggledEvent to disable", func(t *testing.T) {
		agg := &FeatureFlagAggregate{Enabled: true}
		agg.Apply(&events.FeatureFlagToggledEvent{
			NewEnabled: false,
		})
		assert.False(t, agg.Enabled)
	})

	t.Run("full event stream replay", func(t *testing.T) {
		agg := &FeatureFlagAggregate{Key: "test-flag"}

		// Created (enabled)
		agg.Apply(&events.FeatureFlagToggledEvent{FlagKey: "test-flag", NewEnabled: true})
		assert.True(t, agg.Enabled)

		// Rollout update
		agg.Apply(&events.FeatureFlagRolloutUpdatedEvent{FlagKey: "test-flag", NewPercent: 50, Strategy: "PERCENTAGE"})
		assert.Equal(t, 50, agg.RolloutPercent)
		assert.Equal(t, "PERCENTAGE", agg.Strategy)

		// Toggled off
		agg.Apply(&events.FeatureFlagToggledEvent{FlagKey: "test-flag", NewEnabled: false})
		assert.False(t, agg.Enabled)
	})
}