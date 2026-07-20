/**
 * Tests for TestMFLoader page
 */
import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import TestMFLoader from '../index';

const renderWithRouter = (ui: React.ReactElement) => {
  return render(<MemoryRouter>{ui}</MemoryRouter>);
};

describe('TestMFLoader', () => {
  it('renders without crashing', () => {
    renderWithRouter(<TestMFLoader />);
    expect(document.body).toBeTruthy();
  });
});
