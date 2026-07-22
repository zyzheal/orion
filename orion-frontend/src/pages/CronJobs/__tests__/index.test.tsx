/**
 * Tests for CronJobsPage page
 */
import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import CronJobsPage from '../index';

const renderWithRouter = (ui: React.ReactElement) => {
  return render(<MemoryRouter>{ui}</MemoryRouter>);
};

describe('CronJobsPage', () => {
  it('renders without crashing', () => {
    renderWithRouter(<CronJobsPage />);
    expect(document.body).toBeTruthy();
  });
});
