//go:build ignore
// ============================================================
// SNMP Transport — 网络设备采集底层
// ============================================================
//
// 设计参考:
//   - NeatLogic CMDB 采集 (Perl SNMP 脚本)
//   - RFC 3411 SNMPv3, RFC 1905 SNMPv2c
//   - github.com/golang/snmp 标准库
//
// 职责:
//   - 封装 SNMP 连接/查询/超时/重试
//   - 提供 Get/BulkGet 等核心方法
//   - 处理 SNMP ErrorStatus
//
// 厂商覆盖: Cisco/Huawei/H3C/Juniper 均通过此层采集
package transport

import (
	"context"
	"fmt"
	"log/slog"
	"net"
	"time"

	"github.com/golang/snmp"
)

// ============================================================
// SNMP 配置
// ============================================================

// SNMPConfig SNMP 连接配置
type SNMPConfig struct {
	Target     string `yaml:"target"`
	Port       int    `yaml:"port"`          // 默认 161
	Community  string `yaml:"community"`     // v1/v2c 共同体字符串
	Version    int    `yaml:"version"`       // 1=SNMPv1, 2=SNMPv2c, 3=SNMPv3
	Timeout    int    `yaml:"timeout"`       // 超时秒数，默认 5
	Retries    int    `yaml:"retries"`       // 重试次数，默认 3
	MaxOids    int    `yaml:"max_oids"`      // 单次查询最大 OID 数
	RetriesDelay int `yaml:"retries_delay"`  // 重试间隔秒数

	// SNMPv3 认证
	UserName   string `yaml:"user_name"`
	AuthPass   string `yaml:"auth_pass"`
	PrivPass   string `yaml:"priv_pass"`
	AuthProto  string `yaml:"auth_proto"` // MD5/SHA
	PrivProto  string `yaml:"priv_proto"` // DES/AES
}

// DefaultSNMPConfig 默认 SNMP 配置
func DefaultSNMPConfig() *SNMPConfig {
	return &SNMPConfig{
		Port:        161,
		Version:     2, // SNMPv2c
		Timeout:     5,
		Retries:     3,
		RetriesDelay: 1,
	}
}

// Validate 校验 SNMP 配置
func (c *SNMPConfig) Validate() error {
	if c.Target == "" {
		return fmt.Errorf("snmp target is required")
	}
	if c.Version < 1 || c.Version > 3 {
		return fmt.Errorf("invalid snmp version: %d", c.Version)
	}
	if c.Timeout <= 0 {
		c.Timeout = 5
	}
	if c.Retries < 0 {
		c.Retries = 0
	}
	return nil
}

// NetAddr 返回网络地址
func (c *SNMPConfig) NetAddr() string {
	if c.Port == 0 {
		c.Port = 161
	}
	return fmt.Sprintf("%s:%d", c.Target, c.Port)
}

// ============================================================
// SNMPCl 客户端封装
// ============================================================

// SNMPCl SNMP 客户端
type SNMPCl struct {
	config *SNMPConfig
	conn   *snmp.Conn
}

// NewSNMPCl 创建 SNMP 客户端
func NewSNMPCl(config *SNMPConfig) (*SNMPCl, error) {
	if err := config.Validate(); err != nil {
		return nil, fmt.Errorf("invalid snmp config: %w", err)
	}
	return &SNMPCl{config: config}, nil
}

// connect 建立 SNMP 连接
func (c *SNMPCl) connect(ctx context.Context) error {
	conn, err := snmp.Open(&snmp.TCP, c.config.NetAddr(), c.config.Community)
	if err != nil {
		return fmt.Errorf("snmp connect failed: %w", err)
	}
	c.conn = conn

	// 设置超时
	deadline, ok := ctx.Deadline()
	if ok {
		conn.Timeout = time.Until(deadline)
	} else {
		conn.Timeout = time.Duration(c.config.Timeout) * time.Second
	}

	return nil
}

// Close 关闭 SNMP 连接
func (c *SNMPCl) Close() {
	if c.conn != nil {
		c.conn.Close()
		c.conn = nil
	}
}

// Get 执行 SNMP GET 查询
func (c *SNMPCl) Get(ctx context.Context, oids []string) ([]snmp.SnmpValue, error) {
	slog.Debug("snmp get", "oids", oids, "target", c.config.NetAddr())

	// TODO: 实现 SNMPv3 认证模式
	// TODO: 实现自动重试逻辑

	values, err := c.conn.Get(oids, snmp.Context{
		ContextName: "",
	})
	if err != nil {
		return nil, fmt.Errorf("snmp get failed: %w", err)
	}
	return values, nil
}

// BulkGet 执行 SNMP GETBULK 查询 (v2c/v3)
func (c *SNMPCl) BulkGet(ctx context.Context, nonRepeaters int, maxRepetitions int, oids []string) ([]snmp.SnmpValue, error) {
	slog.Debug("snmp bulk get", "oids", oids, "max_repetitions", maxRepetitions)

	if c.config.Version < 2 {
		return nil, fmt.Errorf("bulk get requires SNMPv2c or v3")
	}

	values, err := c.conn.BulkGet(nonRepeaters, maxRepetitions, oids)
	if err != nil {
		return nil, fmt.Errorf("snmp bulk get failed: %w", err)
	}
	return values, nil
}

// Walk 执行 SNMP WALK (遍历子树)
func (c *SNMPCl) Walk(ctx context.Context, rootOid string, callback func(snmp.PDU) error) error {
	slog.Debug("snmp walk", "root_oid", rootOid, "target", c.config.NetAddr())

	var err error
	err = c.connect(ctx)
	if err != nil {
		return err
	}

	pdus, err := c.conn.Walk(rootOid, func(pdu snmp.PDU) bool {
		if err := callback(pdu); err != nil {
			return false
		}
		return true
	})
	return err
}

// Ping 探测目标是否可达 (SNMP Echo)
func (c *SNMPCl) Ping(ctx context.Context) (bool, error) {
	slog.Debug("snmp ping", "target", c.config.NetAddr())

	var reachable bool
	var err error

	for i := 0; i <= c.config.Retries; i++ {
		// 尝试解析目标地址
		addr := c.config.NetAddr()
		_, portErr := net.ResolveTCPAddr("tcp", addr)
		if portErr != nil {
			err = portErr
			break
		}

		// SNMP 探测：GET sysUpTime.0
		_, err = c.Get(ctx, []string{"1.3.6.1.2.1.1.3.0"})
		if err == nil {
			reachable = true
			break
		}

		if i < c.config.Retries {
			time.Sleep(time.Duration(c.config.RetriesDelay) * time.Second)
		}
	}

	if !reachable {
		return false, fmt.Errorf("snmp target %s unreachable: %w", c.config.NetAddr(), err)
	}
	return true, nil
}

// ============================================================
// OID 注册表 — 厂商特定 OID 管理
// ============================================================

// OIDTable OID 映射表
type OIDTable struct {
	Name   string `yaml:"name"`
	Object string `yaml:"object"`
	OID    string `yaml:"oid"`
	Type   string `yaml:"type"` // string/int64/uint64/ipAddr
}

// VendorOIDRegistry 厂商 OID 注册表
type VendorOIDRegistry struct {
	Name    string        `yaml:"name"`
	Vendor  string        `yaml:"vendor"`
	Categories map[string][]OIDTable `yaml:"categories"`
}

// GetOID 从注册表中查找 OID
func (r *VendorOIDRegistry) GetOID(category, name string) string {
	if cat, ok := r.Categories[category]; ok {
		for _, oid := range cat {
			if oid.Name == name {
				return oid.OID
			}
		}
	}
	return ""
}

// DefaultVendorOIDs 默认厂商 OID 注册表
var DefaultVendorOIDs = map[string]*VendorOIDRegistry{
	"cisco": {
		Name:   "Cisco IOS",
		Vendor: "cisco",
		Categories: map[string][]OIDTable{
            // 系统信息
			"system": {
                {Name: "sysName", OID: "1.3.6.1.2.1.1.5.0", Type: "string"},
                {Name: "sysDescr", OID: "1.3.6.1.2.1.1.1.0", Type: "string"},
                {Name: "sysUpTime", OID: "1.3.6.1.2.1.1.3.0", Type: "int64"},
                {Name: "sysObjectID", OID: "1.3.6.1.2.1.1.2.0", Type: "string"},
            },
            // 接口信息
			"interface": {
                {Name: "ifName", OID: "1.3.6.1.2.1.31.1.1.1.1", Type: "string"},
                {Name: "ifDescr", OID: "1.3.6.1.2.1.2.2.1.2", Type: "string"},
                {Name: "ifType", OID: "1.3.6.1.2.1.2.2.1.3", Type: "int64"},
                {Name: "ifSpeed", OID: "1.3.6.1.2.1.2.2.1.5", Type: "int64"},
                {Name: "ifOperStatus", OID: "1.3.6.1.2.1.2.2.1.8", Type: "int64"},
            },
        },
	},
	"huawei": {
		Name:   "Huawei VRP",
		Vendor: "huawei",
		Categories: map[string][]OIDTable{
            "system": {
                {Name: "sysName", OID: "1.3.6.1.2.1.1.5.0", Type: "string"},
                {Name: "sysDescr", OID: "1.3.6.1.2.1.1.1.0", Type: "string"},
                {Name: "sysUpTime", OID: "1.3.6.1.2.1.1.3.0", Type: "int64"},
            },
        },
	},
}

// GetVendorOIDs 获取厂商 OID 注册表
func GetVendorOIDs(vendor string) *VendorOIDRegistry {
	return DefaultVendorOIDs[vendor]
}
