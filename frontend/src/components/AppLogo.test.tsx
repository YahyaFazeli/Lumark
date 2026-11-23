import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { AppLogo } from './AppLogo';

describe('AppLogo Component', () => {
  it('renders correctly with default size', () => {
    const { getByTestId } = render(<AppLogo />);
    const svg = getByTestId('app-logo');
    expect(svg).toBeInTheDocument();
    expect(svg).toHaveAttribute('width', '18');
    expect(svg).toHaveAttribute('height', '18');
  });

  it('renders with custom size and class', () => {
    const { getByTestId } = render(<AppLogo size={24} className="custom-logo" />);
    const svg = getByTestId('app-logo');
    expect(svg).toHaveAttribute('width', '24');
    expect(svg).toHaveAttribute('height', '24');
    expect(svg).toHaveClass('custom-logo');
  });
});
