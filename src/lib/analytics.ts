import posthog from 'posthog-js';

// Only initialize in production to avoid polluting dev data
if (import.meta.env.PROD) {
  posthog.init(import.meta.env.VITE_POSTHOG_KEY, {
    api_host: import.meta.env.VITE_POSTHOG_HOST,
    // Session recording for Demo Day replay
    session_recording: {
      maskTextSelector: '.sensitive', // mask elements with .sensitive class
    },
    // Autocapture clicks/taps
    autocapture: true,
    // Capture page views — we handle manually for SPA
    capture_pageview: false,
    capture_pageleave: true,
  });
}

export function identifyUser(userId: string, properties?: Record<string, unknown>) {
  if (import.meta.env.PROD) {
    posthog.identify(userId, properties);
  }
}

export function trackEvent(event: string, properties?: Record<string, unknown>) {
  if (import.meta.env.PROD) {
    posthog.capture(event, properties);
  }
}

export function resetUser() {
  if (import.meta.env.PROD) {
    posthog.reset();
  }
}
