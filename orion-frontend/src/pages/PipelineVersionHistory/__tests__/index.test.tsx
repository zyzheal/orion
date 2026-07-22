/**
 * Tests for PipelineVersionHistory page
 */
import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import PipelineVersionHistory from '../index';

const renderWithRouter = (ui: React.ReactElement) => {
  return render(<MemoryRouter>{ui}</MemoryRouter>);
};

describe('PipelineVersionHistory', () => {
  it('renders without crashing', () => {
    renderWithRouter(<PipelineVersionHistory />);
    expect(document.body).toBeTruthy();
  });
});
