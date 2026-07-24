package repository

import (
	"context"
	"database/sql"
	"fmt"
)

type CodeRepoRepository interface {
	List(ctx context.Context) (interface{}, error)
	Create(ctx context.Context, name, url, provider, token string) (interface{}, error)
	Get(ctx context.Context, id string) (interface{}, error)
	Update(ctx context.Context, id string, data interface{}) error
	Delete(ctx context.Context, id string) error
}

type codeRepoRepositoryImpl struct {
	DB *sql.DB
}

func NewCodeRepoRepository(db *sql.DB) CodeRepoRepository {
	return &codeRepoRepositoryImpl{DB: db}
}

func (r *codeRepoRepositoryImpl) List(ctx context.Context) (interface{}, error) {
	return nil, fmt.Errorf("not implemented")
}

func (r *codeRepoRepositoryImpl) Create(ctx context.Context, name, url, provider, token string) (interface{}, error) {
	return nil, fmt.Errorf("not implemented")
}

func (r *codeRepoRepositoryImpl) Get(ctx context.Context, id string) (interface{}, error) {
	return nil, fmt.Errorf("not implemented")
}

func (r *codeRepoRepositoryImpl) Update(ctx context.Context, id string, data interface{}) error {
	return fmt.Errorf("not implemented")
}

func (r *codeRepoRepositoryImpl) Delete(ctx context.Context, id string) error {
	return fmt.Errorf("not implemented")
}
