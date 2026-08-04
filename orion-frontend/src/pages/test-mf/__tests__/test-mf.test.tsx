import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import TestMfIndex from '../index';

describe('test-mf', () => {
  it('renders without crashing', () => {
    const { container } = render(<TestMfIndex />);
    expect(container.firstChild).not.toBeNull();
  });
});
