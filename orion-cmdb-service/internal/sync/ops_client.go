package sync

import (
	"context"
	"fmt"
	"time"

	"github.com/google/uuid"
	opsv1 "github.com/orion-platform/orion-proto/ops/v1"
	"google.golang.org/grpc"
	"google.golang.org/grpc/credentials/insecure"
)

// Session represents a terminal session
type Session struct {
	ID        string
	Name      string
	UserID    string
	Status    string
	CreatedAt time.Time
	ClosedAt  *time.Time
}

// Task represents a batch execution task
type Task struct {
	ID          string
	Name        string
	Command     string
	Status      string
	HostIDs     []string
	CreatedAt   time.Time
	StartedAt   *time.Time
	CompletedAt *time.Time
}

// TaskResult represents the result of executing on a single host
type TaskResult struct {
	TaskID    string
	HostID    string
	HostName  string
	HostIP    string
	ExitCode  int
	Output    string
	Error     string
	Status    string
	DurationMs int64
}

// OpsClient is a gRPC client for the Ops service
type OpsClient struct {
	grpcConn *grpc.ClientConn
	client   opsv1.OpsServiceClient
}

// NewOpsClient creates a new Ops client
func NewOpsClient(addr string) (*OpsClient, error) {
	conn, err := grpc.NewClient(addr, grpc.WithTransportCredentials(insecure.NewCredentials()))
	if err != nil {
		return nil, fmt.Errorf("failed to connect to Ops service: %w", err)
	}

	return &OpsClient{
		grpcConn: conn,
		client:   opsv1.NewOpsServiceClient(conn),
	}, nil
}

// CreateSession creates a new session in Ops service
func (c *OpsClient) CreateSession(ctx context.Context, hostID, sessionType string) (*Session, error) {
	req := &opsv1.CreateSessionRequest{
		Name: fmt.Sprintf("session-%s", uuid.New().String()[:8]),
		Metadata: map[string]string{
			"host_id":     hostID,
			"session_type": sessionType,
		},
	}

	resp, err := c.client.CreateSession(ctx, req)
	if err != nil {
		return nil, fmt.Errorf("failed to create session: %w", err)
	}

	session := resp.Session
	return &Session{
		ID:        session.Id,
		Name:      session.Name,
		UserID:    session.UserId,
		Status:    session.Status,
		CreatedAt: time.Unix(session.CreatedAt, 0),
	}, nil
}

// ExecuteBatch executes a command on multiple hosts
func (c *OpsClient) ExecuteBatch(ctx context.Context, name, command string, hosts []string) (*Task, error) {
	commands := make([]*opsv1.BatchCommand, len(hosts))
	for i, host := range hosts {
		commands[i] = &opsv1.BatchCommand{
			Command: command,
		}
		_ = host // In real impl, would use host-specific command
	}

	req := &opsv1.ExecuteBatchRequest{
		SessionId: uuid.New().String(),
		Commands:  commands,
	}

	resp, err := c.client.ExecuteBatch(ctx, req)
	if err != nil {
		return nil, fmt.Errorf("failed to execute batch: %w", err)
	}

	if len(resp.Tasks) == 0 {
		return nil, fmt.Errorf("no tasks returned")
	}

	t := resp.Tasks[0]
	task := &Task{
		ID:        t.Id,
		Name:      name,
		Command:   t.Command,
		Status:    t.Status,
		HostIDs:   hosts,
		CreatedAt: time.Unix(t.CreatedAt, 0),
	}

	if t.StartedAt > 0 {
		startedAt := time.Unix(t.StartedAt, 0)
		task.StartedAt = &startedAt
	}
	if t.FinishedAt > 0 {
		completedAt := time.Unix(t.FinishedAt, 0)
		task.CompletedAt = &completedAt
	}

	return task, nil
}

// GetTaskResults retrieves task execution results
func (c *OpsClient) GetTaskResults(ctx context.Context, taskID string) ([]TaskResult, error) {
	req := &opsv1.GetTaskResultsRequest{
		SessionId: taskID,
	}

	resp, err := c.client.GetTaskResults(ctx, req)
	if err != nil {
		return nil, fmt.Errorf("failed to get task results: %w", err)
	}

	results := make([]TaskResult, len(resp.Results))
	for i, r := range resp.Results {
		results[i] = TaskResult{
			TaskID:    r.TaskId,
			ExitCode:  int(r.ExitCode),
			Output:    r.Stdout,
			Error:     r.Stderr,
			Status:    r.Metadata["status"],
			DurationMs: 0,
		}
		if hostID, ok := r.Metadata["host_id"]; ok {
			results[i].HostID = hostID
		}
		if hostName, ok := r.Metadata["host_name"]; ok {
			results[i].HostName = hostName
		}
		if hostIP, ok := r.Metadata["host_ip"]; ok {
			results[i].HostIP = hostIP
		}
	}

	return results, nil
}

// Close closes the gRPC connection
func (c *OpsClient) Close() error {
	if c.grpcConn != nil {
		return c.grpcConn.Close()
	}
	return nil
}