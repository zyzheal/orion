// ============================================================
// CollectorFactory — 采集器工厂 (init() 注册)
// ============================================================
//
// 设计参考:
//   - NeatLogic CollectorManager
//   - Go 社区 SPI 惯例 (io/fs, database/sql/driver)
//
// 职责:
//   1. 管理全局 Collector 注册中心
//   2. 提供按名称/厂商/类型查找
//   3. 厂商适配器在各自包的 init() 中自动注册
//
// 注册方式:
//   厂商适配器包 (如 internal/adapter/network/cisco/) 的 init() 函数:
//   func init() {
//       collector.GlobalFactory.Register(&CiscoCollector{})
//   }

package factory

import (
	"context"
	"log/slog"
	"sync"

	"orion/platform-svc-go/internal/cmdb/collector"
)

// ============================================================
// 工厂实现
// ============================================================

// CollectorFactory 采集器工厂
type CollectorFactory struct {
	mu     sync.RWMutex
	index  map[string]collector.Collector
	vendor map[collector.VendorType][]collector.Collector
	typ    map[string][]collector.Collector
	all    []collector.Collector
}

// NewCollectorFactory 创建采集器工厂
func NewCollectorFactory() *CollectorFactory {
	return &CollectorFactory{
		index:  make(map[string]collector.Collector),
		vendor: make(map[collector.VendorType][]collector.Collector),
		typ:    make(map[string][]collector.Collector),
	}
}

// Register 注册采集器 (厂商适配器 init() 使用)
func (f *CollectorFactory) Register(c collector.Collector) {
	name := c.Name()
	f.mu.Lock()
	defer f.mu.Unlock()

	if _, exists := f.index[name]; exists {
		panic("collector already registered: " + name)
	}

	f.index[name] = c
	f.vendor[c.Vendor()] = append(f.vendor[c.Vendor()], c)
	f.typ[c.Type()] = append(f.typ[c.Type()], c)
	f.all = append(f.all, c)

	slog.Info("collector registered", "name", name, "vendor", string(c.Vendor()), "type", c.Type())
}

// Get 按名称获取采集器
func (f *CollectorFactory) Get(name string) (collector.Collector, bool) {
	f.mu.RLock()
	defer f.mu.RUnlock()
	c, ok := f.index[name]
	return c, ok
}

// GetByVendor 按厂商获取所有采集器
func (f *CollectorFactory) GetByVendor(vendor collector.VendorType) []collector.Collector {
	f.mu.RLock()
	defer f.mu.RUnlock()
	vendors := f.vendor[vendor]
	if len(vendors) == 0 {
		return nil
	}
	result := make([]collector.Collector, len(vendors))
	copy(result, vendors)
	return result
}

// GetByType 按类型获取所有采集器
func (f *CollectorFactory) GetByType(t string) []collector.Collector {
	f.mu.RLock()
	defer f.mu.RUnlock()
	types := f.typ[t]
	if len(types) == 0 {
		return nil
	}
	result := make([]collector.Collector, len(types))
	copy(result, types)
	return result
}

// All 返回所有已注册的采集器
func (f *CollectorFactory) All() []collector.Collector {
	return collector.GlobalFactory.All()
}

// List 返回采集器名称列表
func (f *CollectorFactory) List() []string {
	return collector.GlobalFactory.List()
}

// Count 返回已注册的采集器数量
func (f *CollectorFactory) Count() int {
	return collector.GlobalFactory.Count()
}

// ============================================================
// 采集执行器
// ============================================================

// RunCollector 执行单个采集任务
func RunCollector(ctx context.Context, name string, config map[string]any) ([]collector.CIRaw, error) {
	collector, ok := collector.GlobalFactory.Get(name)
	if !ok {
		return nil, nil
	}

	slog.Info("run collector", "name", name, "config", config)

	// 1. 校验配置
	if err := collector.Validate(config); err != nil {
		return nil, err
	}

	// 2. 探测目标
	reachable, err := collector.Ping(ctx, config)
	if err != nil || !reachable {
		slog.Warn("target unreachable", "collector", name, "error", err)
		return nil, nil
	}

	// 3. 执行采集
	cis, err := collector.Collect(ctx, config)
	if err != nil {
		return nil, err
	}

	slog.Info("collector complete", "name", name, "ci_count", len(cis))
	return cis, nil
}

// RunCollectors 批量执行多个采集任务
func RunCollectors(ctx context.Context, tasks []collector.CollectionTask) ([]collector.CollectionResult, error) {
	results := make([]collector.CollectionResult, 0, len(tasks))

	for _, task := range tasks {
		result := collector.CollectionResult{TaskID: task.ID}

		cis, err := RunCollector(ctx, task.Collector, task.TargetConfig)
		if err != nil {
			result.Error = err.Error()
			result.Status = "failed"
		} else {
			result.Status = "success"
			result.RawCI = cis
		}

		results = append(results, result)
	}

	return results, nil
}

// ============================================================
// 全局工厂
// ============================================================

var GlobalFactory = NewCollectorFactory()
