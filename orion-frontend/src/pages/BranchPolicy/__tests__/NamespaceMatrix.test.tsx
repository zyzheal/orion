import { describe, expect, it } from 'vitest';
import { renderWithProviders } from '@/tests/render';
import { MemoryRouter } from 'react-router-dom';
import NamespaceMatrix from '@/pages/BranchPolicy/NamespaceMatrix';

describe('NamespaceMatrix', () => {
  it('renders without crashing', () => {
    renderWithProviders(
      <MemoryRouter>
        <NamespaceMatrix />
      </MemoryRouter>,
    );
    expect(document.body).toBeTruthy();
  });
});
