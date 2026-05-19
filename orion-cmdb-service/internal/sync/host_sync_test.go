package sync

import (
	"context"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestNewService(t *testing.T) {
	// Test with empty config
	config := &HostSyncConfig{
		OpsServiceAddr: "",
		SyncInterval:   time.Minute,
		Enabled:        false,
	}

	service, err := NewService(nil, nil, config)
	require.NoError(t, err)
	require.NotNil(t, service)
	assert.False(t, service.config.Enabled)
}

func TestNewServiceWithClient(t *testing.T) {
	// Test with invalid address - should still create service but disable sync
	config := &HostSyncConfig{
		OpsServiceAddr: "localhost:19999",
		SyncInterval:   time.Minute,
		Enabled:        true,
	}

	service, err := NewService(nil, nil, config)
	// Should create service but may disable sync due to connection failure
	require.NoError(t, err)
	require.NotNil(t, service)
}

func TestSyncHostsToOpsDisabled(t *testing.T) {
	config := &HostSyncConfig{
		Enabled: false,
	}

	service, err := NewService(nil, nil, config)
	require.NoError(t, err)

	ctx := context.Background()
	err = service.SyncHostsToOps(ctx)
	assert.Error(t, err)
	assert.Contains(t, err.Error(), "disabled")
}

func TestSyncHostToOpsDisabled(t *testing.T) {
	config := &HostSyncConfig{
		Enabled: false,
	}

	service, err := NewService(nil, nil, config)
	require.NoError(t, err)

	ctx := context.Background()
	err = service.SyncHostToOps(ctx, "host-1")
	assert.Error(t, err)
	assert.Contains(t, err.Error(), "disabled")
}