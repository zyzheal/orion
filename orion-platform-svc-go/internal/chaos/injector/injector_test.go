package injector

import (
	"context"
	"testing"

	"k8s.io/client-go/kubernetes/fake"
)

func TestNewInjector_WithFakeClientset(t *testing.T) {
	fakeClient := fake.NewSimpleClientset()
	inj, err := NewInjector(Config{Clientset: fakeClient})
	if err != nil {
		t.Fatalf("NewInjector with fake clientset failed: %v", err)
	}
	if inj == nil {
		t.Fatal("expected non-nil injector")
	}
}

func TestNewInjector_DefaultConfig(t *testing.T) {
	fakeClient := fake.NewSimpleClientset()
	inj, err := NewInjector(Config{Clientset: fakeClient})
	if err != nil {
		t.Fatalf("NewInjector failed: %v", err)
	}
	if inj.cfg.DefaultTimeout != 5*60*1000000000 {
		t.Errorf("expected default timeout 5m, got %v", inj.cfg.DefaultTimeout)
	}
	if inj.cfg.DefaultNamespace != "default" {
		t.Errorf("expected default namespace 'default', got %q", inj.cfg.DefaultNamespace)
	}
}

func TestHealthCheck(t *testing.T) {
	fakeClient := fake.NewSimpleClientset()
	inj, err := NewInjector(Config{Clientset: fakeClient})
	if err != nil {
		t.Fatalf("NewInjector failed: %v", err)
	}

	ctx := context.Background()
	if err := inj.HealthCheck(ctx); err != nil {
		t.Fatalf("HealthCheck failed: %v", err)
	}
}

func TestParseTarget(t *testing.T) {
	tests := []struct {
		name         string
		target       string
		defaultNS    string
		wantNS       string
		wantResource string
		wantErr      bool
	}{
		{"simple", "myapp", "default", "default", "myapp", false},
		{"ns_resource", "prod/myapp", "default", "prod", "myapp", false},
		{"ns_kind_resource", "prod/deployment/myapp", "default", "prod", "myapp", false},
		{"too_many_segments", "a/b/c/d", "default", "", "", true},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			ns, resource, err := parseTarget(tt.target, tt.defaultNS)
			if (err != nil) != tt.wantErr {
				t.Errorf("parseTarget error = %v, wantErr %v", err, tt.wantErr)
				return
			}
			if ns != tt.wantNS {
				t.Errorf("namespace = %q, want %q", ns, tt.wantNS)
			}
			if resource != tt.wantResource {
				t.Errorf("resource = %q, want %q", resource, tt.wantResource)
			}
		})
	}
}

func TestParseDurationSeconds(t *testing.T) {
	tests := []struct {
		input    string
		expected int
	}{
		{"", 300},
		{"30s", 30},
		{"2m", 120},
		{"1h", 3600},
		{"90s", 90},
		{"invalid", 300},
	}
	for _, tt := range tests {
		t.Run(tt.input, func(t *testing.T) {
			result := parseDurationSeconds(tt.input)
			if result != tt.expected {
				t.Errorf("parseDurationSeconds(%q) = %d, want %d", tt.input, result, tt.expected)
			}
		})
	}
}

func TestBoolPtr(t *testing.T) {
	v := boolPtr(true)
	if v == nil || *v != true {
		t.Error("boolPtr(true) failed")
	}
	v = boolPtr(false)
	if v == nil || *v != false {
		t.Error("boolPtr(false) failed")
	}
}

func TestInt64Ptr(t *testing.T) {
	v := int64Ptr(42)
	if v == nil || *v != 42 {
		t.Error("int64Ptr(42) failed")
	}
}

func TestTruncateLabel(t *testing.T) {
	s := "short"
	if truncateLabel(s) != "short" {
		t.Error("truncateLabel short string failed")
	}
	long := ""
	for i := 0; i < 100; i++ {
		long += "a"
	}
	result := truncateLabel(long)
	if len(result) != 63 {
		t.Errorf("truncateLabel long string = %d chars, want 63", len(result))
	}
}

func TestInjector_RecoverPodKillNoop(t *testing.T) {
	fakeClient := fake.NewSimpleClientset()
	inj, err := NewInjector(Config{Clientset: fakeClient})
	if err != nil {
		t.Fatalf("NewInjector failed: %v", err)
	}

	ctx := context.Background()
	result, err := inj.Recover(ctx, FaultPodKill, "injection-1", "")
	if err != nil {
		t.Fatalf("Recover pod-kill failed: %v", err)
	}
	if !result.Success {
		t.Error("expected success for pod-kill recovery")
	}
	if result.Message != "pods managed by controllers, no recovery needed" {
		t.Errorf("unexpected message: %s", result.Message)
	}
}

func TestInjector_RecoverBadRollbackID(t *testing.T) {
	fakeClient := fake.NewSimpleClientset()
	inj, err := NewInjector(Config{Clientset: fakeClient})
	if err != nil {
		t.Fatalf("NewInjector failed: %v", err)
	}

	ctx := context.Background()
	_, err = inj.Recover(ctx, FaultServiceDown, "bad-id", "")
	if err == nil {
		t.Error("expected error for bad rollback ID")
	}
}

func TestInjector_InjectUnsupportedFault(t *testing.T) {
	fakeClient := fake.NewSimpleClientset()
	inj, err := NewInjector(Config{Clientset: fakeClient})
	if err != nil {
		t.Fatalf("NewInjector failed: %v", err)
	}

	ctx := context.Background()
	result, err := inj.Inject(ctx, "invalid-fault", "default/myapp", "")
	if err == nil {
		t.Error("expected error for unsupported fault type")
	}
	if result != nil && result.Success {
		t.Error("expected failed result for unsupported fault type")
	}
}

func TestInjector_InjectCpuSpike(t *testing.T) {
	fakeClient := fake.NewSimpleClientset()
	inj, err := NewInjector(Config{Clientset: fakeClient})
	if err != nil {
		t.Fatalf("NewInjector failed: %v", err)
	}

	ctx := context.Background()
	configJSON := `{"duration":"30s","intensity":1.0}`
	result, err := inj.Inject(ctx, FaultCpuSpike, "default/test-app", configJSON)
	if err != nil {
		t.Fatalf("Inject cpu-spike failed: %v", err)
	}
	if !result.Success {
		t.Error("expected success")
	}
	if result.FaultType != "cpu-spike" {
		t.Errorf("expected fault type cpu-spike, got %s", result.FaultType)
	}
	if result.RollbackID == "" {
		t.Error("expected non-empty rollback ID")
	}
}

func TestInjector_InjectNetworkLatency(t *testing.T) {
	fakeClient := fake.NewSimpleClientset()
	inj, err := NewInjector(Config{Clientset: fakeClient})
	if err != nil {
		t.Fatalf("NewInjector failed: %v", err)
	}

	ctx := context.Background()
	configJSON := `{"duration":"30s","intensity":200}`
	result, err := inj.Inject(ctx, FaultNetworkLatency, "default/test-app", configJSON)
	if err != nil {
		t.Fatalf("Inject network-latency failed: %v", err)
	}
	if !result.Success {
		t.Error("expected success")
	}
	if result.FaultType != "network-latency" {
		t.Errorf("expected fault type network-latency, got %s", result.FaultType)
	}
}

func TestInjector_InjectBadConfig(t *testing.T) {
	fakeClient := fake.NewSimpleClientset()
	inj, err := NewInjector(Config{Clientset: fakeClient})
	if err != nil {
		t.Fatalf("NewInjector failed: %v", err)
	}

	ctx := context.Background()
	_, err = inj.Inject(ctx, FaultCpuSpike, "default/test-app", "not-json")
	if err == nil {
		t.Error("expected error for invalid JSON config")
	}
}
