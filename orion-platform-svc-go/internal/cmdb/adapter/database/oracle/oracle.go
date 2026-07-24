//go:build ignore

// ============================================================
// Oracle Collector — Oracle 数据库采集器
// ============================================================
//
// 设计参考:
//   - NeatLogic CMDB 采集: Oracle 适配器 (Perl DBI)
//   - go-sql-driver/oracle (github.com/go-goose/oracledb)
//
// 采集数据:
//   - 数据库版本 (SELECT BANNER FROM V$VERSION)
//   - 数据库名称 (SELECT NAME FROM V$DATABASE)
//   - 表空间信息 (DBA_TABLESPACES)
//   - 表信息 (DBA_TABLES)
//   - 系统参数 (V$SYSTEM_PARAMETER)
//   - 会话信息 (V$SESSION)
//
// 采集器名称: oracle
// 厂商: oracle
// 类型: database
package oracle

import (
	"context"
	"fmt"
	"log/slog"

	"orion/platform-svc-go/internal/cmdb/collector"
	"orion/platform-svc-go/internal/cmdb/collector"
	"orion/platform-svc-go/internal/cmdb/transport"
)

// ============================================================
// OracleCollector 实现
// ============================================================

// OracleCollector Oracle 采集器
type OracleCollector struct {
	pool *transport.SQLPool
}

// Name 返回采集器名称
func (c *OracleCollector) Name() string { return "oracle" }

// Vendor 返回厂商
func (c *OracleCollector) Vendor() collector.VendorType { return collector.VendorOracle }

// Type 返回类型
func (c *OracleCollector) Type() string { return "database" }

// Validate 校验配置
func (c *OracleCollector) Validate(config map[string]any) error {
	host, ok := config["host"]
	if !ok || host == "" {
		return fmt.Errorf("oracle collector: host is required")
	}
	username, ok := config["username"]
	if !ok || username == "" {
		return fmt.Errorf("oracle collector: username is required")
	}
	password, ok := config["password"]
	if !ok || password == "" {
		return fmt.Errorf("oracle collector: password is required")
	}
	port, ok := config["port"]
	if !ok {
		port = 1521
	}
	serviceName, ok := config["service_name"]
	if !ok || serviceName == "" {
		return fmt.Errorf("oracle collector: service_name is required")
	}

	slog.Debug("oracle validate", "host", host, "port", port, "service_name", serviceName)
	return nil
}

// Ping 探测数据库
func (c *OracleCollector) Ping(ctx context.Context, config map[string]any) (bool, error) {
	host := config["host"].(string)
	port := 1521
	if p, ok := config["port"]; ok {
		port = p.(int)
	}
	username := config["username"].(string)
	password := config["password"].(string)
	serviceName := config["service_name"].(string)

	sqlConfig := &transport.SQLConfig{
		Dialect:     transport.DBDialectOracle,
		Host:        host,
		Port:        port,
		Username:    username,
		Password:    password,
		Database:    serviceName, // Oracle 用 service_name
		QueryTimeout: 5,
	}

	pool, err := transport.NewSQLPool(sqlConfig)
	if err != nil {
		return false, fmt.Errorf("oracle pool init failed: %w", err)
	}
	defer pool.Close()

	reachable, err := pool.Ping(ctx)
	if err != nil {
		return false, fmt.Errorf("oracle ping failed: %w", err)
	}

	slog.Debug("oracle ping result", "reachable", reachable, "host", host, "port", port, "service_name", serviceName)
	return reachable, nil
}

// Collect 执行采集
//
// 采集流程:
//   1. 连接数据库 (go-sql-driver/oracle)
//   2. 获取版本 (V$VERSION)
//   3. 获取数据库名 (V$DATABASE)
//   4. 获取表空间 (DBA_TABLESPACES)
//   5. 获取表信息 (DBA_TABLES)
//   6. 获取系统参数 (V$SYSTEM_PARAMETER)
//   7. 组装 CIRaw
func (c *OracleCollector) Collect(ctx context.Context, config map[string]any) ([]collector.CIRaw, error) {
	host := config["host"].(string)
	port := 1521
	if p, ok := config["port"]; ok {
		port = p.(int)
	}
	username := config["username"].(string)
	password := config["password"].(string)
	serviceName := config["service_name"].(string)

	slog.Info("oracle collect", "host", host, "port", port, "service_name", serviceName)

	// 1. 创建连接池
	sqlConfig := &transport.SQLConfig{
		Dialect:      transport.DBDialectOracle,
		Host:         host,
		Port:         port,
		Username:     username,
		Password:     password,
		Database:     serviceName,
		QueryTimeout: 30,
		MaxOpenConns: 5,
		MaxIdleConns: 2,
	}
	pool, err := transport.NewSQLPool(sqlConfig)
	if err != nil {
		return nil, fmt.Errorf("oracle pool init failed: %w", err)
	}
	defer pool.Close()

	// 2. 获取 SQL 模板
	_ = transport.GetDBSQLTemplates(transport.DBDialectOracle)

	// 3. 采集版本
	versionRows, err := pool.Query(ctx, `SELECT BANNER FROM V$VERSION WHERE ROWNUM = 1`)
	if err != nil {
		return nil, fmt.Errorf("oracle version query failed: %w", err)
	}
	version := ""
	if len(versionRows) > 0 {
		if v, ok := versionRows[0]["BANNER"]; ok {
			version = fmt.Sprintf("%v", v)
		}
	}

	// 4. 获取数据库名
	dbNameRows, err := pool.Query(ctx, `SELECT NAME FROM V$DATABASE`)
	if err != nil {
		return nil, fmt.Errorf("oracle db name query failed: %w", err)
	}
	dbName := ""
	if len(dbNameRows) > 0 {
		if d, ok := dbNameRows[0]["NAME"]; ok {
			databaseName := fmt.Sprintf("%v", d)
			dbName = databaseName
		}
	}

	// 5. 获取表空间信息
	tablespaceRows, err := pool.Query(ctx,
		`SELECT TABLESPACE_NAME, STATUS, CONTENTS, EXTENT_MANAGEMENT, ALLOCATION_TYPE FROM DBA_TABLESPACES WHERE TABLESPACE_NAME NOT IN ('SYSAUX', 'SYSTEM', 'UNDOTBS1')`,
	)
	if err != nil {
		slog.Warn("oracle tablespace query failed", "error", err)
	}

	tablespaces := make([]map[string]any, 0)
	for _, row := range tablespaceRows {
		ts := map[string]any{
			"tablespace_name":    row["TABLESPACE_NAME"],
			"status":             row["STATUS"],
			"contents":           row["CONTENTS"],
			"extent_management":  row["EXTENT_MANAGEMENT"],
			"allocation_type":    row["ALLOCATION_TYPE"],
		}
		tablespaces = append(tablespaces, ts)
	}

	// 6. 获取表信息
	tableRows, err := pool.Query(ctx,
		`SELECT OWNER, TABLE_NAME, NUM_ROWS, BLOCKS, LAST_ANALYZED FROM DBA_TABLES WHERE OWNER NOT IN ('SYS', 'SYSTEM', 'SYSMAN', 'DBSNMP')`,
	)
	if err != nil {
		slog.Warn("oracle table query failed", "error", err)
	}

	tables := make([]map[string]any, 0)
	for _, row := range tableRows {
		table := map[string]any{
			"owner":        row["OWNER"],
			"table_name":   row["TABLE_NAME"],
			"num_rows":     row["NUM_ROWS"],
			"blocks":       row["BLOCKS"],
			"last_analyzed": row["LAST_ANALYZED"],
		}
		tables = append(tables, table)
	}

	// 7. 构建 CIRaw — 数据库实例 CI
	cis := make([]collector.CIRaw, 0)

	dbCI := collector.CIRaw{
		Name:     fmt.Sprintf("oracle://%s:%d/%s", host, port, serviceName),
		TypeHint: collector.CITypeDatabase,
		Status:   collector.CIStatusActive,
		Attributes: map[string]any{
			"vendor":           "oracle",
			"host":             host,
			"port":             port,
			"version":          version,
			"database_name":    dbName,
			"service_name":     serviceName,
			"tablespaces_count": len(tablespaces),
			"tablespaces":      tablespaces,
			"tables_count":     len(tables),
			"tables":           tables,
			"connection":       map[string]any{
				"username":     username,
				"service_name": serviceName,
			},
		},
		EntityAttrs: map[string]any{
			"databases_count": 1,
		},
		Tags: map[string]any{
			"tags": []string{"database", "oracle"},
		},
	}
	cis = append(cis, dbCI)

	slog.Info("oracle collect complete", "ci_count", len(cis), "host", host, "database", dbName)
	return cis, nil
}

// ============================================================
// 注册
// ============================================================

func init() {
	collector.GlobalFactory.Register(&OracleCollector{})
}

// ============================================================
// Oracle 特定常量
// ============================================================

// OracleView Oracle 系统视图
type OracleView string

const (
	OracleViewVersion         OracleView = "V$VERSION"
	OracleViewDatabase        OracleView = "V$DATABASE"
	OracleViewTablespaces     OracleView = "DBA_TABLESPACES"
	OracleViewTables          OracleView = "DBA_TABLES"
	OracleViewSystemParameter OracleView = "V$SYSTEM_PARAMETER"
	OracleViewSession         OracleView = "V$SESSION"
	OracleViewInstance        OracleView = "V$INSTANCE"
	OracleViewControlfile     OracleView = "V$CONTROLFILE"
	OracleViewDatafile        OracleView = "DBA_DATA_FILES"
	OracleViewSegments        OracleView = "DBA_SEGMENTS"
	OracleViewViews           OracleView = "DBA_VIEWS"
	OracleViewIndexes         OracleView = "DBA_INDEXES"
	OracleViewConstraints     OracleView = "DBA_CONSTRAINTS"
	OracleViewUsers           OracleView = "DBA_USERS"
)

// String 返回视图名
func (v OracleView) String() string { return string(v) }
