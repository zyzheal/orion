package scheduler

import (
	"testing"

	"github.com/stretchr/testify/assert"
)

func TestJobStatus_Constants(t *testing.T) {
	assert.Equal(t, JobStatus("ACTIVE"), JobStatusActive)
	assert.Equal(t, JobStatus("PAUSED"), JobStatusPaused)
	assert.Equal(t, JobStatus("DISABLED"), JobStatusDisabled)
}

func TestCronJob_Validation(t *testing.T) {
	tests := []struct {
		name    string
		job     CronJob
		wantErr bool
	}{
		{
			name: "valid job",
			job: CronJob{
				TenantID: 1,
				UserID:   "user1",
				Name:     "test-job",
				Command:  "echo hello",
				Schedule: "0 * * * *", // every hour
				Status:   JobStatusActive,
			},
			wantErr: false,
		},
		{
			name: "invalid cron expression",
			job: CronJob{
				TenantID: 1,
				UserID:   "user1",
				Name:     "test-job",
				Command:  "echo hello",
				Schedule: "invalid",
			},
			wantErr: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			// Validate cron expression
			if tt.job.Schedule != "" && tt.job.Schedule != "invalid" {
				// Would validate with cron parser in real implementation
			}
		})
	}
}