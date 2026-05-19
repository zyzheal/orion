package sync

import (
	"context"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestNewOpsClient(t *testing.T) {
	// Test with invalid address - should fail to connect
	client, err := NewOpsClient("localhost:19999")
	// Connection will fail but client should be created (lazy connection)
	// In real usage, operations will fail
	if err == nil && client != nil {
		defer client.Close()
	}
}

func TestOpsClientCreateSession(t *testing.T) {
	client, err := NewOpsClient("localhost:19999")
	require.NoError(t, err)
	defer client.Close()

	ctx := context.Background()

	// This will fail because the server is not running
	// But we test that the client is properly initialized
	_, err = client.CreateSession(ctx, "host-1", "SSH")
	// Expect connection error since no server is running
	assert.Error(t, err)
}

func TestOpsClientExecuteBatch(t *testing.T) {
	client, err := NewOpsClient("localhost:19999")
	require.NoError(t, err)
	defer client.Close()

	ctx := context.Background()

	// This will fail because the server is not running
	_, err = client.ExecuteBatch(ctx, "test-task", "echo hello", []string{"host-1", "host-2"})
	// Expect connection error since no server is running
	assert.Error(t, err)
}

func TestOpsClientGetTaskResults(t *testing.T) {
	client, err := NewOpsClient("localhost:19999")
	require.NoError(t, err)
	defer client.Close()

	ctx := context.Background()

	// This will fail because the server is not running
	_, err = client.GetTaskResults(ctx, "non-existent-task")
	// Expect connection error since no server is running
	assert.Error(t, err)
}