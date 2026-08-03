package llmprovider

import (
	"context"
	"testing"
)

func TestDebug1(t *testing.T) {
	r := NewProviderRegistry()
	r.SetTokenLimit(ProviderTypeOpenAI, 1)
	r.Register(newEchoProvider(ProviderTypeOpenAI, "hi", nil))

	ctx := context.Background()
	req := &ChatRequest{Model: "gpt-4o", Messages: []Message{{Role: "user", Content: "hi"}}}
	
	// first call ok
	resp1, err1 := r.Call(ctx, req)
	t.Logf("call1: resp=%+v err=%v", resp1, err1)
	pool1 := r.TokenPool(ProviderTypeOpenAI)
	t.Logf("pool after call1: %+v", pool1)

	// second call: pool exhausted
	resp2, err2 := r.Call(ctx, req)
	t.Logf("call2: resp=%+v err=%v", resp2, err2)
}
