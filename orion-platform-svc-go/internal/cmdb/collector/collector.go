// ============================================================
// Collector Factory — 采集器注册中心
// ============================================================
//
// 设计参考:
//   - NeatLogic CMDB 采集适配器 (120+ 厂商, Perl 脚本驱动)
//   - Go 社区 SPI 惯例 (io/fs, database/sql/driver)
//
// 架构决策:
//   1. Collector interface 定义在 types.go
//   2. Factory 负责注册中心管理
//   3. 采集器通过 init() 自动注册到全局 Factory
//   4. 厂商适配器放在 adapter/ 子包，不污染核心包

package collector

import "sync"

// Factory 管理所有已注册的 Collector
type Factory struct {
	mu      sync.RWMutex
	index   map[string]Collector     // name -> Collector
	vendor  map[VendorType][]Collector // vendor -> [Collector...]
	typ     map[string][]Collector   // type -> [Collector...]
	all     []Collector
}

// NewFactory 创建新的采集器工厂
func NewFactory() *Factory {
	return &Factory{
		index:  make(map[string]Collector),
		vendor: make(map[VendorType][]Collector),
		typ:    make(map[string][]Collector),
	}
}

// Register 注册采集器
func (f *Factory) Register(c Collector) {
	name := c.Name()
	f.mu.Lock()
	defer f.mu.Unlock()

	if _, exists := f.index[name]; exists {
		_ = name // duplicate registration skipped
	}

	f.index[name] = c
	f.vendor[c.Vendor()] = append(f.vendor[c.Vendor()], c)
	f.typ[c.Type()] = append(f.typ[c.Type()], c)
	// 避免重复添加
	for _, existing := range f.all {
		if existing.Name() == name {
			return
		}
	}
	f.all = append(f.all, c)
}

// Get 按名称获取采集器
func (f *Factory) Get(name string) (Collector, bool) {
	f.mu.RLock()
	defer f.mu.RUnlock()
	c, ok := f.index[name]
	return c, ok
}

// GetByVendor 按厂商获取所有采集器
func (f *Factory) GetByVendor(vendor VendorType) []Collector {
	f.mu.RLock()
	defer f.mu.RUnlock()
	vendors := f.vendor[vendor]
	result := make([]Collector, len(vendors))
	copy(result, vendors)
	return result
}

// GetByType 按类型获取所有采集器
func (f *Factory) GetByType(t string) []Collector {
	f.mu.RLock()
	defer f.mu.RUnlock()
	types := f.typ[t]
	result := make([]Collector, len(types))
	copy(result, types)
	return result
}

// All 返回所有已注册的采集器
func (f *Factory) All() []Collector {
	f.mu.RLock()
	defer f.mu.RUnlock()
	result := make([]Collector, len(f.all))
	copy(result, f.all)
	return result
}

// List 返回采集器名称列表
func (f *Factory) List() []string {
	f.mu.RLock()
	defer f.mu.RUnlock()
	result := make([]string, 0, len(f.index))
	for name := range f.index {
		result = append(result, name)
	}
	return result
}

// Count 返回已注册的采集器数量
func (f *Factory) Count() int {
	f.mu.RLock()
	defer f.mu.RUnlock()
	return len(f.index)
}

// ============================================================
// 全局工厂实例
// ============================================================

var GlobalFactory = NewFactory()
