import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { Loading } from '@/components/Loading';

describe('Loading', () => {
  it('should render loading component', () => {
    const { container } = render(<Loading />);
    expect(container.querySelector('.ant-spin')).toBeInTheDocument();
  });

  it('should render in fullscreen mode', () => {
    const { container } = render(<Loading fullscreen />);
    const overlay = container.firstChild;
    expect(overlay).toHaveStyle('position: fixed');
  });
});
