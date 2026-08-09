import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import TestMfIndex from '../index';

describe('test-mf', () => {
  it('renders without crashing', () => {
    render(
      <MemoryRouter initialEntries={['/test-mf']}>
        <Routes>
          <Route path="/test-mf" element={<TestMfIndex />} />
        </Routes>
      </MemoryRouter>
    );
    expect(document.body).toBeTruthy();
  });
});