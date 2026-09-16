import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import SignupPage from '../pages/SignupPage';
import { AppContext } from '../context/AppContext';

vi.mock('../lib/auth', () => ({
  signUp: vi.fn(),
}));

vi.mock('../data/jobCategories', () => ({
  jobCategories: ['Retail', 'Hospitality', 'Admin'],
}));

vi.mock('@sentry/react', () => ({
  captureException: vi.fn(),
}));

const renderSignup = (setPage = vi.fn()) =>
  render(
    <MemoryRouter>
      <AppContext.Provider value={{ setPage }}>
        <SignupPage />
      </AppContext.Provider>
    </MemoryRouter>
  );

describe('SignupPage', () => {
  it('renders the signup form', () => {
    renderSignup();
    expect(screen.getByPlaceholderText('Full Name')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Email')).toBeInTheDocument();
    expect(screen.getByText('Create Account →')).toBeInTheDocument();
  });

  it('shows error when required fields are empty', async () => {
    renderSignup();
    fireEvent.click(screen.getByRole('button', { name: /create account/i }));
    // The form validates every field at once and shows a specific message per
    // field (not one generic message) — with an empty form, the Name field's
    // error is the first one set. Each error is prefixed with a "⚠ " warning
    // icon by the FieldError component, so match with a regex rather than an
    // exact string.
    expect(screen.getByText(/Please enter your name\./)).toBeInTheDocument();
  });

  it('shows error when password is too short', () => {
    renderSignup();
    fireEvent.change(screen.getByPlaceholderText('Full Name'), { target: { value: 'Test User' } });
    fireEvent.change(screen.getByPlaceholderText('Email'), { target: { value: 'test@test.com' } });
    fireEvent.change(screen.getByPlaceholderText('Password'), { target: { value: '123' } });
    fireEvent.click(screen.getByRole('checkbox'));
    fireEvent.click(screen.getByRole('button', { name: /create account/i }));
    // Regex match to allow for the "⚠ " icon FieldError prepends to the message.
    expect(screen.getByText(/Password must be at least 8 characters\./)).toBeInTheDocument();
  });

  it('shows CRO number field when company role is selected', () => {
    renderSignup();
    fireEvent.click(screen.getByRole('button', { name: /company/i }));
    expect(screen.getByPlaceholderText(/CRO Number/i)).toBeInTheDocument();
  });
});
