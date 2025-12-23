"use client";

import { useEffect } from 'react';

export function MobileSnapManager() {
  useEffect(() => {
    const isMobile = () => window.matchMedia('(max-width: 600px)').matches;

    if (!isMobile()) {
      return;
    }

    const container = document.querySelector<HTMLElement>('main#site-root');
    if (!container) return;

    let scrollTimeout: number | null = null;

    const getSections = () =>
      Array.from(container.querySelectorAll<HTMLElement>('.section')).filter(
        (section) => section.offsetWidth > 0,
      );

    const snapToClosest = () => {
      const sections = getSections();
      if (!sections.length) return;

      const containerCenter = container.scrollLeft + container.clientWidth / 2;
      let closest: HTMLElement | null = null;
      let minDelta = Number.POSITIVE_INFINITY;

      sections.forEach((section) => {
        const sectionCenter = section.offsetLeft + section.clientWidth / 2;
        const delta = Math.abs(sectionCenter - containerCenter);
        if (delta < minDelta) {
          minDelta = delta;
          closest = section;
        }
      });

      if (!closest) return;

      const targetCenter = closest.offsetLeft + closest.clientWidth / 2;
      const targetLeft = targetCenter - container.clientWidth / 2;
      container.scrollTo({ left: targetLeft, behavior: 'smooth' });
    };

    const handleScroll = () => {
      if (scrollTimeout) window.clearTimeout(scrollTimeout);
      scrollTimeout = window.setTimeout(() => {
        snapToClosest();
      }, 80);
    };

    container.addEventListener('scroll', handleScroll, { passive: true });

    // initial alignment
    snapToClosest();

    const handleResize = () => {
      if (isMobile()) {
        snapToClosest();
      }
    };

    window.addEventListener('resize', handleResize);

    return () => {
      if (scrollTimeout) window.clearTimeout(scrollTimeout);
      container.removeEventListener('scroll', handleScroll);
      window.removeEventListener('resize', handleResize);
    };
  }, []);

  return null;
}
