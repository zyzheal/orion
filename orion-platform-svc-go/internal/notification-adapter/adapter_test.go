package adapter

import (
	"context"
	"errors"
	"testing"

	"go.uber.org/zap"
)

// fakePipeline 模拟 pipeline 发送。
type fakePipeline struct {
	err   error
	resp  *SendResponse
	calls int
}

func (f *fakePipeline) Send(ctx context.Context, req SendRequest) (*SendResponse, error) {
	f.calls++
	if f.err != nil {
		return nil, f.err
	}
	if f.resp != nil {
		return f.resp, nil
	}
	return &SendResponse{DeliveryID: "dlv-1", Status: "delivered"}, nil
}

// fakeLegacy 模拟 legacy 发送。
type fakeLegacy struct {
	err   error
	resp  *SendResponse
	calls int
}

func (f *fakeLegacy) Send(ctx context.Context, req SendRequest) (*SendResponse, error) {
	f.calls++
	if f.err != nil {
		return nil, f.err
	}
	if f.resp != nil {
		return f.resp, nil
	}
	return &SendResponse{DeliveryID: "dlv-legacy", Status: "delivered"}, nil
}

func TestSend_FeatureFlagDisabled_UseLegacy(t *testing.T) {
	pipeline := &fakePipeline{}
	legacy := &fakeLegacy{}
	a := New(pipeline, legacy, StaticFlag{Value: false}, zap.NewNop())

	resp, err := a.Send(context.Background(), SendRequest{Channel: "wechat"})
	if err != nil {
		t.Fatalf("Send failed: %v", err)
	}
	if resp.AdapterMode != "legacy" {
		t.Errorf("expected legacy mode, got %s", resp.AdapterMode)
	}
	if pipeline.calls != 0 {
		t.Errorf("pipeline should not be called, got %d", pipeline.calls)
	}
	if legacy.calls != 1 {
		t.Errorf("legacy should be called once, got %d", legacy.calls)
	}
}

func TestSend_FeatureFlagEnabled_PipelineSucceeds(t *testing.T) {
	pipeline := &fakePipeline{}
	legacy := &fakeLegacy{}
	a := New(pipeline, legacy, StaticFlag{Value: true}, zap.NewNop())

	resp, err := a.Send(context.Background(), SendRequest{Channel: "wechat"})
	if err != nil {
		t.Fatalf("Send failed: %v", err)
	}
	if resp.AdapterMode != "pipeline" {
		t.Errorf("expected pipeline mode, got %s", resp.AdapterMode)
	}
	if pipeline.calls != 1 {
		t.Errorf("pipeline should be called once")
	}
	if legacy.calls != 0 {
		t.Errorf("legacy should not be called")
	}
}

func TestSend_PipelineFails_FallbackToLegacy(t *testing.T) {
	pipeline := &fakePipeline{err: errors.New("pipeline down")}
	legacy := &fakeLegacy{}
	a := New(pipeline, legacy, StaticFlag{Value: true}, zap.NewNop())

	resp, err := a.Send(context.Background(), SendRequest{Channel: "wechat"})
	if err != nil {
		t.Fatalf("Send should not return error when legacy fallback works")
	}
	if resp.AdapterMode != "legacy" {
		t.Errorf("expected legacy mode, got %s", resp.AdapterMode)
	}
	if pipeline.calls != 1 || legacy.calls != 1 {
		t.Errorf("expected pipeline=1, legacy=1, got pipeline=%d, legacy=%d", pipeline.calls, legacy.calls)
	}
}

func TestSend_BothFail_ReturnsSilentResponse(t *testing.T) {
	pipeline := &fakePipeline{err: errors.New("pipeline down")}
	legacy := &fakeLegacy{err: errors.New("legacy down")}
	a := New(pipeline, legacy, StaticFlag{Value: true}, zap.NewNop())

	resp, err := a.Send(context.Background(), SendRequest{Channel: "wechat"})
	if err != nil {
		t.Errorf("Send should not return error (silent), got %v", err)
	}
	if resp.AdapterMode != "silent" {
		t.Errorf("expected silent mode, got %s", resp.AdapterMode)
	}
}

func TestStatus_Snapshot(t *testing.T) {
	pipeline := &fakePipeline{}
	legacy := &fakeLegacy{}
	a := New(pipeline, legacy, StaticFlag{Value: true}, zap.NewNop())

	// 触发一次成功
	_, _ = a.Send(context.Background(), SendRequest{})

	snap := a.Status()
	if snap.PipelineAdapterEnabled != true {
		t.Error("expected pipeline_adapter_enabled=true")
	}
	if snap.PipelineAvailable != true {
		t.Error("expected pipeline_available=true")
	}
	if snap.RecentDeliveryCount != 1 {
		t.Errorf("expected 1 delivery, got %d", snap.RecentDeliveryCount)
	}
	if snap.RecentDeliverySuccessRate != 1.0 {
		t.Errorf("expected 100%% success, got %.2f", snap.RecentDeliverySuccessRate)
	}
}

func TestStatus_BothFailures(t *testing.T) {
	pipeline := &fakePipeline{err: errors.New("down")}
	legacy := &fakeLegacy{err: errors.New("down")}
	a := New(pipeline, legacy, StaticFlag{Value: true}, zap.NewNop())

	_, _ = a.Send(context.Background(), SendRequest{})

	snap := a.Status()
	if snap.RecentDeliverySuccessRate != 0 {
		t.Errorf("expected 0%% success, got %.2f", snap.RecentDeliverySuccessRate)
	}
}
