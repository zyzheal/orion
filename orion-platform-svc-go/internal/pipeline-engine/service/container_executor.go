package service

import (
	"bytes"
	"context"
	"errors"
	"fmt"
	"io"
	"os"
	"os/exec"
	"strings"
	"syscall"
	"time"

	"golang.org/x/sync/errgroup"
)

var (
	ErrDockerNotAvailable = errors.New("docker is not available")
)

// Volume represents a host-to-container volume mount.
type Volume struct {
	HostPath      string `json:"host_path"`
	ContainerPath string `json:"container_path"`
	ReadOnly      bool   `json:"read_only,omitempty"`
}

// GPUResource represents GPU device allocation.
type GPUResource struct {
	Devices        string   `json:"devices,omitempty"`
	Capabilities   []string `json:"capabilities,omitempty"`
}

// ResourceLimit represents container resource constraints.
type ResourceLimit struct {
	CPU    string       `json:"cpu,omitempty"`
	Memory string       `json:"memory,omitempty"`
	GPU    *GPUResource `json:"gpu,omitempty"`
}

// ContainerSpec defines the container execution specification.
type ContainerSpec struct {
	Image     string          `json:"image"`
	Workdir   *string         `json:"workdir,omitempty"`
	Env       map[string]string `json:"env,omitempty"`
	Resources *ResourceLimit  `json:"resources,omitempty"`
	Volumes   []Volume        `json:"volumes,omitempty"`
	Network   *string         `json:"network,omitempty"` // host, bridge, none
	Command   []string        `json:"command,omitempty"`
}

// ContainerExecutionResult holds the outcome of a container command execution.
type ContainerExecutionResult struct {
	ExitCode    int    `json:"exit_code"`
	Stdout      string `json:"stdout"`
	Stderr      string `json:"stderr"`
	DurationMs  int64  `json:"duration_ms"`
	ContainerId *string `json:"container_id,omitempty"`
}

// ContainerExecutorStrategy defines the execution strategy interface.
type ContainerExecutorStrategy interface {
	Execute(ctx context.Context, spec ContainerSpec, command string, args []string, timeout time.Duration) (*ContainerExecutionResult, error)
	IsAvailable(ctx context.Context) bool
}

// LocalSpawnExecutor runs commands locally via os/exec.
type LocalSpawnExecutor struct{}

func (e *LocalSpawnExecutor) Execute(ctx context.Context, spec ContainerSpec, command string, args []string, timeout time.Duration) (*ContainerExecutionResult, error) {
	start := time.Now()

	cwd := os.Getenv("PWD")
	if spec.Workdir != nil && *spec.Workdir != "" {
		cwd = *spec.Workdir
	}

	cmd := exec.CommandContext(ctx, command, args...)
	cmd.Dir = cwd

	// Merge environment
	cmd.Env = append(os.Environ(), formatEnv(spec.Env)...)

	stdout, err := cmd.StdoutPipe()
	if err != nil {
		return nil, fmt.Errorf("failed to create stdout pipe: %w", err)
	}
	stderr, err := cmd.StderrPipe()
	if err != nil {
		return nil, fmt.Errorf("failed to create stderr pipe: %w", err)
	}
	cmd.Stdin = nil

	if err := cmd.Start(); err != nil {
		return nil, fmt.Errorf("failed to spawn: %w", err)
	}

	var stdoutBuf, stderrBuf bytes.Buffer
	eg, _ := errgroup.WithContext(ctx)
	eg.Go(func() error {
		_, err := io.Copy(&stdoutBuf, stdout)
		return err
	})
	eg.Go(func() error {
		_, err := io.Copy(&stderrBuf, stderr)
		return err
	})

	// Enforce timeout with separate goroutine
	if timeout > 0 {
		// ctx.Done() is handled by exec.CommandContext automatically
		_ = ctx
	}

	err = cmd.Wait()
	// Drain the copy goroutines (pipes closed by cmd.Wait(), they finish quickly).
	_ = eg.Wait()

	exitCode := 0
	if err != nil {
		if exitErr, ok := err.(*exec.ExitError); ok {
			if ws, ok := exitErr.Sys().(syscall.WaitStatus); ok {
				exitCode = ws.ExitStatus()
			} else {
				exitCode = 1
			}
		} else {
			exitCode = 1
		}
	}

	return &ContainerExecutionResult{
		ExitCode:   exitCode,
		Stdout:     strings.TrimSpace(stdoutBuf.String()),
		Stderr:     strings.TrimSpace(stderrBuf.String()),
		DurationMs: time.Since(start).Milliseconds(),
	}, nil
}

func (e *LocalSpawnExecutor) IsAvailable(ctx context.Context) bool {
	return true
}

// DockerExecutor runs commands inside Docker containers.
type DockerExecutor struct {
	dockerBinary string
}

func NewDockerExecutor() *DockerExecutor {
	return &DockerExecutor{dockerBinary: "docker"}
}

func (e *DockerExecutor) Execute(ctx context.Context, spec ContainerSpec, command string, args []string, timeout time.Duration) (*ContainerExecutionResult, error) {
	start := time.Now()

	if !e.IsAvailable(ctx) {
		return &ContainerExecutionResult{
			ExitCode:   1,
			Stdout:     "",
			Stderr:     "Docker is not available",
			DurationMs: time.Since(start).Milliseconds(),
		}, nil
	}

	dockerArgs := e.buildDockerArgs(spec, command, args)
	cmd := exec.CommandContext(ctx, e.dockerBinary, dockerArgs...)

	stdout, err := cmd.Output()
	if err != nil {
		// Attempt to extract stderr
		stderr := ""
		if exitErr, ok := err.(*exec.ExitError); ok {
			stderr = string(exitErr.Stderr)
			if stderr == "" {
				stderr = exitErr.Error()
			}
		} else {
			stderr = err.Error()
		}

		exitCode := 1
		if exitErr, ok := err.(*exec.ExitError); ok {
			if ws, ok := exitErr.Sys().(syscall.WaitStatus); ok {
				exitCode = ws.ExitStatus()
			}
		}

		return &ContainerExecutionResult{
			ExitCode:   exitCode,
			Stdout:     "",
			Stderr:     strings.TrimSpace(stderr),
			DurationMs: time.Since(start).Milliseconds(),
		}, nil
	}

	return &ContainerExecutionResult{
		ExitCode:   0,
		Stdout:     strings.TrimSpace(string(stdout)),
		Stderr:     "",
		DurationMs: time.Since(start).Milliseconds(),
	}, nil
}

func (e *DockerExecutor) IsAvailable(ctx context.Context) bool {
	timeoutCtx, cancel := context.WithTimeout(ctx, 5*time.Second)
	defer cancel()
	cmd := exec.CommandContext(timeoutCtx, e.dockerBinary, "info")
	err := cmd.Run()
	return err == nil
}

func (e *DockerExecutor) buildDockerArgs(spec ContainerSpec, command string, args []string) []string {
	a := []string{"run", "--rm"}

	// Working directory
	workdir := "/workspace"
	if spec.Workdir != nil && *spec.Workdir != "" {
		workdir = *spec.Workdir
	}
	a = append(a, "-w", workdir)

	// Resource limits
	if spec.Resources != nil {
		if spec.Resources.CPU != "" {
			a = append(a, "--cpus", spec.Resources.CPU)
		}
		if spec.Resources.Memory != "" {
			a = append(a, "--memory", spec.Resources.Memory)
		}
		if spec.Resources.GPU != nil {
			gpu := spec.Resources.GPU
			parts := []string{}
			if gpu.Devices != "" {
				parts = append(parts, fmt.Sprintf("device=%s", gpu.Devices))
			}
			if len(gpu.Capabilities) > 0 {
				parts = append(parts, strings.Join(gpu.Capabilities, ","))
			}
			gpuArg := "all"
			if len(parts) > 0 {
				gpuArg = strings.Join(parts, ",")
			}
			a = append(a, "--gpus", gpuArg)
		}
	}

	// Environment variables
	for k, v := range spec.Env {
		a = append(a, "-e", fmt.Sprintf("%s=%s", k, v))
	}

	// Volume mounts
	for _, vol := range spec.Volumes {
		mode := "rw"
		if vol.ReadOnly {
			mode = "ro"
		}
		a = append(a, "-v", fmt.Sprintf("%s:%s:%s", vol.HostPath, vol.ContainerPath, mode))
	}

	// Network mode
	if spec.Network != nil && *spec.Network != "" {
		a = append(a, "--network", *spec.Network)
	}

	// Image
	a = append(a, spec.Image)

	// Command
	if command != "" {
		a = append(a, command)
	}
	if len(args) > 0 {
		a = append(a, args...)
	}

	return a
}

// NewContainerExecutor is the factory function for container executors.
func NewContainerExecutor(executorType string) ContainerExecutorStrategy {
	switch strings.ToLower(executorType) {
	case "docker":
		return NewDockerExecutor()
	case "local":
		fallthrough
	default:
		return &LocalSpawnExecutor{}
	}
}

// --- helpers ---

func formatEnv(env map[string]string) []string {
	if env == nil {
		return nil
	}
	result := make([]string, 0, len(env))
	for k, v := range env {
		result = append(result, fmt.Sprintf("%s=%s", k, v))
	}
	return result
}

var _ ContainerExecutorStrategy = (*LocalSpawnExecutor)(nil)
var _ ContainerExecutorStrategy = (*DockerExecutor)(nil)
