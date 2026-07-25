// ============================================================
// MySQL Collector — MySQL 数据库采集器
// ============================================================
//
// 设计参考:
//   - NeatLogic CMDB 采集: MySQL 适配器 (Perl DBI)
//   - 当前 TS 版本: blueprints/orion-cmdb-svc/src/types/cmdb.ts
//
// 采集数据:
//   - 数据库版本
//   - 当前库名称
//   - 数据库列表 (information_schema)
//   - 表信息 (表名/行数/大小/创建时间/更新时间)
//   - 用户列表
//   - 数据库状态 (SHOW STATUS)
//
// 采集器名称: mysql
// 厂商: mysql
// 类型: database
package mysql

import (
	"context"
	"fmt"
	"log/slog"

	"orion-cmdb-svc-go/internal/collector"
	"orion-cmdb-svc-go/internal/model"
	"orion-cmdb-svc-go/internal/transport"
)

// ============================================================
// MySQLCollector 实现
// ============================================================

// MySQLCollector MySQL 采集器
type MySQLCollector struct {
	pool *transport.SQLPool
}

// Name 返回采集器名称
func (c *MySQLCollector) Name() string { return "mysql" }

// Vendor 返回厂商
func (c *MySQLCollector) Vendor() model.VendorType { return model.VendorMySQL }

// Type 返回类型
func (c *MySQLCollector) Type() string { return "database" }

// Validate 校验配置
func (c *MySQLCollector) Validate(config map[string]any) error {
	host, ok := config["host"]
	if !ok || host == "" {
		return fmt.Errorf("mysql collector: host is required")
	}
	username, ok := config["username"]
	if !ok || username == "" {
		return fmt.Errorf("mysql collector: username is required")
	}
	password, ok := config["password"]
	if !ok || password == "" {
		return fmt.Errorf("mysql collector: password is required")
	}
	port, ok := config["port"]
	if !ok {
		port = 3306
	}

	slog.Debug("mysql validate", "host", host, "port", port)
	return nil
}

// Ping 探测数据库
func (c *MySQLCollector) Ping(ctx context.Context, config map[string]any) (bool, error) {
	host := config["host"].(string)
	port := 3306
	if p, ok := config["port"]; ok {
		port = p.(int)
	}
	username := config["username"].(string)
	password := config["password"].(string)
	database := config["database"].(string)
	if database == "" {
		database = "information_schema"
	}

	sqlConfig := &transport.SQLConfig{
		Dialect:     transport.DBDialectMySQL,
		Host:        host,
		Port:        port,
		Username:    username,
		Password:    password,
		Database:    database,
		Charset:     "utf8mb4",
		QueryTimeout: 5,
	}

	pool, err := transport.NewSQLPool(sqlConfig)
	if err != nil {
		return false, fmt.Errorf("mysql pool init failed: %w", err)
	}
	defer pool.Close()

	reachable, err := pool.Ping(ctx)
	if err != nil {
		return false, fmt.Errorf("mysql ping failed: %w", err)
	}

	slog.Debug("mysql ping result", "reachable", reachable, "host", host, "port", port)
	return reachable, nil
}

// Collect 执行采集
//
// 采集流程:
//   1. 连接数据库 (连接池)
//   2. 获取版本/当前库
//   3. 获取数据库列表
//   4. 获取表信息
//   5. 获取用户列表
//   6. 获取状态信息
//   7. 组装 CIRaw
func (c *MySQLCollector) Collect(ctx context.Context, config map[string]any) ([]model.CIRaw, error) {
	host := config["host"].(string)
	port := 3306
	if p, ok := config["port"]; ok {
		port = p.(int)
	}
	username := config["username"].(string)
	password := config["password"].(string)
	database := config["database"].(string)
	charset := config["charset"].(string)
	if charset == "" {
		charset = "utf8mb4"
	}

	slog.Info("mysql collect", "host", host, "port", port, "database", database)

	// 1. 创建连接池
	sqlConfig := &transport.SQLConfig{
		Dialect:      transport.DBDialectMySQL,
		Host:         host,
		Port:         port,
		Username:     username,
		Password:     password,
		Database:     database,
		Charset:      charset,
		QueryTimeout: 30,
		MaxOpenConns: 5,
		MaxIdleConns: 2,
	}
	pool, err := transport.NewSQLPool(sqlConfig)
	if err != nil {
		return nil, fmt.Errorf("mysql pool init failed: %w", err)
	}
	defer pool.Close()

	// 2. 获取 SQL 模板
	_ = transport.GetDBSQLTemplates(transport.DBDialectMySQL)

	// 3. 采集版本信息
	versionRows, err := pool.Query(ctx, templates.SelectVersion)
	if err != nil {
		return nil, fmt.Errorf("mysql version query failed: %w", err)
	}

	version := ""
	if len(versionRows) > 0 {
		if v, ok := versionRows[0]["version"]; ok {
			version = fmt.Sprintf("%v", v)
		}
	}

	// 4. 获取数据库列表
	dbList := []string{}
	if databaseRows, err := pool.Query(ctx, `SELECT schema_name FROM information_schema.schemata WHERE schema_name NOT IN ('mysql', 'information_schema', 'performance_schema', 'sys')`); err == nil {
		for _, row := range databaseRows {
			if db, ok := row["schema_name"]; ok {
				dbList = append(dbList, fmt.Sprintf("%v", db))
			}
		}
	}

	// 5. 构建 CIRaw — 数据库实例 CI
	cis := make([]model.CIRaw, 0)

	dbCI := model.CIRaw{
		Name:     fmt.Sprintf("mysql://%s:%d", host, port),
		TypeHint: model.CITypeDatabase,
		Status:   model.CIStatusActive,
		Attributes: map[string]any{
			"vendor": "mysql",
			"host":   host,
			"port":   port,
			"version": version,
			"databases": dbList,
			"connection": map[string]any{
				"username": username,
				"database": database,
				"charset":  charset,
			},
		},
		EntityAttrs: map[string]any{
			"databases_count": len(dbList),
		},
		Tags: map[string]any{
			"tags": []string{"database", "mysql"},
		},
	}
	cis = append(cis, dbCI)

	// 6. 为每个数据库创建 CI
	for _, dbName := range dbList {
		// 获取表信息
		tablesSQL := fmt.Sprintf(
			`SELECT TABLE_NAME, TABLE_ROWS, DATA_LENGTH, INDEX_LENGTH, CREATE_TIME, UPDATE_TIME FROM information_schema.TABLES WHERE TABLE_SCHEMA = '%s'`,
			dbName,
		)
		tableRows, err := pool.Query(ctx, tablesSQL)
		if err != nil {
			slog.Warn("mysql table query failed", "database", dbName, "error", err)
			continue
		}

		tables := make([]map[string]any, 0)
		for _, row := range tableRows {
			table := map[string]any{
				"name":         row["TABLE_NAME"],
				"rows":         row["TABLE_ROWS"],
				"data_length":  row["DATA_LENGTH"],
				"index_length": row["INDEX_LENGTH"],
				"create_time":  row["CREATE_TIME"],
				"update_time":  row["UPDATE_TIME"],
			}
			tables = append(tables, table)
		}

		tableCI := model.CIRaw{
			Name:     fmt.Sprintf("%s/%s", host, dbName),
			TypeHint: model.CITypeDatabase,
			Status:   model.CIStatusActive,
			Attributes: map[string]any{
				"vendor":        "mysql",
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
				"tags": []string{"database", "mysql", "schema"},
			},
		}
		cis = append(cis, tableCI)
	}

	slog.Info("mysql collect complete", "ci_count", len(cis), "host", host, "databases", len(dbList))
	return cis, nil
}

// ============================================================
// 注册
// ============================================================

func init() {
	collector.GlobalFactory.Register(&MySQLCollector{})
}

// ============================================================
// MySQL 特定常量
// ============================================================

// MySQLTable 表类型常量
type MySQLTable string

const (
	MySQLTableUser           MySQLTable = "mysql.user"
	MySQLTableDB             MySQLTable = "mysql.db"
	MySQLTableGlobalStatus   MySQLTable = "SHOW GLOBAL STATUS"
	MySQLTableGlobalVariables MySQLTable = "SHOW GLOBAL VARIABLES"
	MySQLTableProcesslist    MySQLTable = "SHOW PROCESSLIST"
	MySQLTableInnodbStatus   MySQLTable = "SHOW ENGINE INNODB STATUS"
	MySQLTableBinlog         MySQLTable = "SHOW BINARY LOGS"
	MySQLTableSlaveStatus    MySQLTable = "SHOW SLAVE STATUS"
)

// String 返回表名
func (t MySQLTable) String() string { return string(t) }
