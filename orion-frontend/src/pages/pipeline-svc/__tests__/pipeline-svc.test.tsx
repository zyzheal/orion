import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import PipelineServiceIndex from '../index';

describe('pipeline-svc', () => {
  it('renders without crashing', () => {
    const { container } = render(<PipelineServiceIndex />);
    expect(container.firstChild).not.toBeNull();
  });
});
