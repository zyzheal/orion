package pg

import (
	"context"

	"github.com/orion-platform/orion-knowledge/log"
	"github.com/orion-platform/orion-knowledge/store/pg"
)

type MCPRepository struct {
	db     *pg.DB
	logger *log.Logger
}

func NewMCPRepository(db *pg.DB, logger *log.Logger) *MCPRepository {
	return &MCPRepository{db: db, logger: logger}
}

func (r *MCPRepository) GetMCPCallCount(ctx context.Context) (int64, error) {
	var count int64
	if err := r.db.WithContext(ctx).Table("mcp_calls").Count(&count).Error; err != nil {
		return 0, err
	}
	return count, nil
}
