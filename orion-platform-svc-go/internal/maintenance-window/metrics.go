package maintenancewindow

import (
    "sync"
    "time"
)

type MaintenanceWindowMetrics struct {
    mu          sync.RWMutex
    counters    map[string]int64
    gauges      map[string]float64
    histograms  map[string][]float64
    lastUpdated time.Time
}

func NewMaintenanceWindowMetrics() *MaintenanceWindowMetrics {
    return &MaintenanceWindowMetrics{
        counters:   make(map[string]int64),
        gauges:     make(map[string]float64),
        histograms: make(map[string][]float64),
    }
}

func (m *MaintenanceWindowMetrics) Incr(counter string) {
    m.mu.Lock()
    m.counters[counter]++
    m.lastUpdated = time.Now()
    m.mu.Unlock()
}

func (m *MaintenanceWindowMetrics) Decr(counter string) {
    m.mu.Lock()
    m.counters[counter]--
    m.lastUpdated = time.Now()
    m.mu.Unlock()
}

func (m *MaintenanceWindowMetrics) SetGauge(name string, value float64) {
    m.mu.Lock()
    m.gauges[name] = value
    m.lastUpdated = time.Now()
    m.mu.Unlock()
}

func (m *MaintenanceWindowMetrics) Observe(name string, value float64) {
    m.mu.Lock()
    m.histograms[name] = append(m.histograms[name], value)
    if len(m.histograms[name]) > 1000 {
        m.histograms[name] = m.histograms[name][len(m.histograms[name])-1000:]
    }
    m.lastUpdated = time.Now()
    m.mu.Unlock()
}

func (m *MaintenanceWindowMetrics) GetCounter(name string) int64 {
    m.mu.RLock()
    defer m.mu.RUnlock()
    return m.counters[name]
}

func (m *MaintenanceWindowMetrics) GetGauge(name string) float64 {
    m.mu.RLock()
    defer m.mu.RUnlock()
    return m.gauges[name]
}

func (m *MaintenanceWindowMetrics) GetStats() map[string]interface{} {
    m.mu.RLock()
    defer m.mu.RUnlock()
    stats := make(map[string]interface{}, 3)
    stats["counters"] = m.counters
    stats["gauges"] = m.gauges
    stats["last_updated"] = m.lastUpdated
    return stats
}

func (m *MaintenanceWindowMetrics) Reset() {
    m.mu.Lock()
    defer m.mu.Unlock()
    m.counters = make(map[string]int64)
    m.gauges = make(map[string]float64)
    m.histograms = make(map[string][]float64)
    m.lastUpdated = time.Time{}
}
