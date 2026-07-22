/**
 * Tests for DeploymentDetail page
 */
import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import DeploymentDetail from '../index';

const renderWithRouter = (ui: React.ReactElement) => {
  return render(<MemoryRouter>{ui}</MemoryRouter>);
};

describe('DeploymentDetail', () => {
  it('renders without crashing', () => {
    renderWithRouter(<DeploymentDetail />);
    expect(document.body).toBeTruthy();
  });
});
