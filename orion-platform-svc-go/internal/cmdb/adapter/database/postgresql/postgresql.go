//go:build ignore

// ============================================================
// PostgreSQL Collector — PostgreSQL 数据库采集器
// ============================================================
//
// 设计参考:
//   - NeatLogic CMDB 采集: PostgreSQL 适配器 (Perl DBI)
//   - pg_stat* 系列视图
//
// 采集数据:
//   - 数据库版本 (SELECT version())
//   - 数据库列表 (pg_database)
//   - Schema/表信息 (pg_stat_user_tables)
//   - 用户/角色 (pg_user / pg_roles)
//   - 系统参数 (pg_settings)
//   - 连接状态 (pg_stat_activity)
//
// 采集器名称: postgresql
// 厂商: postgresql
// 类型: database
package postgresql

import (
	"context"
	"fmt"
	"log/slog"

	"orion/platform-svc-go/internal/cmdb/collector"
	"orion/platform-svc-go/internal/cmdb/collector"
	"orion/platform-svc-go/internal/cmdb/transport"
)

// ============================================================
// PostgreSQLCollector 实现
// ============================================================

// PostgreSQLCollector PostgreSQL 采集器
type PostgreSQLCollector struct {
	pool *transport.SQLPool
}

// Name 返回采集器名称
func (c *PostgreSQLCollector) Name() string { return "postgresql" }

// Vendor 返回厂商
func (c *PostgreSQLCollector) Vendor() collector.VendorType { return collector.VendorPostgreSQL }

// Type 返回类型
func (c *PostgreSQLCollector) Type() string { return "database" }

// Validate 校验配置
func (c *PostgreSQLCollector) Validate(config map[string]any) error {
	host, ok := config["host"]
	if !ok || host == "" {
		return fmt.Errorf("postgresql collector: host is required")
	}
	username, ok := config["username"]
	if !ok || username == "" {
		return fmt.Errorf("postgresql collector: username is required")
	}
	password, ok := config["password"]
	if !ok || password == "" {
		return fmt.Errorf("postgresql collector: password is required")
	}
	port, ok := config["port"]
	if !ok {
		port = 5432
	}

	slog.Debug("postgresql validate", "host", host, "port", port)
	return nil
}

// Ping 探测数据库
func (c *PostgreSQLCollector) Ping(ctx context.Context, config map[string]any) (bool, error) {
	host := config["host"].(string)
	port := 5432
	if p, ok := config["port"]; ok {
		port = p.(int)
	}
	username := config["username"].(string)
	password := config["password"].(string)
	database := config["database"].(string)
	if database == "" {
		database = "postgres"
	}

	sqlConfig := &transport.SQLConfig{
		Dialect:     transport.DBDialectPostgreSQL,
		Host:        host,
		Port:        port,
		Username:    username,
		Password:    password,
		Database:    database,
		QueryTimeout: 5,
	}

	pool, err := transport.NewSQLPool(sqlConfig)
	if err != nil {
		return false, fmt.Errorf("postgresql pool init failed: %w", err)
	}
	defer pool.Close()

	reachable, err := pool.Ping(ctx)
	if err != nil {
		return false, fmt.Errorf("postgresql ping failed: %w", err)
	}

	slog.Debug("postgresql ping result", "reachable", reachable, "host", host, "port", port)
	return reachable, nil
}

// Collect 执行采集
//
// 采集流程:
//   1. 连接数据库 (pgx 连接池)
//   2. 获取版本 (SELECT version())
//   3. 获取数据库列表 (pg_database)
//   4. 获取 schema/表信息 (pg_stat_user_tables)
//   5. 获取用户列表 (pg_user)
//   6. 获取连接状态 (pg_stat_activity)
//   7. 获取系统参数 (pg_settings)
//   8. 组装 CIRaw
func (c *PostgreSQLCollector) Collect(ctx context.Context, config map[string]any) ([]collector.CIRaw, error) {
	host := config["host"].(string)
	port := 5432
	if p, ok := config["port"]; ok {
		port = p.(int)
	}
	username := config["username"].(string)
	password := config["password"].(string)
	database := config["database"].(string)

	slog.Info("postgresql collect", "host", host, "port", port, "database", database)

	// 1. 创建连接池
	sqlConfig := &transport.SQLConfig{
		Dialect:      transport.DBDialectPostgreSQL,
		Host:         host,
		Port:         port,
		Username:     username,
		Password:     password,
		Database:     database,
		QueryTimeout: 30,
		MaxOpenConns: 5,
		MaxIdleConns: 2,
	}
	pool, err := transport.NewSQLPool(sqlConfig)
	if err != nil {
		return nil, fmt.Errorf("postgresql pool init failed: %w", err)
	}
	defer pool.Close()

	// 2. 获取 SQL 模板
	_ = transport.GetDBSQLTemplates(transport.DBDialectPostgreSQL)

	// 3. 采集版本
	versionRows, err := pool.Query(ctx, `SELECT version() AS version`)
	if err != nil {
		return nil, fmt.Errorf("postgresql version query failed: %w", err)
	}
	version := ""
	if len(versionRows) > 0 {
		if v, ok := versionRows[0]["version"]; ok {
			version = fmt.Sprintf("%v", v)
		}
	}

	// 4. 获取数据库列表
	dbList := []string{}
	if dbRows, err := pool.Query(ctx, `SELECT datname FROM pg_database WHERE datistemplate = false AND datname NOT IN ('postgres')`); err == nil {
		for _, row := range dbRows {
			if db, ok := row["datname"]; ok {
				dbList = append(dbList, fmt.Sprintf("%v", db))
			}
		}
	}

	// 5. 构建 CIRaw — 数据库实例 CI
	cis := make([]collector.CIRaw, 0)

	dbCI := collector.CIRaw{
		Name:     fmt.Sprintf("postgresql://%s:%d", host, port),
		TypeHint: collector.CITypeDatabase,
		Status:   collector.CIStatusActive,
		Attributes: map[string]any{
			"vendor": "postgresql",
			"host":   host,
			"port":   port,
			"version": version,
			"databases": dbList,
			"connection": map[string]any{
				"username": username,
				"database": database,
			},
		},
		EntityAttrs: map[string]any{
			"databases_count": len(dbList),
		},
		Tags: map[string]any{
			"tags": []string{"database", "postgresql"},
		},
	}
	cis = append(cis, dbCI)

	// 6. 为每个数据库创建 CI
	for _, dbName := range dbList {
		// 获取表信息
		tableRows, err := pool.Query(ctx,
			`SELECT schemaname, tablename, n_tup_ins, n_tup_upd, n_tup_del, last_vacuum, last_autovacuum FROM pg_stat_user_tables WHERE schemaname != 'pg_catalog' AND schemaname != 'information_schema'`,
		)
		if err != nil {
			slog.Warn("postgresql table query failed", "database", dbName, "error", err)
			continue
		}

		tables := make([]map[string]any, 0)
		for _, row := range tableRows {
			table := map[string]any{
				"schemaname":      row["schemaname"],
				"tablename":       row["tablename"],
				"tup_ins":         row["n_tup_ins"],
				"tup_upd":         row["n_tup_upd"],
				"tup_del":         row["n_tup_del"],
				"last_vacuum":     row["last_vacuum"],
				"last_autovacuum": row["last_autovacuum"],
			}
			tables = append(tables, table)
		}

		tableCI := collector.CIRaw{
			Name:     fmt.Sprintf("%s/%s", host,dbName),
			TypeHint: collector.CITypeDatabase,
			Status:   collector.CIStatusActive,
			Attributes: map[string]any{
				"vendor":        "postgresql",
				"host":          host,
				"port":          port,
				"database_name": dbName,
				"tables_count":  len(tables),
				"tables":        tables,
			},
			EntityAttrs: map[string]any{
				"parent_ci": dbCI.Name,
			},
			Relations: []model.RawRelation{
				{
					SourceCI: dbCI.Name,
					TargetCI: fmt.Sprintf("%s/%s", host, dbName),
					Type:     "contains",
				},
			},
			Tags: map[string]any{
				"tags": []string{"database", "postgresql", "schema"},
			},
		}
		cis = append(cis, tableCI)
	}

	slog.Info("postgresql collect complete", "ci_count", len(cis), "host", host, "databases", len(dbList))
	return cis, nil
}

// ============================================================
// 注册
// ============================================================

func init() {
	collector.GlobalFactory.Register(&PostgreSQLCollector{})
}

// ============================================================
// PostgreSQL 特定常量
// ============================================================

// PGView PostgreSQL 系统视图
type PGView string

const (
	PGViewDatabase        PGView = "pg_database"
	PGViewStatActivity     PGView = "pg_stat_activity"
	PGViewStatUserTables   PGView = "pg_stat_user_tables"
	PGViewUser             PGView = "pg_user"
	PGViewRoles            PGView = "pg_roles"
	PGViewSettings         PGView = "pg_settings"
	PGViewShdepend         PGView = "pg_shdepend"
	PGViewClass            PGView = "pg_class"
	PGViewAttribute        PGView = "pg_attribute"
	PGViewType             PGView = "pg_type"
	PGViewNamespace        PGView = "pg_namespace"
	PGViewConstraint       PGView = "pg_constraint"
)

// String 返回视图名
func (v PGView) String() string { return string(v) }
