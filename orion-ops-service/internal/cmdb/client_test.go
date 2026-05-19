package cmdb

import (
	"context"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestNewClient(t *testing.T) {
	// Test with invalid address - should fail to connect
	client, err := NewClient("localhost:19999")
	// Connection will fail but client should be created (lazy connection)
	// In real usage, operations will fail
	if err == nil && client != nil {
		defer client.Close()
	}
}

func TestClientGetHost(t *testing.T) {
	client, err := NewClient("localhost:19999")
	require.NoError(t, err)
	defer client.Close()

	ctx := context.Background()

	// This will fail because the server is not running
	_, err = client.GetHost(ctx, "host-1")
	// Expect connection error since no server is running
	assert.Error(t, err)
}

func TestClientListHosts(t *testing.T) {
	client, err := NewClient("localhost:19999")
	require.NoError(t, err)
	defer client.Close()

	ctx := context.Background()

	// This will fail because the server is not running
	_, err = client.ListHosts(ctx, 1)
	// Expect connection error since no server is running
	assert.Error(t, err)
}

func TestClientGetRelations(t *testing.T) {
	client, err := NewClient("localhost:19999")
	require.NoError(t, err)
	defer client.Close()

	ctx := context.Background()

	// This will fail because the server is not running
	_, err = client.GetRelations(ctx, "ci-1")
	// Expect connection error since no server is running
	assert.Error(t, err)
}