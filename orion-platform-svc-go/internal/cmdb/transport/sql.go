//go:build ignore
// ============================================================
// SQL Transport — 数据库采集底层
// ============================================================
//
// 设计参考:
//   - NeatLogic CMDB 采集 (远程 DB 采集, Perl DBI)
//   - database/sql 标准库
//
// 职责:
//   - 封装多数据库连接池管理
//   - 提供统一的 SQL 查询/批量查询接口
//   - 处理数据库方言 (MySQL/Oracle/PostgreSQL)
//   - 实现连接池/超时/重试
//
// 厂商覆盖: MySQL/Oracle/PostgreSQL 均通过此层采集
package transport

import (
	"context"
	"database/sql"
	"fmt"
	"log/slog"
	"strings"
	"sync"
	"time"

	_ "github.com/go-sql-driver/mysql"
	_ "github.com/jackc/pgx/v5/stdlib"
	_ "github.com/lib/pq"
)

// ============================================================
// 数据库方言
// ============================================================

// DBDialect 数据库方言枚举
type DBDialect string

const (
	DBDialectMySQL      DBDialect = "mysql"
	DBDialectOracle     DBDialect = "oracle"
	DBDialectPostgreSQL DBDialect = "postgresql"
)

// DBDriverName 数据库驱动名映射
func (d DBDialect) DriverName() string {
	switch d {
	case DBDialectMySQL:
		return "mysql"
	case DBDialectOracle:
		return "oracle" // github.com/go-goose/oracledb
	case DBDialectPostgreSQL:
		return "pgx" // github.com/jackc/pgx/v5/stdlib
	default:
		return "mysql"
	}
}

// DSNBuilder DSN 构建器
// 格式: {username}:{password}@tcp({host}:{port})/{database}?charset=utf8mb4&parseTime=True&loc=Local
type DSNBuilder struct {
	Dialect  DBDialect
	Host     string
	Port     int
	Username string
	Password string
	Database string
	Charset  string
	Timeout  time.Duration
}

// DSN 构建连接字符串
func (b *DSNBuilder) DSN() string {
	switch b.Dialect {
	case DBDialectMySQL:
		return fmt.Sprintf(
			"%s:%s@tcp(%s:%d)/%s?charset=%s&parseTime=true&loc=Local&timeout=%s&readTimeout=%s&writeTimeout=%s",
			b.Username, b.Password, b.Host, b.Port, b.Database,
			b.Charset, b.Timeout, b.Timeout, b.Timeout,
		)
	case DBDialectPostgreSQL:
		// pgx 格式: postgres://user:pass@host:port/database?sslmode=disable
		return fmt.Sprintf(
			"postgres://%s:%s@%s:%d/%s?sslmode=disable&connect_timeout=%d",
			b.Username, b.Password, b.Host, b.Port, b.Database,
			int(b.Timeout.Seconds()),
		)
	case DBDialectOracle:
		// oracle 格式: user/pass@//host:port/service_name
		return fmt.Sprintf(
			"%s/%s@//%s:%d/%s",
			b.Username, b.Password, b.Host, b.Port, b.Database,
		)
	default:
		return ""
	}
}

// ============================================================
// SQLConfig SQL 连接配置
// ============================================================

// SQLConfig SQL 采集配置
type SQLConfig struct {
	Dialect  DBDialect `yaml:"dialect"`
	Host     string    `yaml:"host"`
	Port     int       `yaml:"port"`
	Username string    `yaml:"username"`
	Password string    `yaml:"password"`
	Database string    `yaml:"database"`
	Charset  string    `yaml:"charset"`

	// 连接池配置
	MaxOpenConns   int `yaml:"max_open_conns"`
	MaxIdleConns   int `yaml:"max_idle_conns"`
	ConnMaxLifetime int `yaml:"conn_max_lifetime"` // 秒
	ConnMaxIdleTime int `yaml:"conn_max_idle_time"` // 秒

	// 超时
	QueryTimeout int `yaml:"query_timeout"` // 秒
}

// DefaultSQLConfig 默认 SQL 配置
func DefaultSQLConfig() *SQLConfig {
	return &SQLConfig{
		Charset:          "utf8mb4",
		MaxOpenConns:     10,
		MaxIdleConns:     5,
		ConnMaxLifetime:  300, // 5 分钟
		ConnMaxIdleTime:  60,  // 1 分钟
		QueryTimeout:     30,  // 30 秒
	}
}

// Validate 校验 SQL 配置
func (c *SQLConfig) Validate() error {
	if c.Host == "" {
		return fmt.Errorf("sql host is required")
	}
	if c.Username == "" {
		return fmt.Errorf("sql username is required")
	}
	if c.Port == 0 {
		c.Port = 3306
	}
	return nil
}

// ============================================================
// SQLPool 连接池封装
// ============================================================

// SQLPool 数据库连接池
type SQLPool struct {
	db    *sql.DB
	dsn   *DSNBuilder
	mu    sync.RWMutex
}

// NewSQLPool 创建数据库连接池
func NewSQLPool(config *SQLConfig) (*SQLPool, error) {
	if err := config.Validate(); err != nil {
		return nil, fmt.Errorf("invalid sql config: %w", err)
	}

	dsn := &DSNBuilder{
		Dialect:  config.Dialect,
		Host:     config.Host,
		Port:     config.Port,
		Username: config.Username,
		Password: config.Password,
		Database: config.Database,
		Charset:  config.Charset,
		Timeout:  time.Duration(config.QueryTimeout) * time.Second,
	}

	driver := dsn.DriverName()
	db, err := sql.Open(driver, dsn.DSN())
	if err != nil {
		return nil, fmt.Errorf("sql open failed: %w", err)
	}

	// 设置连接池参数
	db.SetMaxOpenConns(config.MaxOpenConns)
	db.SetMaxIdleConns(config.MaxIdleConns)
	db.SetConnMaxLifetime(time.Duration(config.ConnMaxLifetime) * time.Second)
	db.SetConnMaxIdleTime(time.Duration(config.ConnMaxIdleTime) * time.Second)

	return &SQLPool{db: db, dsn: dsn}, nil
}

// Ping 探测数据库连接
func (p *SQLPool) Ping(ctx context.Context) (bool, error) {
	slog.Debug("sql ping", "dialect", p.dsn.Dialect, "host", p.dsn.Host)

	deadline, ok := ctx.Deadline()
	if ok {
		if err := p.db.PingContext(ctx); err != nil {
			return false, fmt.Errorf("sql ping failed: %w", err)
		}
		return true, nil
	}
	if err := p.db.Ping(); err != nil {
		return false, fmt.Errorf("sql ping failed: %w", err)
	}
	return true, nil
}

// Close 关闭连接池
func (p *SQLPool) Close() {
	p.mu.Lock()
	defer p.mu.Unlock()
	if p.db != nil {
		p.db.Close()
		p.db = nil
	}
}

// Query 执行 SQL 查询，返回原始 rows
func (p *SQLPool) Query(ctx context.Context, sql string, args ...any) ([]map[string]any, error) {
	p.mu.RLock()
	defer p.mu.RUnlock()

	if p.db == nil {
		return nil, fmt.Errorf("database pool is closed")
	}

	// 设置查询超时
	queryCtx := ctx
	if queryCtx == nil {
		queryCtx = context.Background()
	}

	rows, err := p.db.QueryContext(queryCtx, sql, args...)
	if err != nil {
		return nil, fmt.Errorf("sql query failed: %w", err)
	}
	defer rows.Close()

	// 获取列名
	columns, err := rows.Columns()
	if err != nil {
		return nil, fmt.Errorf("sql columns failed: %w", err)
	}

	result := make([]map[string]any, 0)
	for rows.Next() {
		values := make([]any, len(columns))
		valuePtrs := make([]any, len(columns))
		for i := range columns {
			valuePtrs[i] = &values[i]
		}
		if err := rows.Scan(valuePtrs...); err != nil {
			return nil, fmt.Errorf("sql scan failed: %w", err)
		}
		row := make(map[string]any)
		for i, col := range columns {
			row[col] = values[i]
		}
		result = append(result, row)
	}
	return result, nil
}

// QueryRow 执行单行 SQL 查询
func (p *SQLPool) QueryRow(ctx context.Context, sql string, args ...any) (map[string]any, error) {
	rows, err := p.Query(ctx, sql, args...)
	if err != nil {
		return nil, err
	}
	if len(rows) == 0 {
		return nil, fmt.Errorf("no rows returned")
	}
	return rows[0], nil
}

// ============================================================
// 数据库厂商 SQL 模板
// ============================================================

// DBSQLTemplates 数据库 SQL 模板集合
type DBSQLTemplates struct {
	Name           string `yaml:"name"`
	Dialect        DBDialect `yaml:"dialect"`
	SelectVersion  string   `yaml:"select_version"`
	SelectDBName   string   `yaml:"select_db_name"`
	SelectUser     string   `yaml:"select_user"`
	SelectTables   string   `yaml:"select_tables"`
	SelectStatus   string   `yaml:"select_status"`
}

// DefaultDBSQLTemplates 默认数据库 SQL 模板
var DefaultDBSQLTemplates = map[DBDialect]*DBSQLTemplates{
	DBDialectMySQL: {
		Name:        "MySQL",
		Dialect:     DBDialectMySQL,
		SelectVersion: "SELECT VERSION() AS version",
		SelectDBName:  "SELECT DATABASE() AS database_name",
		SelectUser:    "SELECT USER() AS user, HOST() AS host",
		SelectTables:  "SELECT TABLE_SCHEMA, TABLE_NAME, TABLE_ROWS, DATA_LENGTH, INDEX_LENGTH, CREATE_TIME, UPDATE_TIME FROM information_schema.TABLES WHERE TABLE_SCHEMA NOT IN ('mysql', 'information_schema', 'performance_schema', 'sys')",
		SelectStatus:  "SHOW STATUS",
	},
	DBDialectPostgreSQL: {
		Name:        "PostgreSQL",
		Dialect:     DBDialectPostgreSQL,
		SelectVersion: "SELECT version() AS version",
		SelectDBName:  "SELECT current_database() AS database_name",
		SelectUser:    "SELECT current_user AS user, inet_server_addr() AS host",
		SelectTables:  "SELECT schemaname, tablename, n_tup_ins, n_tup_upd, n_tup_del, last_vacuum, last_autovacuum FROM pg_stat_user_tables",
		SelectStatus:  "SELECT name, setting, unit FROM pg_settings WHERE category LIKE 'Statistics%' AND short_desc IS NOT NULL",
	},
	DBDialectOracle: {
		Name:        "Oracle",
		Dialect:     DBDialectOracle,
		SelectVersion: "SELECT BANNER FROM V$VERSION WHERE ROWNUM = 1",
		SelectDBName:  "SELECT NAME FROM V$DATABASE",
		SelectUser:    "SELECT SYS_CONTEXT('USERENV', 'CURRENT_USER') AS user FROM DUAL",
		SelectTables:  "SELECT OWNER, TABLE_NAME, NUM_ROWS, BLOCKS, LAST_ANALYZED FROM DBA_TABLES WHERE OWNER NOT IN ('SYS', 'SYSTEM', 'SYSMAN')",
		SelectStatus:  "SELECT NAME, VALUE FROM V$SYSTEM_PARAMETER WHERE NAME LIKE '%timeout%' OR NAME LIKE '%max%' ORDER BY NAME",
	},
}

// GetDBSQLTemplates 获取数据库 SQL 模板
func GetDBSQLTemplates(dialect DBDialect) *DBSQLTemplates {
	return DefaultDBSQLTemplates[dialect]
}

// SafeSQLQuery 安全 SQL 查询 (防止 SQL 注入)
func SafeSQLQuery(sql string, params ...any) (string, []any) {
	// TODO: 实现 SQL 参数化，防止 SQL 注入
	// 当前使用 database/sql 的参数化查询，天然防注入
	// 但需要在上层确保:
	//   1. 所有用户输入都使用参数化
	//   2. 不拼接动态表名/列名
	//   3. 使用预编译语句
	return sql, params
}

// NormalizeIdentifier 规范化标识符 (表名/列名)
func NormalizeIdentifier(name string) string {
	// 移除空格和特殊字符，转小写
	name = strings.TrimSpace(name)
	name = strings.ToLower(name)
	// 只保留字母、数字、下划线
	result := strings.Builder{}
	for _, r := range name {
		if (r >= 'a' && r <= 'z') || (r >= '0' && r <= '9') || r == '_' {
			result.WriteRune(r)
		}
	}
	return result.String()
}
