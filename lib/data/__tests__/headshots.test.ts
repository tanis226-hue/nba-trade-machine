import { describe, expect, it } from 'vitest';
import { headshotSources, headshotZoom } from '../headshots';

describe('player headshot sources', () => {
  it('retains the full ESPN source and its exact player identity', () => {
    const source = 'https://a.espncdn.com/i/headshots/nba/players/full/3975.png';
    expect(headshotSources(source)).toEqual([source]);
  });

  it('upgrades only a known NBA thumbnail while preserving the ID and query', () => {
    const source = 'https://cdn.nba.com/headshots/nba/latest/260x190/201939.png?v=2';
    expect(headshotSources(source)).toEqual([
      'https://cdn.nba.com/headshots/nba/latest/1040x760/201939.png?v=2', source,
    ]);
  });

  it.each([
    'https://cdn.nba.com.example.org/headshots/nba/latest/260x190/201939.png',
    'https://cdn.nba.com/other/260x190/201939.png',
    'https://example.org/260x190/portrait.png',
    '/players/260x190/curry.png',
  ])('leaves unfamiliar source %s unchanged and uncropped', source => {
    expect(headshotSources(source)).toEqual([source]);
    expect(headshotZoom(source)).toBe(1);
  });

  it('never guesses an image when the dataset has no source', () => {
    expect(headshotSources(null)).toEqual([]);
    expect(headshotSources()).toEqual([]);
  });
});
