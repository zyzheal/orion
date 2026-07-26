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
//
// 扩展方式:
//   新增厂商适配器步骤:
//   1. 创建 internal/adapter/<type>/<vendor>/<vendor>.go
//   2. 实现 collector.Collector 接口
//   3. 在 init() 中注册到 GlobalFactory
//   4. 在 config.yaml 中配置采集任务
package factory

import (
	"context"
	"log/slog"
	"sync"

	"orion-cmdb-svc-go/internal/collector"
	"orion-cmdb-svc-go/internal/model"
)

// ============================================================
// 工厂实现
// ============================================================

// CollectorFactory 采集器工厂
type CollectorFactory struct {
	mu      sync.RWMutex
	index   map[string]collector.Collector
	vendor  map[model.VendorType][]collector.Collector
	typ     map[string][]collector.Collector
	all     []collector.Collector
}

// NewCollectorFactory 创建采集器工厂
func NewCollectorFactory() *CollectorFactory {
	return &CollectorFactory{
		index:  make(map[string]collector.Collector),
		vendor: make(map[model.VendorType][]collector.Collector),
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

	slog.Info("collector registered", "name", name, "vendor", c.Vendor(), "type", c.Type())
}

// Get 按名称获取采集器
func (f *CollectorFactory) Get(name string) (collector.Collector, bool) {
	f.mu.RLock()
	defer f.mu.RUnlock()
	c, ok := f.index[name]
	return c, ok
}

// GetByVendor 按厂商获取所有采集器
func (f *CollectorFactory) GetByVendor(vendor model.VendorType) []collector.Collector {
	f.mu.RLock()
	defer f.mu.RUnlock()
	result := make([]collector.Collector, len(f.vendor[vendor]))
	copy(result, f.vendor[vendor])
	return result
}

// GetByType 按类型获取所有采集器
func (f *CollectorFactory) GetByType(t string) []collector.Collector {
	f.mu.RLock()
	defer f.mu.RUnlock()
	result := make([]collector.Collector, len(f.typ[t]))
	copy(result, f.typ[t])
	return result
}

// All 返回所有已注册的采集器
func (f *CollectorFactory) All() []collector.Collector {
	// 注意: GlobalFactory 是 collector 包的单例
	// 此方法提供与 collector.Factory 接口兼容
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

// RunCollector 执行采集任务
func RunCollector(ctx context.Context, name string, config map[string]any) ([]model.CIRaw, error) {
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
func RunCollectors(ctx context.Context, tasks []model.CollectionTask) ([]model.CollectionResult, error) {
	results := make([]model.CollectionResult, 0, len(tasks))

	for _, task := range tasks {
		result := model.CollectionResult{
			TaskID: task.ID,
		}

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

var (
	// GlobalFactory 全局采集器工厂
	GlobalFactory = NewCollectorFactory()

	// once 确保只初始化一次
	once sync.Once
)

func init() {
	once.Do(func() {
		// 注意: 此处不做任何注册
		// 厂商适配器在各自包的 init() 中调用 collector.GlobalFactory.Register()
	})
}
