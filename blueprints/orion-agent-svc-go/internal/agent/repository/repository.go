package repository

import (
	"context"
	"database/sql"
	"fmt"
)

type AgentRepository interface {
	Register(ctx context.Context, name, agentType, version, tags string) (interface{}, error)
	List(ctx context.Context) (interface{}, error)
	Get(ctx context.Context, id string) (interface{}, error)
	Update(ctx context.Context, id string, data interface{}) error
	Delete(ctx context.Context, id string) error
	Heartbeat(ctx context.Context, id string) error
	ListRuns(ctx context.Context, agentID string) (interface{}, error)
}

type agentRepositoryImpl struct {
	DB *sql.DB
}

func NewAgentRepository(db *sql.DB) AgentRepository {
	return &agentRepositoryImpl{DB: db}
}

func (r *agentRepositoryImpl) Register(ctx context.Context, name, agentType, version, tags string) (interface{}, error) {
	return nil, fmt.Errorf("not implemented")
}

func (r *agentRepositoryImpl) List(ctx context.Context) (interface{}, error) {
	return nil, fmt.Errorf("not implemented")
}

func (r *agentRepositoryImpl) Get(ctx context.Context, id string) (interface{}, error) {
	return nil, fmt.Errorf("not implemented")
}

func (r *agentRepositoryImpl) Update(ctx context.Context, id string, data interface{}) error {
	return fmt.Errorf("not implemented")
}

func (r *agentRepositoryImpl) Delete(ctx context.Context, id string) error {
	return fmt.Errorf("not implemented")
}

func (r *agentRepositoryImpl) Heartbeat(ctx context.Context, id string) error {
	return fmt.Errorf("not implemented")
}

func (r *agentRepositoryImpl) ListRuns(ctx context.Context, agentID string) (interface{}, error) {
	return nil, fmt.Errorf("not implemented")
}
