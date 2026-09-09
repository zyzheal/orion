import { describe, expect, it } from 'vitest';
import { renderWithProviders } from '@/tests/render';
import { MemoryRouter } from 'react-router-dom';
import BranchProfileList from '@/pages/BranchPolicy/BranchProfileList';

describe('BranchProfileList', () => {
  it('renders without crashing', () => {
    renderWithProviders(
      <MemoryRouter>
        <BranchProfileList />
      </MemoryRouter>,
    );
    expect(document.body).toBeTruthy();
  });
});
