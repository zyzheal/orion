// ============================================================
// H3C Comware Collector — H3C 网络设备采集器
// ============================================================
//
// 设计参考:
//   - NeatLogic CMDB 采集: H3C Comware 适配器 (Perl SNMP + SSH)
//   - SNMP MIB: IF-MIB, H3C 私有 MIB
//   - SSH CLI: display commands (Comware 无需 system-view)
//
// 采集数据:
//   - 设备基本信息: 型号/版本/序列号/uptime
//   - 接口信息: 名称/类型/状态/速率
//   - 邻居关系: LLDP 邻居
//   - 资源状态: CPU/内存
//
// 采集器名称: h3c_comware
// 厂商: h3c
// 类型: network
package h3c

import (
	"context"
	"fmt"
	"log/slog"

	"orion-cmdb-svc-go/internal/collector"
	"orion-cmdb-svc-go/internal/model"
	"orion-cmdb-svc-go/internal/transport"
)

// ============================================================
// H3CCollector 实现
// ============================================================

// H3CCollector H3C Comware 采集器
type H3CCollector struct {
	snmp *transport.SNMPCl
	ssh  *transport.SSHClient
}

// Name 返回采集器名称
func (c *H3CCollector) Name() string { return "h3c_comware" }

// Vendor 返回厂商
func (c *H3CCollector) Vendor() model.VendorType { return model.VendorH3C }

// Type 返回类型
func (c *H3CCollector) Type() string { return "network" }

// Validate 校验配置
func (c *H3CCollector) Validate(config map[string]any) error {
	host, ok := config["host"]
	if !ok || host == "" {
		return fmt.Errorf("h3c collector: host is required")
	}
	community, ok := config["community"]
	if !ok || community == "" {
		return fmt.Errorf("h3c collector: community is required for SNMP")
	}
	slog.Debug("h3c validate", "host", host)
	return nil
}

// Ping 探测设备
func (c *H3CCollector) Ping(ctx context.Context, config map[string]any) (bool, error) {
	host := config["host"].(string)
	community := config["community"].(string)

	snmpConfig := &transport.SNMPConfig{
		Target:    host,
		Port:      161,
		Community: community,
		Version:   2,
		Timeout:   5,
		Retries:   2,
	}

	snmp, err := transport.NewSNMPCl(snmpConfig)
	if err != nil {
		return false, fmt.Errorf("h3c snmp init failed: %w", err)
	}
	defer snmp.Close()

	reachable, err := snmp.Ping(ctx)
	if err != nil {
		return false, fmt.Errorf("h3c snmp ping failed: %w", err)
	}

	slog.Debug("h3c ping result", "reachable", reachable, "host", host)
	return reachable, nil
}

// Collect 执行采集
func (c *H3CCollector) Collect(ctx context.Context, config map[string]any) ([]model.CIRaw, error) {
	host := config["host"].(string)
	community := config["community"].(string)
	description := config["description"].(string)

	slog.Info("h3c collect", "host", host, "description", description)

	// 1. 创建 SNMP 客户端
	snmpConfig := &transport.SNMPConfig{
		Target:    host,
		Port:      161,
		Community: community,
		Version:   2,
		Timeout:   10,
		Retries:   3,
	}
	snmp, err := transport.NewSNMPCl(snmpConfig)
	if err != nil {
		return nil, fmt.Errorf("h3c snmp init failed: %w", err)
	}
	defer snmp.Close()

	// 2. 获取厂商 OID 注册表
	oidRegistry := transport.GetVendorOIDs("h3c")
	if oidRegistry == nil {
		slog.Debug("h3c oid registry not found, using default MIB")
	}

	// 3. 构建 CIRaw
	cis := make([]model.CIRaw, 0)

	// 设备 CI
	ci := model.CIRaw{
		Name:     host,
		TypeHint: model.CITypeNetworkDevice,
		Status:   model.CIStatusActive,
		Attributes: map[string]any{
			"vendor":  "h3c",
			"platform": "h3c_comware",
			"host":    host,
			"snmp": map[string]any{
				"community": community,
				"port":      161,
				"version":   2,
			},
			"description": description,
		},
		EntityAttrs: map[string]any{
			"snmp_oid_sysDescr": "1.3.6.1.2.1.1.1.0",
		},
		Tags: map[string]any{
			"tags": []string{"network", "h3c", "comware"},
		},
	}
	cis = append(cis, ci)

	// 4. 采集接口信息 (简化示例)
	// TODO: 实现 SNMP WALK 遍历接口表

	slog.Info("h3c collect complete", "ci_count", len(cis), "host", host)
	return cis, nil
}

// ============================================================
// 注册
// ============================================================

func init() {
	collector.GlobalFactory.Register(&H3CCollector{})
}

// ============================================================
// SNMP MIB OID 常量 — H3C 专用
// ============================================================

// H3COid H3C OID 常量
type H3COid string

const (
	// 系统信息 MIB-2
	H3COidSysDescr    H3COid = "1.3.6.1.2.1.1.1.0"
	H3COidSysName     H3COid = "1.3.6.1.2.1.1.5.0"
	H3COidSysUpTime   H3COid = "1.3.6.1.2.1.1.3.0"
	H3COidSysObjectID H3COid = "1.3.6.1.2.1.1.2.0"

	// 接口信息 IF-MIB
	H3COidIfName       H3COid = "1.3.6.1.2.1.31.1.1.1.1"
	H3COidIfDescr      H3COid = "1.3.6.1.2.1.2.2.1.2"
	H3COidIfType       H3COid = "1.3.6.1.2.1.2.2.1.3"
	H3COidIfSpeed      H3COid = "1.3.6.1.2.1.2.2.1.5"
	H3COidIfOperStatus H3COid = "1.3.6.1.2.1.2.2.1.8"

	// H3C 私有 MIB — 资源状态
	H3COidCpuUsage  H3COid = "1.3.6.1.4.1.25506.2.1.1.1.1.1.3"
	H3COidMemUsage  H3COid = "1.3.6.1.4.1.25506.2.1.1.1.1.1.4"
	H3COidTemperature H3COid = "1.3.6.1.4.1.25506.2.1.1.1.1.1.5"

	// LLDP 邻居
	H3COidLldpLocalPortName   H3COid = "1.0.8802.1.1.2.1.3.1.2"
	H3COidLldpRemoteSystemName H3COid = "1.0.8802.1.1.2.1.4.1.2.1.2"
	H3COidLldpRemotePortName  H3COid = "1.0.8802.1.1.2.1.4.1.2.1.3"

	// SSH CLI 命令 — Comware
	H3CCmdDisplayVersion   = "display version"
	H3CCmdDisplayInterface = "display interface brief"
	H3CCmdDisplayLldp      = "display lldp neighbor-information"
	H3CCmdDisplayCurrent   = "display current-configuration"
	H3CCmdDisplayCPU       = "display cpu-usage"
	H3CCmdDisplayMemory    = "display memory-usage"
)

// String 返回 OID 字符串
func (o H3COid) String() string { return string(o) }

// ============================================================
// 数据解析辅助函数
// ============================================================

// ParseSNMPValue 解析 SNMP 值为 Go 类型
func ParseSNMPValue(value any) any {
	switch v := value.(type) {
	case string:
		return v
	case int64:
		return v
	case uint64:
		return v
	case []byte:
		return string(v)
	default:
		return fmt.Sprintf("%v", value)
	}
}

// ParseUptime 解析系统运行时间 (秒 -> 可读格式)
func ParseUptime(seconds int64) string {
	days := seconds / 86400
	hours := (seconds % 86400) / 3600
	minutes := (seconds % 3600) / 60
	secs := seconds % 60
	return fmt.Sprintf("%dd %dh %dm %ds", days, hours, minutes, secs)
}
