package scriptversion

import (
    "sync"
    "time"
)

type ScriptVersionMetrics struct {
    mu          sync.RWMutex
    counters    map[string]int64
    gauges      map[string]float64
    histograms  map[string][]float64
    lastUpdated time.Time
}

func NewScriptVersionMetrics() *ScriptVersionMetrics {
    return &ScriptVersionMetrics{
        counters:   make(map[string]int64),
        gauges:     make(map[string]float64),
        histograms: make(map[string][]float64),
    }
}

func (m *ScriptVersionMetrics) Incr(counter string) {
    m.mu.Lock()
    m.counters[counter]++
    m.lastUpdated = time.Now()
    m.mu.Unlock()
}

func (m *ScriptVersionMetrics) Decr(counter string) {
    m.mu.Lock()
    m.counters[counter]--
    m.lastUpdated = time.Now()
    m.mu.Unlock()
}

func (m *ScriptVersionMetrics) SetGauge(name string, value float64) {
    m.mu.Lock()
    m.gauges[name] = value
    m.lastUpdated = time.Now()
    m.mu.Unlock()
}

func (m *ScriptVersionMetrics) Observe(name string, value float64) {
    m.mu.Lock()
    m.histograms[name] = append(m.histograms[name], value)
    if len(m.histograms[name]) > 1000 {
        m.histograms[name] = m.histograms[name][len(m.histograms[name])-1000:]
    }
    m.lastUpdated = time.Now()
    m.mu.Unlock()
}

func (m *ScriptVersionMetrics) GetCounter(name string) int64 {
    m.mu.RLock()
    defer m.mu.RUnlock()
    return m.counters[name]
}

func (m *ScriptVersionMetrics) GetGauge(name string) float64 {
    m.mu.RLock()
    defer m.mu.RUnlock()
    return m.gauges[name]
}

func (m *ScriptVersionMetrics) GetStats() map[string]interface{} {
    m.mu.RLock()
    defer m.mu.RUnlock()
    stats := make(map[string]interface{}, 3)
    stats["counters"] = m.counters
    stats["gauges"] = m.gauges
    stats["last_updated"] = m.lastUpdated
    return stats
}

func (m *ScriptVersionMetrics) Reset() {
    m.mu.Lock()
    defer m.mu.Unlock()
    m.counters = make(map[string]int64)
    m.gauges = make(map[string]float64)
    m.histograms = make(map[string][]float64)
    m.lastUpdated = time.Time{}
}
