# Playwright E2E 测试指南

## 配置 MCP 控制浏览器

本项目已配置 Playwright MCP 插件，允许 Claude Code 直接控制浏览器进行自动化测试。

### 启用 MCP

1. **项目级配置** (`.mcp.json`) - 已创建
   ```json
   {
     "playwright": {
       "command": "npx",
       "args": ["@playwright/mcp@latest"]
     }
   }
   ```

2. **全局配置** (`~/.claude/settings.json`) - 已启用 playwright 插件

### 安装依赖

```bash
cd orion-frontend
npm install
npx playwright install  # 安装浏览器
```

### 运行测试

```bash
# 运行所有 E2E 测试
npm run test:e2e

# 使用 UI 模式运行（可视化调试）
npm run test:e2e:ui

# 调试模式（带断点）
npm run test:e2e:debug

# 只运行登录测试
npx playwright test tests/e2e/login.spec.ts
```

## 使用 MCP 进行交互式测试

在 Claude Code 对话中，你可以使用以下 Playwright MCP 命令：

### 浏览器导航
- `browser_navigate` - 访问指定 URL
- `browser_navigate_back` - 返回上一页

### 页面交互
- `browser_click` - 点击元素
- `browser_fill_form` - 填写表单
- `browser_type` - 输入文本
- `browser_select_option` - 选择下拉选项
- `browser_hover` - 悬停元素
- `browser_drag` - 拖拽元素

### 页面检查
- `browser_snapshot` - 获取页面快照
- `browser_take_screenshot` - 截图
- `browser_console_messages` - 获取控制台消息
- `browser_network_requests` - 获取网络请求

### 其他工具
- `browser_run_code` - 在页面上下文中运行 JavaScript
- `browser_wait_for` - 等待特定条件
- `browser_handle_dialog` - 处理弹窗
- `browser_file_upload` - 上传文件

## 示例测试流程

### 登录流程测试

```
1. 导航到登录页
   → browser_navigate { url: "http://localhost:3000/login" }

2. 填写登录表单
   → browser_fill_form { 
       selector: "input[name=username]", 
       value: "admin" 
     }
   → browser_fill_form { 
       selector: "input[name=password]", 
       value: "admin123" 
     }

3. 提交表单
   → browser_click { selector: "button[type=submit]" }

4. 验证跳转
   → browser_wait_for { url: "**/dashboard" }

5. 截图验证
   → browser_take_screenshot
```

## 测试报告

测试完成后，HTML 报告会生成在 `playwright-report` 目录：

```bash
npx playwright show-report
```

## 常见问题

### 浏览器安装失败
```bash
npx playwright install --with-deps
```

### 端口冲突
确保前端服务运行在 3000 端口：
```bash
lsof -i :3000
```

### 测试超时
在 `playwright.config.ts` 中调整超时时间：
```typescript
export default defineConfig({
  timeout: 30000, // 30 秒
});
```
