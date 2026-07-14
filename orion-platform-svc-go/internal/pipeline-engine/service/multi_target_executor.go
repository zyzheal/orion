package service

import (
	"context"
	"sync"
	"time"
)

const batchTargetCount = 3

type TargetResult struct {
	Target     string  `json:"target"`
	BatchIndex int     `json:"batch_index"`
	Success    bool    `json:"success"`
	Error      *string `json:"error,omitempty"`
	DurationMs int64   `json:"duration_ms"`
}

type BatchResult struct {
	BatchIndex    int            `json:"batch_index"`
	Targets       []string       `json:"targets"`
	TargetResults []TargetResult `json:"target_results"`
	BatchSuccess  bool           `json:"batch_success"`
}

type MultiTargetResult struct {
	StageName      string       `json:"stage_name"`
	ExecutionMode  string       `json:"execution_mode"`
	TotalTargets   int          `json:"total_targets"`
	TotalBatches   int          `json:"total_batches"`
	BatchResults   []BatchResult `json:"batch_results"`
	OverallSuccess bool         `json:"overall_success"`
}

type MultiTargetExecutor struct {
	stageExecutor *StageExecutor
}

func NewMultiTargetExecutor(se *StageExecutor) *MultiTargetExecutor {
	return &MultiTargetExecutor{stageExecutor: se}
}

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
			BatchIndex: bi, Targets: batch, TargetResults: targetResults, BatchSuccess: batchSuccess,
		})
		mu.Unlock()
	}

	return &MultiTargetResult{
		StageName: stageName, ExecutionMode: mode,
		TotalTargets: len(targets), TotalBatches: len(batchResults),
		BatchResults: batchResults, OverallSuccess: overallSuccess,
	}
}

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

func (mte *MultiTargetExecutor) executeTarget(ctx context.Context, stageName, stageID string, target string, batchIndex int) TargetResult {
	start := time.Now()
	select {
	case <-ctx.Done():
		e := ctx.Err().Error()
		return TargetResult{Target: target, BatchIndex: batchIndex, Success: false, Error: &e, DurationMs: time.Since(start).Milliseconds()}
	default:
	}
	// v1 placeholder: simulate target execution
	// Production dispatches to StageOrchestrator.ExecuteStage with targeted stage
	time.Sleep(10 * time.Millisecond)
	return TargetResult{Target: target, BatchIndex: batchIndex, Success: true, DurationMs: time.Since(start).Milliseconds()}
}
