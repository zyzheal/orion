// ============================================================
// Collector 测试 — 核心接口测试
// ============================================================

package collector

import (
	"context"
	"testing"
)

func TestGlobalFactoryRegister(t *testing.T) {
	// 测试 1: 注册 MockCollector
	mock := &MockCollector{
		NameVal:   "test_mock",
		VendorVal: "test_vendor",
		TypeVal:   "test_type",
	}

	GlobalFactory.Register(mock)

	// 测试 2: 查找
	c, ok := GlobalFactory.Get("test_mock")
	if !ok {
		t.Fatalf("expected to find test_mock collector")
	}

	if c.Name() != "test_mock" {
		t.Errorf("expected name test_mock, got %s", c.Name())
	}

	// 测试 3: 重复注册 panic
	defer func() {
		if r := recover(); r == nil {
			t.Errorf("expected panic on duplicate register")
		}
	}()
	GlobalFactory.Register(mock)
}

func TestGlobalFactoryGetByVendor(t *testing.T) {
	collectors := GlobalFactory.GetByVendor("test_vendor")
	if len(collectors) != 1 {
		t.Errorf("expected 1 collector for vendor test_vendor, got %d", len(collectors))
	}
}

func TestGlobalFactoryGetByType(t *testing.T) {
	collectors := GlobalFactory.GetByType("test_type")
	if len(collectors) != 1 {
		t.Errorf("expected 1 collector for type test_type, got %d", len(collectors))
	}
}

func TestGlobalFactoryList(t *testing.T) {
	list := GlobalFactory.List()
	found := false
	for _, name := range list {
		if name == "test_mock" {
			found = true
			break
		}
	}
	if !found {
		t.Errorf("expected test_mock in list")
	}
}

func TestGlobalFactoryCount(t *testing.T) {
	count := GlobalFactory.Count()
	if count < 1 {
		t.Errorf("expected count >= 1, got %d", count)
	}
}

func TestMockCollectorCollect(t *testing.T) {
	mock := &MockCollector{
		NameVal:   "test_mock2",
		VendorVal: "test_vendor",
		TypeVal:   "test_type",
	}

	ctx := context.Background()
	cis, err := mock.Collect(ctx, map[string]any{})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	if len(cis) != 1 {
		t.Errorf("expected 1 CI, got %d", len(cis))
	}

	if cis[0].Name != "test_mock2-test-1" {
		t.Errorf("expected name test_mock2-test-1, got %s", cis[0].Name)
	}
}

func TestMockCollectorPing(t *testing.T) {
	mock := &MockCollector{
		NameVal:   "test_mock3",
		VendorVal: "test_vendor",
		TypeVal:   "test_type",
	}

	ctx := context.Background()
	reachable, err := mock.Ping(ctx, map[string]any{})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if !reachable {
		t.Errorf("expected reachable, got %v", reachable)
	}
}

func TestMockCollectorValidate(t *testing.T) {
	mock := &MockCollector{
		NameVal:   "test_mock4",
		VendorVal: "test_vendor",
		TypeVal:   "test_type",
	}

	err := mock.Validate(map[string]any{})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
}

func TestRunner(t *testing.T) {
	cfg := DefaultRunnerConfig()
	runner := NewRunner(cfg)
	defer runner.Stop()

	ctx := context.Background()
	runner.Start(ctx)

	// 提交任务
	runner.Submit(TaskItem{
		ID:        "test-task-1",
		Collector: "test_mock",
		Config:    map[string]any{},
		TenantID:  "default",
	})

	// 等待任务完成
	// TODO: 添加适当的等待机制

	results := runner.GetResults()
	if len(results) != 1 {
		t.Errorf("expected 1 result, got %d", len(results))
	}
}

func TestRunnerStats(t *testing.T) {
	cfg := DefaultRunnerConfig()
	runner := NewRunner(cfg)

	stats := runner.Stats()
	if stats["total_tasks"] != 0 {
		t.Errorf("expected 0 tasks, got %v", stats["total_tasks"])
	}
}
