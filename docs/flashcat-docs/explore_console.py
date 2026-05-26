#!/usr/bin/env python3
"""
Flashduty Console 自动探索器
通过 ChromeMcpServer MCP 工具系统性地访问每个功能页面，提取完整的页面结构、表单字段、交互逻辑。
"""

import json
import time
import os
import re
from pathlib import Path
from typing import Optional

import httpx

MCP_URL = "http://127.0.0.1:12306/mcp"
SESSION_ID = None
OUTPUT_DIR = Path("/tmp/flashcat-explorer")

# 要探索的完整页面清单（基于文档分析的路由结构）
PAGES_TO_EXPLORE = [
    # 一级导航
    {"name": "协作空间列表", "url": "https://console.flashcat.cloud/channel", "actions": []},
    {"name": "故障管理", "url": "https://console.flashcat.cloud/incidents", "actions": []},
    {"name": "告警管理", "url": "https://console.flashcat.cloud/alerts", "actions": []},
    {"name": "值班管理", "url": "https://console.flashcat.cloud/schedules", "actions": []},
    {"name": "集成中心-告警事件", "url": "https://console.flashcat.cloud/integrations/alert-events", "actions": []},
    {"name": "集成中心-Webhook", "url": "https://console.flashcat.cloud/integrations/webhooks", "actions": []},
    {"name": "模板管理", "url": "https://console.flashcat.cloud/templates", "actions": []},
    {"name": "分析看板", "url": "https://console.flashcat.cloud/insights", "actions": []},
    {"name": "状态页", "url": "https://console.flashcat.cloud/statuspage", "actions": []},
    {"name": "用量数据", "url": "https://console.flashcat.cloud/usage", "actions": []},
]

# 协作空间详情页的子 Tab
CHANNEL_SUB_TABS = [
    {"name": "概览", "selector": None, "desc": "默认 Tab，展示统计卡片 + 最近故障/告警"},
    {"name": "故障列表", "selector": None, "desc": "该空间下的故障列表"},
    {"name": "告警列表", "selector": None, "desc": "该空间下的告警列表"},
    {"name": "配置-集成数据-专属集成", "selector": None, "desc": "专属集成配置"},
    {"name": "配置-集成数据-排除规则", "selector": None, "desc": "排除规则配置"},
    {"name": "配置-降噪处理-告警聚合", "selector": None, "desc": "告警聚合规则"},
    {"name": "配置-降噪处理-抖动检测", "selector": None, "desc": "抖动检测规则"},
    {"name": "配置-降噪处理-静默策略", "selector": None, "desc": "静默策略配置"},
    {"name": "配置-降噪处理-抑制策略", "selector": None, "desc": "抑制策略配置"},
    {"name": "配置-通知分派-分派策略", "selector": None, "desc": "分派策略配置"},
    {"name": "配置-设置-基础信息", "selector": None, "desc": "空间基础信息编辑"},
    {"name": "配置-设置-高级配置", "selector": None, "desc": "高级配置"},
]


def init_session() -> str:
    """Initialize MCP session and return session ID."""
    resp = httpx.post(
        MCP_URL,
        headers={"Content-Type": "application/json", "Accept": "application/json, text/event-stream"},
        json={
            "jsonrpc": "2.0",
            "id": 1,
            "method": "initialize",
            "params": {
                "protocolVersion": "2024-11-05",
                "capabilities": {},
                "clientInfo": {"name": "flashcat-explorer", "version": "1.0.0"},
            },
        },
    )
    session_id = resp.headers.get("mcp-session-id")
    if not session_id:
        # Try lower case
        for k, v in resp.headers.items():
            if "session" in k.lower():
                session_id = v
                break
    if not session_id:
        raise RuntimeError(f"No session ID in response. Headers: {dict(resp.headers)}")
    return session_id


def mcp_call(method: str, params: dict, timeout: float = 30.0) -> dict:
    """Call an MCP tool and return parsed result."""
    global SESSION_ID
    resp = httpx.post(
        MCP_URL,
        headers={
            "Content-Type": "application/json",
            "Accept": "application/json, text/event-stream",
            "Mcp-Session-Id": SESSION_ID,
        },
        json={
            "jsonrpc": "2.0",
            "id": int(time.time() * 1000),
            "method": "tools/call",
            "params": {"name": method, "arguments": params},
        },
        timeout=timeout,
    )
    # Parse SSE response
    lines = resp.text.strip().split("\n")
    for line in lines:
        if line.startswith("data: "):
            data = json.loads(line[6:])
            return data
    raise RuntimeError(f"No data in MCP response: {resp.text[:500]}")


def navigate(url: str) -> dict:
    """Navigate to a URL."""
    return mcp_call("chrome_navigate", {"url": url})


def get_page_content() -> dict:
    """Get full page content."""
    return mcp_call("chrome_get_web_content", {"htmlContent": True})


def screenshot(name: str) -> dict:
    """Take a screenshot."""
    return mcp_call("chrome_screenshot", {"path": str(OUTPUT_DIR / f"{name}.png"), "fullPage": True})


def click_element(selector: str) -> dict:
    """Click an element by selector."""
    return mcp_call("chrome_click_element", {"selector": selector})


def read_page() -> dict:
    """Read page accessibility tree."""
    return mcp_call("chrome_read_page", {})


def execute_js(script: str) -> dict:
    """Execute JavaScript and return result."""
    return mcp_call("chrome_javascript", {"code": script})


def extract_page_structure(page_name: str) -> dict:
    """
    Extract complete page structure:
    - Full HTML
    - Visible text
    - Form fields
    - Tab elements
    - Button elements
    - API calls triggered
    """
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

    result = {"page_name": page_name, "timestamp": time.strftime("%Y-%m-%d %H:%M:%S")}

    # 1. Get full HTML content
    try:
        content = get_page_content()
        result["html_content"] = content.get("content", "")[:50000]  # Limit size
        result["page_title"] = content.get("title", "")
        result["page_url"] = content.get("url", "")
        print(f"  HTML content: {len(content.get('content', ''))} chars")
    except Exception as e:
        result["html_error"] = str(e)
        print(f"  HTML error: {e}")

    # 2. Take screenshot
    try:
        ss = screenshot(page_name.replace("/", "_").replace(" ", "_"))
        result["screenshot"] = str(OUTPUT_DIR / f"{page_name.replace('/', '_').replace(' ', '_')}.png")
    except Exception as e:
        result["screenshot_error"] = str(e)

    # 3. Extract visible text
    try:
        text_result = execute_js("document.body.innerText")
        result["visible_text"] = text_result.get("result", "")[:10000]
    except Exception as e:
        result["text_error"] = str(e)

    # 4. Extract all form fields
    try:
        form_js = """
        JSON.stringify(Array.from(document.querySelectorAll('input, select, textarea')).map(el => ({
            tag: el.tagName,
            type: el.type || '',
            name: el.name || '',
            id: el.id || '',
            placeholder: el.placeholder || '',
            label: (el.labels && el.labels[0] && el.labels[0].textContent) || '',
            required: el.required,
            disabled: el.disabled,
            value: el.value || '',
            options: el.tagName === 'SELECT' ? Array.from(el.options).map(o => ({text: o.text, value: o.value})) : []
        })))
        """
        forms = execute_js(form_js)
        result["form_fields"] = json.loads(forms.get("result", "[]"))
        print(f"  Form fields: {len(result['form_fields'])}")
    except Exception as e:
        result["form_error"] = str(e)

    # 5. Extract all buttons and clickable elements
    try:
        btn_js = """
        JSON.stringify(Array.from(document.querySelectorAll('button, [role="button"], a, [onclick]')).slice(0, 100).map(el => ({
            tag: el.tagName,
            text: (el.textContent || '').trim().substring(0, 50),
            type: el.type || '',
            className: el.className || '',
            href: el.href || '',
            id: el.id || '',
            role: el.getAttribute('role') || ''
        })))
        """
        buttons = execute_js(btn_js)
        result["buttons"] = json.loads(buttons.get("result", "[]"))
        print(f"  Buttons/clickable: {len(result['buttons'])}")
    except Exception as e:
        result["button_error"] = str(e)

    # 6. Extract tab elements
    try:
        tab_js = """
        JSON.stringify(Array.from(document.querySelectorAll('[role="tab"], .ant-tabs-tab, .tabs-item, [class*="tab"]')).slice(0, 50).map(el => ({
            text: (el.textContent || '').trim().substring(0, 50),
            active: el.getAttribute('aria-selected') === 'true' || el.classList.contains('active') || el.classList.contains('ant-tabs-tab-active'),
            className: el.className || ''
        })))
        """
        tabs = execute_js(tab_js)
        result["tabs"] = json.loads(tabs.get("result", "[]"))
        print(f"  Tabs: {len(result['tabs'])}")
    except Exception as e:
        result["tab_error"] = str(e)

    # 7. Extract table columns (if any)
    try:
        table_js = """
        JSON.stringify(Array.from(document.querySelectorAll('thead tr th, table th')).slice(0, 50).map(el => ({
            text: (el.textContent || '').trim(),
            index: el.cellIndex
        })))
        """
        cols = execute_js(table_js)
        result["table_columns"] = json.loads(cols.get("result", "[]"))
        print(f"  Table columns: {len(result['table_columns'])}")
    except Exception as e:
        result["table_error"] = str(e)

    # 8. Capture network requests (API calls visible in the page)
    try:
        network_js = """
        JSON.stringify((window.__capturedRequests || []).slice(0, 50).map(r => ({url: r.url, method: r.method})))
        """
        # First, set up request interception
        result["network"] = "Request interception not available"
    except Exception as e:
        result["network_error"] = str(e)

    return result


def save_result(page_name: str, data: dict):
    """Save exploration result to file."""
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    safe_name = page_name.replace("/", "_").replace(" ", "_")

    # Save JSON
    json_path = OUTPUT_DIR / f"{safe_name}.json"
    with open(json_path, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)

    # Save HTML separately if available
    if "html_content" in data:
        html_path = OUTPUT_DIR / f"{safe_name}.html"
        with open(html_path, "w", encoding="utf-8") as f:
            f.write(data["html_content"])

    print(f"  Saved: {json_path}")


def summarize_page(data: dict) -> str:
    """Generate a human-readable summary of a page."""
    lines = [f"## {data['page_name']}", ""]

    if "page_title" in data:
        lines.append(f"- **标题**: {data['page_title']}")
    if "page_url" in data:
        lines.append(f"- **URL**: {data['page_url']}")

    # Tabs
    if data.get("tabs"):
        lines.append("")
        lines.append("### Tab 页签")
        for tab in data["tabs"]:
            active = " (当前激活)" if tab.get("active") else ""
            lines.append(f"- {tab['text']}{active}")

    # Form fields
    if data.get("form_fields"):
        lines.append("")
        lines.append("### 表单字段")
        for f in data["form_fields"]:
            req = " (必填)" if f.get("required") else ""
            label = f.get("label", f.get("name", f.get("id", "unknown")))
            tag_type = f"{f['tag']}/{f.get('type', '')}"
            lines.append(f"- `{label}` - {tag_type}{req}")

    # Buttons
    if data.get("buttons"):
        lines.append("")
        lines.append("### 按钮与可操作元素")
        seen = set()
        for b in data["buttons"]:
            text = b.get("text", "")
            if text and text not in seen and len(text) > 0:
                seen.add(text)
                lines.append(f"- {text}")

    # Table columns
    if data.get("table_columns"):
        lines.append("")
        lines.append("### 表格列")
        for c in sorted(data["table_columns"], key=lambda x: x.get("index", 0)):
            lines.append(f"- {c['text']}")

    lines.append("")
    return "\n".join(lines)


def click_and_capture(page_name: str, selector: str, wait: float = 2.0) -> Optional[dict]:
    """Click an element and capture the resulting page."""
    try:
        click_element(selector)
        time.sleep(wait)
        return extract_page_structure(page_name)
    except Exception as e:
        print(f"  Failed to click '{page_name}': {e}")
        return None


def main():
    global SESSION_ID

    print("=" * 60)
    print("Flashduty Console 自动探索器")
    print("=" * 60)

    # Initialize session
    print("\n[1/3] 初始化 MCP 会话...")
    SESSION_ID = init_session()
    print(f"  Session ID: {SESSION_ID}")

    # Navigate to each page and capture
    print("\n[2/3] 逐页探索...")
    all_summaries = []

    for page in PAGES_TO_EXPLORE:
        print(f"\n{'─' * 40}")
        print(f"正在访问: {page['name']}")
        print(f"URL: {page['url']}")

        try:
            # Navigate
            navigate(page["url"])
            time.sleep(3)  # Wait for page render

            # Extract structure
            data = extract_page_structure(page["name"])
            save_result(page["name"], data)

            # Summarize
            summary = summarize_page(data)
            all_summaries.append(summary)

        except Exception as e:
            print(f"  错误: {e}")
            all_summaries.append(f"## {page['name']}\n\n- **访问失败**: {e}\n")

    # Generate comprehensive report
    print("\n[3/3] 生成综合报告...")

    report_path = OUTPUT_DIR / "exploration-report.md"
    with open(report_path, "w", encoding="utf-8") as f:
        f.write("# Flashduty Console 页面探索报告\n\n")
        f.write(f"> 自动生成时间: {time.strftime('%Y-%m-%d %H:%M:%S')}\n")
        f.write(f"> 探索页面数: {len(PAGES_TO_EXPLORE)}\n\n")

        f.write("## 目录\n\n")
        for page in PAGES_TO_EXPLORE:
            safe_name = page["name"].replace(" ", "-")
            f.write(f"- [{page['name']}](#{safe_name})\n")
        f.write("\n---\n\n")

        for summary in all_summaries:
            f.write(summary)
            f.write("\n---\n\n")

    print(f"\n报告已保存到: {report_path}")
    print(f"详细数据目录: {OUTPUT_DIR}")

    # Count stats
    files = list(OUTPUT_DIR.glob("*.json"))
    htmls = list(OUTPUT_DIR.glob("*.html"))
    pngs = list(OUTPUT_DIR.glob("*.png"))
    print(f"\n统计: {len(files)} JSON, {len(htmls)} HTML, {len(pngs)} PNG")


if __name__ == "__main__":
    main()
