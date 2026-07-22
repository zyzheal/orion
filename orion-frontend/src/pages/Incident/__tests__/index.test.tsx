/**
 * Tests for IncidentManagement page
 */
import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import IncidentManagement from '../index';

const renderWithRouter = (ui: React.ReactElement) => {
  return render(<MemoryRouter>{ui}</MemoryRouter>);
};

describe('IncidentManagement', () => {
  it('renders without crashing', () => {
    renderWithRouter(<IncidentManagement />);
    expect(document.body).toBeTruthy();
  });
});
