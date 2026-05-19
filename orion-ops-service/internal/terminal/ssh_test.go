package terminal

import (
	"testing"
	"github.com/stretchr/testify/assert"
)

func TestSSHConfig_Validation(t *testing.T) {
	tests := []struct {
		name    string
		config  *SSHConfig
		wantErr bool
		errMsg  string
	}{
		{
			name:    "nil config",
			config:  nil,
			wantErr: true,
			errMsg:  "SSH config cannot be nil",
		},
		{
			name: "empty host",
			config: &SSHConfig{
				Host:     "",
				Port:     22,
				User:     "test",
				Password: "test",
			},
			wantErr: true,
			errMsg:  "SSH host cannot be empty",
		},
		{
			name: "empty user",
			config: &SSHConfig{
				Host:     "localhost",
				Port:     22,
				User:     "",
				Password: "test",
			},
			wantErr: true,
			errMsg:  "SSH user cannot be empty",
		},
		{
			name: "no password or key",
			config: &SSHConfig{
				Host:     "localhost",
				Port:     22,
				User:     "test",
				Password: "",
				Key:      nil,
			},
			wantErr: true,
			errMsg:  "either password or private key must be provided",
		},
		{
			name: "valid config with password",
			config: &SSHConfig{
				Host:     "localhost",
				Port:     22,
				User:     "test",
				Password: "test",
			},
			wantErr: false,
		},
		{
			name: "valid config with key",
			config: &SSHConfig{
				Host: "localhost",
				Port: 22,
				User: "test",
				Key:  []byte("-----BEGIN OPENSSH PRIVATE KEY-----\ntest\n-----END OPENSSH PRIVATE KEY-----"),
			},
			wantErr: false,
		},
		{
			name: "default port",
			config: &SSHConfig{
				Host:     "localhost",
				Port:     0,
				User:     "test",
				Password: "test",
			},
			wantErr: false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			client, err := NewSSHClient(tt.config)
			if tt.wantErr {
				assert.Error(t, err)
				assert.Contains(t, err.Error(), tt.errMsg)
				assert.Nil(t, client)
			} else {
				assert.NoError(t, err)
				assert.NotNil(t, client)
			}
		})
	}
}

func TestSSHClient_IsConnected(t *testing.T) {
	config := &SSHConfig{
		Host:     "localhost",
		Port:     22,
		User:     "test",
		Password: "test",
	}

	client, err := NewSSHClient(config)
	assert.NoError(t, err)
	assert.NotNil(t, client)

	// Before connection
	assert.False(t, client.IsConnected())

	// Note: We don't actually connect in this test since there's no SSH server
	// In integration tests, you would test the full connection flow
}

func TestSessionType_Constants(t *testing.T) {
	assert.Equal(t, SessionType("SSH"), SessionTypeSSH)
	assert.Equal(t, SessionType("RDP"), SessionTypeRDP)
	assert.Equal(t, SessionType("VNC"), SessionTypeVNC)
}

func TestManagedSession(t *testing.T) {
	config := &SSHConfig{
		Host:     "localhost",
		Port:     22,
		User:     "test",
		Password: "test",
	}

	client, err := NewSSHClient(config)
	assert.NoError(t, err)

	managedSession := &ManagedSession{
		Session: &Session{
			ID:          "test-session-id",
			TenantID:    1,
			UserID:      "user-1",
			HostID:      "host-1",
			SessionType: "SSH",
			Status:      "CONNECTING",
		},
		Client: client,
	}

	assert.NotNil(t, managedSession.Session)
	assert.NotNil(t, managedSession.Client)
	assert.Equal(t, "test-session-id", managedSession.Session.ID)
	assert.Equal(t, "SSH", managedSession.Session.SessionType)
}

func TestGetConfig(t *testing.T) {
	config := &SSHConfig{
		Host:     "192.168.1.1",
		Port:     2222,
		User:     "admin",
		Password: "secret",
	}

	client, err := NewSSHClient(config)
	assert.NoError(t, err)

	returnedConfig := client.GetConfig()
	assert.Equal(t, config.Host, returnedConfig.Host)
	assert.Equal(t, config.Port, returnedConfig.Port)
	assert.Equal(t, config.User, returnedConfig.User)
	assert.Equal(t, config.Password, returnedConfig.Password)
}

func TestDialAndConnect_InvalidConfig(t *testing.T) {
	// Test with empty host
	client, err := DialAndConnect("", 22, "user", "pass", nil)
	assert.Error(t, err)
	assert.Nil(t, client)

	// Test with no credentials
	client, err = DialAndConnect("localhost", 22, "user", "", nil)
	assert.Error(t, err)
	assert.Nil(t, client)
}

func TestStatus_Constants(t *testing.T) {
	assert.Equal(t, "CONNECTING", StatusConnecting)
	assert.Equal(t, "ACTIVE", StatusActive)
	assert.Equal(t, "CLOSED", StatusClosed)
}