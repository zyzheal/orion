import { describe, it, expect } from 'vitest';
import FormDesigner from '../index';
import { renderWithProviders } from '@/tests/render';

describe('FormDesigner', () => {
  it('renders without crashing', () => {
    const { container } = renderWithProviders(<FormDesigner />);
    expect(container.firstChild).not.toBeNull();
  });
});
