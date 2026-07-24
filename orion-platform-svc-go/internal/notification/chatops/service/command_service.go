package service

import (
	"context"
	"fmt"
	"log"
	"strings"
	"time"

	"orion/platform-svc-go/internal/chatops/models"
	"orion/platform-svc-go/internal/chatops/repository"

	"github.com/google/uuid"
)

// CommandService handles command CRUD, parsing, and execution routing.
type CommandService struct {
	repo      *repository.Repository
	rateLimit *RateLimitService
	audit     *AuditService
}

func NewCommandService(repo *repository.Repository, rateLimit *RateLimitService, audit *AuditService) *CommandService {
	return &CommandService{repo: repo, rateLimit: rateLimit, audit: audit}
}

func (s *CommandService) Create(ctx context.Context, tenantID string, req models.CreateCommandRequest) (*models.ChatOpsCommand, error) {
	cmd := &models.ChatOpsCommand{
		ID:              uuid.New().String(),
		TenantID:        tenantID,
		Name:            req.Name,
		Subcommand:      req.Subcommand,
		SchemaDef:       req.SchemaDef,
		Aliases:         req.Aliases,
		PermissionLevel: req.PermissionLevel,
		Examples:        req.Examples,
		Enabled:         true,
	}
	if cmd.PermissionLevel == "" {
		cmd.PermissionLevel = "viewer"
	}
	if err := s.repo.CreateCommand(ctx, cmd); err != nil {
		return nil, err
	}
	return cmd, nil
}

func (s *CommandService) GetByName(ctx context.Context, tenantID, name string) (*models.ChatOpsCommand, error) {
	return s.repo.GetCommandByName(ctx, tenantID, name)
}

func (s *CommandService) List(ctx context.Context, tenantID string, offset, limit int) ([]models.ChatOpsCommand, error) {
	return s.repo.ListCommands(ctx, tenantID, offset, limit)
}

func (s *CommandService) Update(ctx context.Context, tenantID, id string, req models.UpdateCommandRequest) error {
	existing, err := s.repo.GetCommandByID(ctx, tenantID, id)
	if err != nil {
		return fmt.Errorf("command not found: %s", id)
	}
	if req.Subcommand != nil {
		existing.Subcommand = *req.Subcommand
	}
	if req.SchemaDef != nil {
		existing.SchemaDef = *req.SchemaDef
	}
	if req.Aliases != nil {
		existing.Aliases = *req.Aliases
	}
	if req.PermissionLevel != nil {
		existing.PermissionLevel = *req.PermissionLevel
	}
	if req.Examples != nil {
		existing.Examples = *req.Examples
	}
	if req.Enabled != nil {
		existing.Enabled = *req.Enabled
	}
	return s.repo.UpdateCommand(ctx, existing)
}

func (s *CommandService) Delete(ctx context.Context, tenantID, id string) error {
	return s.repo.DeleteCommand(ctx, tenantID, id)
}

// ParseCommand parses raw chat input into a structured ParsedCommand.
func (s *CommandService) ParseCommand(ctx context.Context, tenantID, raw string) (*models.ParsedCommand, error) {
	raw = strings.TrimSpace(raw)
	if raw == "" {
		return nil, fmt.Errorf("empty command")
	}

	parts := strings.Fields(raw)
	cmdName := strings.TrimPrefix(parts[0], "/")

	// Try direct name lookup first
	cmd, err := s.repo.GetCommandByName(ctx, tenantID, cmdName)
	if err != nil {
		// Try alias lookup
		cmd, err = s.repo.GetCommandByAlias(ctx, tenantID, cmdName)
		if err != nil {
			return &models.ParsedCommand{
				Params: parseParams(parts[1:]),
				Raw:    raw,
			}, nil // command not found, return nil command
		}
	}

	if !cmd.Enabled {
		return &models.ParsedCommand{
			Command: cmd,
			Params:  parseParams(parts[1:]),
			Raw:     raw,
		}, fmt.Errorf("command disabled: %s", cmdName)
	}

	return &models.ParsedCommand{
		Command: cmd,
		Params:  parseParams(parts[1:]),
		Raw:     raw,
	}, nil
}

// ExecuteCommand parses, checks permissions and rate limits, then executes.
func (s *CommandService) ExecuteCommand(ctx context.Context, tenantID, userID, platform, channel, raw string) (*models.CommandResult, error) {
	parsed, err := s.ParseCommand(ctx, tenantID, raw)
	if err != nil {
		return nil, err
	}
	if parsed.Command == nil {
		return &models.CommandResult{
			Command: raw,
			Output:  "Unknown command. Type /help for available commands.",
			Status:  "error",
		}, nil
	}

	// Rate limit check
	if s.rateLimit != nil {
		allowed, err := s.rateLimit.CheckRateLimit(ctx, tenantID, userID, parsed.Command.Name)
		if err != nil {
			return nil, fmt.Errorf("rate limit check failed: %w", err)
		}
		if !allowed {
			return &models.CommandResult{
				Command: parsed.Command.Name,
				Output:  "Rate limit exceeded. Please try again later.",
				Status:  "rate_limited",
			}, nil
		}
	}

	// Record execution
	exec := &models.ChatOpsExecution{
		ID:        uuid.New().String(),
		TenantID:  tenantID,
		CommandID: parsed.Command.ID,
		UserID:    userID,
		Platform:  platform,
		Channel:   channel,
		Params:    models.JSONB{},
		Status:    "running",
		StartTime: time.Now(),
		Milestones: models.JSONB{},
	}
	// Copy params
	if parsed.Params != nil {
		p := make(models.JSONB)
		for k, v := range parsed.Params {
			p[k] = v
		}
		exec.Params = p
	}
	if err := s.repo.CreateExecution(ctx, exec); err != nil {
		return nil, fmt.Errorf("create execution: %w", err)
	}

	// Build result (mock execution for now - real integrations would call actual services)
	result := &models.CommandResult{
		Command: parsed.Command.Name,
		Params:  map[string]interface{}{},
		Output:  fmt.Sprintf("Command '%s' executed successfully", parsed.Command.Name),
		Status:  "success",
	}
	for k, v := range parsed.Params {
		result.Params[k] = v
	}

	// Update execution status
	endTime := time.Now()
	exec.Status = "completed"
	exec.EndTime = &endTime
	exec.Result = models.JSONB{"output": result.Output, "status": result.Status}
	if err := s.repo.UpdateExecutionStatus(ctx, tenantID, exec.ID, "completed", &endTime, exec.Result); err != nil {
		log.Printf("command: failed to update execution status for %s: %v", exec.ID, err)
	}

	// Audit log
	if s.audit != nil {
		if err := s.audit.Log(ctx, tenantID, exec.ID, userID, parsed.Command.Name, "success", map[string]interface{}{
			"platform": platform,
			"channel":  channel,
			"params":   parsed.Params,
		}); err != nil {
			log.Printf("command: failed to write audit log for %s: %v", exec.ID, err)
		}
	}

	return result, nil
}

func parseParams(parts []string) map[string]string {
	params := make(map[string]string)
	for _, p := range parts {
		if strings.Contains(p, "=") {
			kv := strings.SplitN(p, "=", 2)
			params[kv[0]] = kv[1]
		} else if strings.HasPrefix(p, "--") {
			params[strings.TrimPrefix(p, "-")] = "true"
		}
	}
	return params
}
