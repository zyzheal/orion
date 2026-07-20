/**
 * Tests for EventRegistryPage page
 */
import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import EventRegistryPage from '../index';

const renderWithRouter = (ui: React.ReactElement) => {
  return render(<MemoryRouter>{ui}</MemoryRouter>);
};

describe('EventRegistryPage', () => {
  it('renders without crashing', () => {
    renderWithRouter(<EventRegistryPage />);
    expect(document.body).toBeTruthy();
  });
});
