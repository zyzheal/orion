package processor

import "sync"

// Metrics holds a point-in-time snapshot of processor counters.
type Metrics struct {
	// TasksStarted is the total number of Execute calls.
	TasksStarted int64
	// TasksCompleted is the number of successfully completed tasks.
	TasksCompleted int64
	// TasksFailed is the number of failed tasks.
	TasksFailed int64
	// Retries is the total number of retry attempts across all tasks.
	Retries int64
	// TransformsApplied is the number of transform operations applied.
	TransformsApplied int64
	// HandlersRegistered is the number of handlers in the registry.
	HandlersRegistered int64
	// RulesRegistered is the number of registered transform rules.
	RulesRegistered int64
}

// metrics is an internal counter collection protected by a mutex.
type metrics struct {
	mu                sync.Mutex
	tasksStarted      int64
	tasksCompleted    int64
	tasksFailed       int64
	retries           int64
	transformsApplied int64
}

func (m *metrics) snapshot() Metrics {
	m.mu.Lock()
	defer m.mu.Unlock()
	return Metrics{
		TasksStarted:      m.tasksStarted,
		TasksCompleted:    m.tasksCompleted,
		TasksFailed:       m.tasksFailed,
		Retries:           m.retries,
		TransformsApplied: m.transformsApplied,
	}
}

func (m *metrics) started() {
	m.mu.Lock()
	m.tasksStarted++
	m.mu.Unlock()
}

func (m *metrics) completed() {
	m.mu.Lock()
	m.tasksCompleted++
	m.mu.Unlock()
}

func (m *metrics) failed() {
	m.mu.Lock()
	m.tasksFailed++
	m.mu.Unlock()
}

func (m *metrics) retried() {
	m.mu.Lock()
	m.retries++
	m.mu.Unlock()
}

func (m *metrics) transformed() {
	m.mu.Lock()
	m.transformsApplied++
	m.mu.Unlock()
}
