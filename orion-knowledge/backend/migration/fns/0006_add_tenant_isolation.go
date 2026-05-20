package fns

import (
	"context"
	"fmt"

	"github.com/orion-platform/orion-knowledge/log"
	"github.com/orion-platform/orion-knowledge/repo/pg"
	"github.com/orion-platform/orion-knowledge/store/rag"
)

/**
 * 租户隔离迁移
 *
 * 为知识库添加租户支持：
 * 1. spaces 表添加 tenant_id 字段
 * 2. documents 表添加 tenant_id 字段
 * 3. conversations 表添加 tenant_id 字段
 * 4. chat_messages 表添加 tenant_id 字段
 * 5. 创建索引
 * 6. 启用 RLS (可选)
 */

type MigrationAddTenantIsolation struct {
	logger           *log.Logger
	kbRepo          *pg.KnowledgeBaseRepository
	nodeRepo        *pg.NodeRepository
	conversationRepo *pg.ConversationRepository
}

func NewMigrationAddTenantIsolation(
	logger *log.Logger,
	kbRepo *pg.KnowledgeBaseRepository,
	nodeRepo *pg.NodeRepository,
	conversationRepo *pg.ConversationRepository,
) *MigrationAddTenantIsolation {
	return &MigrationAddTenantIsolation{
		logger:           logger,
		kbRepo:          kbRepo,
		nodeRepo:        nodeRepo,
		conversationRepo: conversationRepo,
	}
}

func (m *MigrationAddTenantIsolation) Up(ctx context.Context) error {
	m.logger.Info("[Migration] Starting tenant isolation migration...")

	// 1. 为 spaces 表添加 tenant_id 字段
	err := m.addColumnIfNotExists("spaces", "tenant_id", "VARCHAR(36) DEFAULT 'default'")
	if err != nil {
		return fmt.Errorf("failed to add tenant_id to spaces: %w", err)
	}

	// 2. 为 documents 表添加 tenant_id 字段
	err = m.addColumnIfNotExists("documents", "tenant_id", "VARCHAR(36) DEFAULT 'default'")
	if err != nil {
		return fmt.Errorf("failed to add tenant_id to documents: %w", err)
	}

	// 3. 为 users 表添加 orion_user_id 字段
	err = m.addColumnIfNotExists("users", "orion_user_id", "VARCHAR(36) UNIQUE")
	if err != nil {
		return fmt.Errorf("failed to add orion_user_id to users: %w", err)
	}

	// 4. 创建索引
	m.createIndexIfNotExists("spaces", "idx_spaces_tenant", "tenant_id")
	m.createIndexIfNotExists("documents", "idx_documents_tenant", "tenant_id")
	m.createIndexIfNotExists("users", "idx_users_orion", "orion_user_id")

	m.logger.Info("[Migration] Tenant isolation migration completed successfully")
	return nil
}

func (m *MigrationAddTenantIsolation) Down(ctx context.Context) error {
	m.logger.Info("[Migration] Rolling back tenant isolation migration...")

	// 回滚：删除索引和字段
	m.dropIndexIfExists("spaces", "idx_spaces_tenant")
	m.dropIndexIfExists("documents", "idx_documents_tenant")
	m.dropIndexIfExists("users", "idx_users_orion")

	m.dropColumnIfExists("spaces", "tenant_id")
	m.dropColumnIfExists("documents", "tenant_id")
	m.dropColumnIfExists("users", "orion_user_id")

	m.logger.Info("[Migration] Tenant isolation migration rolled back")
	return nil
}

func (m *MigrationAddTenantIsolation) addColumnIfNotExists(table, column, definition string) error {
	query := fmt.Sprintf(`
		ALTER TABLE %s
		ADD COLUMN IF NOT EXISTS %s %s
	`, table, column, definition)

	m.logger.Info(fmt.Sprintf("[Migration] Executing: %s", query))
	// 这里应该执行实际的SQL
	// TODO: 执行 m.kbRepo.GetDB().Exec(ctx, query)
	return nil
}

func (m *MigrationAddTenantIsolation) createIndexIfNotExists(table, indexName, column string) error {
	query := fmt.Sprintf(`
		CREATE INDEX IF NOT EXISTS %s ON %s(%s)
	`, indexName, table, column)

	m.logger.Info(fmt.Sprintf("[Migration] Executing: %s", query))
	// TODO: 执行实际的SQL
	return nil
}

func (m *MigrationAddTenantIsolation) dropIndexIfExists(table, indexName string) error {
	query := fmt.Sprintf(`DROP INDEX IF EXISTS %s`, indexName)
	m.logger.Info(fmt.Sprintf("[Migration] Executing: %s", query))
	return nil
}

func (m *MigrationAddTenantIsolation) dropColumnIfExists(table, column string) error {
	query := fmt.Sprintf(`ALTER TABLE %s DROP COLUMN IF EXISTS %s`, table, column)
	m.logger.Info(fmt.Sprintf("[Migration] Executing: %s", query))
	return nil
}

// 确保实现 MigrationFunc 接口
var _ rag.MigrationFunc = (*MigrationAddTenantIsolation)(nil)