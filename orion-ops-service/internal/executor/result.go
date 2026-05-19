package executor

import (
	"fmt"
	"sync"

	"gorm.io/gorm"
)

// ResultCollector collects task results in real-time
type ResultCollector struct {
	db       *gorm.DB
	results  map[string][]TaskResult
	mu       sync.RWMutex
	channels map[string]chan TaskResult
}

// NewResultCollector creates a new ResultCollector
func NewResultCollector(db *gorm.DB) *ResultCollector {
	return &ResultCollector{
		db:       db,
		results:  make(map[string][]TaskResult),
		channels: make(map[string]chan TaskResult),
	}
}

// Subscribe creates a channel for receiving results for a task
func (rc *ResultCollector) Subscribe(taskID string) <-chan TaskResult {
	rc.mu.Lock()
	defer rc.mu.Unlock()

	ch := make(chan TaskResult, 10)
	rc.channels[taskID] = ch
	return ch
}

// Unsubscribe removes the subscription for a task
func (rc *ResultCollector) Unsubscribe(taskID string) {
	rc.mu.Lock()
	defer rc.mu.Unlock()

	if ch, ok := rc.channels[taskID]; ok {
		close(ch)
		delete(rc.channels, taskID)
	}

	delete(rc.results, taskID)
}

// Collect adds a result to the collector
func (rc *ResultCollector) Collect(result TaskResult) {
	rc.mu.Lock()
	defer rc.mu.Unlock()

	// Store result
	rc.results[result.TaskID] = append(rc.results[result.TaskID], result)

	// Send to channel if subscribed
	if ch, ok := rc.channels[result.TaskID]; ok {
		select {
		case ch <- result:
		default:
			// Channel full, skip
		}
	}
}

// GetResults returns all collected results for a task
func (rc *ResultCollector) GetResults(taskID string) ([]TaskResult, error) {
	rc.mu.RLock()
	defer rc.mu.RUnlock()

	results, ok := rc.results[taskID]
	if !ok {
		return nil, fmt.Errorf("no results for task %s", taskID)
	}

	return results, nil
}

// LoadFromDB loads results from database
func (rc *ResultCollector) LoadFromDB(taskID string) ([]TaskResult, error) {
	var results []TaskResult
	if err := rc.db.Where("task_id = ?", taskID).Find(&results).Error; err != nil {
		return nil, err
	}

	rc.mu.Lock()
	rc.results[taskID] = results
	rc.mu.Unlock()

	return results, nil
}