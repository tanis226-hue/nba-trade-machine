'use client';

import { useState } from 'react';
import { headshotSources, headshotZoom } from '@/lib/data/headshots';

type PlayerHeadshotProps = {
  src?: string | null;
  name: string;
  size?: number;
  shape?: 'circle' | 'rounded';
  /** Hide a repeated portrait from assistive technology when the name is adjacent. */
  decorative?: boolean;
  className?: string;
};

/** A face-framed avatar using the existing player's verified image source. */
export function PlayerHeadshot({ src, name, size = 48, shape = 'circle', decorative = true, className = '' }: PlayerHeadshotProps) {
  return <span
    className={`shrink-0 bg-[var(--surface-2)] font-semibold text-[var(--muted)] ring-1 ring-[var(--border)] ${className}`}
    aria-hidden={decorative || undefined}
    role={decorative ? undefined : 'img'}
    aria-label={decorative ? undefined : name}
    style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', width: size, height: size, borderRadius: shape === 'circle' ? '50%' : 12, fontSize: Math.max(8, Math.round(size * 0.28)), lineHeight: 1 }}
  >
    <HeadshotContent key={src ?? ''} src={src} name={name} size={size}/>
  </span>;
}

function HeadshotContent({ src, name, size }: Pick<PlayerHeadshotProps, 'src' | 'name'> & { size: number }) {
  // A source change remounts this child so a failed previous player never hides
  // the next player's portrait. Each known source has at most one fallback.
  const [attempt, setAttempt] = useState(0);
  const sources = headshotSources(src);
  const source = sources[attempt];
  if (!source) return <span aria-hidden="true">{name.trim().split(/\s+/).filter(Boolean).slice(0, 2).map(word => Array.from(word)[0]).join('').toLocaleUpperCase('en-US') || '?'}</span>;

  return (
    // ESPN full portraits and the NBA high-resolution source already cover 3x
    // density at avatar sizes; do not send these through a small image resize.
    // eslint-disable-next-line @next/next/no-img-element
    <img
      key={source}
      src={source}
      alt=""
      width={size}
      height={size}
      loading="lazy"
      decoding="async"
      onError={() => setAttempt(attempt + 1)}
      style={{ display: 'block', width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'center top', transform: `scale(${headshotZoom(source)})`, transformOrigin: 'center 25%' }}
    />
  );
}
