package service

import (
	"context"
	"errors"
	"math"
	"testing"
)

// fakeCollector lets tests control returned measurements and errors.
type fakeCollector struct {
	id   string
	ms   []Measurement
	err  error
}

func (f *fakeCollector) ID() string { return f.id }
func (f *fakeCollector) Collect(_ context.Context, _ string, _ map[string]interface{}) ([]Measurement, error) {
	return f.ms, f.err
}

func TestThresholdEvaluator_NoRules_Pass(t *testing.T) {
	e := NewDefaultThresholdEvaluator()
	ms := []Measurement{{Name: "cpu", Value: 50}}
	out := e.Evaluate(ms)
	if len(out) != 1 {
		t.Fatalf("expected 1 problem, got %d", len(out))
	}
	if out[0].Severity != "pass" {
		t.Errorf("expected pass for no-rule measurement, got %s", out[0].Severity)
	}
}

func TestThresholdEvaluator_FailAboveMax(t *testing.T) {
	e := &ThresholdEvaluator{Rules: []ThresholdRule{
		{Name: "cpu", Max: 80, WarnAbove: 60, Enabled: true},
	}}
	out := e.Evaluate([]Measurement{{Name: "cpu", Value: 95}})
	if len(out) != 1 || out[0].Severity != "fail" {
		t.Fatalf("expected single fail problem, got %+v", out)
	}
	if out[0].Reason != "above_max" {
		t.Errorf("expected reason above_max, got %s", out[0].Reason)
	}
}

func TestThresholdEvaluator_WarnBelow(t *testing.T) {
	e := &ThresholdEvaluator{Rules: []ThresholdRule{
		{Name: "disk_free", Min: 0, Max: math.MaxFloat64, WarnBelow: 10, Enabled: true},
	}}
	out := e.Evaluate([]Measurement{{Name: "disk_free", Value: 5}})
	if len(out) != 1 || out[0].Severity != "warning" {
		t.Fatalf("expected single warning, got %+v", out)
	}
}

func TestThresholdEvaluator_ErrorTag(t *testing.T) {
	e := &ThresholdEvaluator{}
	out := e.Evaluate([]Measurement{{Name: "x", Value: 0, ErrorTag: "timeout"}})
	if len(out) != 1 || out[0].Severity != "error" {
		t.Fatalf("expected error severity, got %+v", out)
	}
}

func TestThresholdEvaluator_EmptyMeasurements(t *testing.T) {
	e := &ThresholdEvaluator{Rules: []ThresholdRule{{Name: "x", Enabled: true}}}
	out := e.Evaluate(nil)
	if len(out) != 0 {
		t.Fatalf("expected empty, got %v", out)
	}
}

func TestEngine_Run_CollectorErrorPropagates(t *testing.T) {
	eng := NewEngine().WithCollector(&fakeCollector{id: "c1", err: errors.New("down")})
	res := eng.Run(context.Background(), "t1", nil)
	if len(res.Errors) != 1 {
		t.Fatalf("expected 1 collector error, got %v", res.Errors)
	}
	if res.FinalStatus() != "failed" {
		t.Errorf("expected final status failed, got %s", res.FinalStatus())
	}
}

func TestEngine_Run_NoCollectors(t *testing.T) {
	eng := NewEngine()
	res := eng.Run(context.Background(), "t1", nil)
	if len(res.Problems) != 0 || len(res.Errors) != 0 {
		t.Fatalf("expected empty result, got %+v", res)
	}
	if res.FinalStatus() != "passed" {
		t.Errorf("empty engine should be passed, got %s", res.FinalStatus())
	}
}

func TestEngine_Run_PartialFailure(t *testing.T) {
	eng := NewEngine().
		WithRules([]ThresholdRule{{Name: "cpu", Max: 90, WarnAbove: 70, Enabled: true}}).
		WithCollector(&fakeCollector{id: "ok", ms: []Measurement{{Name: "cpu", Value: 50}}}).
		WithCollector(&fakeCollector{id: "bad", err: errors.New("refused")})
	res := eng.Run(context.Background(), "t1", nil)
	if res.Collectors != 2 {
		t.Errorf("expected 2 collectors executed, got %d", res.Collectors)
	}
	if res.Collected != 1 {
		t.Errorf("expected 1 measurement collected, got %d", res.Collected)
	}
	if len(res.Errors) != 1 {
		t.Errorf("expected 1 error, got %v", res.Errors)
	}
	if res.FinalStatus() != "failed" {
		t.Errorf("expected failed status due to collector error, got %s", res.FinalStatus())
	}
}
