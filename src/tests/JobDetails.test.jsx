import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import JobDetails from '../pages/JobDetails';
import { AppContext } from '../context/AppContext';

vi.mock('../lib/auth', () => ({
  likeJob: vi.fn(),
  unlikeJob: vi.fn(),
  createApplication: vi.fn(() => Promise.resolve()),
}));

vi.mock('@sentry/react', () => ({
  captureException: vi.fn(),
}));

vi.mock('dompurify', () => ({
  default: { sanitize: (html) => html },
}));

vi.mock('../utils/geo', () => ({
  haversineDistance: vi.fn(() => 2.5),
  formatDistance: vi.fn(() => '2.5 km'),
}));

const mockJob = {
  id: 'job-1',
  title: 'Barista',
  company: 'Coffee Co',
  location: 'Dublin',
  pay: '€13/hr',
  description: 'Make great coffee.',
  days: ['Monday'],
  times: { Monday: ['09:00', '17:00'] },
  photos: [],
  deadline: null,
  status: 'Active',
  filled_shifts: [],
};

const mockUser = {
  id: 'user-1',
  name: 'Test Student',
  role: 'student',
  verificationStatus: 'verified',
  cvName: 'cv.pdf',
};

const baseContext = {
  setPage: vi.fn(),
  currentUser: mockUser,
  likedJobs: [],
  setLikedJobs: vi.fn(),
  appliedJobs: [],
  setAppliedJobs: vi.fn(),
  setSavedLikedJobIds: vi.fn(),
  setSavedAppliedJobIds: vi.fn(),
  studentLocation: null,
};

const renderJobDetails = (contextOverrides = {}) =>
  render(
    <MemoryRouter>
      <AppContext.Provider value={{ ...baseContext, ...contextOverrides }}>
        <JobDetails job={mockJob} />
      </AppContext.Provider>
    </MemoryRouter>
  );

describe('JobDetails', () => {
  it('renders job title and company', () => {
    renderJobDetails();
    expect(screen.getByText('Barista')).toBeInTheDocument();
    expect(screen.getByText(/Coffee Co/)).toBeInTheDocument();
  });

  it('shows Apply Now button for verified student with CV', () => {
    renderJobDetails();
    expect(screen.getByRole('button', { name: 'Apply Now' })).toBeInTheDocument();
  });

  it('shows confirmation modal on apply click', () => {
    renderJobDetails();
    fireEvent.click(screen.getByRole('button', { name: 'Apply Now' }));
    expect(screen.getByText(/Apply for Barista\?/i)).toBeInTheDocument();
  });

  it('hides Apply Now button when job is already applied', () => {
    renderJobDetails({ appliedJobs: [mockJob] });
    expect(screen.queryByRole('button', { name: 'Apply Now' })).not.toBeInTheDocument();
  });

  it('redirects to login when unauthenticated user clicks apply', () => {
    const setPage = vi.fn();
    renderJobDetails({ currentUser: null, setPage });
    fireEvent.click(screen.getByRole('button', { name: 'Apply Now' }));
    expect(setPage).toHaveBeenCalledWith('login');
  });
});
