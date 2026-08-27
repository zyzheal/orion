import { type Page, test as base, expect } from '@playwright/test';

export interface E2EUser {
  email: string;
  password: string;
  name?: string;
  role?: string;
}

export const testUsers = {
  admin: { email: 'admin@orion.test', password: 'Admin@123456', name: 'Admin User', role: 'admin' },
  dev: { email: 'dev@orion.test', password: 'Dev@123456', name: 'Developer User', role: 'developer' },
  viewer: { email: 'viewer@orion.test', password: 'Viewer@123456', name: 'Viewer User', role: 'viewer' },
} as const;

export interface E2EContext {
  login: void;
  logout: void;
}

export const e2eTest = base.extend<E2EContext>({
  async login({ page }, use) {
    await page.goto('/login');
    await page.getByLabel(/邮箱|email/i).fill(testUsers.admin.email);
    await page.getByLabel(/密码|password/i).fill(testUsers.admin.password);
    await page.getByRole('button', { name: /登录|sign\s*in/i }).click();
    await expect(page).toHaveURL(/(\/dashboard|\/)(\?|$)/);
    await use();
  },
  async logout({ page }, use) {
    await page.getByTestId('user-menu').click();
    await page.getByRole('menuitem', { name: /退出|logout/i }).click();
    await expect(page).toHaveURL('/login');
    await use();
  },
});