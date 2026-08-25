// ============================================================
// Plan 26 — 供应链安全 (Supply Chain Security)
// ============================================================
// 优先级: P1
// 来源: v3.5 系统评审
// 本地证据:
//   - internal/supply-chain/ (5文件): 有 handler + repository + models — CRUD only
//   - internal/sbom/: 有 SBOM 模块
//   - internal/vulnerability/: 有漏洞管理
//   - 缺口: 无实际 SBOM 生成 (无 syft/trivy 集成)
// 合并方案:
//   1. 本 Plan 的 Scanner 逻辑合并到本地 internal/supply-chain/service/scanner.go
//   2. 增加 syft/trivy 命令行集成
//   3. 扫描结果写入本地 SBOM 和 vulnerability 模块
// 详细设计参见 docs/deliverables/README.md P1-08 小节
// ============================================================

package supplychain

import (
    "context"
    "encoding/json"
    "fmt"
    "sort"
    "sync"
    "time"
)

type VulnerabilitySeverity string

const (
    SeverityCritical VulnerabilitySeverity = "critical"
    SeverityHigh     VulnerabilitySeverity = "high"
    SeverityMedium   VulnerabilitySeverity = "medium"
    SeverityLow      VulnerabilitySeverity = "low"
    SeverityInfo     VulnerabilitySeverity = "info"
)

type Package struct {
    Name      string `json:"name"`
    Version   string `json:"version"`
    License   string `json:"license"`
    Checksum  string `json:"checksum"`
    Published int64  `json:"published"`
}

type Vulnerability struct {
    ID          string               `json:"id"`
    Package     string               `json:"package"`
    Version     string               `json:"version"`
    Severity    VulnerabilitySeverity `json:"severity"`
    CVSS        float64              `json:"cvss"`
    Description string               `json:"description"`
    FixedIn     string               `json:"fixedIn"`
    Published   int64                `json:"published"`
}

type SBOMEntry struct {
    Name     string    `json:"name"`
    Version  string    `json:"version"`
    License  string    `json:"license"`
    Deps     []string  `json:"deps"`
    Checksum string    `json:"checksum"`
}

type SBOMReport struct {
    Generator string         `json:"generator"`
    Generated int64          `json:"generated"`
    Packages  []SBOMEntry    `json:"packages"`
    Vulns     []Vulnerability `json:"vulnerabilities"`
}

type Scanner struct {
    vulnDB    map[string][]Vulnerability
    sbomCache map[string]*SBOMReport
    mu        sync.RWMutex
}

func NewScanner() *Scanner {
    return &Scanner{
        vulnDB:    make(map[string][]Vulnerability),
        sbomCache: make(map[string]*SBOMReport),
    }
}

func (s *Scanner) LoadVulnerabilities(vulns []Vulnerability) {
    s.mu.Lock()
    defer s.mu.Unlock()
    for _, v := range vulns {
        s.vulnDB[v.Package] = append(s.vulnDB[v.Package], v)
    }
}

func (s *Scanner) ScanPackages(ctx context.Context, packages []Package) ([]Vulnerability, error) {
    s.mu.RLock()
    defer s.mu.RUnlock()
    var results []Vulnerability
    for _, pkg := range packages {
        select {
        case <-ctx.Done():
            return nil, ctx.Err()
        default:
        }
        if vulns, ok := s.vulnDB[pkg.Name]; ok {
            for _, v := range vulns {
                if isVulnerable(v, pkg) {
                    results = append(results, v)
                }
            }
        }
    }
    sort.Slice(results, func(i, j int) bool {
        return cvssRank(results[i].Severity) > cvssRank(results[j].Severity)
    })
    return results, nil
}

func (s *Scanner) GenerateSBOM(packages []Package) (*SBOMReport, error) {
    entries := make([]SBOMEntry, len(packages))
    for i, pkg := range packages {
        entries[i] = SBOMEntry{
            Name:     pkg.Name,
            Version:  pkg.Version,
            License:  pkg.License,
            Checksum: pkg.Checksum,
        }
    }
    vulns, _ := s.ScanPackages(context.Background(), packages)
    return &SBOMReport{
        Generator: "orion-supply-chain-scanner",
        Generated: time.Now().UnixMilli(),
        Packages:  entries,
        Vulns:     vulns,
    }, nil
}

func (s *Scanner) CheckDependencyLock(packages []Package, lockfile string) error {
    s.mu.RLock()
    defer s.mu.RUnlock()
    for _, pkg := range packages {
        if pkg.Checksum == "" {
            return fmt.Errorf("package %s@%s missing checksum in %s", pkg.Name, pkg.Version, lockfile)
        }
    }
    return nil
}

func (s *Scanner) GetSBOM(projectID string) (*SBOMReport, error) {
    s.mu.RLock()
    defer s.mu.RUnlock()
    report, ok := s.sbomCache[projectID]
    if !ok { return nil, fmt.Errorf("SBOM not found for %s", projectID) }
    return report, nil
}

func (s *Scanner) CacheSBOM(projectID string, report *SBOMReport) {
    s.mu.Lock()
    defer s.mu.Unlock()
    s.sbomCache[projectID] = report
}

func isVulnerable(v Vulnerability, pkg Package) bool {
    if v.Package != pkg.Name { return false }
    return v.Version != "" && pkg.Version != v.FixedIn
}

func cvssRank(sev VulnerabilitySeverity) int {
    switch sev {
    case SeverityCritical: return 4
    case SeverityHigh:     return 3
    case SeverityMedium:   return 2
    case SeverityLow:      return 1
    default:               return 0
    }
}

func MarshalReport(r *SBOMReport) ([]byte, error) {
    return json.Marshal(r)
}
