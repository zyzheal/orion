/**
 * Tests for CronJobsPage page
 */
import { describe, it, expect } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { renderWithProviders } from '@/tests/render';
import CronJobsPage from '../index';

const renderWithRouter = (ui: React.ReactElement) => {
  return renderWithProviders(<MemoryRouter>{ui}</MemoryRouter>);
};

describe('CronJobsPage', () => {
  it('renders without crashing', () => {
    renderWithRouter(<CronJobsPage />);
    expect(document.body).toBeTruthy();
  });
});
