/**
 * Tests for function page
 */
import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import I18nManagementPage from '../index';

const renderWithRouter = (ui: React.ReactElement) => {
  return render(<MemoryRouter>{ui}</MemoryRouter>);
};

describe('I18nManagement', () => {
  it('renders without crashing', () => {
    renderWithRouter(<I18nManagementPage />);
    expect(document.body).toBeTruthy();
  });
});
