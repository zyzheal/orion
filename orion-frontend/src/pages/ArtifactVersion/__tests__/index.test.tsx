/**
 * Tests for ArtifactVersionPage page
 */
import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import ArtifactVersionPage from '../index';

const renderWithRouter = (ui: React.ReactElement) => {
  return render(<MemoryRouter>{ui}</MemoryRouter>);
};

describe('ArtifactVersionPage', () => {
  it('renders without crashing', () => {
    renderWithRouter(<ArtifactVersionPage />);
    expect(document.body).toBeTruthy();
  });
});
