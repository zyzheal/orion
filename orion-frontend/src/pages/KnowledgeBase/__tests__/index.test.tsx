/**
 * Tests for function page
 */
import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import KnowledgeBase from '../index';

const renderWithRouter = (ui: React.ReactElement) => {
  return render(<MemoryRouter>{ui}</MemoryRouter>);
};

describe('KnowledgeBase', () => {
  it('renders without crashing', () => {
    renderWithRouter(<KnowledgeBase />);
    expect(document.body).toBeTruthy();
  });
});
