import React from 'react';

// Single source of truth for the official EVNexus logo asset (served from /public/brand).
export const LOGO_SRC = '/brand/evnexus-logo.png';

const SIZE_CLASS = { sm: 'brand-logo-img--sm', md: '', lg: 'brand-logo-img--lg' };

export default function BrandLogo({ size = 'md', className = '', alt = 'EVNexus — Charge, Manage, Grow' }) {
  return (
    <img
      src={LOGO_SRC}
      alt={alt}
      className={`brand-logo-img ${SIZE_CLASS[size] || ''} ${className}`.trim()}
      width="948"
      height="232"
      decoding="async"
    />
  );
}
