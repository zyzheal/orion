// ============================================================
// 采集器测试 — 模拟采集器
// ============================================================

package collector

import (
	"context"
	"fmt"

	"orion-cmdb-svc-go/internal/model"
)

// MockCollector 用于测试和演示的模拟采集器
type MockCollector struct {
	NameVal    string
	VendorVal  model.VendorType
	TypeVal    string
	CollectFn  func(context.Context, map[string]any) ([]model.CIRaw, error)
	PingFn     func(context.Context, map[string]any) (bool, error)
	ValidateFn func(map[string]any) error
}

func (c *MockCollector) Name() string { return c.NameVal }
func (c *MockCollector) Vendor() model.VendorType { return c.VendorVal }
func (c *MockCollector) Type() string { return c.TypeVal }

func (c *MockCollector) Ping(ctx context.Context, config map[string]any) (bool, error) {
	if c.PingFn != nil {
		return c.PingFn(ctx, config)
	}
	return true, nil
}

func (c *MockCollector) Validate(config map[string]any) error {
	if c.ValidateFn != nil {
		return c.ValidateFn(config)
	}
	return nil
}

func (c *MockCollector) Collect(ctx context.Context, config map[string]any) ([]model.CIRaw, error) {
	if c.CollectFn != nil {
		return c.CollectFn(ctx, config)
	}
	return []model.CIRaw{
		{
			Name:       fmt.Sprintf("%s-test-1", c.NameVal),
			TypeHint:   model.CITypeServer,
			Status:     model.CIStatusActive,
			Attributes: map[string]any{"mock": true},
		},
	}, nil
}
