import { describe, it, expect } from 'vitest';
import React from 'react';
import { render } from '@testing-library/react';
import pipeline-svc from '../index';

describe('pipeline-svc', () => {
  it('renders without crashing', () => {
    const { container } = render(<pipeline-svc />);
    expect(container.firstChild).not.toBeNull();
  });
});
