package idempotency

import (
	"context"
	"database/sql"
	"encoding/json"
	"errors"
	"fmt"
	"time"
)

// PGStore PostgreSQL 幂等存储实现
// 适用于需要持久化审计的场景（如 Saga 24h 幂等）
type PGStore struct {
	db    *sql.DB
	table string
}

// NewPGStore 创建 PostgreSQL 幂等存储
// 表结构需提前创建（migrations/001_create_idempotency_tables.sql）
func NewPGStore(db *sql.DB, table string) *PGStore {
	if table == "" {
		table = "idempotency_keys"
	}
	return &PGStore{db: db, table: table}
}

// upsertSQL 插入或更新 SQL（ON CONFLICT key_id DO UPDATE）
func (s *PGStore) upsertSQL() string {
	return `
INSERT INTO ` + s.table + ` (
    key_id, path, method, tenant_id, user_id, payload_hash,
    code, body, headers, locked, locked_at, expires_at
) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
ON CONFLICT (key_id) DO UPDATE SET
    code = EXCLUDED.code,
    body = EXCLUDED.body,
    headers = EXCLUDED.headers,
    locked = EXCLUDED.locked,
    locked_at = EXCLUDED.locked_at,
    expires_at = EXCLUDED.expires_at
`
}

// Check 检查幂等键是否存在，返回缓存的响应
func (s *PGStore) Check(ctx context.Context, key Key) (*Result, error) {
	var code sql.NullInt64
	var body sql.NullString
	var headersRaw sql.NullString

	err := s.db.QueryRowContext(ctx,
		`SELECT code, body, headers FROM `+s.table+
			` WHERE key_id = $1 AND expires_at > NOW()`,
		key.ID).Scan(&code, &body, &headersRaw)

	if err != nil {
		if err == sql.ErrNoRows {
			return &Result{IsProcessed: false}, nil
		}
		return nil, err
	}

	headers := map[string]string{}
	if headersRaw.Valid {
		_ = json.Unmarshal([]byte(headersRaw.String), &headers)
	}

	return &Result{
		IsProcessed:     code.Valid && code.Int64 != 0,
		ResponseCode:    int(code.Int64),
		ResponseBody:    []byte(body.String),
		ResponseHeaders: headers,
	}, nil
}

// Lock 锁定幂等键（防并发）
// 使用 INSERT ... ON CONFLICT ... DO UPDATE ... SET locked = TRUE
func (s *PGStore) Lock(ctx context.Context, key Key) error {
	stmt := `
INSERT INTO ` + s.table + ` (
    key_id, path, method, tenant_id, user_id, payload_hash,
    code, body, headers, locked, locked_at, expires_at
) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
ON CONFLICT (key_id) DO UPDATE SET
    locked = TRUE,
    locked_at = NOW(),
        expires_at = EXCLUDED.expires_at
RETURNING code
`
	var code sql.NullInt64
	err := s.db.QueryRowContext(ctx, stmt,
		key.ID, key.Path, key.Method, key.TenantID, key.UserID, key.PayloadHash,
		sql.NullInt64{}, sql.NullString{}, sql.NullString{},
		sql.NullBool{Bool: true, Valid: true},
		time.Now(),
		time.Now().Add(time.Duration(key.TTL)*time.Second)).Scan(&code)

	if err != nil {
		return err
	}

	// 已有响应（code != 0）说明请求已处理过，直接返回缓存
	if code.Valid && code.Int64 != 0 {
		return nil
	}

	// code == 0 且 locked=TRUE，可能是另一个请求正在处理
	return ErrAlreadyProcessing
}

// Unlock 释放幂等键
func (s *PGStore) Unlock(ctx context.Context, key Key) error {
	_, err := s.db.ExecContext(ctx,
		`UPDATE `+s.table+` SET locked = FALSE, locked_at = NULL WHERE key_id = $1`,
		key.ID)
	return err
}

// StoreResponse 存储响应（请求处理完成后调用）
func (s *PGStore) StoreResponse(ctx context.Context, key Key, code int, body []byte, headers map[string]string) error {
	headersJSON, err := json.Marshal(headers)
	if err != nil {
		return errors.New("idempotency: 无法序列化响应头")
	}

	_, err = s.db.ExecContext(ctx, s.upsertSQL(),
		key.ID, key.Path, key.Method, key.TenantID, key.UserID, key.PayloadHash,
		sql.NullInt64{Int64: int64(code), Valid: true},
		sql.NullString{String: string(body), Valid: len(body) > 0},
		sql.NullString{String: string(headersJSON), Valid: true},
		sql.NullBool{Bool: false, Valid: true},
		nil,
		time.Now().Add(time.Duration(key.TTL)*time.Second))

	return err
}

// SetTTL 更新幂等键 TTL（用于 Saga 长时间事务）
func (s *PGStore) SetTTL(ctx context.Context, key Key, ttl int64) error {
	_, err := s.db.ExecContext(ctx,
		"UPDATE "+s.table+" SET expires_at = NOW() + INTERVAL '"+
			fmt.Sprintf("%d", ttl)+" seconds' WHERE key_id = $1",
		key.ID)
	return err
}
