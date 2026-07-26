package repository

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"time"

	"orion/chatops-svc-go/internal/chatops/models"
)

// ChatOpsRepository interface
type ChatOpsRepository interface {
	ExecuteCommand(ctx context.Context, command, args string) (*models.CommandResult, error)
	ListMessages(ctx context.Context) ([]models.Message, error)
	SendMessage(ctx context.Context, platform, channel, content, sender string) error
	ListConversations(ctx context.Context) ([]models.Conversation, error)
	ListPlatforms(ctx context.Context) ([]models.Platform, error)
	RegisterPlatform(ctx context.Context, name, platformType, config, tenantID string) error
	CreateConversation(ctx context.Context, name, platform, tenantID string) (*models.Conversation, error)
}

// chatOpsRepositoryImpl with PostgreSQL
type chatOpsRepositoryImpl struct {
	DB *sql.DB
}

func NewChatOpsRepository(db *sql.DB) ChatOpsRepository {
	return &chatOpsRepositoryImpl{DB: db}
}

func (r *chatOpsRepositoryImpl) ExecuteCommand(ctx context.Context, command, args string) (*models.CommandResult, error) {
	// Insert command into audit log
	now := time.Now()
	var resultID int64
	err := r.DB.QueryRowContext(ctx, `
		INSERT INTO chatops_command_log (command, args, status, created_at)
		VALUES ($1, $2, 'executed', $3)
		RETURNING id`, command, args, now).Scan(&resultID)
	if err != nil {
		return nil, fmt.Errorf("log command execution: %w", err)
	}
	return &models.CommandResult{
		Command: command,
		Output:  fmt.Sprintf("command executed, log_id=%d", resultID),
	}, nil
}

func (r *chatOpsRepositoryImpl) ListMessages(ctx context.Context) ([]models.Message, error) {
	rows, err := r.DB.QueryContext(ctx, `
		SELECT id, platform, channel, content, sender, tenant_id, created_at
		FROM chatops_messages
		ORDER BY created_at DESC
		LIMIT 100`)
	if err != nil {
		return nil, fmt.Errorf("query messages: %w", err)
	}
	defer rows.Close()

	var messages []models.Message
	for rows.Next() {
		var m models.Message
		if err := rows.Scan(&m.ID, &m.Platform, &m.Channel, &m.Content, &m.Sender, &m.TenantID, &m.CreatedAt); err != nil {
			return nil, fmt.Errorf("scan message: %w", err)
		}
		messages = append(messages, m)
	}
	return messages, nil
}

func (r *chatOpsRepositoryImpl) SendMessage(ctx context.Context, platform, channel, content, sender string) error {
	now := time.Now()
	_, err := r.DB.ExecContext(ctx, `
		INSERT INTO chatops_messages (platform, channel, content, sender, created_at)
		VALUES ($1, $2, $3, $4, $5)`, platform, channel, content, sender, now)
	return err
}

func (r *chatOpsRepositoryImpl) ListConversations(ctx context.Context) ([]models.Conversation, error) {
	rows, err := r.DB.QueryContext(ctx, `
		SELECT id, name, platform, tenant_id, created_at
		FROM chatops_conversations
		ORDER BY created_at DESC`)
	if err != nil {
		return nil, fmt.Errorf("query conversations: %w", err)
	}
	defer rows.Close()

	var convs []models.Conversation
	for rows.Next() {
		var c models.Conversation
		if err := rows.Scan(&c.ID, &c.Name, &c.Platform, &c.TenantID, &c.CreatedAt); err != nil {
			return nil, fmt.Errorf("scan conversation: %w", err)
		}
		convs = append(convs, c)
	}
	return convs, nil
}

func (r *chatOpsRepositoryImpl) ListPlatforms(ctx context.Context) ([]models.Platform, error) {
	rows, err := r.DB.QueryContext(ctx, `
		SELECT id, name, type, config, tenant_id, created_at
		FROM chatops_platforms
		ORDER BY created_at DESC`)
	if err != nil {
		return nil, fmt.Errorf("query platforms: %w", err)
	}
	defer rows.Close()

	var platforms []models.Platform
	for rows.Next() {
		var p models.Platform
		if err := rows.Scan(&p.ID, &p.Name, &p.Type, &p.Config, &p.TenantID, &p.CreatedAt); err != nil {
			return nil, fmt.Errorf("scan platform: %w", err)
		}
		platforms = append(platforms, p)
	}
	return platforms, nil
}

func (r *chatOpsRepositoryImpl) RegisterPlatform(ctx context.Context, name, platformType, config, tenantID string) error {
	now := time.Now()
	_, err := r.DB.ExecContext(ctx, `
		INSERT INTO chatops_platforms (name, type, config, tenant_id, created_at)
		VALUES ($1, $2, $3, $4, $5)`, name, platformType, config, tenantID, now)
	return err
}

func (r *chatOpsRepositoryImpl) CreateConversation(ctx context.Context, name, platform, tenantID string) (*models.Conversation, error) {
	now := time.Now()
	var id string
	err := r.DB.QueryRowContext(ctx, `
		INSERT INTO chatops_conversations (id, name, platform, tenant_id, created_at)
		VALUES (gen_random_uuid(), $1, $2, $3, $4)
		RETURNING id`, name, platform, tenantID, now).Scan(&id)
	if err != nil {
		return nil, fmt.Errorf("create conversation: %w", err)
	}
	return &models.Conversation{
		ID:        id,
		Name:      name,
		Platform:  platform,
		TenantID:  tenantID,
		CreatedAt: now,
	}, nil
}

// Ensure interface compliance
var _ ChatOpsRepository = (*chatOpsRepositoryImpl)(nil)
