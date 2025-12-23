"use client";

import { MouseEvent, useEffect, useRef, useState } from 'react';

type NavItem = {
  label: string;
  href: string;
};

interface MobileTabsProps {
  items: NavItem[];
}

export function MobileTabs({ items }: MobileTabsProps) {
  const [activeHref, setActiveHref] = useState<string>(items[0]?.href ?? '');
  const observerRef = useRef<IntersectionObserver | null>(null);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const updateViewport = () => {
      setIsMobile(window.innerWidth <= 600);
    };

    updateViewport();
    window.addEventListener('resize', updateViewport);
    return () => window.removeEventListener('resize', updateViewport);
  }, []);

  useEffect(() => {
    const sectionIds = items
      .map((item) => (item.href.startsWith('#') ? item.href.slice(1) : ''))
      .filter(Boolean);

    if (!sectionIds.length) return;

    if (isMobile) {
      const container = document.querySelector('main#site-root');
      if (!container) return;

      const sections = sectionIds
        .map((id) => document.getElementById(id))
        .filter((el): el is HTMLElement => Boolean(el));

      const handleScroll = () => {
        let closestHref = items[0]?.href ?? '';
        let minDelta = Number.POSITIVE_INFINITY;

        sections.forEach((section) => {
          const sectionCenter = section.offsetLeft + section.clientWidth / 2;
          const containerCenter = container.scrollLeft + container.clientWidth / 2;
          const delta = Math.abs(sectionCenter - containerCenter);
          if (delta < minDelta) {
            minDelta = delta;
            closestHref = `#${section.id}`;
          }
        });

        if (closestHref) {
          setActiveHref((prev) => (prev === closestHref ? prev : closestHref));
        }
      };

      handleScroll();
      container.addEventListener('scroll', handleScroll, { passive: true });
      return () => container.removeEventListener('scroll', handleScroll);
    }

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((entry) => entry.isIntersecting)
          .map((entry) => ({
            id: entry.target.id,
            offset: Math.abs(entry.boundingClientRect.top),
          }))
          .sort((a, b) => a.offset - b.offset);

        if (visible.length > 0) {
          setActiveHref(`#${visible[0]!.id}`);
        }
      },
      {
        root: null,
        threshold: [0.3, 0.5, 0.7],
        rootMargin: '-20% 0px -40% 0px',
      },
    );

    sectionIds.forEach((id) => {
      const el = document.getElementById(id);
      if (el) observer.observe(el);
    });

    observerRef.current = observer;

    return () => {
      observer.disconnect();
    };
  }, [items, isMobile]);

  const handleClick = (event: MouseEvent<HTMLAnchorElement>, href: string) => {
    const mobileViewport = typeof window !== 'undefined' && window.innerWidth <= 600;

    if (href === '#hero') {
      event.preventDefault();
      document.body.classList.remove('site-entered');
      window.scrollTo({ top: 0, behavior: 'smooth' });
      window.history.replaceState(null, '', '#hero');
      window.dispatchEvent(new CustomEvent('gallery:reset'));
      return;
    }

    document.body.classList.add('site-entered');
    setActiveHref(href);

    const target = document.querySelector(href);
    if (target instanceof HTMLElement) {
      event.preventDefault();
      if (mobileViewport) {
        const container = document.querySelector('main#site-root');
        if (container) {
          const targetCenter = target.offsetLeft + target.clientWidth / 2;
          const containerCenter = container.clientWidth / 2;
          const left = targetCenter - containerCenter;
          container.scrollTo({ left, behavior: 'smooth' });
        }
      } else {
        target.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
      window.history.replaceState(null, '', href);
    }
  };

  return (
    <nav className="mobile-tabs" aria-label="Site section tabs">
      {items.map((item) => (
        <a
          key={item.href}
          href={item.href}
          className={activeHref === item.href ? 'active' : ''}
          onClick={(event) => handleClick(event, item.href)}
        >
          {item.label}
        </a>
      ))}
    </nav>
  );
}
