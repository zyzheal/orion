module orion-cmdb-svc-go

go 1.25

require (
	github.com/ClickHouse/clickhouse-go/v2 v2.27.0 // indirect — 预留
	github.com/go-playground/validator/v10 v10.20.0
	github.com/go-sql-driver/mysql v1.8.1
	github.com/golang/snmp v0.0.0-20230905022622-79f2db2d3c2e
	github.com/jackc/pgx/v5 v5.6.0
	github.com/lib/pq v1.10.9
	github.com/oracle/go-sql-driver/v2 v2.1.0 // 使用 go-oracle-driver
	github.com/pkg/errors v0.9.1
	gopkg.in/yaml.v3 v3.0.1
	xorm.io/core v0.0.0-20231019170808-d5f3487089ff
)

// 标准库依赖:
// - database/sql (数据库连接池)
// - net/http (HTTP 健康检查)
// - sync (并发安全工厂)
// - context (超时控制)
// - fmt / strings / log/slog
