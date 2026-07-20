/**
 * Tests for PluginSPIPage page
 */
import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import PluginSPIPage from '../index';

const renderWithRouter = (ui: React.ReactElement) => {
  return render(<MemoryRouter>{ui}</MemoryRouter>);
};

describe('PluginSPIPage', () => {
  it('renders without crashing', () => {
    renderWithRouter(<PluginSPIPage />);
    expect(document.body).toBeTruthy();
  });
});
