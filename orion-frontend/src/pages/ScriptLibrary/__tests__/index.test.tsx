/**
 * Tests for function page
 */
import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import ScriptLibraryPage from '../index';

const renderWithRouter = (ui: React.ReactElement) => {
  return render(<MemoryRouter>{ui}</MemoryRouter>);
};

describe('ScriptLibrary', () => {
  it('renders without crashing', () => {
    renderWithRouter(<ScriptLibraryPage />);
    expect(document.body).toBeTruthy();
  });
});
