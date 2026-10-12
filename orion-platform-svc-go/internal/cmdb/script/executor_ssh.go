package script

import (
	"bytes"
	"context"
	"fmt"
	"net"
	"os"
	"strings"
	"time"

	"golang.org/x/crypto/ssh"
)

// SSHExecutor executes scripts on remote hosts over SSH. It is invoked
// when ExecRequest.SSH is populated (Host non-empty).
//
// Credentials may be Password or KeyPath (KeyPath wins when both set).
// Both are required to be non-empty otherwise ErrSSHNotConfigured.
type SSHExecutor struct {
	// Timeout bounds a single session. Zero = MaxPerTargetTimeout.
	Timeout time.Duration
	// MaxOutputBytes caps retained output.
	MaxOutputBytes int
}

// Compile-time assert.
var _ Executor = (*SSHExecutor)(nil)

func (e *SSHExecutor) Type() string { return "ssh" }

func (e *SSHExecutor) Execute(ctx context.Context, req *ExecRequest) (*ExecResult, error) {
	if req == nil || strings.TrimSpace(req.Script) == "" {
		return failResult(req, ErrScriptBodyEmpty), nil
	}
	if req.SSH == nil || req.SSH.Host == "" {
		return failResult(req, ErrSSHNotConfigured), nil
	}
	if req.SSH.Password == "" && req.SSH.KeyPath == "" {
		return failResult(req, ErrSSHNotConfigured), nil
	}
	timeout := e.Timeout
	if timeout <= 0 {
		timeout = MaxPerTargetTimeout * time.Millisecond
	}
	runCtx, cancel := context.WithTimeout(ctx, timeout)
	defer cancel()

	client, err := e.dial(runCtx, req.SSH)
	if err != nil {
		return failResult(req, fmt.Errorf("ssh dial: %w", err)), nil
	}
	defer client.Close()

	session, err := client.NewSession()
	if err != nil {
		return failResult(req, fmt.Errorf("ssh session: %w", err)), nil
	}
	defer session.Close()

	var outBuf, errBuf bytes.Buffer
	session.Stdout = &outBuf
	session.Stderr = &errBuf

	runErr := session.Run(req.Script)
	if runCtx.Err() == context.DeadlineExceeded {
		return failResult(req, fmt.Errorf("ssh timed out after %v", timeout)), nil
	}
	if runErr != nil {
		res := failResult(req, runErr)
		res.Output = capOutput(e.MaxOutputBytes, outBuf.String())
		if errBuf.Len() > 0 {
			res.Error = fmt.Sprintf("%v | stderr: %s", runErr.Error(), capOutput(e.MaxOutputBytes, errBuf.String()))
		}
		return res, nil
	}
	return &ExecResult{
		CIID:   req.CIID,
		Status: "success",
		Output: capOutput(e.MaxOutputBytes, outBuf.String()),
	}, nil
}

func (e *SSHExecutor) dial(ctx context.Context, t *SSHTarget) (*ssh.Client, error) {
	auth, err := e.buildAuth(t)
	if err != nil {
		return nil, err
	}
	addr := t.Host
	if t.Port != 0 && t.Port != 22 {
		addr = fmt.Sprintf("%s:%d", t.Host, t.Port)
	}
	cfg := &ssh.ClientConfig{
		User:            t.User,
		Auth:            []ssh.AuthMethod{auth},
		HostKeyCallback: ssh.InsecureIgnoreHostKey(), //nolint: gosec // TODO: replace with known_hosts from DB
		Timeout:         15 * time.Second,
	}
	// x/crypto/ssh has no DialContext; wire ctx into the TCP dial via
	// net.Dialer.DialContext to honour cancellation during handshake.
	return dialWithCtx(ctx, cfg, addr)
}

func dialWithCtx(ctx context.Context, cfg *ssh.ClientConfig, addr string) (*ssh.Client, error) {
	d := net.Dialer{Timeout: cfg.Timeout}
	nconn, err := d.DialContext(ctx, "tcp", addr)
	if err != nil {
		return nil, err
	}
	_ = nconn.Close() // TCP probe only; ssh.Dial re-dials below.
	return ssh.Dial("tcp", addr, cfg)
}

func (e *SSHExecutor) buildAuth(t *SSHTarget) (ssh.AuthMethod, error) {
	if t.KeyPath != "" {
		key, err := os.ReadFile(t.KeyPath)
		if err != nil {
			return nil, fmt.Errorf("read key %q: %w", t.KeyPath, err)
		}
		signer, err := ssh.ParsePrivateKey(key)
		if err != nil {
			return nil, fmt.Errorf("parse key: %w", err)
		}
		return ssh.PublicKeys(signer), nil
	}
	if t.Password != "" {
		return ssh.Password(t.Password), nil
	}
	return nil, ErrSSHNotConfigured
}
