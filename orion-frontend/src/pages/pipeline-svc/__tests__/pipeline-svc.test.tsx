import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import PipelineServiceIndex from '../index';

describe('pipeline-svc', () => {
  it('renders without crashing', () => {
    render(
      <MemoryRouter initialEntries={['/pipeline-svc']}>
        <Routes>
          <Route path="/pipeline-svc" element={<PipelineServiceIndex />} />
          <Route path="/observability/pipelines/monitor" element={<div>Target</div>} />
        </Routes>
      </MemoryRouter>
    );
    expect(document.body).toBeTruthy();
  });
});