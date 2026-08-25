// Plan 18 — Agent 评估框架 (Agent Evaluation Framework)
// 本地: 无 internal/eval/ 或 internal/assessment/ 模块 — 完全新增
// 缺口: 无 Agent 质量评估、无 LLM Judge、无评分汇总
package eval

import (
	"context"
	"errors"
	"fmt"
	"math"
	"sync"
	"time"
)

type EvalDimension string

const (
	DimAccuracy     EvalDimension = "accuracy"
	DimCompleteness EvalDimension = "completeness"
	DimRelevance    EvalDimension = "relevance"
	DimClarity      EvalDimension = "clarity"
	DimLatency      EvalDimension = "latency"
	DimSafety       EvalDimension = "safety"
)

type EvalScore struct {
	Dimension EvalDimension `json:"dimension"`
	Score     float64       `json:"score"`  // 0-100
	Rationale  string        `json:"rationale"`
}

type EvalTestCase struct {
	ID            string                 `json:"id"`
	Input         string                 `json:"input"`
	Expected      string                 `json:"expected"`
	Context       map[string]string      `json:"context,omitempty"`
	Difficulty    string                 `json:"difficulty"` // easy/medium/hard
	Tags          []string               `json:"tags,omitempty"`
}

type EvalResult struct {
	TestCaseID  string      `json:"testCaseId"`
	Output      string      `json:"output"`
	Scores      []EvalScore `json:"scores"`
	OverallScore float64   `json:"overallScore"`
	Duration     int64      `json:"durationMs"`
	Passed      bool        `json:"passed"`
}

type JudgeConfig struct {
	Model        string  `json:"model"`
	Threshold    float64 `json:"threshold"`  // minimum passing score
	Dimensions   []EvalDimension `json:"dimensions"`
	StrictMode   bool    `json:"strictMode"`
}

type LLMJudge interface {
	Judge(ctx context.Context, input, expected, output string, dims []EvalDimension) ([]EvalScore, error)
}

type MockJudge struct{}

func (m *MockJudge) Judge(ctx context.Context, input, expected, output string, dims []EvalDimension) ([]EvalScore, error) {
	scores := make([]EvalScore, len(dims))
	for i, d := range dims {
		base := 75.0
		if len(output) > 0 && len(expected) > 0 {
			if output == expected {
				base = 100.0
			}
		}
		scores[i] = EvalScore{Dimension: d, Score: base, Rationale: "mock judge"}
	}
	return scores, nil
}

type EvalRunner struct {
	judge    LLMJudge
	config   JudgeConfig
	results  []EvalResult
	mu       sync.Mutex
}

func NewEvalRunner(judge LLMJudge, config JudgeConfig) *EvalRunner {
	return &EvalRunner{
		judge:  judge,
		config: config,
		results: make([]EvalResult, 0),
	}
}

func (r *EvalRunner) RunSingle(ctx context.Context, tc EvalTestCase, output string) (*EvalResult, error) {
	start := time.Now()
	scores, err := r.judge.Judge(ctx, tc.Input, tc.Expected, output, r.config.Dimensions)
	if err != nil {
		return nil, fmt.Errorf("judge failed: %w", err)
	}
	overall := computeOverall(scores)
	return &EvalResult{
		TestCaseID:   tc.ID,
		Output:       output,
		Scores:       scores,
		OverallScore: overall,
		Duration:     time.Since(start).Milliseconds(),
		Passed:       overall >= r.config.Threshold,
	}, nil
}

func (r *EvalRunner) RunSuite(ctx context.Context, cases []EvalTestCase, agentFn func(context.Context, string) (string, error)) ([]EvalResult, error) {
	results := make([]EvalResult, len(cases))
	var wg sync.WaitGroup
	errs := make([]error, len(cases))

	for i, tc := range cases {
		wg.Add(1)
		go func(idx int, c EvalTestCase) {
			defer wg.Done()
			output, err := agentFn(ctx, c.Input)
			if err != nil {
				errs[idx] = err
				return
			}
			result, err := r.RunSingle(ctx, c, output)
			if err != nil {
				errs[idx] = err
				return
			}
			results[idx] = *result
		}(i, tc)
	}
	wg.Wait()

	for _, e := range errs {
		if e != nil {
			return nil, e
		}
	}

	r.mu.Lock()
	r.results = append(r.results, results...)
	r.mu.Unlock()
	return results, nil
}

type SuiteSummary struct {
	TotalCases  int                `json:"totalCases"`
	Passed      int                `json:"passed"`
	Failed      int               `json:"failed"`
	PassRate    float64           `json:"passRate"`
	AvgScore    float64           `json:"avgScore"`
	ByDimension map[EvalDimension]float64 `json:"byDimension"`
	ByDifficulty map[string]float64 `json:"byDifficulty"`
	DurationMs   int64             `json:"durationMs"`
}

func (r *EvalRunner) Summarize() SuiteSummary {
	r.mu.Lock()
	defer r.mu.Unlock()

	if len(r.results) == 0 {
		return SuiteSummary{ByDimension: make(map[EvalDimension]float64), ByDifficulty: make(map[string]float64)}
	}

	passed := 0
	sumScore := 0.0
	dimSum := make(map[EvalDimension]float64)
	dimCount := make(map[EvalDimension]int)
	diffSum := make(map[string]float64)
	diffCount := make(map[string]int)

	for _, res := range r.results {
		if res.Passed {
			passed++
		}
		sumScore += res.OverallScore
		for _, s := range res.Scores {
			dimSum[s.Dimension] += s.Score
			dimCount[s.Dimension]++
		}
	}

	byDim := make(map[EvalDimension]float64)
	for d, sum := range dimSum {
		byDim[d] = sum / float64(dimCount[d])
	}

	return SuiteSummary{
		TotalCases:  len(r.results),
		Passed:      passed,
		Failed:      len(r.results) - passed,
		PassRate:    float64(passed) / float64(len(r.results)),
		AvgScore:    sumScore / float64(len(r.results)),
		ByDimension: byDim,
		ByDifficulty: diffSum,
	}
}

func computeOverall(scores []EvalScore) float64 {
	if len(scores) == 0 {
		return 0
	}
	sum := 0.0
	for _, s := range scores {
		sum += s.Score
	}
	return math.Round(sum / float64(len(scores)))
}

var ErrNoResults = errors.New("no evaluation results to summarize")