import { test, expect } from '@playwright/test';

test.describe('Security Scan', () => {
  test('@smoke 安全配置页面加载', async ({ page }) => {
    await page.goto('http://localhost:3000/security/auth-config');
    await page.waitForLoadState('networkidle');
    await expect(page.getByRole('heading')).toBeVisible({ timeout: 10000 });
  });

  test('@smoke 合规扫描页面加载', async ({ page }) => {
    await page.goto('http://localhost:3000/security/compliance-scan');
    await page.waitForLoadState('networkidle');
    await expect(page.getByRole('heading')).toBeVisible({ timeout: 10000 });
  });

  test('@smoke 代码扫描页面加载', async ({ page }) => {
    await page.goto('http://localhost:3000/security/code-scan');
    await page.waitForLoadState('networkidle');
    await expect(page.getByRole('heading')).toBeVisible({ timeout: 10000 });
  });

  test('@smoke AI 安全页面加载', async ({ page }) => {
    await page.goto('http://localhost:3000/ai-security');
    await page.waitForLoadState('networkidle');
    await expect(page.getByRole('heading')).toBeVisible({ timeout: 10000 });
  });

  test('@critical 合规扫描页面标题', async ({ page }) => {
    await page.goto('http://localhost:3000/security/compliance-scan');
    await page.waitForLoadState('domcontentloaded');
    const title = await page.title();
    expect(title).toMatch(/orion|security|scan/i);
  });

  test('@smoke SBOM 仪表盘页面加载', async ({ page }) => {
    await page.goto('http://localhost:3000/sbom');
    await page.waitForLoadState('networkidle');
    await expect(page.getByRole('heading')).toBeVisible({ timeout: 10000 });
  });

  test('@smoke 风险仪表盘页面加载', async ({ page }) => {
    await page.goto('http://localhost:3000/risk-dashboard');
    await page.waitForLoadState('networkidle');
    await expect(page.getByRole('heading')).toBeVisible({ timeout: 10000 });
  });
});
