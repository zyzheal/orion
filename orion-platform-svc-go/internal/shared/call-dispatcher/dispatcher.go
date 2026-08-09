package calldispatcher

import (
	"context"
	"fmt"
	"sync"
)

type CallDispatcher struct {
	mu       sync.RWMutex
	handlers map[string]HandlerFunc
}

func New() *CallDispatcher {
	return &CallDispatcher{handlers: make(map[string]HandlerFunc)}
}

func (d *CallDispatcher) Register(target Domain, action string, handler HandlerFunc) {
	key := string(target) + ":" + action
	d.mu.Lock()
	d.handlers[key] = handler
	d.mu.Unlock()
}

func (d *CallDispatcher) Dispatch(ctx context.Context, req CrossDomainRequest) CrossDomainResponse {
	key := string(req.Target) + ":" + req.Action
	d.mu.RLock()
	handler, ok := d.handlers[key]
	d.mu.RUnlock()
	if !ok {
		return CrossDomainResponse{Success: false, StatusCode: 404, Error: fmt.Sprintf("no handler for %s:%s", req.Target, req.Action)}
	}
	return handler(ctx, req)
}
