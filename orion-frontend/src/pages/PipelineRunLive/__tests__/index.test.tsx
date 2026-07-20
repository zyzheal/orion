/**
 * Tests for PipelineRunLive page
 */
import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import PipelineRunLive from '../index';

const renderWithRouter = (ui: React.ReactElement) => {
  return render(<MemoryRouter>{ui}</MemoryRouter>);
};

describe('PipelineRunLive', () => {
  it('renders without crashing', () => {
    renderWithRouter(<PipelineRunLive />);
    expect(document.body).toBeTruthy();
  });
});
