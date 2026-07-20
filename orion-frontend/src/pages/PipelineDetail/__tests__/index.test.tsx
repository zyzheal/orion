/**
 * Tests for PipelineDetail page
 */
import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import PipelineDetail from '../index';

const renderWithRouter = (ui: React.ReactElement) => {
  return render(<MemoryRouter>{ui}</MemoryRouter>);
};

describe('PipelineDetail', () => {
  it('renders without crashing', () => {
    renderWithRouter(<PipelineDetail />);
    expect(document.body).toBeTruthy();
  });
});
