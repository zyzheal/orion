import { type Page, type Response } from '@playwright/test';

export async function waitForApi(page: Page, urlPattern: string | RegExp, statusCode = 200): Promise<Response> {
  return page.waitForResponse(async (response) => {
    if (!response.url().match(urlPattern)) return false;
    return response.status() === statusCode;
  });
}

export async function expectPageLoad(page: Page): Promise<void> {
  await page.waitForLoadState('networkidle');
}

export const dataGenerators = {
  uniqueId: () => `test-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
  projectName: (prefix = 'project') => `${prefix}-${Date.now()}`,
  pipelineName: (prefix = 'pipeline') => `${prefix}-${Date.now()}`,
};
