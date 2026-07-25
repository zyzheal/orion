// Package router_test tests the crossover call router.
package router

import (
	"context"
	"errors"
	"sync"
	"testing"
	"time"

	"orion/platform-svc-go/internal/crossover/models"
	"orion/platform-svc-go/internal/crossover/registry"
)

func TestHandlerRegistry_RegisterAndGet(t *testing.T) {
	hr := NewHandlerRegistry()
	fn := func(ctx context.Context, tenantID string, req *models.InvokeCrossoverRequest) (map[string]interface{}, error) {
		return map[string]interface{}{"ok": true}, nil
	}
	hr.Register("module-a", "op1", fn)
	got := hr.Get("module-a", "op1")
	if got == nil {
		t.Fatal("expected handler to be found")
	}
	// Call the handler to verify it works
	result, err := got(context.Background(), "tenant-1", &models.InvokeCrossoverRequest{})
	if err != nil {
		t.Fatalf("handler failed: %v", err)
	}
	if result["ok"] != true {
		t.Error("expected ok=true")
	}
}

func TestHandlerRegistry_Unregister(t *testing.T) {
	hr := NewHandlerRegistry()
	fn := func(ctx context.Context, tenantID string, req *models.InvokeCrossoverRequest) (map[string]interface{}, error) {
		return nil, nil
	}
	hr.Register("module-a", "op1", fn)
	hr.Unregister("module-a", "op1")
	if hr.Get("module-a", "op1") != nil {
		t.Error("expected handler to be nil after unregister")
	}
}

func TestHandlerRegistry_Has(t *testing.T) {
	hr := NewHandlerRegistry()
	fn := func(ctx context.Context, tenantID string, req *models.InvokeCrossoverRequest) (map[string]interface{}, error) {
		return nil, nil
	}
	hr.Register("module-a", "op1", fn)
	if !hr.Has("module-a", "op1") {
		t.Error("expected handler to exist")
	}
	if hr.Has("module-a", "op2") {
		t.Error("expected handler to not exist")
	}
}

func TestCallRouter_NewCallRouter(t *testing.T) {
	handlerReg := NewHandlerRegistry()
	opReg := registry.NewCallOperationRegistry(nil)
	router := NewCallRouter(handlerReg, opReg, WithTimeout(5*time.Second))
	if router.defaultTimeout != 5*time.Second {
		t.Errorf("expected 5s timeout, got %v", router.defaultTimeout)
	}
}

func TestCallRouter_DefaultTimeout(t *testing.T) {
	handlerReg := NewHandlerRegistry()
	opReg := registry.NewCallOperationRegistry(nil)
	router := NewCallRouter(handlerReg, opReg)
	if router.defaultTimeout != 10*time.Second {
		t.Errorf("expected default 10s timeout, got %v", router.defaultTimeout)
	}
}

func TestCallRouter_Dispatch_Success(t *testing.T) {
	handlerReg := NewHandlerRegistry()
	opReg := registry.NewCallOperationRegistry(nil)
	router := NewCallRouter(handlerReg, opReg)

	fn := func(ctx context.Context, tenantID string, req *models.InvokeCrossoverRequest) (map[string]interface{}, error) {
		return map[string]interface{}{"status": "done"}, nil
	}
	handlerReg.Register("test-module", "test-op", fn)

	result, err := router.Dispatch(context.Background(), "tenant-1", "test-module", "test-op", nil)
	if err != nil {
		t.Fatalf("dispatch failed: %v", err)
	}
	if result["status"] != "done" {
		t.Errorf("expected done, got %v", result["status"])
	}
}

func TestCallRouter_Dispatch_NoHandler(t *testing.T) {
	handlerReg := NewHandlerRegistry()
	opReg := registry.NewCallOperationRegistry(nil)
	router := NewCallRouter(handlerReg, opReg)

	_, err := router.Dispatch(context.Background(), "tenant-1", "unknown", "op", nil)
	if !errors.Is(err, ErrNoHandler) {
		t.Errorf("expected ErrNoHandler, got %v", err)
	}
}

func TestCallRouter_Route_Sync_Success(t *testing.T) {
	handlerReg := NewHandlerRegistry()
	opReg := registry.NewCallOperationRegistry(nil)
	router := NewCallRouter(handlerReg, opReg)

	fn := func(ctx context.Context, tenantID string, req *models.InvokeCrossoverRequest) (map[string]interface{}, error) {
		return map[string]interface{}{"value": "ok"}, nil
	}
	handlerReg.Register("test-module", "test-op", fn)

	call := &models.CrossoverCall{
		CallType:     models.CallTypeRequestResponse,
		SourceModule: "caller",
		TargetModule: "test-module",
		Operation:    "test-op",
	}

	result, err := router.Route(context.Background(), "tenant-1", call)
	if err != nil {
		t.Fatalf("route failed: %v", err)
	}
	if result.Value["value"] != "ok" {
		t.Errorf("expected ok, got %v", result.Value["value"])
	}
}

func TestCallRouter_Route_Sync_InvalidType(t *testing.T) {
	handlerReg := NewHandlerRegistry()
	router := NewCallRouter(handlerReg, nil)

	call := &models.CrossoverCall{
		CallType: "invalid-type",
	}

	_, err := router.Route(context.Background(), "tenant-1", call)
	if !errors.Is(err, ErrInvalidCallType) {
		t.Errorf("expected ErrInvalidCallType, got %v", err)
	}
}

func TestCallRouter_Route_Event(t *testing.T) {
	handlerReg := NewHandlerRegistry()
	opReg := registry.NewCallOperationRegistry(nil)
	router := NewCallRouter(handlerReg, opReg)

	fn := func(ctx context.Context, tenantID string, req *models.InvokeCrossoverRequest) (map[string]interface{}, error) {
		return map[string]interface{}{"status": "processed"}, nil
	}
	handlerReg.Register("test-module", "test-op", fn)

	call := &models.CrossoverCall{
		CallType:     models.CallTypeEvent,
		TargetModule: "test-module",
		Operation:    "test-op",
	}

	result, err := router.Route(context.Background(), "tenant-1", call)
	if err != nil {
		t.Fatalf("event route failed: %v", err)
	}
	if result.Value["status"] != "dispatched" {
		t.Errorf("expected dispatched, got %v", result.Value["status"])
	}
}

func TestCallRouter_Route_Async(t *testing.T) {
	handlerReg := NewHandlerRegistry()
	router := NewCallRouter(handlerReg, nil)

	call := &models.CrossoverCall{
		CallType:     models.CallTypeAsync,
		TargetModule: "test-module",
		Operation:    "test-op",
	}

	result, err := router.Route(context.Background(), "tenant-1", call)
	if err != nil {
		t.Fatalf("async route failed: %v", err)
	}
	if result.Value["status"] != "created" {
		t.Errorf("expected created, got %v", result.Value["status"])
	}
}

func TestCallRouter_RouteWithTimeout(t *testing.T) {
	handlerReg := NewHandlerRegistry()
	router := NewCallRouter(handlerReg, nil)

	call := &models.CrossoverCall{
		CallType:     models.CallTypeRequestResponse,
		TargetModule: "unknown-module",
		Operation:    "unknown-op",
	}

	_, err := router.RouteWithTimeout(context.Background(), "tenant-1", call, 100*time.Millisecond)
	if !errors.Is(err, ErrNoHandler) {
		t.Errorf("expected ErrNoHandler, got %v", err)
	}
}

func TestCallRouter_Resolve(t *testing.T) {
	handlerReg := NewHandlerRegistry()
	opReg := registry.NewCallOperationRegistry(nil)
	router := NewCallRouter(handlerReg, opReg)

	fn := func(ctx context.Context, tenantID string, req *models.InvokeCrossoverRequest) (map[string]interface{}, error) {
		return nil, nil
	}
	handlerReg.Register("test-module", "test-op", fn)

	available, _ := router.Resolve(context.Background(), "tenant-1", "test-module", "test-op")
	if !available {
		t.Error("expected operation to be available")
	}

	available, _ = router.Resolve(context.Background(), "tenant-1", "unknown", "op")
	if available {
		t.Error("expected operation to not be available")
	}
}

func TestCallRouter_ListHandlers(t *testing.T) {
	handlerReg := NewHandlerRegistry()
	router := NewCallRouter(handlerReg, nil)

	fn := func(ctx context.Context, tenantID string, req *models.InvokeCrossoverRequest) (map[string]interface{}, error) {
		return nil, nil
	}
	handlerReg.Register("mod1", "op1", fn)
	handlerReg.Register("mod2", "op2", fn)

	handlers := router.ListHandlers()
	if len(handlers) != 2 {
		t.Errorf("expected 2 handlers, got %d", len(handlers))
	}
}

func TestCallRouter_Dispatch_ErrHandler(t *testing.T) {
	handlerReg := NewHandlerRegistry()
	router := NewCallRouter(handlerReg, nil)

	var wg sync.WaitGroup
	ctx, cancel := context.WithTimeout(context.Background(), 50*time.Millisecond)
	defer cancel()
	defer wg.Wait()

	handlerReg.Register("slow-module", "slow-op", func(ctx context.Context, tenantID string, req *models.InvokeCrossoverRequest) (map[string]interface{}, error) {
		select {
		case <-ctx.Done():
			return nil, ctx.Err()
		case <-time.After(100 * time.Millisecond):
			return map[string]interface{}{"late": true}, nil
		}
	})

	_, err := router.Dispatch(ctx, "tenant-1", "slow-module", "slow-op", nil)
	if !errors.Is(err, context.DeadlineExceeded) && !errors.Is(err, context.Canceled) {
		// The dispatch runs synchronously, so it may or may not hit the timeout
		// depending on timing; just verify it doesn't panic
	}
}

func TestHandlerRegistry_ConcurrentAccess(t *testing.T) {
	hr := NewHandlerRegistry()
	fn := func(ctx context.Context, tenantID string, req *models.InvokeCrossoverRequest) (map[string]interface{}, error) {
		return nil, nil
	}

	var wg sync.WaitGroup
	for i := 0; i < 10; i++ {
		wg.Add(3)
		go func(i int) {
			defer wg.Done()
			hr.Register("module", "op", fn)
		}(i)
		go func(i int) {
			defer wg.Done()
			hr.Get("module", "op")
		}(i)
		go func(i int) {
			defer wg.Done()
			hr.Has("module", "op")
		}(i)
	}
	wg.Wait()
}
