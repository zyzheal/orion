package calldispatcher

import (
	"context"
	"fmt"
	"testing"
)

func TestDispatch(t *testing.T) {
	d := New()
	d.Register(DomainPipeline, "trigger", func(ctx context.Context, req CrossDomainRequest) CrossDomainResponse {
		return CrossDomainResponse{Success: true, StatusCode: 200, Data: "triggered"}
	})
	resp := d.Dispatch(context.Background(), CrossDomainRequest{
		TenantID: "t1", Source: DomainAlert, Target: DomainPipeline, Action: "trigger",
	})
	if !resp.Success {
		t.Fatalf("expected success")
	}
}

func TestDispatchNotFound(t *testing.T) {
	d := New()
	resp := d.Dispatch(context.Background(), CrossDomainRequest{
		TenantID: "t1", Source: DomainAlert, Target: DomainPipeline, Action: "unknown",
	})
	if resp.Success {
		t.Fatalf("expected failure")
	}
	if resp.StatusCode != 404 {
		t.Fatalf("expected status code 404, got %d", resp.StatusCode)
	}
}

func TestDispatchConcurrent(t *testing.T) {
	d := New()
	for i := 0; i < 10; i++ {
		action := fmt.Sprintf("action_%d", i)
		d.Register(DomainCMDB, action, func(ctx context.Context, req CrossDomainRequest) CrossDomainResponse {
			return CrossDomainResponse{Success: true, StatusCode: 200}
		})
	}
	for i := 0; i < 10; i++ {
		action := fmt.Sprintf("action_%d", i)
		resp := d.Dispatch(context.Background(), CrossDomainRequest{
			TenantID: "t1", Source: DomainAlert, Target: DomainCMDB, Action: action,
		})
		if !resp.Success {
			t.Fatalf("expected success for %s", action)
		}
	}
}
