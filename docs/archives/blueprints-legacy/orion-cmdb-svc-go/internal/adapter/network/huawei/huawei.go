// ============================================================
// Huawei VRP Collector — 华为网络设备采集器
// ============================================================
//
// 设计参考:
//   - NeatLogic CMDB 采集: Huawei VRP 适配器 (Perl SNMP + SSH)
//   - SNMP MIB: IF-MIB, Huawei 私有 MIB (华为设备特定 OID)
//   - SSH CLI: system-view -> display commands
//
// 采集数据:
//   - 设备基本信息: 型号/版本/序列号/uptime
//   - 接口信息: 名称/类型/状态/速率
//   - 邻居关系: LLDP 邻居
//   - 资源状态: CPU/内存
//
// 采集器名称: huawei_vrp
// 厂商: huawei
// 类型: network
package huawei

import (
	"context"
	"fmt"
	"log/slog"

	"orion-cmdb-svc-go/internal/collector"
	"orion-cmdb-svc-go/internal/model"
	"orion-cmdb-svc-go/internal/transport"
)

// ============================================================
// HuaweiCollector 实现
// ============================================================

// HuaweiCollector 华为 VRP 采集器
type HuaweiCollector struct {
	snmp *transport.SNMPCl
	ssh  *transport.SSHClient
}

// Name 返回采集器名称
func (c *HuaweiCollector) Name() string { return "huawei_vrp" }

// Vendor 返回厂商
func (c *HuaweiCollector) Vendor() model.VendorType { return model.VendorHuawei }

// Type 返回类型
func (c *HuaweiCollector) Type() string { return "network" }

// Validate 校验配置
func (c *HuaweiCollector) Validate(config map[string]any) error {
	host, ok := config["host"]
	if !ok || host == "" {
		return fmt.Errorf("huawei collector: host is required")
	}
	community, ok := config["community"]
	if !ok || community == "" {
		return fmt.Errorf("huawei collector: community is required for SNMP")
	}
	slog.Debug("huawei validate", "host", host)
	return nil
}

// Ping 探测设备
func (c *HuaweiCollector) Ping(ctx context.Context, config map[string]any) (bool, error) {
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
		return false, fmt.Errorf("huawei snmp init failed: %w", err)
	}
	defer snmp.Close()

	reachable, err := snmp.Ping(ctx)
	if err != nil {
		return false, fmt.Errorf("huawei snmp ping failed: %w", err)
	}

	slog.Debug("huawei ping result", "reachable", reachable, "host", host)
	return reachable, nil
}

// Collect 执行采集
func (c *HuaweiCollector) Collect(ctx context.Context, config map[string]any) ([]model.CIRaw, error) {
	host := config["host"].(string)
	community := config["community"].(string)
	description := config["description"].(string)

	slog.Info("huawei collect", "host", host, "description", description)

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
		return nil, fmt.Errorf("huawei snmp init failed: %w", err)
	}
	defer snmp.Close()

	// 2. 获取厂商 OID 注册表
	oidRegistry := transport.GetVendorOIDs("huawei")

	// 3. 构建 CIRaw
	cis := make([]model.CIRaw, 0)

	// 设备 CI
	ci := model.CIRaw{
		Name:     host,
		TypeHint: model.CITypeNetworkDevice,
		Status:   model.CIStatusActive,
		Attributes: map[string]any{
			"vendor":  "huawei",
			"platform": "huawei_vrp",
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
			"tags": []string{"network", "huawei", "vrp"},
		},
	}
	cis = append(cis, ci)

	// 4. 采集接口信息 (简化示例)
	// TODO: 实现 SNMP WALK 遍历接口表
	// ifOIDs := oidRegistry.GetOID("interface", "ifName")

	slog.Info("huawei collect complete", "ci_count", len(cis), "host", host)
	return cis, nil
}

// ============================================================
// 注册
// ============================================================

func init() {
	collector.GlobalFactory.Register(&HuaweiCollector{})
}

// ============================================================
// SNMP MIB OID 常量 — Huawei 专用
// ============================================================

// HuaweiOid 华为 OID 常量
type HuaweiOid string

const (
	// 系统信息 MIB-2
	HuaweiOidSysDescr    HuaweiOid = "1.3.6.1.2.1.1.1.0"
	HuaweiOidSysName     HuaweiOid = "1.3.6.1.2.1.1.5.0"
	HuaweiOidSysUpTime   HuaweiOid = "1.3.6.1.2.1.1.3.0"
	HuaweiOidSysObjectID HuaweiOid = "1.3.6.1.2.1.1.2.0"

	// 接口信息 IF-MIB
	HuaweiOidIfName       HuaweiOid = "1.3.6.1.2.1.31.1.1.1.1"
	HuaweiOidIfDescr      HuaweiOid = "1.3.6.1.2.1.2.2.1.2"
	HuaweiOidIfType       HuaweiOid = "1.3.6.1.2.1.2.2.1.3"
	HuaweiOidIfSpeed      HuaweiOid = "1.3.6.1.2.1.2.2.1.5"
	HuaweiOidIfOperStatus HuaweiOid = "1.3.6.1.2.1.2.2.1.8"

	// 华为私有 MIB — 资源状态
	// 华为设备 CPU 使用率 (Huawei-MIB)
	HuaweiOidCpuUsage HuaweiOid = "1.3.6.1.4.1.2011.5.25.31.1.1.1.1.2"
	// 华为设备内存使用率
	HuaweiOidMemUsage HuaweiOid = "1.3.6.1.4.1.2011.5.25.31.1.1.1.1.3"

	// 华为设备温度
	HuaweiOidTemperature HuaweiOid = "1.3.6.1.4.1.2011.5.25.31.1.1.1.1.5"

	// LLDP 邻居
	HuaweiOidLldpLocalPortName HuaweiOid = "1.0.8802.1.1.2.1.3.1.2"
	HuaweiOidLldpRemoteSystemName HuaweiOid = "1.0.8802.1.1.2.1.4.1.2.1.2"
	HuaweiOidLldpRemotePortName HuaweiOid = "1.0.8802.1.1.2.1.4.1.2.1.3"

	// SSH CLI 命令 — VRP
	HuaweiCmdDisplayVersion   = "display version"
	HuaweiCmdDisplayInterface = "display interface brief"
	HuaweiCmdDisplayLldp      = "display lldp neighbor"
	HuaweiCmdDisplayCurrent   = "display current-configuration"
	HuaweiCmdDisplayCPU       = "display cpu-usage"
	HuaweiCmdDisplayMemory    = "display memory-usage"
)

// String 返回 OID 字符串
func (o HuaweiOid) String() string { return string(o) }

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
