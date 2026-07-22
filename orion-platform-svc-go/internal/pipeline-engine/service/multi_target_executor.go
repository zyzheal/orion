package service

import (
	"context"
	"fmt"
	"sync"
	"time"

	"orion/platform-svc-go/internal/pipeline-engine/models"
	"orion/platform-svc-go/internal/pipeline-engine/repository"
)

const batchTargetCount = 3

// TargetResult holds the outcome of executing a stage against a single target.
type TargetResult struct {
	Target     string  `json:"target"`
	BatchIndex int     `json:"batch_index"`
	Success    bool    `json:"success"`
	Error      *string `json:"error,omitempty"`
	DurationMs int64   `json:"duration_ms"`
}

// BatchResult aggregates the results of executing a stage across a batch of targets.
type BatchResult struct {
	BatchIndex    int            `json:"batch_index"`
	Targets       []string       `json:"targets"`
	TargetResults []TargetResult `json:"target_results"`
	BatchSuccess  bool           `json:"batch_success"`
}

// MultiTargetResult aggregates the results of executing a stage across multiple targets.
type MultiTargetResult struct {
	StageName      string        `json:"stage_name"`
	ExecutionMode  string        `json:"execution_mode"`
	TotalTargets   int           `json:"total_targets"`
	TotalBatches   int           `json:"total_batches"`
	BatchResults   []BatchResult `json:"batch_results"`
	OverallSuccess bool          `json:"overall_success"`
}

// MultiTargetExecutor dispatches stage execution across multiple targets,
// respecting batching and execution modes (oneshot vs grayScale).
type MultiTargetExecutor struct {
	stageExecutor *StageExecutor
	repo          *repository.Repository
}

// NewMultiTargetExecutor creates a new MultiTargetExecutor.
func NewMultiTargetExecutor(se *StageExecutor, repo *repository.Repository) *MultiTargetExecutor {
	return &MultiTargetExecutor{
		stageExecutor: se,
		repo:          repo,
	}
}

// Execute runs a stage across multiple targets, batched and mode-aware.
//
// Targets are grouped into batches of batchTargetCount.
// - "oneshot" mode: runs all batches, continues even if one fails.
// - "grayScale" mode: stops on the first failed batch.
//
// Within each batch, targets are executed concurrently via goroutines.
func (mte *MultiTargetExecutor) Execute(ctx context.Context, stageName, stageID string, targets []string, mode string) *MultiTargetResult {
	if len(targets) == 0 {
		return &MultiTargetResult{StageName: stageName, ExecutionMode: mode, OverallSuccess: false}
	}
	if mode == "" {
		mode = "oneshot"
	}

	var batches [][]string
	for i := 0; i < len(targets); i += batchTargetCount {
		end := i + batchTargetCount
		if end > len(targets) {
			end = len(targets)
		}
		batches = append(batches, targets[i:end])
	}

	batchResults := make([]BatchResult, 0, len(batches))
	overallSuccess := true
	var mu sync.Mutex

	for bi, batch := range batches {
		targetResults := mte.executeBatch(ctx, stageName, stageID, batch, bi)
		batchSuccess := true
		for _, tr := range targetResults {
			if !tr.Success {
				batchSuccess = false
				break
			}
		}
		if !batchSuccess {
			overallSuccess = false
			if mode == "grayScale" {
				break
			}
		}
		mu.Lock()
		batchResults = append(batchResults, BatchResult{
			BatchIndex:    bi,
			Targets:       batch,
			TargetResults: targetResults,
			BatchSuccess:  batchSuccess,
		})
		mu.Unlock()
	}

	return &MultiTargetResult{
		StageName:      stageName,
		ExecutionMode:  mode,
		TotalTargets:   len(targets),
		TotalBatches:   len(batchResults),
		BatchResults:   batchResults,
		OverallSuccess: overallSuccess,
	}
}

// executeBatch runs a stage against a batch of targets concurrently.
func (mte *MultiTargetExecutor) executeBatch(ctx context.Context, stageName, stageID string, batch []string, batchIndex int) []TargetResult {
	var wg sync.WaitGroup
	targetResults := make([]TargetResult, len(batch))
	for i, target := range batch {
		wg.Add(1)
		go func(idx int, t string) {
			defer wg.Done()
			targetResults[idx] = mte.executeTarget(ctx, stageName, stageID, t, batchIndex)
		}(i, target)
	}
	wg.Wait()
	return targetResults
}

// executeTarget runs a stage against a single target.
//
// It dispatches to the StageOrchestrator to execute the stage with the target
// injected as a variable (TARGET_NAME), then records the result.
func (mte *MultiTargetExecutor) executeTarget(ctx context.Context, stageName, stageID string, target string, batchIndex int) TargetResult {
	start := time.Now()

	// Check for context cancellation before execution
	select {
	case <-ctx.Done():
		e := ctx.Err().Error()
		return TargetResult{
			Target:     target,
			BatchIndex: batchIndex,
			Success:    false,
			Error:      &e,
			DurationMs: time.Since(start).Milliseconds(),
		}
	default:
	}

	// Build target-aware execution context
	variables := map[string]string{
		"TARGET_NAME":  target,
		"TARGET_INDEX": fmt.Sprintf("%d", batchIndex),
	}

	// Load the stage to verify it exists
	_, err := mte.repo.GetStage(ctx, "", stageID)
	if err != nil {
		errStr := fmt.Sprintf("stage not found: %v", err)
		return TargetResult{
			Target:     target,
			BatchIndex: batchIndex,
			Success:    false,
			Error:      &errStr,
			DurationMs: time.Since(start).Milliseconds(),
		}
	}

	// Load tasks for this stage
	tasks, err := mte.repo.GetTasksByStage(ctx, "", stageID)
	if err != nil {
		errStr := fmt.Sprintf("failed to load tasks for stage %s: %v", stageID, err)
		return TargetResult{
			Target:     target,
			BatchIndex: batchIndex,
			Success:    false,
			Error:      &errStr,
			DurationMs: time.Since(start).Milliseconds(),
		}
	}

	// Execute each task in the stage with target variables
	taskFailed := false
	for _, task := range tasks {
		// Skip tasks that have already been marked as completed/failed
		if task.Status != models.TaskStatusPending {
			continue
		}
		_, taskResult := mte.stageExecutor.ExecuteTask(ctx, "", stageID, &task, variables)
		if !taskResult.Success {
			taskFailed = true
			break
		}
	}

	duringMs := time.Since(start).Milliseconds()
	if taskFailed {
		errStr := fmt.Sprintf("stage %s failed for target %s", stageName, target)
		return TargetResult{
			Target:     target,
			BatchIndex: batchIndex,
			Success:    false,
			Error:      &errStr,
			DurationMs: duringMs,
		}
	}

	// All tasks succeeded
	return TargetResult{
		Target:     target,
		BatchIndex: batchIndex,
		Success:    true,
		DurationMs: duringMs,
	}
}
