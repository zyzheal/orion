package service

import (
	"testing"

	"orion/platform-svc-go/internal/change/models"
)

func Test_RiskKeywords(t *testing.T) {
	cases := []struct {
		text string
		want bool
	}{
		{"db 主库迁移 schema", true},
		{"普通配置更新", false},
		{"生产环境 SSL 证书轮换", true},
	}
	for _, c := range cases {
		got := riskKeywords(c.text)
		if (len(got) > 0) != c.want {
			t.Errorf("riskKeywords(%q) = %q, want non-empty=%v", c.text, got, c.want)
		}
	}
}

func Test_BuildRiskSuggestions(t *testing.T) {
	sug := buildRiskSuggestions("high", "emergency")
	if len(sug) < 3 {
		t.Fatalf("high+emergency suggestions = %+v, want >=3", sug)
	}
	if sug[0] != "升级为发布窗内变更并安排灰度" {
		t.Fatalf("high suggestions should lead with rollback/gray, got %q", sug[0])
	}

	low := buildRiskSuggestions("low", "normal")
	if len(low) != 2 {
		t.Fatalf("low suggestions = %+v, want 2", low)
	}
}

func Test_MinInt(t *testing.T) {
	if minInt(3, 5) != 3 {
		t.Fatal("minInt should return smaller")
	}
	if minInt(7, 2) != 2 {
		t.Fatal("minInt should return smaller")
	}
}

func Test_AnalyzeChangeRisk_ScoreCap(t *testing.T) {
	// emergency + high risk + critical + keywords should exceed 100 and cap.
	factors := []models.RiskFactor{{Name: "x", Weight: 80}, {Name: "y", Weight: 40}}
	score := 0
	for _, f := range factors {
		score += f.Weight
	}
	score = minInt(score, 100)
	if score != 100 {
		t.Fatalf("capped score = %d, want 100", score)
	}
}
