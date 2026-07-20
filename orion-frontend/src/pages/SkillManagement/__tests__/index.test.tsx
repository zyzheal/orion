/**
 * Tests for SkillManagementLayout page
 */
import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import SkillManagementLayout from '../index';

const renderWithRouter = (ui: React.ReactElement) => {
  return render(<MemoryRouter>{ui}</MemoryRouter>);
};

describe('SkillManagementLayout', () => {
  it('renders without crashing', () => {
    renderWithRouter(<SkillManagementLayout />);
    expect(document.body).toBeTruthy();
  });
});
