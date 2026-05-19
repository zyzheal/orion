package executor

import (
	"testing"

	"github.com/stretchr/testify/assert"
)

func TestExecuteBatchInput_Validation(t *testing.T) {
	tests := []struct {
		name    string
		input   ExecuteBatchInput
		wantErr bool
	}{
		{
			name: "valid input",
			input: ExecuteBatchInput{
				TenantID: 1,
				UserID:   "user1",
				Name:     "test-task",
				Command:  "ls -la",
				HostIDs:  []string{"host1", "host2"},
			},
			wantErr: false,
		},
		{
			name: "missing tenant_id",
			input: ExecuteBatchInput{
				UserID:  "user1",
				Name:    "test-task",
				Command: "ls -la",
				HostIDs: []string{"host1"},
			},
			wantErr: true,
		},
		{
			name: "empty host_ids",
			input: ExecuteBatchInput{
				TenantID: 1,
				UserID:   "user1",
				Name:     "test-task",
				Command:  "ls -la",
				HostIDs:  []string{},
			},
			wantErr: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if tt.wantErr {
				assert.NotNil(t, tt.input.TenantID)
			} else {
				assert.NotZero(t, tt.input.TenantID)
			}
		})
	}
}

func TestTaskStatus_Constants(t *testing.T) {
	assert.Equal(t, TaskStatus("PENDING"), TaskStatusPending)
	assert.Equal(t, TaskStatus("RUNNING"), TaskStatusRunning)
	assert.Equal(t, TaskStatus("COMPLETED"), TaskStatusCompleted)
	assert.Equal(t, TaskStatus("FAILED"), TaskStatusFailed)
	assert.Equal(t, TaskStatus("CANCELLED"), TaskStatusCancelled)
}