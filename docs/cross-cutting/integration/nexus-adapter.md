# Nexus Adapter 集成设计

> 版本：v1.0  
> 创建日期：2026-04-10  
> 负责人：后端团队  
> 优先级：P0  
> 状态：设计完成

---

## 一、集成架构总览

### 1.1 Nexus 在 Orion 中的定位

```
┌─────────────────────────────────────────────────────────────────┐
│                    Orion 平台                                    │
│                                                                 │
│  用户接口层                                                      │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐            │
│  │  Orion UI   │  │  Pipeline   │  │  CLI        │            │
│  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘            │
│         │                 │                 │                   │
│         └─────────────────┼─────────────────┘                   │
│                           ▼                                     │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │           Nexus Adapter (封装层)                          │   │
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  │   │
│  │  │ Maven 仓库    │  │ NPM 仓库      │  │ PyPI 仓库     │  │   │
│  │  │ API 客户端    │  │ API 客户端    │  │ API 客户端    │  │   │
│  │  └──────────────┘  └──────────────┘  └──────────────┘  │   │
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  │   │
│  │  │ 依赖追踪     │  │ 版本提升     │  │ 清理策略     │  │   │
│  │  │ 服务         │  │ 服务         │  │ 服务         │  │   │
│  │  └──────────────┘  └──────────────┘  └──────────────┘  │   │
│  └─────────────────────────────────────────────────────────┘   │
│                           │                                     │
│                           ▼                                     │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │                Nexus Repository 3                        │   │
│  │  • Maven Repository (releases/snapshots/3rd-party)       │   │
│  │  • NPM Repository                                        │   │
│  │  • PyPI Repository                                       │   │
│  │  • Go Module Repository                                  │   │
│  │  • Raw Repository (Helm Charts/通用文件)                  │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### 1.2 支持的仓库类型

| 类型 | 用途 | Nexus 仓库名示例 |
|------|------|-----------------|
| **Maven** | Java/Scala/Kotlin 依赖 | maven-releases, maven-snapshots, maven-public |
| **NPM** | Node.js/TypeScript 包 | npm-releases, npm-snapshots, npm-public |
| **PyPI** | Python 包 | pypi-releases, pypi-snapshots, pypi-public |
| **Go** | Go Module | go-releases, go-snapshots |
| **Raw** | Helm Chart/通用文件 | raw-helm, raw-generic |

### 1.3 集成场景

| 场景 | 触发源 | Orion 动作 | Nexus 动作 |
|------|--------|-----------|-----------|
| **依赖包发布** | Pipeline Build 完成 | 推送 JAR/NPM/PyPI 包 | 存储 + 生成元数据 |
| **依赖包下载** | Pipeline Build | 从 Nexus 下载依赖 | 提供下载 + 记录统计 |
| **依赖追踪** | 定时任务 | 扫描项目依赖关系 | 提供依赖元数据 |
| **版本提升** | 审批通过 | 从 snapshot→release | 复制/提升操作 |
| **依赖清理** | 定时任务 | 根据保留策略清理 | 删除旧版本 |

---

## 二、Nexus API 封装

### 2.1 Nexus API 客户端

```python
# Nexus Repository Manager 3 API 封装
class NexusClient:
    """
    Nexus Repository Manager 3 API 封装
    参考：https://help.sonatype.com/repomanager3/integrations/nexus-repository-rest-apis
    """
    
    def __init__(self, base_url: str, username: str, password: str):
        self.base_url = base_url.rstrip('/')
        self.session = aiohttp.ClientSession(
            auth=aiohttp.BasicAuth(username, password)
        )
    
    # ========== 组件（Component）相关 ==========
    
    async def upload_component(
        self,
        repository: str,
        asset: BinaryIO,
        asset_path: str,
        asset_name: str,
        component_name: str,
        component_version: str
    ) -> Component:
        """
        上传组件（JAR/NPM 包/Python Wheel 等）
        
        Args:
            repository: 仓库名称 (如 maven-releases)
            asset: 文件二进制流
            asset_path: 存储路径 (如 com/company/artifact)
            asset_name: 文件名 (如 artifact-1.0.0.jar)
            component_name: 组件名 (如 com.company:artifact)
            component_version: 版本号 (如 1.0.0)
        """
        url = f"{self.base_url}/service/rest/v1/components"
        
        # 构建 multipart 表单
        form = aiohttp.FormData()
        form.add_field('repository', repository)
        form.add_field('asset', asset, filename=asset_name)
        form.add_field('asset.path', asset_path)
        form.add_field('asset.name', asset_name)
        form.add_field('component.name', component_name)
        form.add_field('component.version', component_version)
        
        async with self.session.post(url, data=form) as resp:
            resp.raise_for_status()
            data = await resp.json()
            return Component(**data)
    
    async def search_components(
        self,
        repository: str = None,
        format: str = None,  # maven, npm, pypi, go
        group: str = None,   # Maven group ID
        name: str = None,
        version: str = None,
        prerelease: bool = None
    ) -> List[Component]:
        """搜索组件"""
        url = f"{self.base_url}/service/rest/v1/search"
        
        params = {}
        if repository:
            params['repository'] = repository
        if format:
            params['format'] = format
        if group:
            params['group'] = group
        if name:
            params['name'] = name
        if version:
            params['version'] = version
        if prerelease is not None:
            params['prerelease'] = str(prerelease).lower()
        
        return await self._paginate(url, params)
    
    async def delete_component(
        self,
        component_id: str
    ):
        """删除组件"""
        url = f"{self.base_url}/service/rest/v1/components/{component_id}"
        async with self.session.delete(url) as resp:
            resp.raise_for_status()
    
    # ========== Maven 特定 API ==========
    
    async def upload_maven(
        self,
        repository: str,
        group_id: str,
        artifact_id: str,
        version: str,
        packaging: str,  # jar, war, pom, etc.
        asset: BinaryIO,
        classifier: str = None  # sources, javadoc, etc.
    ) -> Component:
        """
        上传 Maven 构件
        
        Maven 坐标：group_id:artifact_id:version[:classifier]:packaging
        示例：com.company:payment-service:1.0.0:jar
        """
        url = f"{self.base_url}/service/rest/v1/components/maven"
        
        # 构建路径
        asset_path = group_id.replace('.', '/') + '/' + artifact_id + '/' + version
        asset_name = f"{artifact_id}-{version}" + (f"-{classifier}" if classifier else "") + f".{packaging}"
        
        form = aiohttp.FormData()
        form.add_field('repository', repository)
        form.add_field('asset', asset, filename=asset_name)
        form.add_field('asset.path', asset_path)
        form.add_field('maven2.groupId', group_id)
        form.add_field('maven2.artifactId', artifact_id)
        form.add_field('maven2.version', version)
        form.add_field('maven2.packaging', packaging)
        if classifier:
            form.add_field('maven2.classifier', classifier)
        
        async with self.session.post(url, data=form) as resp:
            resp.raise_for_status()
            data = await resp.json()
            return Component(**data)
    
    # ========== NPM 特定 API ==========
    
    async def upload_npm(
        self,
        repository: str,
        npm_package: BinaryIO
    ) -> Component:
        """上传 NPM 包"""
        url = f"{self.base_url}/service/rest/v1/components/npm"
        
        form = aiohttp.FormData()
        form.add_field('repository', repository)
        form.add_field('npm.package', npm_package)
        
        async with self.session.post(url, data=form) as resp:
            resp.raise_for_status()
            data = await resp.json()
            return Component(**data)
    
    # ========== PyPI 特定 API ==========
    
    async def upload_pypi(
        self,
        repository: str,
        pypi_package: BinaryIO
    ) -> Component:
        """上传 Python Wheel 包"""
        url = f"{self.base_url}/service/rest/v1/components/pypi"
        
        form = aiohttp.FormData()
        form.add_field('repository', repository)
        form.add_field('pypi.asset', pypi_package)
        
        async with self.session.post(url, data=form) as resp:
            resp.raise_for_status()
            data = await resp.json()
            return Component(**data)
    
    # ========== 仓库管理 ==========
    
    async def get_repository(self, name: str) -> Repository:
        """获取仓库信息"""
        url = f"{self.base_url}/service/rest/v1/repositories/{name}"
        async with self.session.get(url) as resp:
            data = await resp.json()
            return Repository(**data)
    
    async def list_repositories(self) -> List[Repository]:
        """获取所有仓库"""
        url = f"{self.base_url}/service/rest/v1/repositories"
        return await self._paginate(url)
    
    async def create_repository(
        self,
        name: str,
        format: str,  # maven, npm, pypi, go, raw
        recipe: str,  # hosted, proxy, group
        **kwargs
    ) -> Repository:
        """创建仓库"""
        url = f"{self.base_url}/service/rest/v1/repositories/{format}/{recipe}"
        
        data = {
            'name': name,
            **kwargs
        }
        
        async with self.session.post(url, json=data) as resp:
            resp.raise_for_status()
            return await self.get_repository(name)
    
    # ========== 清理策略 ==========
    
    async def get_cleanup_policy(self, repository: str) -> CleanupPolicy:
        """获取清理策略"""
        url = f"{self.base_url}/service/rest/beta/repositories/{repository}/cleanup"
        async with self.session.get(url) as resp:
            data = await resp.json()
            return CleanupPolicy(**data)
    
    async def update_cleanup_policy(
        self,
        repository: str,
        mode: str,  # lastDownloaded, released
        retention: int,  # 保留天数
        pattern: str = None  # 版本匹配模式
    ):
        """更新清理策略"""
        url = f"{self.base_url}/service/rest/beta/repositories/{repository}/cleanup"
        
        data = {
            'mode': mode,
            'retentionDays': retention
        }
        if pattern:
            data['pattern'] = pattern
        
        async with self.session.put(url, json=data) as resp:
            resp.raise_for_status()
    
    # ========== 工具方法 ==========
    
    async def _paginate(self, url: str, params: Dict = None) -> List[Any]:
        """处理分页"""
        all_items = []
        continuation_token = None
        
        while True:
            current_params = {**(params or {})}
            if continuation_token:
                current_params['continuationToken'] = continuation_token
            
            async with self.session.get(url, params=current_params) as resp:
                data = await resp.json()
                
                if 'items' in data:
                    all_items.extend(data['items'])
                
                continuation_token = data.get('continuationToken')
                if not continuation_token:
                    break
        
        return all_items
    
    async def close(self):
        """关闭会话"""
        await self.session.close()
```

### 2.2 数据模型定义

```python
# Nexus 数据模型
from pydantic import BaseModel
from typing import Optional, List, Dict
from datetime import datetime

class Component(BaseModel):
    """组件（JAR/NPM 包/Python Wheel 等）"""
    id: str
    repository: str
    format: str  # maven, npm, pypi, go, raw
    group: Optional[str]  # Maven group
    name: str
    version: str
    assets: List[Asset]
    
    # Maven 特定字段
    classifier: Optional[str]
    packaging: Optional[str]
    
    # 元数据
    created: datetime
    created_by: Optional[str]
    last_downloaded: Optional[datetime]
    download_count: int = 0
    
    # 便捷属性
    @property
    def coordinates(self) -> str:
        """获取组件坐标"""
        if self.format == 'maven':
            coords = f"{self.group}:{self.name}:{self.version}"
            if self.classifier:
                coords += f":{self.classifier}"
            if self.packaging:
                coords += f"::{self.packaging}"
            return coords
        elif self.format == 'npm':
            return f"{self.name}@{self.version}"
        elif self.format == 'pypi':
            return f"{self.name}=={self.version}"
        else:
            return f"{self.name}@{self.version}"

class Asset(BaseModel):
    """组件资产（文件）"""
    id: str
    repository: str
    format: str
    path: str
    name: str
    size: int  # 字节
    checksum: Dict[str, str]  # md5, sha1, sha256
    content_type: str
    last_modified: datetime
    download_url: str

class Repository(BaseModel):
    """Nexus 仓库"""
    name: str
    format: str
    type: str  # hosted, proxy, group
    url: str
    
    # 配置
    online: bool = True
    storage: Dict
    cleanup: Optional[Dict]
    
    # Maven 特定
    maven: Optional[Dict]
    
    # NPM 特定
    npm: Optional[Dict]
    
    # PyPI 特定
    pypi: Optional[Dict]

class CleanupPolicy(BaseModel):
    """清理策略"""
    mode: str  # lastDownloaded, released
    retentionDays: int
    pattern: Optional[str]  # 版本匹配模式（正则）

class Dependency(BaseModel):
    """依赖关系"""
    component_id: str
    component_name: str
    component_version: str
    repository: str
    format: str
    
    # 依赖信息
    depended_by: List[str]  # 被哪些组件依赖
    depends_on: List[str]   # 依赖哪些组件
    
    # 使用统计
    download_count: int
    last_downloaded: datetime
```

---

## 三、依赖追踪设计

### 3.1 依赖扫描服务

```python
# 依赖扫描服务
class DependencyScanService:
    """
    扫描项目依赖，构建依赖关系图
    """
    
    def __init__(
        self,
        nexus_client: NexusClient,
        graph_store: Neo4jClient
    ):
        self.nexus = nexus_client
        self.graph = graph_store
    
    async def scan_project(
        self,
        project_id: str,
        project_type: str  # maven, npm, pypi, go
    ) -> DependencyGraph:
        """
        扫描项目依赖
        
        返回：依赖关系图
        """
        
        # 1. 解析项目依赖文件
        dependencies = await self._parse_dependency_file(
            project_id, project_type
        )
        
        # 2. 从 Nexus 获取依赖详情
        enriched_deps = await self._enrich_dependencies(dependencies)
        
        # 3. 构建依赖关系图
        graph = await self._build_dependency_graph(
            project_id, enriched_deps
        )
        
        # 4. 存储到 Neo4j
        await self._persist_to_graph(project_id, graph)
        
        return graph
    
    async def _parse_dependency_file(
        self,
        project_id: str,
        project_type: str
    ) -> List[Dependency]:
        """解析项目依赖文件"""
        
        if project_type == 'maven':
            # 解析 pom.xml
            return await self._parse_pom_xml(project_id)
        
        elif project_type == 'npm':
            # 解析 package.json
            return await self._parse_package_json(project_id)
        
        elif project_type == 'pypi':
            # 解析 requirements.txt 或 pyproject.toml
            return await self._parse_requirements(project_id)
        
        elif project_type == 'go':
            # 解析 go.mod
            return await self._parse_go_mod(project_id)
        
        else:
            raise ValueError(f"不支持的项目类型：{project_type}")
    
    async def _parse_pom_xml(self, project_id: str) -> List[Dependency]:
        """解析 Maven pom.xml"""
        
        # 从 Git 获取 pom.xml
        pom_content = await self._get_file_from_git(
            project_id, 'pom.xml'
        )
        
        # 解析 XML
        root = ET.fromstring(pom_content)
        ns = {'m': 'http://maven.apache.org/POM/4.0.0'}
        
        dependencies = []
        for dep in root.findall('.//m:dependency', ns):
            group_id = dep.find('m:groupId', ns).text
            artifact_id = dep.find('m:artifactId', ns).text
            version = dep.find('m:version', ns).text
            scope = dep.find('m:scope', ns)
            scope = scope.text if scope is not None else 'compile'
            
            dependencies.append(Dependency(
                component_name=f"{group_id}:{artifact_id}",
                component_version=version,
                format='maven',
                repository='maven-public',
                metadata={'scope': scope}
            ))
        
        return dependencies
    
    async def _enrich_dependencies(
        self,
        dependencies: List[Dependency]
    ) -> List[Dependency]:
        """从 Nexus 补充依赖信息"""
        
        enriched = []
        
        for dep in dependencies:
            # 搜索 Nexus 中的组件
            components = await self.nexus.search_components(
                format=dep.format,
                name=dep.component_name,
                version=dep.component_version
            )
            
            if components:
                component = components[0]
                dep.component_id = component.id
                dep.download_count = component.download_count
                dep.last_downloaded = component.last_downloaded
                dep.checksum = component.assets[0].checksum if component.assets else None
            
            enriched.append(dep)
        
        return enriched
    
    async def _build_dependency_graph(
        self,
        project_id: str,
        dependencies: List[Dependency]
    ) -> DependencyGraph:
        """构建依赖关系图"""
        
        graph = DependencyGraph(project_id=project_id)
        
        # 添加项目节点
        graph.add_node(
            id=project_id,
            type='project',
            name=project_id
        )
        
        # 添加依赖节点和边
        for dep in dependencies:
            graph.add_node(
                id=dep.component_id,
                type='component',
                name=dep.component_name,
                version=dep.component_version,
                format=dep.format
            )
            
            graph.add_edge(
                source=project_id,
                target=dep.component_id,
                relationship='DEPENDS_ON'
            )
        
        return graph
    
    async def _persist_to_graph(
        self,
        project_id: str,
        graph: DependencyGraph
    ):
        """持久化到 Neo4j"""
        
        # 清空旧数据
        await self.graph.execute(
            "MATCH (n:Dependency {project_id: $project_id}) DETACH DELETE n",
            {"project_id": project_id}
        )
        
        # 插入新数据
        for node in graph.nodes:
            await self.graph.execute(
                """
                CREATE (n:Dependency {
                    id: $id,
                    project_id: $project_id,
                    type: $type,
                    name: $name,
                    version: $version,
                    format: $format
                })
                """,
                {**node}
            )
        
        for edge in graph.edges:
            await self.graph.execute(
                """
                MATCH (a:Dependency {id: $source})
                MATCH (b:Dependency {id: $target})
                CREATE (a)-[:DEPENDS_ON]->(b)
                """,
                {"source": edge.source, "target": edge.target}
            )
```

### 3.2 依赖影响面分析

```python
# 依赖影响面分析服务
class DependencyImpactAnalyzer:
    """
    分析依赖变更的影响面
    """
    
    def __init__(self, graph_store: Neo4jClient):
        self.graph = graph_store
    
    async def analyze_impact(
        self,
        component_name: str,
        component_version: str
    ) -> ImpactAnalysis:
        """
        分析组件变更的影响面
        
        场景：升级某个二方库，哪些项目会受影响
        """
        
        # 1. 查找使用该组件的所有项目
        affected_projects = await self._find_dependent_projects(
            component_name
        )
        
        # 2. 分析影响级别
        impact_level = self._calculate_impact_level(
            affected_projects
        )
        
        # 3. 生成影响报告
        report = ImpactAnalysis(
            component=f"{component_name}@{component_version}",
            affected_projects=affected_projects,
            impact_level=impact_level,
            recommendations=self._generate_recommendations(
                affected_projects, impact_level
            )
        )
        
        return report
    
    async def _find_dependent_projects(
        self,
        component_name: str
    ) -> List[ProjectImpact]:
        """查找依赖该组件的所有项目"""
        
        # Cypher 查询
        query = """
        MATCH (p:Dependency {type: 'project'})
        -[:DEPENDS_ON*1..5]->
        (c:Dependency {type: 'component', name: $component_name})
        RETURN p, c, shortestPath((p)-[*]->(c)) as path
        """
        
        results = await self.graph.execute(
            query,
            {"component_name": component_name}
        )
        
        affected = []
        for record in results:
            project = record['p']
            component = record['c']
            path_length = len(record['path'].relationships)
            
            affected.append(ProjectImpact(
                project_id=project['id'],
                project_name=project['name'],
                dependency_path_length=path_length,
                direct_dependency=path_length == 1
            ))
        
        return affected
    
    def _calculate_impact_level(
        self,
        affected_projects: List[ProjectImpact]
    ) -> ImpactLevel:
        """计算影响级别"""
        
        project_count = len(affected_projects)
        direct_count = sum(
            1 for p in affected_projects if p.direct_dependency
        )
        
        if direct_count >= 10 or project_count >= 50:
            return ImpactLevel.CRITICAL
        elif direct_count >= 5 or project_count >= 20:
            return ImpactLevel.HIGH
        elif direct_count >= 1 or project_count >= 5:
            return ImpactLevel.MEDIUM
        else:
            return ImpactLevel.LOW
    
    def _generate_recommendations(
        self,
        affected_projects: List[ProjectImpact],
        impact_level: ImpactLevel
    ) -> List[str]:
        """生成建议"""
        
        recommendations = []
        
        if impact_level in [ImpactLevel.CRITICAL, ImpactLevel.HIGH]:
            recommendations.append(
                "⚠️ 影响范围广，建议分批次灰度升级"
            )
            recommendations.append(
                "📋 创建升级检查清单，确保所有项目兼容"
            )
        
        if impact_level == ImpactLevel.CRITICAL:
            recommendations.append(
                "🔔 通知所有受影响项目的负责人"
            )
            recommendations.append(
                "📊 安排专项测试验证"
            )
        
        # 按项目类型建议
        java_projects = [
            p for p in affected_projects 
            if 'maven' in p.project_id.lower()
        ]
        if java_projects:
            recommendations.append(
                f"☕ {len(java_projects)} 个 Java 项目需更新 pom.xml"
            )
        
        return recommendations
```

---

## 四、自动升级 PR

### 4.1 Dependabot 风格服务

```python
# 依赖自动升级服务
class DependencyUpgradeService:
    """
    类似 Dependabot 的依赖自动升级服务
    """
    
    def __init__(
        self,
        nexus_client: NexusClient,
        gitlab_client: GitLabClient,
        graph_store: Neo4jClient
    ):
        self.nexus = nexus_client
        self.gitlab = gitlab_client
        self.graph = graph_store
    
    async def check_for_updates(
        self,
        project_id: str,
        project_type: str
    ) -> List[DependencyUpdate]:
        """检查可升级的依赖"""
        
        # 1. 获取当前依赖列表
        scan_service = DependencyScanService(self.nexus, self.graph)
        graph = await scan_service.scan_project(project_id, project_type)
        
        updates = []
        
        # 2. 检查每个依赖是否有新版本
        for node in graph.nodes:
            if node['type'] != 'component':
                continue
            
            latest_version = await self._get_latest_version(
                node['name'],
                node['format']
            )
            
            if latest_version and latest_version != node['version']:
                # 有新版本
                update = DependencyUpdate(
                    project_id=project_id,
                    component_name=node['name'],
                    current_version=node['version'],
                    latest_version=latest_version,
                    format=node['format']
                )
                updates.append(update)
        
        return updates
    
    async def create_upgrade_pr(
        self,
        project_id: str,
        update: DependencyUpdate
    ) -> MergeRequest:
        """创建升级 PR"""
        
        # 1. 分析影响面
        analyzer = DependencyImpactAnalyzer(self.graph)
        impact = await analyzer.analyze_impact(
            update.component_name,
            update.current_version
        )
        
        # 2. 创建分支
        branch_name = f"auto-upgrade/{update.component_name}-{update.latest_version}"
        await self._create_branch(project_id, branch_name)
        
        # 3. 更新依赖文件
        if update.format == 'maven':
            await self._update_pom_xml(
                project_id,
                update.component_name,
                update.latest_version,
                branch_name
            )
        elif update.format == 'npm':
            await self._update_package_json(
                project_id,
                update.component_name,
                update.latest_version,
                branch_name
            )
        
        # 4. 提交并创建 MR
        mr = await self.gitlab.create_mr(
            project_id=project_id,
            source_branch=branch_name,
            target_branch='main',
            title=f"chore: 升级 {update.component_name} 到 {update.latest_version}",
            description=self._generate_pr_description(update, impact)
        )
        
        return mr
    
    def _generate_pr_description(
        self,
        update: DependencyUpdate,
        impact: ImpactAnalysis
    ) -> str:
        """生成 PR 描述"""
        
        template = """
## 📦 依赖升级

自动升级 **{component}** 从 `{current}` → `{latest}`

---

### 📊 影响分析

- **影响级别**: {impact_level}
- **受影响项目数**: {project_count}
- **直接依赖项目**: {direct_count}

---

### ✅ 检查清单

- [ ] 已阅读 CHANGELOG
- [ ] 已在本地验证
- [ ] CI 测试通过
- [ ] 通知了受影响项目负责人

---

### 🔗 相关链接

- [Nexus 组件详情](https://nexus.internal/#browse/search={component})
- [依赖影响面分析](https://orion.internal/dependencies/{component})

---

> 此 PR 由 Orion 自动生成，如有疑问请联系平台团队
"""
        
        return template.format(
            component=update.component_name,
            current=update.current_version,
            latest=update.latest_version,
            impact_level=impact.impact_level.value,
            project_count=len(impact.affected_projects),
            direct_count=sum(
                1 for p in impact.affected_projects 
                if p.direct_dependency
            )
        )
```

---

## 五、版本提升流程

### 5.1 Snapshot → Release 提升

```python
# Nexus 版本提升服务
class NexusPromotionService:
    """
    Nexus 版本提升服务
    将组件从 snapshot 仓库提升到 release 仓库
    """
    
    def __init__(self, nexus_client: NexusClient):
        self.nexus = nexus_client
    
    async def promote_snapshot_to_release(
        self,
        component_id: str,
        verify_conditions: List[VerificationCondition]
    ) -> PromotionResult:
        """
        将 Snapshot 组件提升到 Release 仓库
        
        前置条件:
        1. 组件存在于 snapshot 仓库
        2. 所有验证条件通过
        3. release 仓库不存在同名版本
        """
        
        # 1. 获取组件详情
        components = await self.nexus.search_components()
        component = next(
            (c for c in components if c.id == component_id),
            None
        )
        
        if not component:
            raise ComponentNotFoundError(component_id)
        
        # 2. 验证前置条件
        for condition in verify_conditions:
            if not await condition.check(component):
                raise PromotionError(
                    f"前置条件不满足：{condition.name}"
                )
        
        # 3. 检查 release 仓库是否已存在
        existing = await self.nexus.search_components(
            repository='maven-releases',
            name=component.name,
            version=component.version
        )
        
        if existing:
            raise PromotionError(
                f"Release 仓库已存在 {component.name}:{component.version}"
            )
        
        # 4. 复制到 release 仓库
        await self._copy_component(
            component,
            source_repo='maven-snapshots',
            target_repo='maven-releases'
        )
        
        # 5. 更新元数据
        await self._update_metadata(component, stage='release')
        
        return PromotionResult(
            success=True,
            component=component,
            new_repository='maven-releases'
        )
    
    async def _copy_component(
        self,
        component: Component,
        source_repo: str,
        target_repo: str
    ):
        """复制组件到目标仓库"""
        
        # 获取组件所有资产
        for asset in component.assets:
            # 下载资产
            asset_content = await self._download_asset(asset.download_url)
            
            # 上传到目标仓库
            if component.format == 'maven':
                await self.nexus.upload_maven(
                    repository=target_repo,
                    group_id=component.group,
                    artifact_id=component.name,
                    version=component.version,
                    packaging=component.packaging,
                    classifier=component.classifier,
                    asset=asset_content
                )
            elif component.format == 'npm':
                await self.nexus.upload_npm(
                    repository=target_repo,
                    npm_package=asset_content
                )
            elif component.format == 'pypi':
                await self.nexus.upload_pypi(
                    repository=target_repo,
                    pypi_package=asset_content
                )
```

---

## 六、清理策略

### 6.1 清理规则配置

```yaml
# Nexus 清理策略配置
apiVersion: v1
kind: ConfigMap
metadata:
  name: nexus-cleanup-policy
  namespace: orion-system
data:
  cleanup_policy.yaml: |
    # 全局策略
    global:
      # 启用清理
      enabled: true
      
      # 清理执行时间
      schedule:
        cron: "0 4 * * *"  # 每天凌晨 4 点
        timezone: "Asia/Shanghai"
    
    # 按仓库类型的清理策略
    repositories:
      # Maven Snapshot
      - name: "maven-snapshots"
        mode: lastDownloaded
        retention_days: 30
        keep_count: 10
        exclude_patterns:
          - ".*-RELEASE"
          - ".*-RC.*"
      
      # Maven Release
      - name: "maven-releases"
        mode: released
        retention_days: 365
        keep_count: -1  # 永久保留
        exclude_patterns:
          - ".*"  # 保留所有
      
      # NPM
      - name: "npm-releases"
        mode: lastDownloaded
        retention_days: 90
        keep_count: 5
        exclude_patterns:
          - "^latest$"
          - "^lts-.*"
      
      # PyPI
      - name: "pypi-releases"
        mode: lastDownloaded
        retention_days: 90
        keep_count: 5
        exclude_patterns:
          - ".*"
    
    # 按项目组的特殊策略
    project_groups:
      # 核心库永久保留
      - pattern: "^com\\.company\\.core.*"
        retention_days: -1
        keep_count: -1
      
      # 临时项目快速清理
      - pattern: "^com\\.company\\.temp.*"
        retention_days: 7
        keep_count: 3
```

---

## 七、部署配置

### 7.1 Kubernetes 部署

```yaml
# Nexus Adapter 部署配置
apiVersion: apps/v1
kind: Deployment
metadata:
  name: nexus-adapter
  namespace: orion-system
spec:
  replicas: 2
  selector:
    matchLabels:
      app: nexus-adapter
  template:
    metadata:
      labels:
        app: nexus-adapter
    spec:
      containers:
        - name: nexus-adapter
          image: orion-registry.internal/nexus-adapter:v1.0.0
          ports:
            - containerPort: 8080
          env:
            - name: NEXUS_URL
              value: "https://nexus.internal"
            - name: NATS_URL
              value: "nats://orion-nats:4222"
          envFrom:
            - secretRef:
                name: nexus-credentials
          resources:
            requests:
              cpu: 100m
              memory: 256Mi
            limits:
              cpu: 500m
              memory: 512Mi
---
apiVersion: v1
kind: Service
metadata:
  name: nexus-adapter
  namespace: orion-system
spec:
  selector:
    app: nexus-adapter
  ports:
    - port: 80
      targetPort: 8080
  type: ClusterIP
---
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: nexus-adapter
  namespace: orion-system
spec:
  rules:
    - host: orion.internal
      http:
        paths:
          - path: /api/nexus
            pathType: Prefix
            backend:
              service:
                name: nexus-adapter
                port:
                  number: 80
```

---

## 八、总结

### 8.1 功能清单

| 功能 | 状态 | 说明 |
|------|------|------|
| Maven 依赖管理 | ✅ | 上传/下载/搜索 |
| NPM 包管理 | ✅ | 上传/下载/搜索 |
| PyPI 包管理 | ✅ | 上传/下载/搜索 |
| 依赖追踪 | ✅ | Neo4j 存储依赖关系 |
| 影响面分析 | ✅ | 升级前分析影响范围 |
| 自动升级 PR | ✅ | Dependabot 风格 |
| 版本提升 | ✅ | snapshot→release |
| 清理策略 | ✅ | 基于保留规则 |

### 8.2 与 Harbor 分工

| 功能 | Nexus | Harbor |
|------|-------|--------|
| Maven JAR | ✅ | ❌ |
| NPM 包 | ✅ | ❌ |
| PyPI 包 | ✅ | ❌ |
| Go Module | ✅ | ❌ |
| 容器镜像 | ❌ | ✅ |
| Helm Chart | ⚠️ Raw 存储 | ✅ 原生支持 |

---

_文档版本：v1.0 | 创建日期：2026-04-10 | 状态：设计完成，待开发_
