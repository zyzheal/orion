package executor

import (
	"fmt"
	"sync"
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

// BatchExecutor handles batch command execution across multiple hosts
type BatchExecutor struct {
	db        *gorm.DB
	resultCh  chan TaskResult
	wg        sync.WaitGroup
}

// NewBatchExecutor creates a new BatchExecutor
func NewBatchExecutor(db *gorm.DB) *BatchExecutor {
	return &BatchExecutor{
		db:       db,
		resultCh: make(chan TaskResult, 100),
	}
}

// ExecuteBatch executes a command on multiple hosts in parallel
func (e *BatchExecutor) ExecuteBatch(input ExecuteBatchInput) (*Task, error) {
	// Set default timeout
	if input.Timeout <= 0 {
		input.Timeout = 300
	}

	// Create task
	task := &Task{
		ID:         uuid.New().String(),
		TenantID:   input.TenantID,
		UserID:     input.UserID,
		Name:       input.Name,
		Command:    input.Command,
		HostIDs:    fmt.Sprintf("%v", input.HostIDs),
		Status:     TaskStatusPending,
		TotalHosts: len(input.HostIDs),
		Progress:   0,
		CreatedAt:  time.Now(),
		UpdatedAt:  time.Now(),
	}

	// Save to database
	if err := e.db.Create(task).Error; err != nil {
		return nil, fmt.Errorf("failed to create task: %w", err)
	}

	// Start execution in background
	go e.executeTask(task, input)

	return task, nil
}

// GetTask retrieves a task by ID
func (e *BatchExecutor) GetTask(taskID string) (*Task, error) {
	var task Task
	if err := e.db.Where("id = ?", taskID).First(&task).Error; err != nil {
		return nil, fmt.Errorf("task not found: %w", err)
	}
	return &task, nil
}

// GetTaskResults retrieves all results for a task
func (e *BatchExecutor) GetTaskResults(taskID string) ([]TaskResult, error) {
	var results []TaskResult
	if err := e.db.Where("task_id = ?", taskID).Find(&results).Error; err != nil {
		return nil, fmt.Errorf("failed to get results: %w", err)
	}
	return results, nil
}

// executeTask runs the batch task
func (e *BatchExecutor) executeTask(task *Task, input ExecuteBatchInput) {
	// Update task status to running
	now := time.Now()
	task.Status = TaskStatusRunning
	task.StartedAt = &now
	e.db.Model(task).Updates(map[string]interface{}{
		"status":     TaskStatusRunning,
		"started_at": now,
	})

	// Execute on each host
	var wg sync.WaitGroup
	results := make([]TaskResult, 0)
	resultMu := sync.Mutex{}

	for _, hostID := range input.HostIDs {
		wg.Add(1)
		go func(hostID string) {
			defer wg.Done()
			result := e.executeOnHost(task, hostID)
			resultMu.Lock()
			results = append(results, result)
			resultMu.Unlock()
		}(hostID)
	}

	wg.Wait()

	// Update task with final status
	task.Progress = 100
	task.SuccessCount = 0
	task.FailedCount = 0
	for _, r := range results {
		if r.Status == TaskStatusCompleted {
			task.SuccessCount++
		} else {
			task.FailedCount++
		}
	}

	if task.FailedCount > 0 && task.SuccessCount == 0 {
		task.Status = TaskStatusFailed
	} else if task.SuccessCount == 0 {
		task.Status = TaskStatusFailed
	} else {
		task.Status = TaskStatusCompleted
	}

	completedAt := time.Now()
	task.CompletedAt = &completedAt
	e.db.Model(task).Updates(map[string]interface{}{
		"status":         task.Status,
		"progress":       100,
		"success_count":  task.SuccessCount,
		"failed_count":   task.FailedCount,
		"completed_at":   completedAt,
	})
}

// executeOnHost executes command on a single host
func (e *BatchExecutor) executeOnHost(task *Task, hostID string) TaskResult {
	startTime := time.Now()

	result := TaskResult{
		ID:         uuid.New().String(),
		TaskID:     task.ID,
		HostID:     hostID,
		Status:     TaskStatusRunning,
		ExecutedAt: startTime,
	}

	// In a real implementation, this would SSH to the host and execute
	// For now, simulate execution
	time.Sleep(100 * time.Millisecond)

	// Mock: Get host info from database
	var host struct {
		ID   string
		Name string
		IP   string
	}
	e.db.Table("hosts").Where("id = ?", hostID).First(&host)

	result.HostID = host.ID
	result.HostName = host.Name
	result.HostIP = host.IP

	// Simulate successful execution
	result.ExitCode = 0
	result.Output = "Command executed successfully"
	result.Status = TaskStatusCompleted

	duration := time.Since(startTime)
	result.DurationMs = duration.Milliseconds()

	// Save result to database
	e.db.Create(&result)

	return result
}