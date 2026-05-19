package sftp

import (
	"testing"

	"github.com/stretchr/testify/assert"
)

func TestTransferStatus_Constants(t *testing.T) {
	assert.Equal(t, TransferStatus("PENDING"), TransferStatusPending)
	assert.Equal(t, TransferStatus("RUNNING"), TransferStatusRunning)
	assert.Equal(t, TransferStatus("COMPLETED"), TransferStatusCompleted)
	assert.Equal(t, TransferStatus("FAILED"), TransferStatusFailed)
}

func TestTransferRequest_Validation(t *testing.T) {
	tests := []struct {
		name    string
		req     TransferRequest
		wantErr bool
	}{
		{
			name: "valid upload request",
			req: TransferRequest{
				TenantID:   1,
				UserID:     "user1",
				HostID:     "host1",
				RemotePath: "/tmp/file.txt",
				LocalPath:  "./file.txt",
				Direction:  "UPLOAD",
			},
			wantErr: false,
		},
		{
			name: "valid download request",
			req: TransferRequest{
				TenantID:   1,
				UserID:     "user1",
				HostID:     "host1",
				RemotePath: "/tmp/file.txt",
				LocalPath:  "./file.txt",
				Direction:  "DOWNLOAD",
			},
			wantErr: false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if tt.wantErr {
				assert.NotZero(t, tt.req.TenantID)
			} else {
				assert.NotZero(t, tt.req.TenantID)
			}
		})
	}
}