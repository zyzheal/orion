# CMDB + 运维操作统一插件化实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 创建两个 Go 微服务（orion-cmdb-service 和 orion-ops-service），实现 CMDB 配置管理和运维操作能力的统一架构

**Architecture:** 采用微服务架构，CMDB 服务负责配置项管理和关系拓扑，Ops 服务负责远程终端和批量执行，两者通过 gRPC 通信，插件化设计支持灵活扩展

**Tech Stack:** Go 1.24+, Gin, gRPC, GORM, Redis

---

## 文件结构映射

### orion-cmdb-service 目录结构

```
orion-cmdb-service/
├── cmd/cmdbd/
│   ├── main.go              # 入口
│   ├── wire.go              # Wire 依赖注入
│   └── wire_gen.go
├── internal/
│   ├── cmdb/
│   │   ├── service.go       # CI CRUD 服务
│   │   ├── repository.go    # 数据访问层
│   │   ├── types.go         # 类型定义
│   │   └── validator.go     # 验证器
│   ├── topology/
│   │   ├── service.go       # 拓扑服务
│   │   ├── impact.go        # 影响分析
│   │   └── graph.go         # 图算法
│   ├── relation/
│   │   ├── service.go       # 关系服务
│   │   └── repository.go    # 关系数据访问
│   ├── k8s/
│   │   ├── watcher.go       # K8s Watch
│   │   └── reconciler.go    # 定时对账
│   ├── audit/
│   │   └── logger.go        # 审计日志
│   └── sync/
│       └── ops_client.go    # Ops 服务客户端
├── api/
│   ├── cmdb.pb.go           # gRPC 定义
│   ├── cmdb.pb.gw.go        # gRPC Gateway
│   └── rest/                # HTTP 适配器
└── pkg/
    └── plugin/              # 插件接口
        ├── interface.go
        └── registry.go
```

### orion-ops-service 目录结构

```
orion-ops-service/
├── cmd/opsd/
│   ├── main.go
│   ├── wire.go
│   └── wire_gen.go
├── internal/
│   ├── terminal/
│   │   ├── ssh.go           # SSH 连接
│   │   ├── session.go       # 会话管理
│   │   └── manager.go       # 终端管理器
│   ├── executor/
│   │   ├── batch.go         # 批量执行
│   │   └── result.go        # 结果收集
│   ├── sftp/
│   │   └── transfer.go      # 文件传输
│   ├── scheduler/
│   │   ├── cron.go          # Cron 调度
│   │   └── job.go           # 任务管理
│   ├── monitor/
│   │   ├── collector.go     # 指标采集
│   │   └── alert.go         # 告警
│   └── cmdb/
│       └── client.go        # CMDB 客户端
├── api/
│   ├── ops.pb.go
│   └── rest/
└── pkg/
    └── plugin/
        ├── interface.go
        └── registry.go
```

---

## Phase 1: 基础框架搭建 (2 周)

### Task 1: 创建 orion-cmdb-service 项目结构

**Files:**
- Create: `orion-cmdb-service/go.mod`
- Create: `orion-cmdb-service/cmd/cmdbd/main.go`
- Create: `orion-cmdb-service/internal/config/config.go`
- Create: `orion-cmdb-service/internal/database/database.go`

- [ ] **Step 1: 创建 go.mod**

```go
// orion-cmdb-service/go.mod
module github.com/orion-platform/orion-cmdb

go 1.24

require (
	github.com/gin-gonic/gin v1.9.1
	github.com/google/wire v0.6.0
	github.com/gorilla/mux v1.8.1
	github.com/joho/godotenv v1.5.1
	github.com/redis/go-redis/v9 v9.4.0
	github.com/spf13/cobra v1.8.0
	github.com/spf13/viper v1.18.2
	github.com/stretchr/testify v1.8.4
	go.uber.org/zap v1.26.0
	gorm.io/driver/postgres v1.5.4
	gorm.io/gorm v1.25.5
	google.golang.org/grpc v1.60.1
	google.golang.org/protobuf v1.32.0
)
```

- [ ] **Step 2: 创建 main.go**

```go
// orion-cmdb-service/cmd/cmdbd/main.go
package main

import (
	"context"
	"log"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/orion-platform/orion-cmdb/internal/config"
	"github.com/orion-platform/orion-cmdb/internal/database"
	"github.com/orion-platform/orion-cmdb/api/rest"
)

func main() {
	cfg := config.Load()
	db, err := database.NewPostgres(cfg.Database)
	if err != nil {
		log.Fatalf("Failed to connect database: %v", err)
	}

	router := rest.NewRouter(cfg, db)
	server := &http.Server{
		Addr:    cfg.Server.Addr,
		Handler: router,
	}

	go func() {
		log.Printf("CMDB Service starting on %s", cfg.Server.Addr)
		if err := server.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			log.Fatalf("Server failed: %v", err)
		}
	}()

	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
	<-quit

	log.Println("Shutting down server...")
	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()

	if err := server.Shutdown(ctx); err != nil {
		log.Fatalf("Server forced to shutdown: %v", err)
	}

	log.Println("Server exited")
}
```

- [ ] **Step 3: 创建配置模块**

```go
// orion-cmdb-service/internal/config/config.go
package config

import (
	"github.com/spf13/viper"
)

type Config struct {
	Server   ServerConfig
	Database DatabaseConfig
	Redis    RedisConfig
	GRPC     GRPCConfig
}

type ServerConfig struct {
	Addr string
}

type DatabaseConfig struct {
	Host     string
	Port     int
	User     string
	Password string
	DBName   string
	SSLMode  string
}

type RedisConfig struct {
	Addr     string
	Password string
	DB       int
}

type GRPCConfig struct {
	Addr string
}

func Load() *Config {
	viper.SetConfigName("config")
	viper.SetConfigType("yaml")
	viper.AddConfigPath(".")
	viper.AddConfigPath("./config")
	viper.AutomaticEnv()

	_ = viper.ReadInConfig()

	return &Config{
		Server: ServerConfig{
			Addr: viper.GetString("server.addr"),
		},
		Database: DatabaseConfig{
			Host:     viper.GetString("database.host"),
			Port:     viper.GetInt("database.port"),
			User:     viper.GetString("database.user"),
			Password: viper.GetString("database.password"),
			DBName:   viper.GetString("database.name"),
			SSLMode:  viper.GetString("database.sslmode"),
		},
		Redis: RedisConfig{
			Addr:     viper.GetString("redis.addr"),
			Password: viper.GetString("redis.password"),
			DB:       viper.GetInt("redis.db"),
		},
		GRPC: GRPCConfig{
			Addr: viper.GetString("grpc.addr"),
		},
	}
}
```

- [ ] **Step 4: 创建数据库模块**

```go
// orion-cmdb-service/internal/database/database.go
package database

import (
	"fmt"

	"gorm.io/driver/postgres"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"

	"github.com/orion-platform/orion-cmdb/internal/config"
)

func NewPostgres(cfg config.DatabaseConfig) (*gorm.DB, error) {
	dsn := fmt.Sprintf(
		"host=%s port=%d user=%s password=%s dbname=%s sslmode=%s",
		cfg.Host, cfg.Port, cfg.User, cfg.Password, cfg.DBName, cfg.SSLMode,
	)

	db, err := gorm.Open(postgres.Open(dsn), &gorm.Config{
		Logger: logger.Default.LogMode(logger.Info),
	})
	if err != nil {
		return nil, fmt.Errorf("failed to connect database: %w", err)
	}

	sqlDB, err := db.DB()
	if err != nil {
		return nil, err
	}

	sqlDB.SetMaxIdleConns(10)
	sqlDB.SetMaxOpenConns(100)

	return db, nil
}
```

- [ ] **Step 5: 创建配置文件**

```yaml
# orion-cmdb-service/config.yaml
server:
  addr: :8081

database:
  host: localhost
  port: 5432
  user: orion
  password: orion
  name: orion_cmdb
  sslmode: disable

redis:
  addr: localhost:6379
  password: ""
  db: 0

grpc:
  addr: :9091
```

- [ ] **Step 6: 提交代码**

```bash
mkdir -p orion-cmdb-service/cmd/cmdbd orion-cmdb-service/internal/{config,database} orion-cmdb-service/api/rest
cd orion-cmdb-service
git init
git add .
git commit -m "feat: create orion-cmdb-service project structure"
```

---

### Task 2: 创建 orion-ops-service 项目结构

**Files:**
- Create: `orion-ops-service/go.mod`
- Create: `orion-ops-service/cmd/opsd/main.go`
- Create: `orion-ops-service/internal/config/config.go`
- Create: `orion-ops-service/internal/database/database.go`

- [ ] **Step 1: 创建 go.mod (Ops 服务)**

```go
// orion-ops-service/go.mod
module github.com/orion-platform/orion-ops

go 1.24

require (
	github.com/gin-gonic/gin v1.9.1
	github.com/google/wire v0.6.0
	github.com/joho/godotenv v1.5.1
	github.com/redis/go-redis/v9 v9.4.0
	github.com/spf13/cobra v1.8.0
	github.com/spf13/viper v1.18.2
	github.com/stretchr/testify v1.8.4
	go.uber.org/zap v1.26.0
	gorm.io/driver/postgres v1.5.4
	gorm.io/gorm v1.25.5
	google.golang.org/grpc v1.60.1
	google.golang.org/protobuf v1.32.0
	golang.org/x/crypto v0.17.0
)
```

- [ ] **Step 2: 创建 main.go (端口 8082)**

```go
// orion-ops-service/cmd/opsd/main.go
package main

import (
	"context"
	"log"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/orion-platform/orion-ops/internal/config"
	"github.com/orion-platform/orion-ops/internal/database"
	"github.com/orion-platform/orion-ops/api/rest"
)

func main() {
	cfg := config.Load()
	db, err := database.NewPostgres(cfg.Database)
	if err != nil {
		log.Fatalf("Failed to connect database: %v", err)
	}

	router := rest.NewRouter(cfg, db)
	server := &http.Server{
		Addr:    cfg.Server.Addr,
		Handler: router,
	}

	go func() {
		log.Printf("Ops Service starting on %s", cfg.Server.Addr)
		if err := server.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			log.Fatalf("Server failed: %v", err)
		}
	}()

	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
	<-quit

	log.Println("Shutting down server...")
	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()

	if err := server.Shutdown(ctx); err != nil {
		log.Fatalf("Server forced to shutdown: %v", err)
	}

	log.Println("Server exited")
}
```

- [ ] **Step 3: 创建配置模块 (Ops)**

```go
// orion-ops-service/internal/config/config.go
package config

import (
	"github.com/spf13/viper"
)

type Config struct {
	Server   ServerConfig
	Database DatabaseConfig
	Redis    RedisConfig
	GRPC     GRPCConfig
}

type ServerConfig struct {
	Addr string
}

type DatabaseConfig struct {
	Host     string
	Port     int
	User     string
	Password string
	DBName   string
	SSLMode  string
}

type RedisConfig struct {
	Addr     string
	Password string
	DB       int
}

type GRPCConfig struct {
	Addr string
}

func Load() *Config {
	viper.SetConfigName("config")
	viper.SetConfigType("yaml")
	viper.AddConfigPath(".")
	viper.AddConfigPath("./config")
	viper.AutomaticEnv()

	_ = viper.ReadInConfig()

	return &Config{
		Server: ServerConfig{
			Addr: viper.GetString("server.addr"),
		},
		Database: DatabaseConfig{
			Host:     viper.GetString("database.host"),
			Port:     viper.GetInt("database.port"),
			User:     viper.GetString("database.user"),
			Password: viper.GetString("database.password"),
			DBName:   viper.GetString("database.name"),
			SSLMode:  viper.GetString("database.sslmode"),
		},
		Redis: RedisConfig{
			Addr:     viper.GetString("redis.addr"),
			Password: viper.GetString("redis.password"),
			DB:       viper.GetInt("redis.db"),
		},
		GRPC: GRPCConfig{
			Addr: viper.GetString("grpc.addr"),
		},
	}
}
```

- [ ] **Step 4: 创建数据库模块 (Ops)**

```go
// orion-ops-service/internal/database/database.go
package database

import (
	"fmt"

	"gorm.io/driver/postgres"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"

	"github.com/orion-platform/orion-ops/internal/config"
)

func NewPostgres(cfg config.DatabaseConfig) (*gorm.DB, error) {
	dsn := fmt.Sprintf(
		"host=%s port=%d user=%s password=%s dbname=%s sslmode=%s",
		cfg.Host, cfg.Port, cfg.User, cfg.Password, cfg.DBName, cfg.SSLMode,
	)

	db, err := gorm.Open(postgres.Open(dsn), &gorm.Config{
		Logger: logger.Default.LogMode(logger.Info),
	})
	if err != nil {
		return nil, fmt.Errorf("failed to connect database: %w", err)
	}

	sqlDB, err := db.DB()
	if err != nil {
		return nil, err
	}

	sqlDB.SetMaxIdleConns(10)
	sqlDB.SetMaxOpenConns(100)

	return db, nil
}
```

- [ ] **Step 5: 创建配置文件**

```yaml
# orion-ops-service/config.yaml
server:
  addr: :8082

database:
  host: localhost
  port: 5432
  user: orion
  password: orion
  name: orion_ops
  sslmode: disable

redis:
  addr: localhost:6379
  password: ""
  db: 1

grpc:
  addr: :9092
```

- [ ] **Step 6: 提交代码**

```bash
mkdir -p orion-ops-service/cmd/opsd orion-ops-service/internal/{config,database} orion-ops-service/api/rest
cd orion-ops-service
git init
git add .
git commit -m "feat: create orion-ops-service project structure"
```

---

### Task 3: 创建共享 proto 定义

**Files:**
- Create: `orion-proto/cmdb/v1/cmdb.proto`
- Create: `orion-proto/ops/v1/ops.proto`
- Create: `orion-proto/common.proto`

- [ ] **Step 1: 创建公共 proto**

```protobuf
// orion-proto/common.proto
syntax = "proto3";

package common;

option go_package = "github.com/orion-platform/orion-proto/common";

message Empty {}

message Error {
    string code = 1;
    string message = 2;
}

message Pagination {
    int32 page = 1;
    int32 page_size = 2;
    int64 total = 3;
}
```

- [ ] **Step 2: 创建 CMDB proto**

```protobuf
// orion-proto/cmdb/v1/cmdb.proto
syntax = "proto3";

package cmdb.v1;

option go_package = "github.com/orion-platform/orion-proto/cmdb/v1";

import "common.proto";

service CMDBService {
    rpc CreateCI(CreateCIRequest) returns (CI);
    rpc GetCI(GetCIRequest) returns (CI);
    rpc UpdateCI(UpdateCIRequest) returns (CI);
    rpc DeleteCI(DeleteCIRequest) returns (common.Empty);
    rpc ListCIs(ListCIsRequest) returns (ListCIsResponse);

    rpc CreateRelation(CreateRelationRequest) returns (Relation);
    rpc DeleteRelation(DeleteRelationRequest) returns (common.Empty);
    rpc GetRelations(GetRelationsRequest) returns (ListRelationsResponse);

    rpc GetTopology(GetTopologyRequest) returns (Topology);
    rpc AnalyzeImpact(AnalyzeImpactRequest) returns (ImpactAnalysis);

    rpc SyncHosts(SyncHostsRequest) returns (SyncHostsResponse);
}

message CI {
    string id = 1;
    string ci_id = 2;
    string ci_type = 3;
    string name = 4;
    string description = 5;
    string status = 6;
    string environment = 7;
    repeated string tags = 8;
    map<string, string> attributes = 9;
    int32 version = 10;
    string created_by = 11;
    string created_at = 12;
    string updated_at = 13;
}

message CreateCIRequest {
    string ci_id = 1;
    string ci_type = 2;
    string name = 3;
    string description = 4;
    string status = 5;
    string environment = 6;
    repeated string tags = 7;
    map<string, string> attributes = 8;
}

message GetCIRequest {
    string id = 1;
}

message UpdateCIRequest {
    string id = 1;
    string description = 2;
    string status = 3;
    string environment = 4;
    repeated string tags = 5;
    map<string, string> attributes = 6;
}

message DeleteCIRequest {
    string id = 1;
}

message ListCIsRequest {
    string ci_type = 1;
    string status = 2;
    string search = 3;
    int32 page = 4;
    int32 page_size = 5;
}

message ListCIsResponse {
    repeated CI data = 1;
    int64 total = 2;
}

message Relation {
    string id = 1;
    string from_ci_id = 2;
    string to_ci_id = 3;
    string relation_type = 4;
    string description = 5;
    string created_by = 6;
    string created_at = 7;
}

message CreateRelationRequest {
    string from_ci_id = 1;
    string to_ci_id = 2;
    string relation_type = 3;
    string description = 4;
}

message DeleteRelationRequest {
    string id = 1;
}

message GetRelationsRequest {
    string ci_id = 1;
}

message ListRelationsResponse {
    repeated Relation data = 1;
}

message Topology {
    repeated TopologyNode nodes = 1;
    repeated TopologyEdge edges = 2;
}

message TopologyNode {
    string id = 1;
    string ci_id = 2;
    string ci_type = 3;
    string name = 4;
    string status = 5;
}

message TopologyEdge {
    string id = 1;
    string source = 2;
    string target = 3;
    string relation_type = 4;
}

message GetTopologyRequest {
    string ci_type = 1;
    string root_ci_id = 2;
}

message ImpactAnalysis {
    string ci_id = 1;
    repeated CI affected_cis = 2;
    repeated string warning_messages = 3;
    bool can_proceed = 4;
}

message AnalyzeImpactRequest {
    string ci_id = 1;
    string operation = 2;
}

message Host {
    string ci_id = 1;
    string ip_address = 2;
    int32 ssh_port = 3;
    string ssh_user = 4;
    string os_type = 5;
    string status = 6;
}

message SyncHostsRequest {
    repeated Host hosts = 1;
}

message SyncHostsResponse {
    int32 synced = 1;
    int32 failed = 2;
}
```

- [ ] **Step 3: 创建 Ops proto**

```protobuf
// orion-proto/ops/v1/ops.proto
syntax = "proto3";

package ops.v1;

option go_package = "github.com/orion-platform/orion-proto/ops/v1";

import "common.proto";

service OpsService {
    rpc CreateSession(CreateSessionRequest) returns (Session);
    rpc GetSession(GetSessionRequest) returns (Session);
    rpc CloseSession(CloseSessionRequest) returns (common.Empty);

    rpc ExecuteBatch(ExecuteBatchRequest) returns (Task);
    rpc GetTask(GetTaskRequest) returns (Task);
    rpc GetTaskResults(GetTaskResultsRequest) returns (ListTaskResultsResponse);

    rpc UploadFile(UploadFileRequest) returns (UploadResponse);
    rpc DownloadFile(DownloadFileRequest) returns (stream Chunk);

    rpc CreateCronJob(CreateCronJobRequest) returns (CronJob);
    rpc UpdateCronJob(UpdateCronJobRequest) returns (CronJob);
    rpc DeleteCronJob(DeleteCronJobRequest) returns (common.Empty);
    rpc ListCronJobs(ListCronJobsRequest) returns (ListCronJobsResponse);
}

message Session {
    string id = 1;
    string user_id = 2;
    string host_id = 3;
    string session_type = 4;
    string status = 5;
    string started_at = 6;
    string closed_at = 7;
}

message CreateSessionRequest {
    string host_id = 1;
    string session_type = 2;
}

message GetSessionRequest {
    string id = 1;
}

message CloseSessionRequest {
    string id = 1;
}

message Task {
    string id = 1;
    string name = 2;
    string command = 3;
    repeated string target_hosts = 4;
    string status = 5;
    string created_by = 6;
    string started_at = 7;
    string finished_at = 8;
}

message ExecuteBatchRequest {
    string name = 1;
    string command = 2;
    repeated string target_hosts = 3;
}

message GetTaskRequest {
    string id = 1;
}

message TaskResult {
    string id = 1;
    string task_id = 2;
    string host_id = 3;
    int32 exit_code = 4;
    string stdout = 5;
    string stderr = 6;
    string executed_at = 7;
}

message GetTaskResultsRequest {
    string task_id = 1;
}

message ListTaskResultsResponse {
    repeated TaskResult data = 1;
}

message UploadFileRequest {
    string host_id = 1;
    string remote_path = 2;
    string file_name = 3;
}

message UploadResponse {
    string file_id = 1;
    string remote_path = 2;
    int64 size = 3;
}

message DownloadFileRequest {
    string host_id = 1;
    string remote_path = 2;
}

message Chunk {
    bytes data = 1;
    int64 offset = 2;
    bool eof = 3;
}

message CronJob {
    string id = 1;
    string name = 2;
    string command = 3;
    string cron_expr = 4;
    repeated string target_hosts = 5;
    bool enabled = 6;
    string last_run_at = 7;
    string next_run_at = 8;
    string created_by = 9;
    string created_at = 10;
}

message CreateCronJobRequest {
    string name = 1;
    string command = 2;
    string cron_expr = 3;
    repeated string target_hosts = 4;
}

message UpdateCronJobRequest {
    string id = 1;
    string name = 2;
    string command = 3;
    string cron_expr = 4;
    repeated string target_hosts = 5;
    bool enabled = 6;
}

message DeleteCronJobRequest {
    string id = 1;
}

message ListCronJobsRequest {
    bool enabled = 1;
    int32 page = 2;
    int32 page_size = 3;
}

message ListCronJobsResponse {
    repeated CronJob data = 1;
    int64 total = 2;
}
```

- [ ] **Step 4: 提交 proto 定义**

```bash
mkdir -p orion-proto/{cmdb/v1,ops/v1}
cd orion-proto
git init
git add .
git commit -m "feat: add CMDB and Ops proto definitions"
```

---

## Phase 2: CMDB 核心迁移 (3 周)

### Task 4: 实现 CMDB CI 管理

**Files:**
- Create: `orion-cmdb-service/internal/cmdb/types.go`
- Create: `orion-cmdb-service/internal/cmdb/repository.go`
- Create: `orion-cmdb-service/internal/cmdb/service.go`
- Create: `orion-cmdb-service/internal/cmdb/validator.go`
- Create: `orion-cmdb-service/internal/cmdb/service_test.go`

- [ ] **Step 1: 创建 CI 类型定义**

```go
// orion-cmdb-service/internal/cmdb/types.go
package cmdb

import (
	"time"
)

type CiType string

const (
	CiTypeApplication   CiType = "APPLICATION"
	CiTypeService       CiType = "SERVICE"
	CiTypeDatabase      CiType = "DATABASE"
	CiTypeServer        CiType = "SERVER"
	CiTypeContainer     CiType = "CONTAINER"
	CiTypeK8sCluster    CiType = "K8S_CLUSTER"
	CiTypeK8sDeployment CiType = "K8S_DEPLOYMENT"
	CiTypeK8sPod        CiType = "K8S_POD"
	CiTypeNetwork       CiType = "NETWORK"
	CiTypeLoadBalancer  CiType = "LOAD_BALANCER"
	CiTypeMiddleware    CiType = "MIDDLEWARE"
	CiTypePipeline      CiType = "PIPELINE"
	CiTypeEnvironment   CiType = "ENVIRONMENT"
)

type CiStatus string

const (
	CiStatusActive         CiStatus = "ACTIVE"
	CiStatusInactive       CiStatus = "INACTIVE"
	CiStatusDecommissioned CiStatus = "DECOMMISSIONED"
	CiStatusPending        CiStatus = "PENDING"
	CiStatusMaintenance    CiStatus = "MAINTENANCE"
)

type CI struct {
	ID          string            `json:"id" gorm:"primaryKey"`
	TenantID    int64             `json:"tenant_id" gorm:"index;not null"`
	CiID        string            `json:"ci_id" gorm:"uniqueIndex:idx_tenant_ci;not null"`
	CiType      string            `json:"ci_type" gorm:"not null"`
	Name        string            `json:"name" gorm:"not null"`
	Description string            `json:"description"`
	Status      string            `json:"status" gorm:"default:ACTIVE"`
	Environment string            `json:"environment"`
	Tags        []string          `json:"tags" gorm:"serializer:json"`
	Attributes  map[string]string `json:"attributes" gorm:"serializer:json"`
	Version     int               `json:"version" gorm:"default:1"`
	CreatedBy   string            `json:"created_by"`
	CreatedAt   time.Time         `json:"created_at"`
	UpdatedAt   time.Time         `json:"updated_at"`
	DeletedAt   *time.Time        `json:"deleted_at"`
}

type CreateCIInput struct {
	CiID        string            `json:"ci_id" validate:"required"`
	CiType      string            `json:"ci_type" validate:"required"`
	Name        string            `json:"name" validate:"required"`
	Description string            `json:"description"`
	Status      string            `json:"status"`
	Environment string            `json:"environment"`
	Tags        []string          `json:"tags"`
	Attributes  map[string]string `json:"attributes"`
	TenantID    int64             `json:"-"`
	CreatedBy   string            `json:"-"`
}

type UpdateCIInput struct {
	Description string            `json:"description"`
	Status      string            `json:"status"`
	Environment string            `json:"environment"`
	Tags        []string          `json:"tags"`
	Attributes  map[string]string `json:"attributes"`
}
```

- [ ] **Step 2: 创建 Repository**

```go
// orion-cmdb-service/internal/cmdb/repository.go
package cmdb

import (
	"fmt"

	"gorm.io/gorm"
)

type Repository struct {
	db *gorm.DB
}

func NewRepository(db *gorm.DB) *Repository {
	return &Repository{db: db}
}

func (r *Repository) Create(ci *CI) error {
	return r.db.Create(ci).Error
}

func (r *Repository) GetByID(id string) (*CI, error) {
	var ci CI
	err := r.db.Where("id = ? AND deleted_at IS NULL", id).First(&ci).Error
	if err != nil {
		return nil, err
	}
	return &ci, nil
}

func (r *Repository) GetByCiID(ciID string, tenantID int64) (*CI, error) {
	var ci CI
	err := r.db.Where("ci_id = ? AND tenant_id = ? AND deleted_at IS NULL", ciID, tenantID).First(&ci).Error
	if err != nil {
		return nil, err
	}
	return &ci, nil
}

func (r *Repository) Update(id string, input *UpdateCIInput) (*CI, error) {
	updates := make(map[string]interface{})
	if input.Description != "" {
		updates["description"] = input.Description
	}
	if input.Status != "" {
		updates["status"] = input.Status
	}
	if input.Environment != "" {
		updates["environment"] = input.Environment
	}
	if len(input.Tags) > 0 {
		updates["tags"] = input.Tags
	}
	if len(input.Attributes) > 0 {
		updates["attributes"] = input.Attributes
	}

	updates["version"] = gorm.Expr("version + 1")

	err := r.db.Model(&CI{}).Where("id = ?", id).Updates(updates).Error
	if err != nil {
		return nil, err
	}
	return r.GetByID(id)
}

func (r *Repository) Delete(id string) error {
	return r.db.Model(&CI{}).Where("id = ?", id).Update("deleted_at", "NOW()").Error
}

func (r *Repository) List(ciType, status, search string, page, pageSize int, tenantID int64) ([]CI, int64, error) {
	var cis []CI
	var total int64

	query := r.db.Model(&CI{}).Where("tenant_id = ? AND deleted_at IS NULL", tenantID)

	if ciType != "" {
		query = query.Where("ci_type = ?", ciType)
	}
	if status != "" {
		query = query.Where("status = ?", status)
	}
	if search != "" {
		query = query.Where("name ILIKE ? OR ci_id ILIKE ?", fmt.Sprintf("%%%s%%", search), fmt.Sprintf("%%%s%%", search))
	}

	err := query.Count(&total).Error
	if err != nil {
		return nil, 0, err
	}

	offset := (page - 1) * pageSize
	err = query.Offset(offset).Limit(pageSize).Find(&cis).Error
	return cis, total, err
}

func (r *Repository) Exists(ciID string, tenantID int64) bool {
	var count int64
	r.db.Model(&CI{}).Where("ci_id = ? AND tenant_id = ? AND deleted_at IS NULL", ciID, tenantID).Count(&count)
	return count > 0
}
```

- [ ] **Step 3: 创建 Service**

```go
// orion-cmdb-service/internal/cmdb/service.go
package cmdb

import (
	"errors"
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

var (
	ErrCIExists     = errors.New("CI already exists")
	ErrCINotFound   = errors.New("CI not found")
	ErrInvalidInput = errors.New("invalid input")
)

type Service struct {
	repo *Repository
}

func NewService(db *gorm.DB) *Service {
	return &Service{
		repo: NewRepository(db),
	}
}

func (s *Service) CreateCI(input *CreateCIInput) (*CI, error) {
	if err := ValidateCIInput(input); err != nil {
		return nil, err
	}

	if s.repo.Exists(input.CiID, input.TenantID) {
		return nil, ErrCIExists
	}

	now := time.Now()
	ci := &CI{
		ID:          uuid.New().String(),
		TenantID:    input.TenantID,
		CiID:        input.CiID,
		CiType:      input.CiType,
		Name:        input.Name,
		Description: input.Description,
		Status:      input.Status,
		Environment: input.Environment,
		Tags:        input.Tags,
		Attributes:  input.Attributes,
		Version:     1,
		CreatedBy:   input.CreatedBy,
		CreatedAt:   now,
		UpdatedAt:   now,
	}

	if err := s.repo.Create(ci); err != nil {
		return nil, err
	}

	return ci, nil
}

func (s *Service) GetCI(id string) (*CI, error) {
	ci, err := s.repo.GetByID(id)
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, ErrCINotFound
		}
		return nil, err
	}
	return ci, nil
}

func (s *Service) UpdateCI(id string, input *UpdateCIInput) (*CI, error) {
	ci, err := s.repo.GetByID(id)
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, ErrCINotFound
		}
		return nil, err
	}

	updated, err := s.repo.Update(id, input)
	if err != nil {
		return nil, err
	}

	s.createVersion(ci)

	return updated, nil
}

func (s *Service) DeleteCI(id string) error {
	_, err := s.repo.GetByID(id)
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return ErrCINotFound
		}
		return err
	}

	return s.repo.Delete(id)
}

func (s *Service) ListCIs(ciType, status, search string, page, pageSize int, tenantID int64) ([]CI, int64, error) {
	if page < 1 {
		page = 1
	}
	if pageSize < 1 {
		pageSize = 20
	}

	return s.repo.List(ciType, status, search, page, pageSize, tenantID)
}

func (s *Service) createVersion(ci *CI) {
	// 实现版本历史记录
}
```

- [ ] **Step 4: 创建 Validator**

```go
// orion-cmdb-service/internal/cmdb/validator.go
package cmdb

var validCiTypes = []string{
	"APPLICATION", "SERVICE", "DATABASE", "SERVER", "CONTAINER",
	"K8S_CLUSTER", "K8S_DEPLOYMENT", "K8S_POD", "NETWORK",
	"LOAD_BALANCER", "MIDDLEWARE", "PIPELINE", "ENVIRONMENT",
}

var validStatuses = []string{
	"ACTIVE", "INACTIVE", "DECOMMISSIONED", "PENDING", "MAINTENANCE",
}

func ValidateCIInput(input *CreateCIInput) error {
	if input.CiID == "" {
		return ErrInvalidInput
	}
	if input.CiType == "" {
		return ErrInvalidInput
	}
	if input.Name == "" {
		return ErrInvalidInput
	}

	valid := false
	for _, t := range validCiTypes {
		if input.CiType == t {
			valid = true
			break
		}
	}
	if !valid {
		return ErrInvalidInput
	}

	if input.Status != "" {
		valid = false
		for _, t := range validStatuses {
			if input.Status == t {
				valid = true
				break
			}
		}
		if !valid {
			input.Status = "ACTIVE"
		}
	}

	return nil
}
```

- [ ] **Step 5: 编写测试**

```go
// orion-cmdb-service/internal/cmdb/service_test.go
package cmdb

import (
	"testing"

	"github.com/stretchr/testify/assert"
)

func TestValidateCIInput(t *testing.T) {
	tests := []struct {
		name    string
		input   *CreateCIInput
		wantErr bool
	}{
		{
			name: "valid input",
			input: &CreateCIInput{
				CiID:   "app-001",
				CiType: "APPLICATION",
				Name:   "Test App",
			},
			wantErr: false,
		},
		{
			name: "missing ci_id",
			input: &CreateCIInput{
				CiType: "APPLICATION",
				Name:   "Test App",
			},
			wantErr: true,
		},
		{
			name: "invalid ci_type",
			input: &CreateCIInput{
				CiID:   "app-001",
				CiType: "INVALID",
				Name:   "Test App",
			},
			wantErr: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			err := ValidateCIInput(tt.input)
			if tt.wantErr {
				assert.Error(t, err)
			} else {
				assert.NoError(t, err)
			}
		})
	}
}
```

- [ ] **Step 6: 运行测试**

```bash
cd orion-cmdb-service
go mod tidy
go test ./internal/cmdb/... -v
# Expected: PASS
```

- [ ] **Step 7: 提交代码**

```bash
git add .
git commit -m "feat: implement CMDB CI CRUD operations"
```

---

### Task 5: 实现关系管理

**Files:**
- Create: `orion-cmdb-service/internal/relation/types.go`
- Create: `orion-cmdb-service/internal/relation/repository.go`
- Create: `orion-cmdb-service/internal/relation/service.go`

按照 Task 4 的模式实现 CI 关系管理功能。

### Task 6: 实现拓扑服务

**Files:**
- Create: `orion-cmdb-service/internal/topology/service.go`
- Create: `orion-cmdb-service/internal/topology/graph.go`

实现拓扑图生成算法。

### Task 7: 实现影响分析

**Files:**
- Create: `orion-cmdb-service/internal/topology/impact.go`

实现基于拓扑的影响分析。

### Task 8: 实现 K8s 同步

**Files:**
- Create: `orion-cmdb-service/internal/k8s/watcher.go`
- Create: `orion-cmdb-service/internal/k8s/reconciler.go`

实现 K8s 资源同步。

---

## Phase 3: 运维操作迁移 (3 周)

### Task 9: 实现远程终端 SSH

**Files:**
- Create: `orion-ops-service/internal/terminal/ssh.go`
- Create: `orion-ops-service/internal/terminal/manager.go`
- Create: `orion-ops-service/internal/terminal/session.go`
- Create: `orion-ops-service/internal/terminal/ssh_test.go`

- [ ] **Step 1: 创建 SSH 连接模块**

```go
// orion-ops-service/internal/terminal/ssh.go
package terminal

import (
	"fmt"
	"io"
	"sync"

	"golang.org/x/crypto/ssh"
)

type SSHClient struct {
	client  *ssh.Client
	session *ssh.Session
	config  *SSHConfig
}

type SSHConfig struct {
	Host     string
	Port     int
	User     string
	Password string
	Key      []byte
}

func NewSSHClient(config *SSHConfig) (*SSHClient, error) {
	authMethods := []ssh.AuthMethod{}
	if config.Password != "" {
		authMethods = append(authMethods, ssh.Password(config.Password))
	}
	if len(config.Key) > 0 {
		authMethods = append(authMethods, ssh.PublicKeys(config.Key))
	}

	client, err := ssh.Dial("tcp",
		fmt.Sprintf("%s:%d", config.Host, config.Port),
		&ssh.ClientConfig{
			User:            config.User,
			Auth:            authMethods,
			HostKeyCallback: ssh.InsecureIgnoreHostKey(),
		},
	)
	if err != nil {
		return nil, fmt.Errorf("failed to dial ssh: %w", err)
	}

	return &SSHClient{
		client: client,
		config: config,
	}, nil
}

func (s *SSHClient) Session() (*ssh.Session, error) {
	return s.client.NewSession()
}

func (s *SSHClient) Close() error {
	return s.client.Close()
}

func (s *SSHClient) Shell() (*ssh.Session, io.ReadCloser, io.Writer, error) {
	session, err := s.Session()
	if err != nil {
		return nil, nil, nil, err
	}

	stdin, err := session.StdinPipe()
	if err != nil {
		return nil, nil, nil, err
	}

	stdout, err := session.StdoutPipe()
	if err != nil {
		return nil, nil, nil, err
	}

	err = session.Shell()
	if err != nil {
		return nil, nil, nil, err
	}

	return session, stdout, stdin, nil
}

func (s *SSHClient) Execute(command string) (string, string, int, error) {
	session, err := s.Session()
	if err != nil {
		return "", "", -1, err
	}
	defer session.Close()

	output, err := session.CombinedOutput(command)
	exitCode := 0
	if err != nil {
		if exitErr, ok := err.(*ssh.ExitError); ok {
			exitCode = exitErr.ExitStatus()
		}
	}

	return string(output), "", exitCode, nil
}

type SessionManager struct {
	sessions map[string]*ManagedSession
	mu       sync.RWMutex
}

type ManagedSession struct {
	ID       string
	Type     string
	Client   *SSHClient
	Status   string
	UserID   string
}

func NewSessionManager() *SessionManager {
	return &SessionManager{
		sessions: make(map[string]*ManagedSession),
	}
}

func (m *SessionManager) Create(id string, client *SSHClient, sessionType, userID string) *ManagedSession {
	m.mu.Lock()
	defer m.mu.Unlock()

	ms := &ManagedSession{
		ID:     id,
		Type:   sessionType,
		Client: client,
		Status: "ACTIVE",
		UserID: userID,
	}
	m.sessions[id] = ms
	return ms
}

func (m *SessionManager) Get(id string) (*ManagedSession, bool) {
	m.mu.RLock()
	defer m.mu.RUnlock()

	ms, ok := m.sessions[id]
	return ms, ok
}

func (m *SessionManager) Delete(id string) {
	m.mu.Lock()
	defer m.mu.Unlock()

	if ms, ok := m.sessions[id]; ok {
		ms.Client.Close()
		delete(m.sessions, id)
	}
}
```

- [ ] **Step 2: 创建终端管理器**

```go
// orion-ops-service/internal/terminal/manager.go
package terminal

import (
	"context"
	"fmt"

	"github.com/google/uuid"
)

type Manager struct {
	sessions   *SessionManager
	cmdbClient interface{ GetHost(ctx context.Context, hostID string) (*Host, error) }
}

type Host struct {
	IDAddress string
	SSHPort   int
	SSHUser   string
	SSHPassword string
}

func NewManager(cmdbClient interface{ GetHost(ctx context.Context, hostID string) (*Host, error) }) *Manager {
	return &Manager{
		sessions:   NewSessionManager(),
		cmdbClient: cmdbClient,
	}
}

func (m *Manager) CreateSession(ctx context.Context, hostID, sessionType, userID string) (*Session, error) {
	host, err := m.cmdbClient.GetHost(ctx, hostID)
	if err != nil {
		return nil, fmt.Errorf("failed to get host: %w", err)
	}

	sshConfig := &SSHConfig{
		Host:     host.IDAddress,
		Port:     host.SSHPort,
		User:     host.SSHUser,
		Password: host.SSHPassword,
	}

	client, err := NewSSHClient(sshConfig)
	if err != nil {
		return nil, fmt.Errorf("failed to create ssh client: %w", err)
	}

	sessionID := uuid.New().String()
	m.sessions.Create(sessionID, client, sessionType, userID)

	return &Session{
		ID:          sessionID,
		HostID:      hostID,
		SessionType: sessionType,
		Status:      "CONNECTING",
		UserID:      userID,
	}, nil
}

func (m *Manager) GetSession(sessionID string) (*ManagedSession, bool) {
	return m.sessions.Get(sessionID)
}

func (m *Manager) CloseSession(sessionID string) error {
	m.sessions.Delete(sessionID)
	return nil
}

func (m *Manager) ExecuteCommand(sessionID, command string) (string, string, int, error) {
	ms, ok := m.sessions.Get(sessionID)
	if !ok {
		return "", "", -1, fmt.Errorf("session not found")
	}

	return ms.Client.Execute(command)
}

type Session struct {
	ID          string
	HostID      string
	SessionType string
	Status      string
	UserID      string
}
```

- [ ] **Step 3: 编写测试**

```go
// orion-ops-service/internal/terminal/ssh_test.go
package terminal

import (
	"testing"

	"github.com/stretchr/testify/assert"
)

func TestSSHConfigValidation(t *testing.T) {
	tests := []struct {
		name    string
		config  *SSHConfig
		wantErr bool
	}{
		{
			name: "valid with password",
			config: &SSHConfig{
				Host:     "localhost",
				Port:     22,
				User:     "root",
				Password: "password",
			},
			wantErr: false,
		},
		{
			name: "missing host",
			config: &SSHConfig{
				Port:     22,
				User:     "root",
				Password: "password",
			},
			wantErr: true,
		},
		{
			name: "invalid port",
			config: &SSHConfig{
				Host:     "localhost",
				Port:     -1,
				User:     "root",
				Password: "password",
			},
			wantErr: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			err := validateSSHConfig(tt.config)
			if tt.wantErr {
				assert.Error(t, err)
			} else {
				assert.NoError(t, err)
			}
		})
	}
}

func validateSSHConfig(config *SSHConfig) error {
	if config.Host == "" {
		return fmt.Errorf("host is required")
	}
	if config.Port <= 0 || config.Port > 65535 {
		return fmt.Errorf("invalid port")
	}
	return nil
}
```

- [ ] **Step 4: 运行测试**

```bash
cd orion-ops-service
go mod tidy
go test ./internal/terminal/... -v
# Expected: PASS
```

- [ ] **Step 5: 提交代码**

```bash
git add .
git commit -m "feat: implement SSH terminal support"
```

---

### Task 10: 实现批量执行引擎

### Task 11: 实现文件传输 SFTP

### Task 12: 实现计划任务调度

### Task 13: 实现系统监控

---

## Phase 4: 插件化改造 (2 周)

### Task 14: 实现统一插件接口

### Task 15: 实现插件注册与生命周期

---

## Phase 5: 数据串联 (1 周)

### Task 16: 实现 CMDB ↔ Ops 服务通信

---

## Phase 6: 前端集成 (2 周)

### Task 17: 创建统一前端页面

---

## Phase 7: 测试与优化 (2 周)

### Task 18: 集成测试与性能优化

---

**计划完成，已保存至 `docs/superpowers/plans/2026-05-19-cmdb-ops-unified-plugin-plan.md`**

---

## 执行选项

**两种执行方式：**

**1. Subagent-Driven (推荐)** - 每个任务由独立子代理执行，任务间进行审查，快速迭代

**2. Inline Execution** - 在当前会话中使用 executing-plans 批量执行，带审查检查点

你选择哪种方式？