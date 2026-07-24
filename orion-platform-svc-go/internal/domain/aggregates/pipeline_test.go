package aggregates

import (
	"testing"

	"github.com/stretchr/testify/assert"

	"orion/platform-svc-go/internal/domain/events"
)

func TestPipelineAggregate_ActivatePipeline(t *testing.T) {
	t.Run("sets status to ACTIVE and creates PipelineActivatedEvent", func(t *testing.T) {
		agg := &PipelineAggregate{
			BaseAggregate: BaseAggregate{
				AggregateID:   "pipe-1",
				AggregateType: "pipeline",
				TenantID:      "tenant-1",
			},
			Name:   "test-pipeline",
			Status: "DRAFT",
		}

		ev := agg.ActivatePipeline()

		assert.NotNil(t, ev)
		assert.Equal(t, "ACTIVE", agg.Status)
		assert.NotNil(t, agg.ActivatedAt)

		activated, ok := ev.(*events.PipelineActivatedEvent)
		assert.True(t, ok)
		assert.Equal(t, "test-pipeline", activated.PipelineName)
	})

	t.Run("can activate from DRAFT status", func(t *testing.T) {
		agg := &PipelineAggregate{Status: "DRAFT"}
		ev := agg.ActivatePipeline()
		assert.NotNil(t, ev)
	})

	t.Run("can activate even if already ACTIVE", func(t *testing.T) {
		agg := &PipelineAggregate{Status: "ACTIVE"}
		ev := agg.ActivatePipeline()
		assert.NotNil(t, ev)
	})
}

func TestPipelineAggregate_DeactivatePipeline(t *testing.T) {
	t.Run("deactivates an ACTIVE pipeline", func(t *testing.T) {
		agg := &PipelineAggregate{
			BaseAggregate: BaseAggregate{
				AggregateID:   "pipe-1",
				AggregateType: "pipeline",
				TenantID:      "tenant-1",
			},
			Name:   "test-pipeline",
			Status: "ACTIVE",
		}

		ev := agg.DeactivatePipeline()

		assert.NotNil(t, ev)
		assert.Equal(t, "DEPRECATED", agg.Status)
		assert.NotNil(t, agg.DeprecatedAt)

		deactivated, ok := ev.(*events.PipelineDeactivatedEvent)
		assert.True(t, ok)
		assert.Equal(t, "test-pipeline", deactivated.PipelineName)
	})

	t.Run("returns nil when pipeline is not ACTIVE", func(t *testing.T) {
		agg := &PipelineAggregate{Status: "DRAFT"}
		ev := agg.DeactivatePipeline()
		assert.Nil(t, ev)
	})

	t.Run("returns nil when pipeline is already DEPRECATED", func(t *testing.T) {
		agg := &PipelineAggregate{Status: "DEPRECATED"}
		ev := agg.DeactivatePipeline()
		assert.Nil(t, ev)
	})
}

func TestPipelineAggregate_UpdatePipelineYAML(t *testing.T) {
	t.Run("updates YAML and creates PipelineUpdatedEvent", func(t *testing.T) {
		agg := &PipelineAggregate{
			BaseAggregate: BaseAggregate{
				AggregateID:   "pipe-1",
				AggregateType: "pipeline",
				TenantID:      "tenant-1",
			},
			Name: "test-pipeline",
			YAML: "old-yaml",
		}

		ev := agg.UpdatePipelineYAML("new-yaml-content")

		assert.NotNil(t, ev)
		assert.Equal(t, "new-yaml-content", agg.YAML)

		updated, ok := ev.(*events.PipelineUpdatedEvent)
		assert.True(t, ok)
		assert.Equal(t, "test-pipeline", updated.PipelineName)
	})

	t.Run("updates YAML even when pipeline is DEPRECATED", func(t *testing.T) {
		agg := &PipelineAggregate{YAML: "old", Status: "DEPRECATED"}
		ev := agg.UpdatePipelineYAML("new")
		assert.NotNil(t, ev)
		assert.Equal(t, "new", agg.YAML)
	})
}

func TestPipelineAggregate_Apply(t *testing.T) {
	t.Run("replays PipelineCreatedEvent", func(t *testing.T) {
		agg := &PipelineAggregate{}
		agg.Apply(&events.PipelineCreatedEvent{})
		assert.Equal(t, "DRAFT", agg.Status)
	})

	t.Run("replays PipelineActivatedEvent", func(t *testing.T) {
		agg := &PipelineAggregate{}
		agg.Apply(&events.PipelineActivatedEvent{PipelineName: "test"})
		assert.Equal(t, "ACTIVE", agg.Status)
		assert.NotNil(t, agg.ActivatedAt)
	})

	t.Run("replays PipelineDeactivatedEvent", func(t *testing.T) {
		agg := &PipelineAggregate{Status: "ACTIVE"}
		agg.Apply(&events.PipelineDeactivatedEvent{PipelineName: "test"})
		assert.Equal(t, "DEPRECATED", agg.Status)
		assert.NotNil(t, agg.DeprecatedAt)
	})

	t.Run("replays PipelineUpdatedEvent", func(t *testing.T) {
		agg := &PipelineAggregate{Status: "ACTIVE"}
		agg.Apply(&events.PipelineUpdatedEvent{})
		assert.Equal(t, "ACTIVE", agg.Status) // status unchanged
	})

	t.Run("full event stream replay", func(t *testing.T) {
		agg := &PipelineAggregate{}

		// Replay the full lifecycle
		agg.Apply(&events.PipelineCreatedEvent{})
		assert.Equal(t, "DRAFT", agg.Status)

		agg.Apply(&events.PipelineActivatedEvent{})
		assert.Equal(t, "ACTIVE", agg.Status)

		agg.Apply(&events.PipelineUpdatedEvent{})
		assert.Equal(t, "ACTIVE", agg.Status)

		agg.Apply(&events.PipelineDeactivatedEvent{})
		assert.Equal(t, "DEPRECATED", agg.Status)
	})
}

func TestPipelineAggregate_BaseEventFields(t *testing.T) {
	t.Run("events get aggregate metadata from addEvent", func(t *testing.T) {
		agg := &PipelineAggregate{
			BaseAggregate: BaseAggregate{
				AggregateID:   "pipe-1",
				AggregateType: "pipeline",
				TenantID:      "tenant-1",
			},
		}

		ev := &events.PipelineActivatedEvent{}
		agg.addEvent(ev)

		assert.Equal(t, "pipe-1", ev.AggregateID())
		assert.Equal(t, "tenant-1", ev.TenantID())
		assert.Equal(t, 1, ev.Version())
		assert.Equal(t, 1, agg.GetVersion())
		assert.Len(t, agg.GetPendingEvents(), 1)
	})

	t.Run("version increments across multiple events", func(t *testing.T) {
		eventsSetLater(t)
	})

	t.Run("ClearPendingEvents empties the pending queue", func(t *testing.T) {
		agg := &PipelineAggregate{
			BaseAggregate: BaseAggregate{
				AggregateID: "pipe-1",
			},
		}
		agg.addEvent(&events.PipelineActivatedEvent{})
		agg.addEvent(&events.PipelineUpdatedEvent{})

		assert.Len(t, agg.GetPendingEvents(), 2)

		agg.ClearPendingEvents()
		assert.Len(t, agg.GetPendingEvents(), 0)
	})
}

func eventsSetLater(t *testing.T) {
	t.Helper()
	agg := &PipelineAggregate{
		BaseAggregate: BaseAggregate{
			AggregateID:   "pipe-1",
			AggregateType: "pipeline",
			TenantID:      "tenant-1",
		},
	}
	agg.addEvent(&events.PipelineActivatedEvent{})
	assert.Equal(t, 1, agg.GetVersion())
	agg.addEvent(&events.PipelineDeactivatedEvent{})
	assert.Equal(t, 2, agg.GetVersion())
}