# 依赖追踪设计

> 版本：v1.0  
> 创建日期：2026-04-10  
> 负责人：后端团队  
> 优先级：P0  
> 状态：设计完成

---

## 一、依赖追踪架构

### 1.1 依赖关系图

```
┌─────────────────────────────────────────────────────────────────┐
│              依赖追踪架构                                        │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  数据源层                                                        │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐            │
│  │  pom.xml    │  │package.json │  │requirements │            │
│  │  (Maven)    │  │  (NPM)      │  │  (PyPI)     │            │
│  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘            │
│         │                 │                 │                   │
│         └─────────────────┼─────────────────┘                   │
│                           ▼                                     │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │           依赖扫描服务 (Dependency Scanner)                │   │
│  │  • 解析依赖文件                                          │   │
│  │  • 从 Nexus 获取依赖详情                                   │   │
│  │  • 构建依赖关系图                                        │   │
│  └─────────────────────────────────────────────────────────┘   │
│                           │                                     │
│                           ▼                                     │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │              Neo4j 图数据库                               │   │
│  │  (n:Dependency)-[:DEPENDS_ON]->(m:Dependency)            │   │
│  └─────────────────────────────────────────────────────────┘   │
│                           │                                     │
│                           ▼                                     │
│  应用层                                                         │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐            │
│  │ 影响面分析   │  │ 自动升级 PR │  │ 漏洞预警    │            │
│  └─────────────┘  └─────────────┘  └─────────────┘            │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### 1.2 数据模型

```cypher
// Neo4j 数据模型

// 项目节点
(:Project {
    id: "payment-service",
    name: "支付服务",
    type: "maven",
    group: "com.company.payment",
    version: "2.3.0-SNAPSHOT"
})

// 依赖组件节点
(:Component {
    id: "com.company:common-utils:1.5.0",
    name: "common-utils",
    group: "com.company",
    version: "1.5.0",
    type: "maven",
    repository: "maven-public",
    download_count: 1523,
    last_downloaded: "2026-04-10T10:30:00Z"
})

// 依赖关系
(:Project)-[:DEPENDS_ON {
    scope: "compile",
    optional: false,
    added_at: "2026-03-15"
}]->(:Component)

// 组件间依赖
(:Component)-[:DEPENDS_ON]->(:Component)

// 漏洞关联
(:Component)-[:HAS_VULNERABILITY {
    severity: "high",
    cvss: 7.5
}]->(:Vulnerability {
    id: "CVE-2026-1234",
    severity: "high",
    cvss: 7.5,
    description: "..."
})
```

---

## 二、依赖扫描服务

### 2.1 扫描流程

```python
# 依赖扫描服务
class DependencyScanService:
    """
    扫描项目依赖，构建依赖关系图
    """
    
    async def scan_project(
        self,
        project_id: str,
        project_type: str  # maven, npm, pypi, go
    ) -> DependencyGraph:
        """扫描项目依赖"""
        
        # 1. 解析依赖文件
        dependencies = await self._parse_dependency_file(
            project_id, project_type
        )
        
        # 2. 从 Nexus 获取依赖详情
        enriched_deps = await self._enrich_from_nexus(dependencies)
        
        # 3. 构建依赖图
        graph = await self._build_graph(project_id, enriched_deps)
        
        # 4. 存储到 Neo4j
        await self._persist_to_neo4j(graph)
        
        return graph
    
    async def _parse_dependency_file(
        self,
        project_id: str,
        project_type: str
    ) -> List[Dependency]:
        """解析依赖文件"""
        
        if project_type == 'maven':
            return await self._parse_pom_xml(project_id)
        elif project_type == 'npm':
            return await self._parse_package_json(project_id)
        elif project_type == 'pypi':
            return await self._parse_requirements(project_id)
        elif project_type == 'go':
            return await self._parse_go_mod(project_id)
```

### 2.2 依赖解析示例

```python
# Maven POM 解析
async def _parse_pom_xml(self, project_id: str) -> List[Dependency]:
    """解析 Maven pom.xml"""
    
    # 从 Git 获取 pom.xml
    pom_content = await self.git.get_file(project_id, 'pom.xml')
    
    # 解析 XML
    root = ET.fromstring(pom_content)
    ns = {'m': 'http://maven.apache.org/POM/4.0.0'}
    
    dependencies = []
    for dep in root.findall('.//m:dependency', ns):
        dependencies.append(Dependency(
            group=dep.find('m:groupId', ns).text,
            artifact=dep.find('m:artifactId', ns).text,
            version=dep.find('m:version', ns).text,
            scope=dep.find('m:scope', ns).text or 'compile'
        ))
    
    return dependencies
```

---

## 三、影响面分析

### 3.1 影响面查询

```python
# 影响面分析服务
class ImpactAnalysisService:
    """
    分析依赖变更的影响面
    """
    
    async def analyze_component_impact(
        self,
        component_name: str,
        component_version: str
    ) -> ImpactReport:
        """
        分析组件变更影响面
        
        场景：升级某个二方库，哪些项目会受影响
        """
        
        # Cypher 查询：查找所有依赖该组件的项目
        query = """
        MATCH (p:Project)-[:DEPENDS_ON*1..5]->
              (c:Component {name: $component_name})
        RETURN p, 
               shortestPath((p)-[*]->(c)) as path,
               length(shortestPath((p)-[*]->(c))) as depth
        ORDER BY depth ASC
        """
        
        results = await self.neo4j.execute(
            query,
            {"component_name": component_name}
        )
        
        # 构建影响报告
        affected_projects = []
        for record in results:
            affected_projects.append(ImpactInfo(
                project_id=record['p']['id'],
                project_name=record['p']['name'],
                dependency_depth=record['depth'],
                direct_dependency=record['depth'] == 1
            ))
        
        # 计算影响级别
        impact_level = self._calculate_impact_level(affected_projects)
        
        return ImpactReport(
            component=f"{component_name}@{component_version}",
            affected_projects=affected_projects,
            impact_level=impact_level,
            recommendations=self._generate_recommendations(
                affected_projects, impact_level
            )
        )
    
    def _calculate_impact_level(
        self,
        projects: List[ImpactInfo]
    ) -> ImpactLevel:
        """计算影响级别"""
        
        total = len(projects)
        direct = sum(1 for p in projects if p.direct_dependency)
        
        if direct >= 10 or total >= 50:
            return ImpactLevel.CRITICAL
        elif direct >= 5 or total >= 20:
            return ImpactLevel.HIGH
        elif direct >= 1 or total >= 5:
            return ImpactLevel.MEDIUM
        else:
            return ImpactLevel.LOW
```

---

## 四、自动升级 PR

### 4.1 Dependabot 风格服务

```python
# 依赖自动升级服务
class AutoUpgradeService:
    """
    类似 Dependabot 的依赖自动升级
    """
    
    async def check_for_updates(
        self,
        project_id: str
    ) -> List[DependencyUpdate]:
        """检查可升级的依赖"""
        
        # 1. 获取当前依赖列表
        graph = await self.scan_service.scan_project(project_id, 'maven')
        
        updates = []
        
        # 2. 检查每个依赖是否有新版本
        for node in graph.nodes:
            if node['type'] != 'component':
                continue
            
            # 从 Nexus 获取最新版本
            latest = await self.nexus.get_latest_version(
                group=node['group'],
                artifact=node['name']
            )
            
            if latest and latest != node['version']:
                updates.append(DependencyUpdate(
                    project_id=project_id,
                    component_name=node['name'],
                    current_version=node['version'],
                    latest_version=latest
                ))
        
        return updates
    
    async def create_upgrade_pr(
        self,
        project_id: str,
        update: DependencyUpdate
    ) -> MergeRequest:
        """创建升级 PR"""
        
        # 1. 分析影响面
        impact = await self.impact_service.analyze_component_impact(
            update.component_name,
            update.current_version
        )
        
        # 2. 创建分支
        branch = f"auto-upgrade/{update.component_name}-{update.latest_version}"
        await self.git.create_branch(project_id, branch)
        
        # 3. 更新依赖文件
        await self._update_pom_xml(
            project_id,
            update.component_name,
            update.latest_version,
            branch
        )
        
        # 4. 提交并创建 MR
        mr = await self.gitlab.create_mr(
            project_id=project_id,
            source_branch=branch,
            target_branch='main',
            title=f"chore: 升级 {update.component_name} 到 {update.latest_version}",
            description=self._generate_pr_description(update, impact)
        )
        
        return mr
```

---

## 五、漏洞预警

### 5.1 漏洞关联分析

```python
# 漏洞预警服务
class VulnerabilityAlertService:
    """
    依赖漏洞预警服务
    """
    
    async def check_vulnerabilities(
        self,
        project_id: str
    ) -> VulnerabilityReport:
        """检查项目依赖的漏洞"""
        
        # Cypher 查询：查找项目依赖中存在漏洞的组件
        query = """
        MATCH (p:Project {id: $project_id})
        -[:DEPENDS_ON*1..5]->
        (c:Component)-[:HAS_VULNERABILITY]->(v:Vulnerability)
        RETURN c, v, 
               shortestPath((p)-[*]->(c)) as path
        """
        
        results = await self.neo4j.execute(
            query,
            {"project_id": project_id}
        )
        
        # 构建漏洞报告
        vulnerabilities = []
        for record in results:
            vulnerabilities.append(VulnInfo(
                component=record['c']['name'],
                version=record['c']['version'],
                vulnerability_id=record['v']['id'],
                severity=record['v']['severity'],
                cvss=record['v']['cvss'],
                fix_version=record['v'].get('fix_version')
            ))
        
        return VulnerabilityReport(
            project_id=project_id,
            vulnerabilities=vulnerabilities,
            summary=self._summarize_vulnerabilities(vulnerabilities)
        )
    
    async def subscribe_alerts(
        self,
        project_id: str,
        channels: List[str]
    ):
        """订阅漏洞告警"""
        
        # 订阅 NATS 主题
        await self.nats.subscribe(
            subject=f"vulnerability.alert.{project_id}",
            callback=lambda msg: self._send_alert(msg, channels)
        )
```

---

## 六、监控指标

### 6.1 Prometheus 指标

```yaml
# 依赖追踪监控指标
dependency_tracking:
  # 依赖数量指标
  components_total:
    type: gauge
    labels: [type, repository]
  
  dependencies_total:
    type: gauge
    labels: [project, type]
  
  # 漏洞指标
  vulnerabilities_total:
    type: gauge
    labels: [severity, project]
  
  # 升级指标
  available_updates_total:
    type: gauge
    labels: [project]
  
  auto_upgrade_prs_total:
    type: counter
    labels: [status]
  
  # 扫描指标
  scan_jobs_total:
    type: counter
    labels: [status]
  
  scan_duration_seconds:
    type: histogram
```

---

## 七、总结

### 7.1 功能清单

| 功能 | 状态 | 说明 |
|------|------|------|
| 依赖扫描 | ✅ | Maven/NPM/PyPI/Go |
| 依赖关系图 | ✅ | Neo4j 存储 |
| 影响面分析 | ✅ | 升级前分析影响范围 |
| 自动升级 PR | ✅ | Dependabot 风格 |
| 漏洞预警 | ✅ | CVE 关联分析 |
| 监控指标 | ✅ | Prometheus 集成 |

---

_文档版本：v1.0 | 创建日期：2026-04-10 | 状态：设计完成，待开发_
