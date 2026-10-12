package builder

import (
	"strings"
	"testing"
	"time"

	"orion/platform-svc-go/internal/domain/events"
	"orion/platform-svc-go/internal/testutil/assertion"
)

func TestBuilder_EventDefaults(t *testing.T) {
	ev := NewEventBuilder().Build()
	assertion.AssertEventFieldsEqual(t, ev.(events.DomainEvent), ev.(events.DomainEvent))
	assertion.AssertNonEmptyString(t, ev.AggregateID(), "AggregateID")
	assertion.AssertNonEmptyString(t, ev.AggregateType(), "AggregateType")
	assertion.AssertNonEmptyString(t, ev.TenantID(), "TenantID")
	assertion.AssertNonEmptyString(t, ev.EventType(), "EventType")
	if ev.Version() < 1 {
		t.Fatalf("Version should be >=1, got %d", ev.Version())
	}
	assertion.AssertTimestampRecent(t, ev.OccurredAt(), 2*time.Second)
}

func TestBuilder_Aggregate(t *testing.T) {
	agg := NewAggregateBuilder().
		WithAggregateType("approval").
		WithTenantID("tenant-42").
		WithVersion(3).
		Build()

	if agg.AggregateType != "approval" {
		t.Errorf("AggregateType: got %q want approval", agg.AggregateType)
	}
	if agg.TenantID != "tenant-42" {
		t.Errorf("TenantID: got %q want tenant-42", agg.TenantID)
	}
	if agg.Version != 3 {
		t.Errorf("Version: got %d want 3", agg.Version)
	}
	assertion.AssertUUIDv4(t, agg.AggregateID, "AggregateID")
}

func TestBuilder_Command(t *testing.T) {
	cmd := NewCommandBuilder().
		WithCommandName("pipeline.cancel").
		WithTenantID("tenant-7").
		WithPayloadValue("reason", "manual abort").
		Build()

	if cmd.CommandName != "pipeline.cancel" {
		t.Errorf("CommandName: got %q want pipeline.cancel", cmd.CommandName)
	}
	if cmd.TenantID != "tenant-7" {
		t.Errorf("TenantID: got %q want tenant-7", cmd.TenantID)
	}
	if reason, ok := cmd.Payload["reason"].(string); !ok || reason != "manual abort" {
		t.Errorf("Payload[reason]: got %v want 'manual abort'", cmd.Payload["reason"])
	}
	assertion.AssertUUIDv4(t, cmd.CommandID, "CommandID")
	assertion.AssertTimestampRecent(t, cmd.IssuedAt, 2*time.Second)
}

func TestBuilder_EventBuilderDistinctIDs(t *testing.T) {
	a := NewEventBuilder().Build()
	b := NewEventBuilder().Build()
	if a.AggregateID() == b.AggregateID() {
		t.Errorf("Distinct builders produced same AggregateID: %s", a.AggregateID())
	}
}

func TestBuilder_EventBuilderCorrelation(t *testing.T) {
	cid := "corr-123"
	caid := "caus-456"
	ev := NewEventBuilder().
		WithCorrelationID(cid).
		WithCausationID(caid).
		BuildPtr()

	if ev.CorrelationID != cid {
		t.Errorf("CorrelationID: got %q want %q", ev.CorrelationID, cid)
	}
	if ev.CausationID != caid {
		t.Errorf("CausationID: got %q want %q", ev.CausationID, caid)
	}
}

func TestBuilder_EventBuilderOverrides(t *testing.T) {
	customTime := time.Date(2026, 1, 2, 3, 4, 5, 0, time.UTC)
	ev := NewEventBuilder().
		WithAggregateType("saga").
		WithAggregateID("saga-1").
		WithEventType("saga.compensated").
		WithTenantID("tenant-override").
		WithOccurredAt(customTime).
		WithVersion(7).
		Build()

	if ev.AggregateType() != "saga" {
		t.Errorf("AggregateType: got %q want saga", ev.AggregateType())
	}
	if ev.AggregateID() != "saga-1" {
		t.Errorf("AggregateID: got %q want saga-1", ev.AggregateID())
	}
	if ev.EventType() != "saga.compensated" {
		t.Errorf("EventType: got %q want saga.compensated", ev.EventType())
	}
	if ev.TenantID() != "tenant-override" {
		t.Errorf("TenantID: got %q want tenant-override", ev.TenantID())
	}
	if !ev.OccurredAt().Equal(customTime) {
		t.Errorf("OccurredAt: got %v want %v", ev.OccurredAt(), customTime)
	}
	if ev.Version() != 7 {
		t.Errorf("Version: got %d want 7", ev.Version())
	}
}

func TestBuilder_DefaultTenantIDIsNotEmpty(t *testing.T) {
	if strings.TrimSpace(DefaultTenantID) == "" {
		t.Fatal("DefaultTenantID must be non-empty by convention")
	}
	ev := NewEventBuilder().Build()
	if ev.TenantID() != DefaultTenantID {
		t.Errorf("Default TenantID: got %q want %q", ev.TenantID(), DefaultTenantID)
	}
}
