import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import RDM from '../index';

describe('RDM', () => {
  it('renders without crashing', () => {
    const { container } = render(<RDM />);
    expect(container.firstChild).not.toBeNull();
  });
});
