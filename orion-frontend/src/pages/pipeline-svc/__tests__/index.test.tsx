/**
 * Tests for pipeline-svc index page (redirect to pipeline monitor)
 */
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import PipelineServiceIndex from '../index';

describe('pipeline-svc', () => {
  it('redirects to /observability/pipelines/monitor', () => {
    render(
      <MemoryRouter initialEntries={['/pipeline-svc']}>
        <Routes>
          <Route path="/pipeline-svc" element={<PipelineServiceIndex />} />
          <Route
            path="/observability/pipelines/monitor"
            element={<div>Pipeline Monitor Target</div>}
          />
        </Routes>
      </MemoryRouter>
    );
    expect(screen.getByText('Pipeline Monitor Target')).toBeTruthy();
  });
});
