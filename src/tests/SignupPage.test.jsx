import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import SignupPage from '../pages/SignupPage';

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
      <SignupPage setPage={setPage} />
    </MemoryRouter>
  );

describe('SignupPage', () => {
  it('renders the signup form', () => {
    renderSignup();
    expect(screen.getByPlaceholderText('Full Name')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Email')).toBeInTheDocument();
    expect(screen.getByText('Create account')).toBeInTheDocument();
  });

  it('shows error when required fields are empty', async () => {
    renderSignup();
    fireEvent.click(screen.getByRole('button', { name: /create account/i }));
    expect(screen.getByText('Please fill in all required fields.')).toBeInTheDocument();
  });

  it('shows error when password is too short', () => {
    renderSignup();
    fireEvent.change(screen.getByPlaceholderText('Full Name'), { target: { value: 'Test User' } });
    fireEvent.change(screen.getByPlaceholderText('Email'), { target: { value: 'test@test.com' } });
    fireEvent.change(screen.getByPlaceholderText('Password'), { target: { value: '123' } });
    fireEvent.click(screen.getByRole('button', { name: /create account/i }));
    expect(screen.getByText('Password must be at least 8 characters.')).toBeInTheDocument();
  });

  it('shows CRO number field when company role is selected', () => {
    renderSignup();
    fireEvent.click(screen.getByRole('button', { name: /company/i }));
    expect(screen.getByPlaceholderText(/CRO Number/i)).toBeInTheDocument();
  });
});
