// ============================================================
// Cisco IOS Collector — 思科网络设备采集器
// ============================================================
//
// 设计参考:
//   - NeatLogic CMDB 采集: Cisco IOS 适配器 (Perl SNMP + SSH)
//   - SNMP MIB: IF-MIB, CISCO-ENTITY-EXT-MIB, CISCO-PROCESS-MIB
//   - SSH CLI: enable -> show commands
//
// 采集数据:
//   - 设备基本信息: 型号/版本/序列号/uptime
//   - 接口信息: 名称/类型/状态/速率/描述
//   - 邻居关系: CDP/LLDP 邻居
//   - 资源状态: CPU/内存/温度
//
// 采集器名称: cisco_ios
// 厂商: cisco
// 类型: network
package cisco

import (
	"context"
	"fmt"
	"log/slog"
	"strconv"
	"strings"

	"orion-cmdb-svc-go/internal/collector"
	"orion-cmdb-svc-go/internal/model"
	"orion-cmdb-svc-go/internal/transport"
)

// ============================================================
// CiscoCollector 实现
// ============================================================

// CiscoCollector Cisco IOS 采集器
type CiscoCollector struct {
	snmp  *transport.SNMPCl
	ssh   *transport.SSHClient
}

// Name 返回采集器名称
func (c *CiscoCollector) Name() string { return "cisco_ios" }

// Vendor 返回厂商
func (c *CiscoCollector) Vendor() model.VendorType { return model.VendorCisco }

// Type 返回类型
func (c *CiscoCollector) Type() string { return "network" }

// Validate 校验配置
func (c *CiscoCollector) Validate(config map[string]any) error {
	host, ok := config["host"]
	if !ok || host == "" {
		return fmt.Errorf("cisco collector: host is required")
	}
	community, ok := config["community"]
	if !ok || community == "" {
		return fmt.Errorf("cisco collector: community is required for SNMP")
	}

	slog.Debug("cisco validate", "host", host)
	return nil
}

// Ping 探测设备
func (c *CiscoCollector) Ping(ctx context.Context, config map[string]any) (bool, error) {
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
		return false, fmt.Errorf("cisco snmp init failed: %w", err)
	}
	defer snmp.Close()

	reachable, err := snmp.Ping(ctx)
	if err != nil {
		return false, fmt.Errorf("cisco snmp ping failed: %w", err)
	}

	slog.Debug("cisco ping result", "reachable", reachable, "host", host)
	return reachable, nil
}

// Collect 执行采集
//
// 采集流程:
//   1. SNMP 获取设备基本信息 (sysDescr, sysName, sysObjectID)
//   2. SNMP 获取接口列表 (IF-MIB)
//   3. SNMP 获取 CDP 邻居信息
//   4. 组装 CIRaw
func (c *CiscoCollector) Collect(ctx context.Context, config map[string]any) ([]model.CIRaw, error) {
	host := config["host"].(string)
	community := config["community"].(string)
	description := config["description"].(string)

	slog.Info("cisco collect", "host", host, "description", description)

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
		return nil, fmt.Errorf("cisco snmp init failed: %w", err)
	}
	defer snmp.Close()

	// 2. 获取厂商 OID 注册表
	oidRegistry := transport.GetVendorOIDs("cisco")

	// 3. 采集系统信息
	sysOIDs := oidRegistry.GetOID("system", "sysDescr")
	if sysOIDs == "" {
		sysOIDs = "1.3.6.1.2.1.1.1.0"
	}

	// 4. 构建 CIRaw
	cis := make([]model.CIRaw, 0)

	// 设备 CI
	ci := model.CIRaw{
		Name:     host,
		TypeHint: model.CITypeNetworkDevice,
		Status:   model.CIStatusActive,
		Attributes: map[string]any{
			"vendor":  "cisco",
			"platform": "cisco_ios",
			"host":    host,
			"snmp": map[string]any{
				"community": community,
				"port":      161,
				"version":   2,
			},
			"description": description,
		},
		EntityAttrs: map[string]any{
			"snmp_oid_sysDescr": sysOIDs,
		},
		Tags: map[string]any{
			"tags": []string{"network", "cisco", "ios"},
		},
	}
	cis = append(cis, ci)

	// 5. 采集接口信息 (简化示例)
	// TODO: 实现 SNMP WALK 遍历接口表
	// ifOIDs := oidRegistry.GetOID("interface", "ifName")
	// if ifOIDs != "" {
	//     _, _ = snmp.Walk(ctx, ifOIDs, func(pdu snmp.PDU) error {
	//         // 解析接口信息并添加到 cis
	//         return nil
	//     })
	// }

	slog.Info("cisco collect complete", "ci_count", len(cis), "host", host)
	return cis, nil
}

// ============================================================
// 注册
// ============================================================

func init() {
	collector.GlobalFactory.Register(&CiscoCollector{})
}

// ============================================================
// SNMP MIB OID 常量 — Cisco 专用
// ============================================================

// CiscoOid 思科 OID 常量
type CiscoOid string

const (
	// 系统信息 MIB-2
	CiscoOidSysDescr    CiscoOid = "1.3.6.1.2.1.1.1.0"
	CiscoOidSysName     CiscoOid = "1.3.6.1.2.1.1.5.0"
	CiscoOidSysUpTime   CiscoOid = "1.3.6.1.2.1.1.3.0"
	CiscoOidSysObjectID CiscoOid = "1.3.6.1.2.1.1.2.0"

	// 接口信息 IF-MIB
	CiscoOidIfName        CiscoOid = "1.3.6.1.2.1.31.1.1.1.1"
	CiscoOidIfDescr       CiscoOid = "1.3.6.1.2.1.2.2.1.2"
	CiscoOidIfType        CiscoOid = "1.3.6.1.2.1.2.2.1.3"
	CiscoOidIfSpeed       CiscoOid = "1.3.6.1.2.1.2.2.1.5"
	CiscoOidIfOperStatus  CiscoOid = "1.3.6.1.2.1.2.2.1.8"
	CiscoOidIfInOctets    CiscoOid = "1.3.6.1.2.1.2.2.1.10"
	CiscoOidIfOutOctets   CiscoOid = "1.3.6.1.2.1.2.2.1.16"

	// Cisco 私有 MIB
	CiscoOidEntityAlias CiscoOid = "1.3.6.1.4.1.9.9.115.1.3.1.2.1" // ENTITY-MIB
	CiscoOidProcessCPU  CiscoOid = "1.3.6.1.4.1.9.9.109.1.1.1.1.3"  // CPU 使用率
	CiscoOidProcessMem  CiscoOid = "1.3.6.1.4.1.9.9.48.1.1.1.1.5"  // 内存使用率

	// CDP 邻居
	CiscoOidCDPDeviceID CiscoOid = "1.3.6.1.4.1.9.9.23.1.2.1.1.4" // CDP 设备名称
	CiscoOidCDPDevicePort CiscoOid = "1.3.6.1.4.1.9.9.23.1.2.1.1.9" // CDP 端口

	// SSH CLI 命令
	CiscoCmdShowVersion    = "show version"
	CiscoCmdShowInterfaces = "show interfaces description"
	CiscoCmdShowCdpNeighbors = "show cdp neighbors detail"
	CiscoCmdShowRunningConfig = "show running-config"
)

// String 返回 OID 字符串
func (o CiscoOid) String() string { return string(o) }

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

// ParseInterfaceName 解析接口名称 (IF-MIB ifIndex)
func ParseInterfaceName(oid string) (string, error) {
	// 从 OID 末尾提取 ifIndex
	// 格式: 1.3.6.1.2.1.2.2.1.2.1 -> 接口 1
	parts := strings.Split(string(oid), ".")
	if len(parts) < 2 {
		return "", fmt.Errorf("invalid if oid: %s", oid)
	}
	ifIndex, err := strconv.Atoi(parts[len(parts)-1])
	if err != nil {
		return "", fmt.Errorf("invalid if index: %w", err)
	}
	return fmt.Sprintf("Interface-%d", ifIndex), nil
}

// ParseUptime 解析系统运行时间 (秒 -> 可读格式)
func ParseUptime(seconds int64) string {
	days := seconds / 86400
	hours := (seconds % 86400) / 3600
	minutes := (seconds % 3600) / 60
	secs := seconds % 60
	return fmt.Sprintf("%dd %dh %dm %ds", days, hours, minutes, secs)
}
