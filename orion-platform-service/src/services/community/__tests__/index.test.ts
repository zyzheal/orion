/**
 * Community module index - Export verification tests
 */

import {
  CommunityService,
  CommunityPluginService,
  CommunityAdvancedService,
} from '../index';

describe('Community module exports', () => {
  it('should export CommunityService class', () => {
    expect(CommunityService).toBeDefined();
    expect(typeof CommunityService).toBe('function');
  });

  it('should export CommunityPluginService class', () => {
    expect(CommunityPluginService).toBeDefined();
    expect(typeof CommunityPluginService).toBe('function');
  });

  it('should export CommunityAdvancedService class', () => {
    expect(CommunityAdvancedService).toBeDefined();
    expect(typeof CommunityAdvancedService).toBe('function');
  });

  it('should instantiate CommunityService from index', async () => {
    const service = new CommunityService();
    expect(service.createContribution).toBeDefined();
    expect(service.listContributions).toBeDefined();
    expect(service.getContribution).toBeDefined();
    expect(service.getContributor).toBeDefined();
    expect(service.listContributors).toBeDefined();
    expect(service.createBestPractice).toBeDefined();
    expect(service.listBestPractices).toBeDefined();
    expect(service.getBestPractice).toBeDefined();
    expect(service.voteBestPractice).toBeDefined();
    expect(service.deleteBestPractice).toBeDefined();
  });

  it('should instantiate CommunityPluginService from index', async () => {
    const service = new CommunityPluginService();
    expect(service.submitPlugin).toBeDefined();
    expect(service.listPlugins).toBeDefined();
    expect(service.reviewPlugin).toBeDefined();
  });

  it('should instantiate CommunityAdvancedService from index', async () => {
    const service = new CommunityAdvancedService();
    expect(service.awardBadge).toBeDefined();
    expect(service.listUserBadges).toBeDefined();
    expect(service.getUserBadges).toBeDefined();
    expect(service.getBadgeDefinitions).toBeDefined();
    expect(service.setupIncentiveProgram).toBeDefined();
    expect(service.getIncentivePrograms).toBeDefined();
    expect(service.assignMentor).toBeDefined();
    expect(service.getMentorshipPairs).toBeDefined();
  });
});
