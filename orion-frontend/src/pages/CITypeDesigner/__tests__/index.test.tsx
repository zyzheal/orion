/**
 * Tests for function page
 */
import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import CITypeDesignerPage from '../index';

const renderWithRouter = (ui: React.ReactElement) => {
  return render(<MemoryRouter>{ui}</MemoryRouter>);
};

describe('CITypeDesigner', () => {
  it('renders without crashing', () => {
    renderWithRouter(<CITypeDesignerPage />);
    expect(document.body).toBeTruthy();
  });
});
