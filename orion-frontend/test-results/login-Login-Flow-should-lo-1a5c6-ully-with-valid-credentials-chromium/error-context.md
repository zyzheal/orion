# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: login.spec.ts >> Login Flow >> should login successfully with valid credentials
- Location: tests/e2e/login.spec.ts:16:3

# Error details

```
Error: expect(received).toBeTruthy()

Received: false
```

# Page snapshot

```yaml
- generic [ref=e5]:
  - generic [ref=e6]:
    - heading "Orion Platform" [level=2] [ref=e7]
    - text: 欢迎登录
  - generic [ref=e8]:
    - generic [ref=e14]:
      - img "user" [ref=e16]:
        - img [ref=e17]
      - textbox "用户名" [ref=e19]: admin
    - generic [ref=e25]:
      - img "lock" [ref=e27]:
        - img [ref=e28]
      - textbox "密码" [ref=e30]: admin123
      - img "eye-invisible" [ref=e32] [cursor=pointer]:
        - img [ref=e33]
    - button "loading 登 录" [active] [ref=e41]:
      - img "loading" [ref=e43]:
        - img [ref=e44]
      - generic [ref=e46]: 登 录
  - generic [ref=e47]: 默认账号：admin / admin123
```

# Test source

```ts
  1  | /**
  2  |  * 登录流程端到端测试
  3  |  * 使用 Playwright 进行浏览器自动化测试
  4  |  */
  5  | 
  6  | import { test, expect } from '@playwright/test';
  7  | 
  8  | test.describe('Login Flow', () => {
  9  |   test.beforeEach(async ({ page }) => {
  10 |     // 访问登录页
  11 |     await page.goto('http://localhost:3000/login');
  12 |     // 等待页面加载
  13 |     await page.waitForSelector('text=Orion Platform', { timeout: 5000 });
  14 |   });
  15 | 
  16 |   test('should login successfully with valid credentials', async ({ page }) => {
  17 |     // 1. 验证登录页标题
  18 |     await expect(page.locator('text=Orion Platform')).toBeVisible();
  19 | 
  20 |     // 2. 使用 placeholder 定位输入框
  21 |     const usernameInput = page.locator('input[placeholder="用户名"]');
  22 |     const passwordInput = page.locator('input[placeholder="密码"]');
  23 |     const submitButton = page.locator('button[type="submit"]');
  24 | 
  25 |     await expect(usernameInput).toBeVisible();
  26 |     await expect(passwordInput).toBeVisible();
  27 |     await expect(submitButton).toBeVisible();
  28 | 
  29 |     // 3. 填写登录表单
  30 |     await usernameInput.fill('admin');
  31 |     await passwordInput.fill('admin123');
  32 | 
  33 |     // 4. 提交表单
  34 |     await submitButton.click();
  35 | 
  36 |     // 5. 等待按钮 loading 状态消失（表示登录请求完成）
  37 |     await page.waitForSelector('button[type="submit"]:not(:has(.anticon-loading))', { timeout: 10000 }).catch(() => {});
  38 |     await page.waitForTimeout(1000);
  39 | 
  40 |     // 6. 验证 - 检查是否还在登录页（如果登录成功应该离开）
  41 |     const currentUrl = page.url();
  42 |     console.log('Current URL after login:', currentUrl);
  43 | 
  44 |     // 检查是否已离开登录页或出现 Dashboard 文本
  45 |     const isNotOnLoginPage = !currentUrl.includes('/login');
  46 |     const hasDashboardText = await page.locator('text=Dashboard').isVisible().catch(() => false);
  47 |     const hasWelcomeText = await page.locator('text=欢迎使用').isVisible().catch(() => false);
  48 | 
> 49 |     expect(isNotOnLoginPage || hasDashboardText || hasWelcomeText).toBeTruthy();
     |                                                                    ^ Error: expect(received).toBeTruthy()
  50 |   });
  51 | 
  52 |   test('should show error with invalid credentials', async ({ page }) => {
  53 |     // 1. 填写错误的密码
  54 |     const usernameInput = page.locator('input[placeholder="用户名"]');
  55 |     const passwordInput = page.locator('input[placeholder="密码"]');
  56 |     const submitButton = page.locator('button[type="submit"]');
  57 | 
  58 |     await usernameInput.fill('admin');
  59 |     await passwordInput.fill('wrongpassword');
  60 | 
  61 |     // 2. 提交表单
  62 |     await submitButton.click();
  63 | 
  64 |     // 3. 等待 loading 消失
  65 |     await page.waitForSelector('button[type="submit"]:not(:has(.anticon-loading))', { timeout: 10000 }).catch(() => {});
  66 |     await page.waitForTimeout(500);
  67 | 
  68 |     // 4. 验证 - 应该还在登录页
  69 |     expect(page.url()).toContain('/login');
  70 |   });
  71 | 
  72 |   test('should validate empty fields', async ({ page }) => {
  73 |     // 1. 直接提交空表单
  74 |     const submitButton = page.locator('button[type="submit"]');
  75 |     await submitButton.click();
  76 | 
  77 |     // 2. 等待片刻
  78 |     await page.waitForTimeout(500);
  79 | 
  80 |     // 3. 验证 - 应该还在登录页（没有提交成功）
  81 |     expect(page.url()).toContain('/login');
  82 |   });
  83 | });
  84 | 
```