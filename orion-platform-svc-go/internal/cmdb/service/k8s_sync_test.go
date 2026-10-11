package service

import (
	"context"
	"testing"
)

// TestListK8sResources_NotStarted_ReturnsEmpty 验证未启动同步时返回空态而非 mock 数据。
func TestListK8sResources_NotStarted_ReturnsEmpty(t *testing.T) {
	svc := NewService(nil)

	res, total, err := svc.ListK8sResources(context.Background(), nil, nil, 20, 0)
	if err != nil {
		t.Fatalf("expected nil error, got %v", err)
	}
	if total != 0 {
		t.Errorf("expected 0 total, got %d", total)
	}
	if len(res) != 0 {
		t.Errorf("expected empty slice, got %d resources", len(res))
	}
}

// TestStartAndStopK8sSync_StateTransitions 验证启动/停止状态切换。
func TestStartAndStopK8sSync_StateTransitions(t *testing.T) {
	svc := NewService(nil)

	// 初始：未启动
	started, _ := svc.K8sSyncStatus(context.Background())
	if started {
		t.Error("expected not started initially")
	}

	// 启动
	err := svc.StartK8sSync(context.Background(), nil)
	if err != nil {
		t.Fatalf("StartK8sSync failed: %v", err)
	}

	started, at := svc.K8sSyncStatus(context.Background())
	if !started {
		t.Error("expected started=true after StartK8sSync")
	}
	if at.IsZero() {
		t.Error("expected startedAt to be set")
	}

	// 启动后可查询（仍为空，因为没有实际 K8s 数据）
	res, total, err := svc.ListK8sResources(context.Background(), nil, nil, 20, 0)
	if err != nil {
		t.Fatalf("ListK8sResources failed: %v", err)
	}
	if total != 0 {
		t.Errorf("expected 0 total (no data yet), got %d", total)
	}
	if len(res) != 0 {
		t.Errorf("expected empty slice, got %d resources", len(res))
	}

	// 停止
	err = svc.StopK8sSync(context.Background())
	if err != nil {
		t.Fatalf("StopK8sSync failed: %v", err)
	}

	started, _ = svc.K8sSyncStatus(context.Background())
	if started {
		t.Error("expected not started after StopK8sSync")
	}
}

// TestStartK8sSync_Idempotent 验证重复启动幂等。
func TestStartK8sSync_Idempotent(t *testing.T) {
	svc := NewService(nil)

	_ = svc.StartK8sSync(context.Background(), nil)
	_ = svc.StartK8sSync(context.Background(), nil)

	started, _ := svc.K8sSyncStatus(context.Background())
	if !started {
		t.Error("expected started=true")
	}
}

// TestStopK8sSync_Idempotent 验证重复停止幂等。
func TestStopK8sSync_Idempotent(t *testing.T) {
	svc := NewService(nil)

	_ = svc.StopK8sSync(context.Background())
	_ = svc.StopK8sSync(context.Background())

	started, _ := svc.K8sSyncStatus(context.Background())
	if started {
		t.Error("expected not started")
	}
}

// TestStopK8sSync_ClearsConfig 验证停止后 config 被清空。
func TestStopK8sSync_ClearsConfig(t *testing.T) {
	svc := NewService(nil)

	startedAt1 := func() {
		_ = svc.StartK8sSync(context.Background(), nil)
	}
	startedAt1()
	_ = svc.StopK8sSync(context.Background())

	if svc.k8sSync.config != nil {
		t.Error("expected config to be nil after StopK8sSync")
	}
	if !svc.k8sSync.startedAt.IsZero() {
		t.Error("expected startedAt to be zero after StopK8sSync")
	}
}
