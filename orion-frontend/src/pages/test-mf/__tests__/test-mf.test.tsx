import { describe, it, expect } from 'vitest';
import React from 'react';
import { render } from '@testing-library/react';
import test-mf from '../index';

describe('test-mf', () => {
  it('renders without crashing', () => {
    const { container } = render(<test-mf />);
    expect(container.firstChild).not.toBeNull();
  });
});
