package service

import (
	"context"
	"database/sql"
)

type BuildService interface {
	StartBuild(ctx context.Context, repoID, branch string) (interface{}, error)
	GetBuild(ctx context.Context, id string) (interface{}, error)
	CancelBuild(ctx context.Context, id string) error
	ListBuilds(ctx context.Context, page, size int) (interface{}, error)
}

type buildServiceImpl struct {
	DB *sql.DB
}

func NewBuildService(db *sql.DB) BuildService {
	return &buildServiceImpl{DB: db}
}

func (s *buildServiceImpl) StartBuild(ctx context.Context, repoID, branch string) (interface{}, error) {
	return nil, nil
}
func (s *buildServiceImpl) GetBuild(ctx context.Context, id string) (interface{}, error) { return nil, nil }
func (s *buildServiceImpl) CancelBuild(ctx context.Context, id string) error { return nil }
func (s *buildServiceImpl) ListBuilds(ctx context.Context, page, size int) (interface{}, error) { return nil, nil }
