import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import FormDesigner from '../index';

describe('FormDesigner', () => {
  it('renders without crashing', () => {
    const { container } = render(<FormDesigner />);
    expect(container.firstChild).not.toBeNull();
  });
});
