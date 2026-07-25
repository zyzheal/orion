package handlers

import (
	"go.uber.org/zap"

	"orion/platform-svc-go/internal/execution-mode-engine/engine"
)

// Defaults registers the built-in mode handlers with the engine.
//
// Handlers are registered in the following order:
//   - ImmediateHandler (executor may be nil — the handler will reject)
//   - QueuedHandler (queue may be nil — the handler will reject)
//   - ScheduledHandler (scheduler may be nil — the handler will reject)
//   - ManualHandler (checker may be nil — confirmation is skipped)
//   - APITriggeredHandler (verifier may be nil — token validation is skipped)
//
// When a dependency is nil, the corresponding handler still registers but
// returns an error at execution time, allowing fallback modes to take over
// when the Engine's fallback option is enabled.
//
// Parameters:
//   engine — the Engine to register handlers on.
//   logger — structured logger (nil → zap.NewNop()).
//   executor — default executor used by immediate and manual handlers.
//   queue — queue implementation for the queued handler.
//   scheduler — scheduler implementation for the scheduled handler.
//   checker — confirmation checker for the manual handler.
//   verifier — token verifier for the api-triggered handler.
func Defaults(
	en *engine.Engine,
	logger *zap.Logger,
	executor Executor,
	queue Queue,
	scheduler Scheduler,
	checker ConfirmationChecker,
	verifier APITokenVerifier,
) {
	if logger == nil {
		logger = zap.NewNop()
	}

	immediate := NewImmediateHandler(logger, executor)
	queued := NewQueuedHandler(logger, queue)
	scheduled := NewScheduledHandler(logger, scheduler)
	manualHandler := NewManualHandler(logger, executor, checker)
	apiHandler := NewAPITriggeredHandler(logger, executor, verifier)

	for _, h := range []engine.ModeHandler{
		immediate,
		queued,
		scheduled,
		manualHandler,
		apiHandler,
	} {
		en.RegisterHandler(h)
	}
}
