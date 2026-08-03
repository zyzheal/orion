import { describe, it, expect } from 'vitest';
import React from 'react';
import { render } from '@testing-library/react';
import Automation from '../index';

describe('Automation', () => {
  it('renders without crashing', () => {
    const { container } = render(<Automation />);
    expect(container.firstChild).not.toBeNull();
  });
});
