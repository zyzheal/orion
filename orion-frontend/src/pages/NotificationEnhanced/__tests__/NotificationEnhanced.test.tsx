import { describe, it, expect } from 'vitest';
import React from 'react';
import { render } from '@testing-library/react';
import NotificationEnhanced from '../index';

describe('NotificationEnhanced', () => {
  it('renders without crashing', () => {
    const { container } = render(<NotificationEnhanced />);
    expect(container.firstChild).not.toBeNull();
  });
});
