import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import LoginPage from '../pages/LoginPage';
import { AppContext } from '../context/AppContext';

vi.mock('../lib/auth', () => ({
  signIn: vi.fn(),
  sendPasswordReset: vi.fn(),
}));

vi.mock('@sentry/react', () => ({
  captureException: vi.fn(),
}));

const renderLogin = (setPage = vi.fn()) =>
  render(
    <MemoryRouter>
      <AppContext.Provider value={{ setPage }}>
        <LoginPage />
      </AppContext.Provider>
    </MemoryRouter>
  );

describe('LoginPage', () => {
  it('renders the login form', () => {
    renderLogin();
    expect(screen.getByText('Welcome back')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Email address')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Password')).toBeInTheDocument();
    expect(screen.getByText('Login →')).toBeInTheDocument();
  });

  it('shows validation error when submitting empty fields', async () => {
    renderLogin();
    fireEvent.click(screen.getByText('Login →'));
    expect(screen.getByText('Please enter your email and password.')).toBeInTheDocument();
  });

  it('shows forgot password form when link is clicked', () => {
    renderLogin();
    fireEvent.click(screen.getByText('Forgot password?'));
    expect(screen.getByText('Reset password')).toBeInTheDocument();
    expect(screen.getByText('Send Reset Link →')).toBeInTheDocument();
  });

  it('navigates to signup when create account is clicked', () => {
    const setPage = vi.fn();
    renderLogin(setPage);
    fireEvent.click(screen.getByText('Create one free'));
    expect(setPage).toHaveBeenCalledWith('signup');
  });
});
