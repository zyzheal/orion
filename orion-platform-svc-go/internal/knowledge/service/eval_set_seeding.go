package service

import (
	"context"
	"fmt"
	"time"

	"orion/platform-svc-go/internal/knowledge/models"
)

type ScenarioSeed struct {
	Scenario string
	Tag      string
	Cases    []models.EvalSetCaseInput
}

var defaultScenarioSeeds = []ScenarioSeed{
	{
		Scenario: "TR-09",
		Tag:      "dev-agent",
		Cases: []models.EvalSetCaseInput{
			{Query: "帮我触发研发流程 Agent 实现登录接口", GoldAnswer: "trigger_pipeline", GoldSources: []string{"assistant", "ai-agent-run"}},
			{Query: "创建 agent run 执行代码评审任务", GoldAnswer: "agent run", GoldSources: []string{"assistant", "ai-agent-run"}},
			{Query: "触发流水线自动化构建", GoldAnswer: "trigger_pipeline", GoldSources: []string{"assistant", "pipeline"}},
			{Query: "帮我创建工单处理支付超时", GoldAnswer: "create_ticket", GoldSources: []string{"assistant", "ticketing"}},
		},
	},
	{
		Scenario: "TR-10",
		Tag:      "lowcode-ai",
		Cases: []models.EvalSetCaseInput{
			{Query: "创建一个审批流程，包含提交、审批、通知节点", GoldAnswer: "approval", GoldSources: []string{"lowcode", "ai-generate"}},
			{Query: "发布服务到生产环境的流程", GoldAnswer: "deployment", GoldSources: []string{"lowcode", "ai-generate"}},
			{Query: "数据同步 ETL 流程", GoldAnswer: "data_sync", GoldSources: []string{"lowcode", "ai-generate"}},
			{Query: "定时任务调度 cron 流程", GoldAnswer: "scheduled", GoldSources: []string{"lowcode", "ai-generate"}},
		},
	},
	{
		Scenario: "TR-11",
		Tag:      "ops-qa",
		Cases: []models.EvalSetCaseInput{
			{Query: "ops 服务器 CPU 使用率飙升建议什么命令排查", GoldAnswer: "suggest_command", GoldSources: []string{"assistant", "runbook"}},
			{Query: "运维 runbook 磁盘满排查", GoldAnswer: "suggest_command", GoldSources: []string{"assistant", "runbook"}},
			{Query: "查询操作手册网络延迟", GoldAnswer: "suggest_command", GoldSources: []string{"assistant", "runbook"}},
			{Query: "服务器内存泄漏建议什么命令", GoldAnswer: "suggest_command", GoldSources: []string{"assistant", "runbook"}},
		},
	},
}

func (s *Service) SeedEvalSetsForAllScenarios(ctx context.Context, tenantID string, userID string) ([]models.EvalSet, error) {
	var seeded []models.EvalSet

	// Load existing eval sets once (avoid N+1 query)
	existing, err := s.ListEvalSets(ctx, tenantID)
	if err != nil {
		return nil, err
	}
	existingNames := make(map[string]bool, len(existing))
	for _, es := range existing {
		existingNames[es.Name] = true
	}

	for _, seed := range defaultScenarioSeeds {
		// Skip if already exists (pre-existing or just created in this loop)
		if existingNames[seed.Scenario] {
			for _, es := range existing {
				if es.Name == seed.Scenario {
					seeded = append(seeded, es)
					break
				}
			}
			continue
		}

		set, err := s.CreateEvalSet(ctx, tenantID, models.CreateEvalSetRequest{
			Name:        seed.Scenario,
			Description: "P3 基线评测集：" + seed.Tag,
			Cases:       seed.Cases,
		}, userID)
		if err != nil {
			continue
		}
		seeded = append(seeded, *set)
		existingNames[seed.Scenario] = true
	}
	return seeded, nil
}

func (s *Service) SeedEvalSetForScenario(ctx context.Context, tenantID string, userID string, scenario string) (*models.EvalSet, error) {
	for _, seed := range defaultScenarioSeeds {
		if seed.Scenario != scenario {
			continue
		}
		existing, err := s.ListEvalSets(ctx, tenantID)
		if err != nil {
			return nil, err
		}
		for _, es := range existing {
			if es.Name == seed.Scenario {
				return &es, nil
			}
		}
		set, err := s.CreateEvalSet(ctx, tenantID, models.CreateEvalSetRequest{
			Name:        seed.Scenario,
			Description: "P3 基线评测集：" + seed.Tag,
			Cases:       seed.Cases,
		}, userID)
		return set, err
	}
	return nil, nil
}

// CIEvalResult captures the outcome of one eval set run in CI.
type CIEvalResult struct {
	Scenario    string  `json:"scenario"`
	SetID       string  `json:"set_id"`
	RunID       string  `json:"run_id"`
	Status      string  `json:"status"`
	Pass        int     `json:"pass"`
	Total       int     `json:"total"`
	PassRate    float64 `json:"pass_rate"`
	AvgScore    float64 `json:"avg_score"`
	DurationMs  int     `json:"duration_ms"`
}

// CIEvalSummary is the aggregated CI eval report.
type CIEvalSummary struct {
	TotalScenarios  int           `json:"total_scenarios"`
	Passed          int           `json:"passed"`
	Failed          int           `json:"failed"`
	Skipped         int           `json:"skipped"`
	OverallPassRate float64       `json:"overall_pass_rate"`
	Threshold       float64       `json:"threshold"`
	MeetsThreshold  bool          `json:"meets_threshold"`
	Results         []CIEvalResult `json:"results"`
	DurationMs      int           `json:"duration_ms"`
}

// CIEvalConfig configures the CI evaluation pipeline.
type CIEvalConfig struct {
	Model     string   `json:"model,omitempty"`
	TopK      int      `json:"top_k,omitempty"`
	Threshold float64  `json:"threshold,omitempty"`
	Scenarios []string `json:"scenarios,omitempty"`
}

// RunCIEvals seeds eval sets for all TR-09/10/11 scenarios, then runs eval
// against each. Returns a CIEvalSummary suitable for CI gate decisions.
func (s *Service) RunCIEvals(ctx context.Context, tenantID string, config CIEvalConfig) (*CIEvalSummary, error) {
	started := time.Now()

	if config.Model == "" {
		config.Model = "default"
	}
	if config.TopK <= 0 {
		config.TopK = 5
	}

	seeded, err := s.SeedEvalSetsForAllScenarios(ctx, tenantID, "ci")
	if err != nil {
		return nil, fmt.Errorf("failed to seed eval sets: %w", err)
	}

	var targets []ScenarioSeed
	if len(config.Scenarios) > 0 {
		scenarioSet := map[string]bool{}
		for _, sc := range config.Scenarios {
			scenarioSet[sc] = true
		}
		for _, seed := range defaultScenarioSeeds {
			if scenarioSet[seed.Scenario] {
				targets = append(targets, seed)
			}
		}
	} else {
		targets = defaultScenarioSeeds
	}

	var results []CIEvalResult
	passed, failed, skipped := 0, 0, 0
	totalPass, totalCases := 0, 0

	for _, seed := range targets {
		setID := ""
		for _, es := range seeded {
			if es.Name == seed.Scenario {
				setID = es.ID
				break
			}
		}
		if setID == "" {
			results = append(results, CIEvalResult{
				Scenario: seed.Scenario,
				Status:   "skipped",
			})
			skipped++
			continue
		}

		caseStart := time.Now()
		run, err := s.RunEval(ctx, tenantID, models.RunEvalRequest{
			SetID: setID,
			Model: config.Model,
			TopK:  config.TopK,
		}, "ci")
		if err != nil {
			results = append(results, CIEvalResult{
				Scenario:   seed.Scenario,
				SetID:      setID,
				Status:     "error",
				DurationMs: int(time.Since(caseStart).Milliseconds()),
			})
			failed++
			continue
		}

		passRate := safeRate(run.PassCount, run.TotalCount)
		res := CIEvalResult{
			Scenario:   seed.Scenario,
			SetID:      setID,
			RunID:      run.ID,
			Status:     run.Status,
			Pass:       run.PassCount,
			Total:      run.TotalCount,
			PassRate:   passRate,
			AvgScore:   run.AvgScore,
			DurationMs: int(time.Since(caseStart).Milliseconds()),
		}
		results = append(results, res)

		if run.TotalCount == 0 {
			skipped++
			continue
		}
		if passRate >= config.Threshold {
			passed++
		} else {
			failed++
		}
		totalPass += run.PassCount
		totalCases += run.TotalCount
	}

	overallRate := safeRate(totalPass, totalCases)
	meets := passed == len(targets)-skipped

	return &CIEvalSummary{
		TotalScenarios:  len(targets),
		Passed:          passed,
		Failed:          failed,
		Skipped:         skipped,
		OverallPassRate: overallRate,
		Threshold:       config.Threshold,
		MeetsThreshold:  meets,
		Results:         results,
		DurationMs:      int(time.Since(started).Milliseconds()),
	}, nil
}