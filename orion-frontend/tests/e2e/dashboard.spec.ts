import { test, expect } from '@playwright/test';

test.describe('Dashboard', () => {
  test('@smoke 加载 Dashboard 页面', async ({ page }) => {
    await page.goto('http://localhost:3000/dashboard');
    await page.waitForLoadState('networkidle');
    await expect(page.getByRole('heading')).toBeVisible({ timeout: 10000 });
  });

  test('@smoke Dashboard 统计卡片渲染', async ({ page }) => {
    await page.goto('http://localhost:3000/dashboard');
    await page.waitForLoadState('networkidle');
    const statCards = page.locator('[class*="stat"], [class*="metric"], [class*="card"]');
    await expect(statCards.first()).toBeVisible({ timeout: 10000 });
  });

  test('@critical 页面标题正确', async ({ page }) => {
    await page.goto('http://localhost:3000/dashboard');
    await page.waitForLoadState('domcontentloaded');
    const title = await page.title();
    expect(title).toMatch(/orion|platform|dashboard/i);
  });
});
