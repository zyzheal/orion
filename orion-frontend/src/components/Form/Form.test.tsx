import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import Form, { type FormField } from './index';

describe('OrionForm', () => {
  const baseFields: FormField[] = [
    { name: 'username', label: 'Username', type: 'text', required: true },
    { name: 'email', label: 'Email', type: 'text', required: true },
    { name: 'age', label: 'Age', type: 'number' },
  ];

  it('should render all fields', () => {
    render(<Form fields={baseFields} onSubmit={vi.fn()} />);
    expect(screen.getByTestId('orion-form')).toBeInTheDocument();
    expect(screen.getByText('Username')).toBeInTheDocument();
    expect(screen.getByText('Email')).toBeInTheDocument();
    expect(screen.getByText('Age')).toBeInTheDocument();
  });

  it('should render submit button', () => {
    render(<Form fields={baseFields} onSubmit={vi.fn()} submitText="Save" />);
    expect(screen.getByText('Save')).toBeInTheDocument();
  });

  it('should render cancel button when cancelText and onCancel are provided', () => {
    render(<Form fields={baseFields} onSubmit={vi.fn()} cancelText="Cancel" onCancel={vi.fn()} />);
    expect(screen.getByText('Cancel')).toBeInTheDocument();
  });

  it('should hide fields marked as hidden', () => {
    const fields: FormField[] = [
      { name: 'visible', label: 'Visible', type: 'text' },
      { name: 'hidden', label: 'Hidden', type: 'text', hidden: true },
    ];
    render(<Form fields={fields} onSubmit={vi.fn()} />);
    expect(screen.getByText('Visible')).toBeInTheDocument();
    expect(screen.queryByText('Hidden')).not.toBeInTheDocument();
  });

  it('should call onSubmit with form values on submit', async () => {
    const handleSubmit = vi.fn();
    render(<Form fields={baseFields} onSubmit={handleSubmit} />);

    // Fill in the form
    const usernameInput = screen.getByPlaceholderText(/please enter username/i);
    const emailInput = screen.getByPlaceholderText(/please enter email/i);

    fireEvent.change(usernameInput, { target: { value: 'testuser' } });
    fireEvent.change(emailInput, { target: { value: 'test@example.com' } });

    // Click submit
    fireEvent.click(screen.getByText('Submit'));

    await waitFor(() => {
      expect(handleSubmit).toHaveBeenCalledWith(
        expect.objectContaining({
          username: 'testuser',
          email: 'test@example.com',
        })
      );
    });
  });

  it('should show required validation error', async () => {
    const fields: FormField[] = [
      { name: 'name', label: 'Name', type: 'text', required: true },
    ];
    render(<Form fields={fields} onSubmit={vi.fn()} />);

    // Click submit without filling required field
    fireEvent.click(screen.getByText('Submit'));

    await waitFor(() => {
      expect(screen.getByText('Name is required')).toBeInTheDocument();
    });
  });

  it('should support custom validation', async () => {
    const fields: FormField[] = [
      {
        name: 'code',
        label: 'Code',
        type: 'text',
        validate: (value) => {
          const str = value as string;
          if (str && str.length < 3) return 'Must be at least 3 characters';
          return undefined;
        },
      },
    ];
    render(<Form fields={fields} onSubmit={vi.fn()} />);

    const input = screen.getByPlaceholderText(/please enter code/i);
    fireEvent.change(input, { target: { value: 'ab' } });
    fireEvent.click(screen.getByText('Submit'));

    await waitFor(() => {
      expect(screen.getByText('Must be at least 3 characters')).toBeInTheDocument();
    });
  });

  it('should support select field type', () => {
    const fields: FormField[] = [
      {
        name: 'role',
        label: 'Role',
        type: 'select',
        options: [
          { label: 'Admin', value: 'admin' },
          { label: 'User', value: 'user' },
        ],
      },
    ];
    render(<Form fields={fields} onSubmit={vi.fn()} />);
    expect(screen.getByText('Role')).toBeInTheDocument();
  });

  it('should support switch field type', () => {
    const fields: FormField[] = [
      { name: 'active', label: 'Active', type: 'switch' },
    ];
    render(<Form fields={fields} onSubmit={vi.fn()} />);
    expect(screen.getByText('Active')).toBeInTheDocument();
  });

  it('should set initial values', () => {
    const fields: FormField[] = [
      { name: 'name', label: 'Name', type: 'text' },
    ];
    render(<Form fields={fields} onSubmit={vi.fn()} initialValues={{ name: 'John' }} />);
    expect(screen.getByDisplayValue('John')).toBeInTheDocument();
  });

  it('should show loading state on submit button', () => {
    render(<Form fields={baseFields} onSubmit={vi.fn()} submitting={true} />);
    expect(screen.getByText('Submit')).toHaveAttribute('aria-busy');
  });

  it('should hide submit button when showSubmit is false', () => {
    render(<Form fields={baseFields} onSubmit={vi.fn()} showSubmit={false} />);
    expect(screen.queryByText('Submit')).not.toBeInTheDocument();
  });

  it('should support custom render field', () => {
    const fields: FormField[] = [
      {
        name: 'custom',
        label: 'Custom Field',
        type: 'custom',
        render: () => <div data-testid="custom-render">Custom Content</div>,
      },
    ];
    render(<Form fields={fields} onSubmit={vi.fn()} />);
    expect(screen.getByTestId('custom-render')).toBeInTheDocument();
    expect(screen.getByText('Custom Content')).toBeInTheDocument();
  });
});
