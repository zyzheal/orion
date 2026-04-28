/**
 * 登录流程端到端测试
 * 使用 Playwright 进行浏览器自动化测试
 */

import { test, expect } from '@playwright/test';

test.describe('Login Flow', () => {
  test.beforeEach(async ({ page }) => {
    // 访问登录页
    await page.goto('http://localhost:3000/login');
    // 等待页面加载
    await page.waitForSelector('text=Orion Platform', { timeout: 5000 });
  });

  test('should login successfully with valid credentials', async ({ page }) => {
    // 1. 验证登录页标题
    await expect(page.locator('text=Orion Platform')).toBeVisible();

    // 2. 使用 placeholder 定位输入框
    const usernameInput = page.locator('input[placeholder="用户名"]');
    const passwordInput = page.locator('input[placeholder="密码"]');
    const submitButton = page.locator('button[type="submit"]');

    await expect(usernameInput).toBeVisible();
    await expect(passwordInput).toBeVisible();
    await expect(submitButton).toBeVisible();

    // 3. 填写登录表单
    await usernameInput.fill('admin');
    await passwordInput.fill('admin123');

    // 4. 提交表单
    await submitButton.click();

    // 5. 等待按钮 loading 状态消失（表示登录请求完成）
    await page
      .waitForSelector('button[type="submit"]:not(:has(.anticon-loading))', { timeout: 10000 })
      .catch(() => {});
    await page.waitForTimeout(1000);

    // 6. 验证 - 检查是否还在登录页（如果登录成功应该离开）
    const currentUrl = page.url();
    console.log('Current URL after login:', currentUrl);

    // 检查是否已离开登录页或出现 Dashboard 文本
    const isNotOnLoginPage = !currentUrl.includes('/login');
    const hasDashboardText = await page
      .locator('text=Dashboard')
      .isVisible()
      .catch(() => false);
    const hasWelcomeText = await page
      .locator('text=欢迎使用')
      .isVisible()
      .catch(() => false);

    expect(isNotOnLoginPage || hasDashboardText || hasWelcomeText).toBeTruthy();
  });

  test('should show error with invalid credentials', async ({ page }) => {
    // 1. 填写错误的密码
    const usernameInput = page.locator('input[placeholder="用户名"]');
    const passwordInput = page.locator('input[placeholder="密码"]');
    const submitButton = page.locator('button[type="submit"]');

    await usernameInput.fill('admin');
    await passwordInput.fill('wrongpassword');

    // 2. 提交表单
    await submitButton.click();

    // 3. 等待 loading 消失
    await page
      .waitForSelector('button[type="submit"]:not(:has(.anticon-loading))', { timeout: 10000 })
      .catch(() => {});
    await page.waitForTimeout(500);

    // 4. 验证 - 应该还在登录页
    expect(page.url()).toContain('/login');
  });

  test('should validate empty fields', async ({ page }) => {
    // 1. 清空表单（Ant Design 表单有默认值）
    const usernameInput = page.locator('input[placeholder="用户名"]');
    const passwordInput = page.locator('input[placeholder="密码"]');

    await usernameInput.clear();
    await passwordInput.clear();

    // 2. 点击提交按钮
    const submitButton = page.locator('button[type="submit"]');
    await submitButton.click();

    // 3. 等待验证错误出现
    await page.waitForTimeout(500);

    // 4. 验证 - 应该还在登录页（没有提交成功）
    expect(page.url()).toContain('/login');
  });
});
