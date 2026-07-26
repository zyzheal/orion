package service

import (
	"testing"

	"go.uber.org/zap"
)

func newTestService() *AutoRecoveryService {
	logger, _ := zap.NewDevelopment()
	return &AutoRecoveryService{logger: logger}
}

func TestEvaluateCondition(t *testing.T) {
	svc := newTestService()

	tests := []struct {
		name      string
		condition string
		metrics   map[string]float64
		want      bool
	}{
		{"greater than true", "error_rate > 0.5", map[string]float64{"error_rate": 0.8}, true},
		{"greater than false", "error_rate > 0.5", map[string]float64{"error_rate": 0.3}, false},
		{"less than true", "latency < 200", map[string]float64{"latency": 150}, true},
		{"less than false", "latency < 200", map[string]float64{"latency": 250}, false},
		{"greater or equal true", "error_rate >= 0.5", map[string]float64{"error_rate": 0.5}, true},
		{"greater or equal false", "error_rate >= 0.5", map[string]float64{"error_rate": 0.4}, false},
		{"less or equal true", "latency <= 200", map[string]float64{"latency": 200}, true},
		{"less or equal false", "latency <= 200", map[string]float64{"latency": 201}, false},
		{"equal true", "status == 1", map[string]float64{"status": 1}, true},
		{"equal false", "status == 1", map[string]float64{"status": 2}, false},
		{"not equal true", "status != 1", map[string]float64{"status": 2}, true},
		{"not equal false", "status != 1", map[string]float64{"status": 1}, false},
		{"metric not found", "unknown > 1", map[string]float64{"error_rate": 0.5}, false},
		{"invalid condition", "nooperator", map[string]float64{}, false},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := svc.evaluateCondition("", tt.condition, tt.metrics)
			if got != tt.want {
				t.Errorf("evaluateCondition(%q) = %v, want %v", tt.condition, got, tt.want)
			}
		})
	}
}

func TestExecuteAction(t *testing.T) {
	svc := newTestService()

	tests := []struct {
		name   string
		action string
		target string
		want   string
		err    bool
	}{
		{"restart", "restart", "nginx", "Service restarted", false},
		{"scale", "scale", "api-server", "Service scaled up", false},
		{"failover", "failover", "db-primary", "Failover to backup", false},
		{"degrade", "degrade", "search-service", "Service degraded", false},
		{"unknown", "unknown_action", "svc", "", true},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result, err := svc.executeAction(tt.action, tt.target)
			if (err != nil) != tt.err {
				t.Errorf("executeAction() error = %v, wantErr %v", err, tt.err)
				return
			}
			if result != tt.want {
				t.Errorf("executeAction() = %q, want %q", result, tt.want)
			}
		})
	}
}
