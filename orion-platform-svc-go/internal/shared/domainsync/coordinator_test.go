package domainsync

import (
	"context"
	"sync/atomic"
	"testing"
)

func TestCoordinatorExecute(t *testing.T) {
	var called int32
	dc := NewDomainCoordinator()
	dc.RegisterHandler(SyncAlertToIncident, func(ctx context.Context, event DomainSyncEvent) error {
		atomic.AddInt32(&called, 1)
		return nil
	})
	err := dc.Execute(context.Background(), DomainSyncEvent{
		Type:     SyncAlertToIncident,
		TenantID: "t1",
	})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if called != 1 {
		t.Fatalf("expected handler to be called once")
	}
}

func TestCoordinatorFullChain(t *testing.T) {
	var order []string
	dc := NewDomainCoordinator()
	dc.RegisterHandler(SyncAlertToIncident, func(ctx context.Context, e DomainSyncEvent) error {
		order = append(order, "alert")
		return nil
	})
	dc.RegisterHandler(SyncIncidentToChange, func(ctx context.Context, e DomainSyncEvent) error {
		order = append(order, "change")
		return nil
	})
	dc.RegisterHandler(SyncChangeToPipeline, func(ctx context.Context, e DomainSyncEvent) error {
		order = append(order, "pipeline")
		return nil
	})
	dc.RegisterHandler(SyncPipelineToCMDB, func(ctx context.Context, e DomainSyncEvent) error {
		order = append(order, "cmdb")
		return nil
	})
	err := dc.StartFullChain(context.Background(), "t1", "test")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(order) != 4 {
		t.Fatalf("expected 4 steps, got %d", len(order))
	}
}
