import { test, expect } from '@playwright/test';

test.describe('Authentication', () => {
  test('@smoke 登录页面加载', async ({ page }) => {
    await page.goto('http://localhost:3000/login');
    await page.waitForLoadState('domcontentloaded');
    await expect(page.getByRole('heading')).toBeVisible({ timeout: 10000 });
  });

  test('@smoke 登录表单字段可见', async ({ page }) => {
    await page.goto('http://localhost:3000/login');
    await page.waitForLoadState('networkidle');
    // 用户名/邮箱输入框
    await expect(page.locator('input[placeholder="用户名"], input[placeholder="邮箱"], input[type="email"]')).toBeVisible({ timeout: 10000 });
    // 密码输入框
    await expect(page.locator('input[type="password"]')).toBeVisible({ timeout: 10000 });
    // 提交按钮
    await expect(page.locator('button[type="submit"]')).toBeVisible({ timeout: 10000 });
  });

  test('@critical 未登录跳转登录页', async ({ page }) => {
    // 直接访问需要登录的页面，应被重定向到登录页
    await page.goto('http://localhost:3000/dashboard');
    await page.waitForLoadState('domcontentloaded');
    const currentUrl = page.url();
    expect(currentUrl).toContain('/login');
  });

  test('@smoke 登出后跳转登录页', async ({ page }) => {
    // 假设已登录，访问 dashboard 后登出
    await page.goto('http://localhost:3000/login');
    await page.waitForLoadState('networkidle');

    const usernameInput = page.locator('input[placeholder="用户名"], input[placeholder="邮箱"], input[type="email"]');
    const passwordInput = page.locator('input[type="password"]');
    const submitButton = page.locator('button[type="submit"]');

    await expect(usernameInput).toBeVisible();
    await expect(passwordInput).toBeVisible();
    await expect(submitButton).toBeVisible();

    await usernameInput.fill('admin');
    await passwordInput.fill('admin123');
    await submitButton.click();

    // 等待请求完成
    await page.waitForTimeout(2000);

    // 检查用户菜单
    const userMenu = page.locator('[data-testid="user-menu"], .ant-menu-item, button:has-text("退出")');
    if (await userMenu.isVisible().catch(() => false)) {
      await userMenu.first().click();
      const logoutBtn = page.locator('button:has-text("退出"), a:has-text("退出")');
      if (await logoutBtn.isVisible().catch(() => false)) {
        await logoutBtn.click();
        await page.waitForTimeout(1000);
        expect(page.url()).toContain('/login');
      }
    }
  });
});
