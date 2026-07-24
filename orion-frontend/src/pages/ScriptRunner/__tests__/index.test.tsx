/**
 * Tests for ScriptRunnerPage page
 */
import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import ScriptRunnerPage from '../index';

const renderWithRouter = (ui: React.ReactElement) => {
  return render(<MemoryRouter>{ui}</MemoryRouter>);
};

describe('ScriptRunnerPage', () => {
  it('renders without crashing', () => {
    renderWithRouter(<ScriptRunnerPage />);
    expect(document.body).toBeTruthy();
  });
});
