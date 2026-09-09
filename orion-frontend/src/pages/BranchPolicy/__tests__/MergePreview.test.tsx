import { describe, expect, it } from 'vitest';
import { renderWithProviders } from '@/tests/render';
import { MemoryRouter } from 'react-router-dom';
import MergePreview from '@/pages/BranchPolicy/MergePreview';

describe('MergePreview', () => {
  it('renders without crashing', () => {
    renderWithProviders(
      <MemoryRouter>
        <MergePreview />
      </MemoryRouter>,
    );
    expect(document.body).toBeTruthy();
  });
});
