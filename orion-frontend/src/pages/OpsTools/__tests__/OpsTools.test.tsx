import { describe, it, expect } from 'vitest';
import React from 'react';
import { render } from '@testing-library/react';
import OpsTools from '../index';

describe('OpsTools', () => {
  it('renders without crashing', () => {
    const { container } = render(<OpsTools />);
    expect(container.firstChild).not.toBeNull();
  });
});
