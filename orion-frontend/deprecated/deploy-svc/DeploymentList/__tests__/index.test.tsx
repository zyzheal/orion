/**
 * Tests for DeploymentList page
 */
import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import DeploymentList from '../index';

const renderWithRouter = (ui: React.ReactElement) => {
  return render(<MemoryRouter>{ui}</MemoryRouter>);
};

describe('DeploymentList', () => {
  it('renders without crashing', () => {
    renderWithRouter(<DeploymentList />);
    expect(document.body).toBeTruthy();
  });
});
