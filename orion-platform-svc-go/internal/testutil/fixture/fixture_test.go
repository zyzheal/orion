package fixture

import (
	"strings"
	"testing"
	"time"

	"orion/platform-svc-go/internal/testutil/assertion"
)

func TestFixture_TenantIDAutoInject(t *testing.T) {
	fx := New("tenant-abc")

	ev := fx.Event("pipeline", "pipe-1", "pipeline.created")
	if ev.BaseTenantID != "tenant-abc" {
		t.Errorf("Event TenantID: got %q want tenant-abc", ev.BaseTenantID)
	}

	agg := fx.Aggregate("approval")
	if agg.TenantID != "tenant-abc" {
		t.Errorf("Aggregate TenantID: got %q want tenant-abc", agg.TenantID)
	}
}

func TestFixture_TenantIDGeneratedWhenEmpty(t *testing.T) {
	fx := New("")
	id := fx.TenantID()
	if id == "" {
		t.Fatal("Empty tenantID should be replaced with a generated value")
	}
	if !strings.HasPrefix(id, "tenant-test-") {
		t.Errorf("Generated TenantID should have prefix 'tenant-test-', got %q", id)
	}
}

func TestFixture_FixedClock(t *testing.T) {
	fixed := time.Date(2026, 6, 15, 10, 0, 0, 0, time.UTC)
	fx := New("tenant-fixed", WithClock(fixed))

	if !fx.Now().Equal(fixed) {
		t.Errorf("Now(): got %v want %v", fx.Now(), fixed)
	}
	ev := fx.Event("pipeline", "pipe-1", "pipeline.started")
	if !ev.BaseOccurredAt.Equal(fixed) {
		t.Errorf("Event OccurredAt: got %v want %v", ev.BaseOccurredAt, fixed)
	}
}

func TestFixture_InjectTenantOnEvent(t *testing.T) {
	fx := New("tenant-xyz")
	ev := fx.EventWithID("pipeline", "pipeline.created")
	// Override to wrong tenant, then inject correct.
	ev.BaseTenantID = "wrong"
	if err := fx.InjectTenant(&ev); err != nil {
		t.Fatalf("InjectTenant failed: %v", err)
	}
	if ev.BaseTenantID != "tenant-xyz" {
		t.Errorf("After InjectTenant: got %q want tenant-xyz", ev.BaseTenantID)
	}
}

func TestFixture_InjectTenantUnsupportedType(t *testing.T) {
	fx := New("tenant-1")
	var s string = "not an object"
	err := fx.InjectTenant(&s)
	if err == nil {
		t.Fatal("InjectTenant should error on unsupported type")
	}
}

func TestFixture_AggregateWithID(t *testing.T) {
	fx := New("tenant-1")
	agg := fx.AggregateWithID("pipeline", "pipe-42")
	if agg.AggregateID != "pipe-42" {
		t.Errorf("AggregateID: got %q want pipe-42", agg.AggregateID)
	}
	if agg.TenantID != "tenant-1" {
		t.Errorf("TenantID: got %q want tenant-1", agg.TenantID)
	}
	if agg.AggregateType != "pipeline" {
		t.Errorf("AggregateType: got %q want pipeline", agg.AggregateType)
	}
	if agg.Version != 0 {
		t.Errorf("Version: got %d want 0", agg.Version)
	}
}

func TestFixture_StringRepresentation(t *testing.T) {
	fx := New("tenant-99")
	s := fx.String()
	if !strings.Contains(s, "tenant-99") {
		t.Errorf("String() should contain tenant ID: got %q", s)
	}
}

func TestFixture_DistinctRunsIsolated(t *testing.T) {
	fx1 := New("")
	fx2 := New("")
	if fx1.TenantID() == fx2.TenantID() {
		t.Errorf("Two empty-input fixtures must have distinct tenant IDs, both got %q", fx1.TenantID())
	}
}

func TestFixture_EventFieldsValid(t *testing.T) {
	fx := New("tenant-1")
	ev := fx.Event("pipeline", "pipe-1", "pipeline.created")
	assertion.AssertNonEmptyString(t, ev.BaseAggregateType, "AggregateType")
	assertion.AssertNonEmptyString(t, ev.BaseAggregateID, "AggregateID")
	assertion.AssertNonEmptyString(t, ev.BaseEventType, "EventType")
	assertion.AssertTimestampRecent(t, ev.BaseOccurredAt, 2*time.Second)
}
