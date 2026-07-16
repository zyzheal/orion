"""
Security Scan Task Plugin

执行安全扫描（基于 Trivy/Semgrep 等工具）
支持依赖漏洞扫描、代码安全检测
"""

import asyncio
from typing import Any, Dict, List, Optional

from orion_plugin_sdk.plugin import (
    TaskPlugin,
    PluginMetadata,
    TaskContext,
    TaskResult,
    TaskStatus,
    Workspace,
    ConfigField,
    register_plugin,
)


class SecurityScanPlugin(TaskPlugin):
    """安全扫描插件"""

    def get_metadata(self) -> PluginMetadata:
        return PluginMetadata(
            name="security-scan",
            version="1.0.0",
            description="Execute security scans using Trivy/Semgrep for vulnerability detection",
            author="Orion Team",
            tags=["security", "vulnerability", "trivy", "semgrep"],
            config_schema={
                "scanType": ConfigField(
                    type="string",
                    description="扫描类型（fs/image/sbom）",
                    required=True,
                    enum=["fs", "image", "sbom"],
                ),
                "targetPath": ConfigField(
                    type="string",
                    description="扫描目标路径",
                    default=".",
                ),
                "severity": ConfigField(
                    type="string",
                    description="漏洞严重程度过滤",
                    default="CRITICAL,HIGH,MEDIUM",
                ),
                "skipDirs": ConfigField(
                    type="array",
                    description="要跳过扫描的目录",
                    default=["node_modules", ".git", "vendor"],
                ),
                "failOnCritical": ConfigField(
                    type="boolean",
                    description="发现严重漏洞时是否失败",
                    default="true",
                ),
                "failOnHigh": ConfigField(
                    type="boolean",
                    description="发现高危漏洞时是否失败",
                    default="false",
                ),
            },
        )

    async def execute(self, ctx: TaskContext) -> TaskResult:
        """执行安全扫描"""
        self._init_context(ctx)

        try:
            self.info("Starting security scan...")

            # 读取配置
            scan_type = self.get_config("scanType", "fs")
            target_path = self.get_config("targetPath", ".")
            severity = self.get_config("severity", "CRITICAL,HIGH,MEDIUM")
            skip_dirs: List[str] = self.get_config("skipDirs", [])
            fail_on_critical = self.get_config("failOnCritical", "true") == "true"
            fail_on_high = self.get_config("failOnHigh", "false") == "true"

            self.debug(
                f"Config: scan_type={scan_type}, target={target_path}, "
                f"severity={severity}, skip_dirs={skip_dirs}"
            )

            # 获取工作区
            workspace_root = self.get_workspace_root()
            self.info(f"Workspace: {workspace_root}")

            # 执行扫描
            result = await self.run_security_scan(
                scan_type=scan_type,
                target_path=target_path,
                severity=severity.split(","),
                skip_dirs=skip_dirs,
                workspace_root=workspace_root,
            )

            # 分析结果
            critical_count = result.get("critical_count", 0)
            high_count = result.get("high_count", 0)
            medium_count = result.get("medium_count", 0)
            low_count = result.get("low_count", 0)

            self.info(
                f"Found vulnerabilities: "
                f"Critical={critical_count}, High={high_count}, "
                f"Medium={medium_count}, Low={low_count}"
            )

            # 判断是否失败
            should_fail = False
            failure_reason = ""

            if fail_on_critical and critical_count > 0:
                should_fail = True
                failure_reason = f"Found {critical_count} critical vulnerabilities"
            elif fail_on_high and high_count > 0:
                should_fail = True
                failure_reason = f"Found {high_count} high severity vulnerabilities"

            if should_fail:
                return TaskResult(
                    task_id=ctx.task_id,
                    status=TaskStatus.FAILED,
                    exit_code=1,
                    stdout=f"Security scan found vulnerabilities: {failure_reason}",
                    stderr=result.get("vulnerabilities", []),
                    duration_ms=int(self._start_time - self._start_time) if self._start_time else 0,
                    outputs={
                        "criticalCount": str(critical_count),
                        "highCount": str(high_count),
                        "mediumCount": str(medium_count),
                        "lowCount": str(low_count),
                        "passed": "false",
                    },
                )

            # 成功
            return self.create_success_result(
                {
                    "criticalCount": str(critical_count),
                    "highCount": str(high_count),
                    "mediumCount": str(medium_count),
                    "lowCount": str(low_count),
                    "passed": "true",
                }
            )

        except Exception as e:
            error_message = str(e)
            self.error(f"Security scan failed: {error_message}")
            return self.create_failed_result(error_message)

    async def run_security_scan(
        self,
        scan_type: str,
        target_path: str,
        severity: List[str],
        skip_dirs: List[str],
        workspace_root: str,
    ) -> Dict[str, Any]:
        """
        运行安全扫描（模拟实现）

        实际实现中：
        - fs 扫描：调用 Trivy filesystem 扫描
        - image 扫描：调用 Trivy image 扫描 Docker 镜像
        - sbom 扫描：解析 SBOM 文件并检查漏洞
        """
        # 模拟扫描结果
        return {
            "critical_count": 0,
            "high_count": 0,
            "medium_count": 0,
            "low_count": 0,
            "vulnerabilities": [],
        }


# 创建并注册插件实例
plugin = SecurityScanPlugin()
register_plugin(plugin)

if __name__ == "__main__":
    # 测试执行
    async def test():
        ctx = TaskContext(
            task_id="test-task-001",
            pipeline_run_id="run-001",
            stage_id="stage-001",
            config={
                "scanType": "fs",
                "targetPath": ".",
                "severity": "CRITICAL,HIGH",
            },
            workspace=Workspace(root_path="/tmp/workspace", files={}),
            env={"CI": "true"},
        )
        result = await plugin.execute(ctx)
        print(f"Result: {result}")

    asyncio.run(test())
