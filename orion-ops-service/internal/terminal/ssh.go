package terminal

import (
	"bytes"
	"errors"
	"fmt"
	"io"
	"golang.org/x/crypto/ssh"
	"net"
)

var (
	ErrNoPasswordOrKey = errors.New("either password or private key must be provided")
	ErrConnectionFailed = errors.New("failed to connect to SSH server")
)

// SSHClient wraps an SSH connection
type SSHClient struct {
	config *SSHConfig
	client *ssh.Client
}

// NewSSHClient creates a new SSH client
func NewSSHClient(config *SSHConfig) (*SSHClient, error) {
	if config == nil {
		return nil, errors.New("SSH config cannot be nil")
	}
	if config.Host == "" {
		return nil, errors.New("SSH host cannot be empty")
	}
	if config.Port <= 0 {
		config.Port = 22
	}
	if config.User == "" {
		return nil, errors.New("SSH user cannot be empty")
	}
	if config.Password == "" && len(config.Key) == 0 {
		return nil, ErrNoPasswordOrKey
	}

	client := &SSHClient{
		config: config,
	}

	return client, nil
}

// Connect establishes the SSH connection
func (s *SSHClient) Connect() error {
	var authMethods []ssh.AuthMethod

	if s.config.Password != "" {
		authMethods = append(authMethods, ssh.Password(s.config.Password))
	}

	if len(s.config.Key) > 0 {
		signer, err := ssh.ParsePrivateKey(s.config.Key)
		if err != nil {
			return fmt.Errorf("failed to parse private key: %w", err)
		}
		authMethods = append(authMethods, ssh.PublicKeys(signer))
	}

	cfg := &ssh.ClientConfig{
		User: s.config.User,
		Auth: authMethods,
		HostKeyCallback: ssh.InsecureIgnoreHostKey(),
	}

	addr := fmt.Sprintf("%s:%d", s.config.Host, s.config.Port)
	client, err := ssh.Dial("tcp", addr, cfg)
	if err != nil {
		return fmt.Errorf("%w: %v", ErrConnectionFailed, err)
	}

	s.client = client
	return nil
}

// Session returns a new SSH session
func (s *SSHClient) Session() (*ssh.Session, error) {
	if s.client == nil {
		return nil, errors.New("SSH client not connected")
	}
	return s.client.NewSession()
}

// Shell opens an interactive shell session
// Returns the session, stdout reader, stderr reader, and stdin writer
func (s *SSHClient) Shell() (*ssh.Session, io.Reader, io.Reader, io.Writer, error) {
	session, err := s.Session()
	if err != nil {
		return nil, nil, nil, nil, err
	}

	// Set up pseudo-terminal
	modes := ssh.TerminalModes{
		ssh.ECHO:          1,
		ssh.TTY_OP_ISPEED: 14400,
		ssh.TTY_OP_OSPEED: 14400,
	}

	// Get terminal dimensions (default if not available)
	width := 80
	height := 24

	if err := session.RequestPty("xterm", height, width, modes); err != nil {
		session.Close()
		return nil, nil, nil, nil, err
	}

	stdin, err := session.StdinPipe()
	if err != nil {
		session.Close()
		return nil, nil, nil, nil, err
	}

	stdout, err := session.StdoutPipe()
	if err != nil {
		session.Close()
		return nil, nil, nil, nil, err
	}

	stderr, err := session.StderrPipe()
	if err != nil {
		session.Close()
		return nil, nil, nil, nil, err
	}

	if err := session.Shell(); err != nil {
		session.Close()
		return nil, nil, nil, nil, err
	}

	return session, stdout, stderr, stdin, nil
}

// Execute runs a command and returns stdout, stderr, and exit code
func (s *SSHClient) Execute(command string) (string, string, int, error) {
	session, err := s.Session()
	if err != nil {
		return "", "", -1, err
	}
	defer session.Close()

	var stdout, stderr bytes.Buffer
	session.Stdout = &stdout
	session.Stderr = &stderr

	err = session.Run(command)
	exitCode := 0
	if err != nil {
		if exitError, ok := err.(*ssh.ExitError); ok {
			exitCode = exitError.ExitStatus()
		} else {
			return "", "", -1, err
		}
	}

	return stdout.String(), stderr.String(), exitCode, nil
}

// Close closes the SSH client connection
func (s *SSHClient) Close() error {
	if s.client != nil {
		err := s.client.Close()
		s.client = nil
		return err
	}
	return nil
}

// IsConnected returns whether the client is connected
func (s *SSHClient) IsConnected() bool {
	return s.client != nil
}

// GetConfig returns the SSH configuration
func (s *SSHClient) GetConfig() *SSHConfig {
	return s.config
}

// DialAndConnect is a convenience function to create and connect in one step
func DialAndConnect(host string, port int, user, password string, key []byte) (*SSHClient, error) {
	config := &SSHConfig{
		Host:     host,
		Port:     port,
		User:     user,
		Password: password,
		Key:      key,
	}
	client, err := NewSSHClient(config)
	if err != nil {
		return nil, err
	}
	if err := client.Connect(); err != nil {
		return nil, err
	}
	return client, nil
}

// DialTCP connects to a specific TCP address
func (s *SSHClient) DialTCP(network, addr string) (net.Conn, error) {
	if s.client == nil {
		return nil, errors.New("SSH client not connected")
	}
	return s.client.Dial(network, addr)
}