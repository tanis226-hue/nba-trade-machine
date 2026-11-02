import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { PlayerHeadshot } from '../PlayerHeadshot';

const curry = 'https://a.espncdn.com/i/headshots/nba/players/full/3975.png';
const herro = 'https://a.espncdn.com/i/headshots/nba/players/full/4395725.png';
afterEach(cleanup);

describe('player headshot recovery and accessibility', () => {
  it('renders initials with a stable footprint when no source is known', () => {
    render(<PlayerHeadshot name="  Stephen   Curry " size={48} decorative={false}/>);
    const portrait = screen.getByRole('img', { name: 'Stephen Curry' });
    expect(portrait.style.width).toBe('48px');
    expect(portrait.style.height).toBe('48px');
    expect(portrait.textContent).toBe('SC');
    expect(portrait.querySelector('img')).toBeNull();
  });

  it('does not repeat the adjacent player name for decorative images', () => {
    const { container } = render(<PlayerHeadshot src={curry} name="Stephen Curry"/>);
    expect(screen.queryByRole('img')).toBeNull();
    expect(container.querySelector('img')?.alt).toBe('');
    expect(container.firstElementChild?.getAttribute('aria-hidden')).toBe('true');
  });

  it('retries the original NBA source before falling back to initials', () => {
    const source = 'https://cdn.nba.com/headshots/nba/latest/260x190/201939.png';
    const { container } = render(<PlayerHeadshot src={source} name="Stephen Curry"/>);
    expect(container.querySelector('img')?.src).toContain('/1040x760/201939.png');
    fireEvent.error(container.querySelector('img')!);
    expect(container.querySelector('img')?.src).toBe(source);
    fireEvent.error(container.querySelector('img')!);
    expect(container.querySelector('img')).toBeNull();
    expect(container.textContent).toBe('SC');
  });

  it('retries images after the same avatar slot changes players', () => {
    const { container, rerender } = render(<PlayerHeadshot src={curry} name="Stephen Curry"/>);
    fireEvent.error(container.querySelector('img')!);
    expect(container.textContent).toBe('SC');
    rerender(<PlayerHeadshot src={herro} name="Tyler Herro"/>);
    expect(container.querySelector('img')?.src).toBe(herro);
    rerender(<PlayerHeadshot src={curry} name="Stephen Curry"/>);
    expect(container.querySelector('img')?.src).toBe(curry);
  });
});
