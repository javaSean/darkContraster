"use client";

import { useEffect } from 'react';

export function EnterButton() {
  useEffect(() => {
    const hash = window.location.hash;
    const params = new URLSearchParams(window.location.search);
    const sectionParam = params.get('section');
    const shouldEnter =
      hash === '#site-root' ||
      hash === '#store' ||
      sectionParam === 'store';

    if (shouldEnter) {
      document.body.classList.add('site-entered');
      // Ensure we scroll to the store section once layout is ready
      const scrollToStore = () => {
        const target = document.getElementById('store');
        if (target) {
          target.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
      };
      requestAnimationFrame(() => {
        requestAnimationFrame(scrollToStore);
      });
    }
  }, []);

  const handleClick = () => {
    document.body.classList.add('site-entered');
    const target = document.getElementById('site-root');
    window.history.replaceState(null, '', '#site-root');
    // Give the DOM a moment to reveal the site-root before scrolling (helps on mobile)
    window.setTimeout(() => {
      target?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 10);
  };

  return (
    <button type="button" className="enter-button" onClick={handleClick}>
      Enter Site
    </button>
  );
}
