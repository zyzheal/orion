package service

import (
	"strings"
	"testing"

	"orion/platform-svc-go/internal/knowledge/models"
)

// ============================================================
// P3: 评测集基线覆盖 TR-09/10/11
// ============================================================

func TestDefaultScenarioSeeds_CoversAllThreeTRs(t *testing.T) {
	scenarios := map[string]bool{}
	for _, s := range defaultScenarioSeeds {
		scenarios[s.Scenario] = true
	}
	for _, want := range []string{"TR-09", "TR-10", "TR-11"} {
		if !scenarios[want] {
			t.Errorf("defaultScenarioSeeds missing %s", want)
		}
	}
}

func TestDefaultScenarioSeeds_CaseContent(t *testing.T) {
	for _, seed := range defaultScenarioSeeds {
		if len(seed.Cases) < 2 {
			t.Errorf("%s has only %d cases, want >= 2", seed.Scenario, len(seed.Cases))
		}
		if seed.Tag == "" {
			t.Errorf("%s missing tag", seed.Scenario)
		}
		for i, c := range seed.Cases {
			if c.Query == "" {
				t.Errorf("%s case[%d] missing Query", seed.Scenario, i)
			}
			if c.GoldAnswer == "" {
				t.Errorf("%s case[%d] missing GoldAnswer", seed.Scenario, i)
			}
		}
	}
}

func TestDefaultScenarioSeeds_TR09_ContainsPipelineKeywords(t *testing.T) {
	for _, seed := range defaultScenarioSeeds {
		if seed.Scenario != "TR-09" {
			continue
		}
		combined := strings.Join(collectQueries(seed.Cases), " ")
		if !strings.Contains(combined, "研发流程") && !strings.Contains(combined, "agent run") && !strings.Contains(combined, "pipeline") {
			t.Error("TR-09 cases should contain pipeline/agent-run keywords")
		}
		if len(seed.Cases) != 4 {
			t.Errorf("TR-09 case count = %d, want 4", len(seed.Cases))
		}
	}
}

func TestDefaultScenarioSeeds_TR10_ContainsFlowGenerationKeywords(t *testing.T) {
	for _, seed := range defaultScenarioSeeds {
		if seed.Scenario != "TR-10" {
			continue
		}
		combined := strings.Join(collectQueries(seed.Cases), " ")
		if !strings.Contains(combined, "审批") && !strings.Contains(combined, "发布") && !strings.Contains(combined, "流程") {
			t.Error("TR-10 cases should contain flow generation keywords")
		}
	}
}

func TestDefaultScenarioSeeds_TR11_ContainsOpsKeywords(t *testing.T) {
	for _, seed := range defaultScenarioSeeds {
		if seed.Scenario != "TR-11" {
			continue
		}
		combined := strings.Join(collectQueries(seed.Cases), " ")
		if !strings.Contains(combined, "ops") && !strings.Contains(combined, "CPU") {
			t.Error("TR-11 cases should contain ops keywords")
		}
		if !strings.Contains(combined, "runbook") || !strings.Contains(combined, "建议什么") {
			t.Error("TR-11 cases should contain runbook/suggest keywords")
		}
	}
}

func TestDefaultScenarioSeeds_AllGoldSourcesAreAssistantOrRunbook(t *testing.T) {
	for _, seed := range defaultScenarioSeeds {
		for i, c := range seed.Cases {
			if len(c.GoldSources) == 0 {
				t.Errorf("%s case[%d] missing GoldSources", seed.Scenario, i)
			}
		}
	}
}

func collectQueries(cases []models.EvalSetCaseInput) []string {
	out := make([]string, 0, len(cases))
	for _, c := range cases {
		out = append(out, c.Query)
	}
	return out
}
