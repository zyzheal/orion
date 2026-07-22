package commands

import (
	"context"
	"encoding/json"
	"errors"
	"sync/atomic"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestNewCommand(t *testing.T) {
	data := json.RawMessage(`{"pipeline_id":"p-1"}`)
	cmd := NewCommand("pipeline.start", "p-1", "tenant-1", data)

	assert.NotEmpty(t, cmd.CommandID)
	assert.Equal(t, "pipeline.start", cmd.CommandType)
	assert.Equal(t, "p-1", cmd.AggregateID)
	assert.Equal(t, "tenant-1", cmd.TenantID)
	assert.Equal(t, data, cmd.Data)
	assert.False(t, cmd.Timestamp.IsZero())
}

func TestInMemoryCommandBus_SendHandlerNotFound(t *testing.T) {
	bus := NewInMemoryCommandBus()
	cmd := NewCommand("nonexistent", "agg-1", "tenant-1", nil)

	err := bus.Send(context.Background(), cmd)
	require.Error(t, err)

	var notFound *HandlerNotFoundError
	assert.True(t, errors.As(err, &notFound))
	assert.Equal(t, "nonexistent", notFound.CommandType)
}

func TestInMemoryCommandBus_RegisterAndSend(t *testing.T) {
	bus := NewInMemoryCommandBus()
	ctx := context.Background()

	var handled atomic.Int32
	bus.RegisterHandler("pipeline.start", CommandHandlerFunc(func(_ context.Context, cmd Command) error {
		handled.Add(1)
		assert.Equal(t, "pipeline.start", cmd.CommandType)
		assert.Equal(t, "pipe-1", cmd.AggregateID)
		assert.Equal(t, "tenant-1", cmd.TenantID)
		return nil
	}))

	cmd := NewCommand("pipeline.start", "pipe-1", "tenant-1", nil)
	err := bus.Send(ctx, cmd)
	assert.NoError(t, err)
	assert.Equal(t, int32(1), handled.Load())
}

func TestInMemoryCommandBus_HandlerReplacement(t *testing.T) {
	bus := NewInMemoryCommandBus()
	ctx := context.Background()

	// Register first handler
	bus.RegisterHandler("pipeline.start", CommandHandlerFunc(func(_ context.Context, _ Command) error {
		return errors.New("old handler")
	}))

	// Replace with new handler
	bus.RegisterHandler("pipeline.start", CommandHandlerFunc(func(_ context.Context, _ Command) error {
		return nil
	}))

	cmd := NewCommand("pipeline.start", "pipe-1", "tenant-1", nil)
	err := bus.Send(ctx, cmd)
	assert.NoError(t, err, "should use the new handler, not the old one")
}

func TestInMemoryCommandBus_MultipleCommandTypes(t *testing.T) {
	bus := NewInMemoryCommandBus()
	ctx := context.Background()

	var pipelineCount, approvalCount atomic.Int32

	bus.RegisterHandler("pipeline.start", CommandHandlerFunc(func(_ context.Context, _ Command) error {
		pipelineCount.Add(1)
		return nil
	}))
	bus.RegisterHandler("approval.request", CommandHandlerFunc(func(_ context.Context, _ Command) error {
		approvalCount.Add(1)
		return nil
	}))

	bus.Send(ctx, NewCommand("pipeline.start", "p-1", "t-1", nil))
	bus.Send(ctx, NewCommand("pipeline.start", "p-2", "t-1", nil))
	bus.Send(ctx, NewCommand("approval.request", "a-1", "t-1", nil))

	assert.Equal(t, int32(2), pipelineCount.Load())
	assert.Equal(t, int32(1), approvalCount.Load())
}

func TestInMemoryCommandBus_HandlerReturnsError(t *testing.T) {
	bus := NewInMemoryCommandBus()
	ctx := context.Background()

	expectedErr := errors.New("handler failure")
	bus.RegisterHandler("failing", CommandHandlerFunc(func(_ context.Context, _ Command) error {
		return expectedErr
	}))

	cmd := NewCommand("failing", "agg-1", "t-1", nil)
	err := bus.Send(ctx, cmd)
	assert.ErrorIs(t, err, expectedErr)
}

func TestInMemoryCommandBus_EmptyCommandID(t *testing.T) {
	bus := NewInMemoryCommandBus()
	ctx := context.Background()

	var capturedID string
	bus.RegisterHandler("test", CommandHandlerFunc(func(_ context.Context, cmd Command) error {
		capturedID = cmd.CommandID
		return nil
	}))

	// Send a command with an empty CommandID
	cmd := Command{
		CommandType: "test",
		AggregateID: "agg-1",
		TenantID:    "t-1",
		Timestamp:   time.Now().UTC(),
	}
	err := bus.Send(ctx, cmd)
	assert.NoError(t, err)
	assert.NotEmpty(t, capturedID, "Send should auto-generate a CommandID")
}

func TestInMemoryCommandBus_UnregisterHandler(t *testing.T) {
	bus := NewInMemoryCommandBus()
	ctx := context.Background()

	bus.RegisterHandler("temp", CommandHandlerFunc(func(_ context.Context, _ Command) error {
		return nil
	}))
	assert.Equal(t, 1, bus.HandlerCount())

	bus.UnregisterHandler("temp")
	assert.Equal(t, 0, bus.HandlerCount())

	cmd := NewCommand("temp", "agg-1", "t-1", nil)
	err := bus.Send(ctx, cmd)
	assert.Error(t, err)
}

func TestHandlerNotFoundError_Error(t *testing.T) {
	err := &HandlerNotFoundError{CommandType: "test.cmd"}
	assert.Contains(t, err.Error(), "test.cmd")

	emptyErr := &HandlerNotFoundError{}
	assert.Equal(t, "command handler not found", emptyErr.Error())
}

func TestInMemoryCommandBus_ConcurrentSafety(t *testing.T) {
	bus := NewInMemoryCommandBus()
	ctx := context.Background()

	// Register a handler
	bus.RegisterHandler("pipeline.start", CommandHandlerFunc(func(_ context.Context, _ Command) error {
		// Simulate some work
		time.Sleep(time.Millisecond)
		return nil
	}))

	// Fire off concurrent sends
	const goroutines = 20
	errs := make(chan error, goroutines)
	for i := 0; i < goroutines; i++ {
		go func() {
			cmd := NewCommand("pipeline.start", "pipe-1", "tenant-1", nil)
			errs <- bus.Send(ctx, cmd)
		}()
	}

	for i := 0; i < goroutines; i++ {
		assert.NoError(t, <-errs)
	}
}

func TestCommandHandlerFunc_Adapter(t *testing.T) {
	var called bool
	fn := CommandHandlerFunc(func(_ context.Context, cmd Command) error {
		called = true
		assert.Equal(t, "test", cmd.CommandType)
		return nil
	})

	err := fn.Handle(context.Background(), Command{CommandType: "test"})
	assert.NoError(t, err)
	assert.True(t, called)
}

func TestInMemoryCommandBus_HandlerCount(t *testing.T) {
	bus := NewInMemoryCommandBus()
	assert.Equal(t, 0, bus.HandlerCount())

	bus.RegisterHandler("a", CommandHandlerFunc(func(_ context.Context, _ Command) error { return nil }))
	bus.RegisterHandler("b", CommandHandlerFunc(func(_ context.Context, _ Command) error { return nil }))
	assert.Equal(t, 2, bus.HandlerCount())
}