import type { CSSProperties } from 'react'

// Per-event brand theming for the RISE chrome (judge, register and admin setup
// surfaces). Emitted as CSS custom properties so they cascade to child
// components without threading props. Tailwind usages reference them with the
// RISE blue as a fallback, e.g. `bg-[var(--brand,#2f5fe0)]`, so any element not
// wrapped by a themed root still renders the default look.
//
// The public leaderboard has its own (class-based) theme in RiseLeaderboard.tsx;
// these tokens mirror the same palettes.

type Brand = {
  brand: string      // solid accent (buttons, active chips, bars)
  press: string      // pressed/hover state of the solid accent
  text: string       // accent used as text/icon colour
  contrast: string   // text/icon colour on top of the solid accent
  bg: string         // page background
  surface: string    // card / panel background
  border: string     // panel border
  glow: string       // radial-gradient accent glow (rgba)
}

const DEFAULT: Brand = {
  brand: '#2f5fe0',
  press: '#2348b8',
  text: '#4d7bff',
  contrast: '#ffffff',
  bg: '#05070f',
  surface: '#0b1226',
  border: '#1a2547',
  glow: 'rgba(47,95,224,0.18)',
}

const BRANDS: Record<string, Brand> = {
  // Evolve — monochrome black & white (theevolveway.com).
  'evolve-deadlift-ladder': {
    brand: '#ffffff',
    press: '#e5e5e5',
    text: '#ffffff',
    contrast: '#000000',
    bg: '#000000',
    surface: '#0a0a0a',
    border: '#1f1f1f',
    glow: 'rgba(255,255,255,0.10)',
  },
  // Turbo — red on black (turbocalisthenics.com / Turbo Store logo #ec2124).
  'turbo-deadhang': {
    brand: '#ec2124',
    press: '#c01a1d',
    text: '#ec2124',
    contrast: '#ffffff',
    bg: '#000000',
    surface: '#0d0d0d',
    border: '#1f1f1f',
    glow: 'rgba(236,33,36,0.16)',
  },
  // RLNTLSS Iron — monochrome black & white.
  'rlntlss-box-jumps': {
    brand: '#ffffff',
    press: '#e5e5e5',
    text: '#ffffff',
    contrast: '#000000',
    bg: '#000000',
    surface: '#0a0a0a',
    border: '#1f1f1f',
    glow: 'rgba(255,255,255,0.10)',
  },
  // LFTD — lime accent on a dark navy base (logo colours #0f2e64 / #dae07c).
  // The public leaderboard uses the light (lime-ground) variant; the admin /
  // judge / register chrome stays dark for legibility, with lime as the accent.
  'lftd-hyrox': {
    brand: '#dae07c',
    press: '#c4cb63',
    text: '#dae07c',
    contrast: '#0f2e64',
    bg: '#0a1428',
    surface: '#0f1c38',
    border: '#20335c',
    glow: 'rgba(218,224,124,0.15)',
  },
}

export function brandVars(slug: string): CSSProperties {
  const b = BRANDS[slug] ?? DEFAULT
  return {
    '--brand': b.brand,
    '--brand-press': b.press,
    '--brand-text': b.text,
    '--brand-contrast': b.contrast,
    '--brand-bg': b.bg,
    '--brand-surface': b.surface,
    '--brand-border': b.border,
    '--brand-glow': b.glow,
  } as CSSProperties
}
