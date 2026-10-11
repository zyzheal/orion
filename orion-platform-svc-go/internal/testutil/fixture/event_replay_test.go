// Tests for event_replay.go (ADR-017 Phase 2).
package fixture

import (
	"testing"
	"time"

	"orion/platform-svc-go/internal/domain/events"
)

func TestReplayFixture_BasicAppendAndLen(t *testing.T) {
	fx := NewReplayFixture("tenant-1")
	if fx.Len() != 0 {
		t.Errorf("initial Len = %d, want 0", fx.Len())
	}

	ev := fx.NewBaseEvent("pipeline", "p-1", "pipeline.created")
	fx.Append(ev)
	if fx.Len() != 1 {
		t.Errorf("after 1 append, Len = %d, want 1", fx.Len())
	}
}

func TestReplayFixture_TenantIDAutoInject(t *testing.T) {
	fx := NewReplayFixture("tenant-abc")
	ev := &events.BaseDomainEvent{
		BaseAggregateType: "pipeline",
		BaseAggregateID:   "p-1",
		BaseEventType:     "pipeline.created",
		BaseOccurredAt:    time.Now(),
		BaseVersion:       1,
	}
	fx.Append(ev)
	if ev.TenantID() != "tenant-abc" {
		t.Errorf("auto-injected tenant = %q, want tenant-abc", ev.TenantID())
	}
}

func TestReplayFixture_TenantIDPreservedIfSet(t *testing.T) {
	fx := NewReplayFixture("tenant-abc")
	ev := &events.BaseDomainEvent{
		BaseAggregateType: "pipeline",
		BaseAggregateID:   "p-1",
		BaseEventType:     "pipeline.created",
		BaseTenantID:      "tenant-xyz", // already set
		BaseOccurredAt:    time.Now(),
		BaseVersion:       1,
	}
	fx.Append(ev)
	if ev.TenantID() != "tenant-xyz" {
		t.Errorf("preserved tenant = %q, want tenant-xyz", ev.TenantID())
	}
}

func TestReplayFixture_AppendNilIsNoop(t *testing.T) {
	fx := NewReplayFixture("tenant-1")
	fx.Append(nil)
	if fx.Len() != 0 {
		t.Errorf("after nil append, Len = %d, want 0", fx.Len())
	}
}

func TestReplayFixture_AppendMany(t *testing.T) {
	fx := NewReplayFixture("tenant-1")
	ev1 := fx.NewBaseEvent("pipeline", "p-1", "pipeline.created")
	ev2 := fx.NewBaseEvent("pipeline", "p-2", "pipeline.created")
	fx.AppendMany(ev1, ev2)
	if fx.Len() != 2 {
		t.Errorf("after AppendMany(2), Len = %d, want 2", fx.Len())
	}
}

func TestReplayFixture_Clear(t *testing.T) {
	fx := NewReplayFixture("tenant-1")
	fx.Append(fx.NewBaseEvent("pipeline", "p-1", "pipeline.created"))
	fx.Append(fx.NewBaseEvent("pipeline", "p-2", "pipeline.created"))
	if fx.Len() != 2 {
		t.Fatalf("setup: Len = %d, want 2", fx.Len())
	}
	fx.Clear()
	if fx.Len() != 0 {
		t.Errorf("after Clear, Len = %d, want 0", fx.Len())
	}
}

func TestReplayFixture_All(t *testing.T) {
	fx := NewReplayFixture("tenant-1")
	ev1 := fx.NewBaseEvent("pipeline", "p-1", "pipeline.created")
	ev2 := fx.NewBaseEvent("pipeline", "p-2", "pipeline.started")
	fx.Append(ev1)
	fx.Append(ev2)

	all := fx.All()
	if len(all) != 2 {
		t.Fatalf("All() len = %d, want 2", len(all))
	}
	if all[0].AggregateID() != "p-1" {
		t.Errorf("All()[0] = %q, want p-1", all[0].AggregateID())
	}
	if all[1].AggregateID() != "p-2" {
		t.Errorf("All()[1] = %q, want p-2", all[1].AggregateID())
	}
}

func TestReplayFixture_IterReturnsInOrder(t *testing.T) {
	fx := NewReplayFixture("tenant-1")
	now := time.Now()

	ev1 := fx.NewBaseEvent("pipeline", "p-1", "pipeline.created")
	ev1.BaseOccurredAt = now.Add(1 * time.Second)
	fx.Append(ev1)

	ev2 := fx.NewBaseEvent("pipeline", "p-2", "pipeline.started")
	ev2.BaseOccurredAt = now.Add(2 * time.Second)
	fx.Append(ev2)

	ev3 := fx.NewBaseEvent("pipeline", "p-3", "pipeline.completed")
	ev3.BaseOccurredAt = now.Add(3 * time.Second)
	fx.Append(ev3)

	var ids []string
	for ev := range fx.Iter() {
		ids = append(ids, ev.AggregateID())
	}
	if len(ids) != 3 {
		t.Fatalf("Iter returned %d events, want 3", len(ids))
	}
	// Events should be sorted by OccurredAt
	if ids[0] != "p-1" || ids[1] != "p-2" || ids[2] != "p-3" {
		t.Errorf("Iter order = %v, want [p-1 p-2 p-3]", ids)
	}
}

func TestReplayFixture_IterByVersion(t *testing.T) {
	fx := NewReplayFixture("tenant-1")
	now := time.Now()

	ev1 := fx.NewBaseEvent("pipeline", "p-1", "pipeline.created")
	ev1.BaseOccurredAt = now
	ev1.BaseVersion = 1
	fx.Append(ev1)

	ev2 := fx.NewBaseEvent("pipeline", "p-1", "pipeline.started")
	ev2.BaseOccurredAt = now.Add(1 * time.Second)
	ev2.BaseVersion = 2
	fx.Append(ev2)

	ev3 := fx.NewBaseEvent("pipeline", "p-1", "pipeline.completed")
	ev3.BaseOccurredAt = now.Add(2 * time.Second)
	ev3.BaseVersion = 3
	fx.Append(ev3)

	// Filter to version >= 2
	var ids []string
	for ev := range fx.IterByVersion(2) {
		ids = append(ids, ev.AggregateID()+"-v"+itoa(ev.Version()))
	}
	if len(ids) != 2 {
		t.Fatalf("IterByVersion(2) returned %d events, want 2", len(ids))
	}
	if ids[0] != "p-1-v2" || ids[1] != "p-1-v3" {
		t.Errorf("IterByVersion(2) = %v, want [p-1-v2 p-1-v3]", ids)
	}
}

func TestReplayFixture_IterByType(t *testing.T) {
	fx := NewReplayFixture("tenant-1")
	now := time.Now()

	ev1 := fx.NewBaseEvent("pipeline", "p-1", "pipeline.created")
	ev1.BaseOccurredAt = now
	fx.Append(ev1)

	ev2 := fx.NewBaseEvent("approval", "a-1", "approval.submitted")
	ev2.BaseOccurredAt = now.Add(1 * time.Second)
	fx.Append(ev2)

	ev3 := fx.NewBaseEvent("pipeline", "p-2", "pipeline.started")
	ev3.BaseOccurredAt = now.Add(2 * time.Second)
	fx.Append(ev3)

	var ids []string
	for ev := range fx.IterByType("pipeline") {
		ids = append(ids, ev.AggregateID())
	}
	if len(ids) != 2 {
		t.Fatalf("IterByType(pipeline) returned %d events, want 2", len(ids))
	}
	if ids[0] != "p-1" || ids[1] != "p-2" {
		t.Errorf("IterByType(pipeline) = %v, want [p-1 p-2]", ids)
	}
}

func TestReplayFixture_IterByTenant(t *testing.T) {
	fx := NewReplayFixture("tenant-1")
	now := time.Now()

	ev1 := &events.BaseDomainEvent{
		BaseAggregateType: "pipeline", BaseAggregateID: "p-1",
		BaseEventType: "pipeline.created", BaseTenantID: "tenant-1",
		BaseOccurredAt: now, BaseVersion: 1,
	}
	fx.Append(ev1)

	ev2 := &events.BaseDomainEvent{
		BaseAggregateType: "pipeline", BaseAggregateID: "p-2",
		BaseEventType: "pipeline.started", BaseTenantID: "tenant-2",
		BaseOccurredAt: now.Add(1 * time.Second), BaseVersion: 1,
	}
	fx.Append(ev2)

	// Filter to tenant-1
	var ids []string
	for ev := range fx.IterByTenant("tenant-1") {
		ids = append(ids, ev.AggregateID())
	}
	if len(ids) != 1 {
		t.Fatalf("IterByTenant(tenant-1) returned %d events, want 1", len(ids))
	}
	if ids[0] != "p-1" {
		t.Errorf("IterByTenant(tenant-1) = %v, want [p-1]", ids)
	}
}

func TestReplayFixture_WithClock(t *testing.T) {
	fixed := time.Date(2026, 10, 11, 12, 0, 0, 0, time.UTC)
	fx := NewReplayFixture("tenant-1", WithReplayClock(fixed))
	ev := fx.NewBaseEvent("pipeline", "p-1", "pipeline.created")
	if !ev.OccurredAt().Equal(fixed) {
		t.Errorf("OccurredAt = %v, want %v", ev.OccurredAt(), fixed)
	}
}

func TestReplayFixture_NewBaseEvent(t *testing.T) {
	fx := NewReplayFixture("tenant-abc")
	ev := fx.NewBaseEvent("pipeline", "p-1", "pipeline.created")
	if ev.AggregateType() != "pipeline" {
		t.Errorf("AggregateType = %q, want pipeline", ev.AggregateType())
	}
	if ev.AggregateID() != "p-1" {
		t.Errorf("AggregateID = %q, want p-1", ev.AggregateID())
	}
	if ev.EventType() != "pipeline.created" {
		t.Errorf("EventType = %q, want pipeline.created", ev.EventType())
	}
	if ev.TenantID() != "tenant-abc" {
		t.Errorf("TenantID = %q, want tenant-abc", ev.TenantID())
	}
	if ev.Version() != 1 {
		t.Errorf("Version = %d, want 1", ev.Version())
	}
}

func TestReplayFixture_String(t *testing.T) {
	fx := NewReplayFixture("tenant-1")
	fx.Append(fx.NewBaseEvent("pipeline", "p-1", "pipeline.created"))
	s := fx.String()
	if s == "" {
		t.Error("String() returned empty")
	}
}

func TestReplayFixture_IterEmpty(t *testing.T) {
	fx := NewReplayFixture("tenant-1")
	count := 0
	for range fx.Iter() {
		count++
	}
	if count != 0 {
		t.Errorf("Iter on empty fixture returned %d events, want 0", count)
	}
}

func TestItoa(t *testing.T) {
	cases := []struct {
		n    int
		want string
	}{
		{0, "0"},
		{1, "1"},
		{42, "42"},
		{100, "100"},
		{999, "999"},
	}
	for _, c := range cases {
		got := itoa(c.n)
		if got != c.want {
			t.Errorf("itoa(%d) = %q, want %q", c.n, got, c.want)
		}
	}
}

func TestReplayFixture_SetAggregateID(t *testing.T) {
	fx := NewReplayFixture("tenant-1")
	ev := fx.NewBaseEvent("pipeline", "p-1", "pipeline.created")
	ev.SetAggregateID("p-2")
	if ev.AggregateID() != "p-2" {
		t.Errorf("SetAggregateID: got %q, want p-2", ev.AggregateID())
	}
}

func TestReplayFixture_SetTenantID(t *testing.T) {
	fx := NewReplayFixture("tenant-1")
	ev := fx.NewBaseEvent("pipeline", "p-1", "pipeline.created")
	ev.SetTenantID("tenant-2")
	if ev.TenantID() != "tenant-2" {
		t.Errorf("SetTenantID: got %q, want tenant-2", ev.TenantID())
	}
}

func TestReplayFixture_SetVersion(t *testing.T) {
	fx := NewReplayFixture("tenant-1")
	ev := fx.NewBaseEvent("pipeline", "p-1", "pipeline.created")
	ev.SetVersion(5)
	if ev.Version() != 5 {
		t.Errorf("SetVersion: got %d, want 5", ev.Version())
	}
}
