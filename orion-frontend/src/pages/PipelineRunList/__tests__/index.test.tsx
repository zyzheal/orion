/**
 * Tests for PipelineRunList page
 */
import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import PipelineRunList from '../index';

const renderWithRouter = (ui: React.ReactElement) => {
  return render(<MemoryRouter>{ui}</MemoryRouter>);
};

describe('PipelineRunList', () => {
  it('renders without crashing', () => {
    renderWithRouter(<PipelineRunList />);
    expect(document.body).toBeTruthy();
  });
});
