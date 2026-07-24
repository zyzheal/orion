/**
 * Tests for ScriptVersionsPage page
 */
import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import ScriptVersionsPage from '../index';

const renderWithRouter = (ui: React.ReactElement) => {
  return render(<MemoryRouter>{ui}</MemoryRouter>);
};

describe('ScriptVersionsPage', () => {
  it('renders without crashing', () => {
    renderWithRouter(<ScriptVersionsPage />);
    expect(document.body).toBeTruthy();
  });
});
