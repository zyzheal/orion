/**
 * Tests for SecretsManagement page
 */
import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import SecretsManagement from '../index';

const renderWithRouter = (ui: React.ReactElement) => {
  return render(<MemoryRouter>{ui}</MemoryRouter>);
};

describe('SecretsManagement', () => {
  it('renders without crashing', () => {
    renderWithRouter(<SecretsManagement />);
    expect(document.body).toBeTruthy();
  });
});
