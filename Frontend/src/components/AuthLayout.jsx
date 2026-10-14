import React from 'react';

/**
 * Shared split layout for the public sign-in / registration pages.
 * Left: the existing form component (children). Right: brand photography with a short message.
 */
export default function AuthLayout({ image, imageAlt, eyebrow, title, description, highlights = [], children }) {
  return (
    <div className="auth-split-container">
      <div className="auth-form-side">
        <div className="auth-form-inner animate-fade-in">{children}</div>
      </div>

      <aside className="auth-visual-side" aria-label="About EVNexus">
        <div className="auth-visual-sticky">
          <img className="auth-visual-image" src={image} alt={imageAlt} loading="lazy" decoding="async" />
          <div className="auth-visual-overlay" />
          <div className="auth-visual-content">
            {eyebrow && <div className="auth-visual-eyebrow">{eyebrow}</div>}
            <h2 className="auth-visual-title">{title}</h2>
            {description && <p className="auth-visual-text">{description}</p>}
            {highlights.length > 0 && (
              <div className="auth-highlights">
                {highlights.map(({ icon: Icon, title: hTitle, text }) => (
                  <div className="auth-highlight" key={hTitle}>
                    <div className="auth-highlight-icon"><Icon size={18} /></div>
                    <div>
                      <div className="auth-highlight-title">{hTitle}</div>
                      <div className="auth-highlight-text">{text}</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </aside>
    </div>
  );
}
