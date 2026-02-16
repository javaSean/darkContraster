"use client";

import { useEffect, useMemo, useRef, useState } from 'react';
import type { MouseEvent } from 'react';

type GalleryImage = {
  title: string;
  src: string;
};

interface GallerySearchProps {
  images: GalleryImage[];
}

export function GallerySearch({ images }: GallerySearchProps) {
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const fullscreenTargetRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const reset = () => setSelectedIndex(null);
    window.addEventListener('gallery:reset', reset);
    return () => window.removeEventListener('gallery:reset', reset);
  }, []);

  const filtered = useMemo(() => {
    if (!query.trim()) return images;
    const normalized = query.trim().toLowerCase();
    return images.filter((image) => image.title.toLowerCase().includes(normalized));
  }, [images, query]);

  useEffect(() => {
    if (selectedIndex !== null && (selectedIndex < 0 || selectedIndex >= filtered.length)) {
      setSelectedIndex(null);
    }
  }, [filtered, selectedIndex]);

  useEffect(() => {
    function handleFullscreenChange() {
      setIsFullscreen(Boolean(document.fullscreenElement));
    }
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  async function handleFullscreenToggle(event: MouseEvent<HTMLButtonElement>) {
    event.stopPropagation();
    if (document.fullscreenElement || (document as Document & { webkitFullscreenElement?: Element }).webkitFullscreenElement) {
      const doc = document as Document & { webkitExitFullscreen?: () => Promise<void> | void };
      if (document.exitFullscreen) {
        await document.exitFullscreen();
      } else if (doc.webkitExitFullscreen) {
        await doc.webkitExitFullscreen();
      }
      return;
    }
    const target = fullscreenTargetRef.current;
    if (target?.requestFullscreen) {
      await target.requestFullscreen();
    } else if (target) {
      const maybeWebkit = target as HTMLElement & { webkitRequestFullscreen?: () => Promise<void> | void };
      if (maybeWebkit.webkitRequestFullscreen) {
        await maybeWebkit.webkitRequestFullscreen();
      }
    }
  }

  const visibleImages =
    selectedIndex !== null && filtered[selectedIndex]
      ? [filtered[selectedIndex]]
      : filtered;

  return (
    <>
      <div className="gallery-header">
        <h2>Gallery</h2>
        <div className="gallery-search">
          <label htmlFor="gallery-search-input" className="sr-only">
            Search gallery
          </label>
          <input
            id="gallery-search-input"
            type="search"
            placeholder="Search titles..."
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              setSelectedIndex(null);
            }}
          />
        </div>
      </div>

      {selectedIndex !== null && (
        <div className="gallery-detail-controls">
          <button type="button" onClick={() => setSelectedIndex((prev) => (prev !== null ? (prev - 1 + filtered.length) % filtered.length : prev))}>
            ← Prev
          </button>
          <button type="button" onClick={() => setSelectedIndex(null)}>
            Show full gallery
          </button>
          <button type="button" onClick={() => setSelectedIndex((prev) => (prev !== null ? (prev + 1) % filtered.length : prev))}>
            Next →
          </button>
        </div>
      )}

      <div className={`gallery-grid gallery-scroll${selectedIndex !== null ? ' detail-view' : ''}`}>
        {visibleImages.map((piece) => (
          <article
            key={piece.src}
            className={`card gallery-card${selectedIndex !== null ? ' expanded' : ''}`}
            onClick={() => {
              if (selectedIndex === null) {
                setSelectedIndex(filtered.findIndex((img) => img.src === piece.src));
              }
            }}
          >
            <div
              className="card-media"
              ref={selectedIndex !== null ? fullscreenTargetRef : null}
            >
              <img
                src={piece.src}
                alt={piece.title}
                loading="lazy"
                style={{
                  width: '100%',
                  height: '100%',
                  objectFit: selectedIndex !== null ? 'contain' : 'cover',
                }}
              />
              {selectedIndex !== null && (
                <button
                  type="button"
                  className="gallery-fullscreen-toggle"
                  onClick={handleFullscreenToggle}
                  aria-label={isFullscreen ? 'Exit full screen' : 'View full screen'}
                >
                  {isFullscreen ? '↘︎' : '↗︎'}
                </button>
              )}
            </div>
            <header>
              <h3>{piece.title}</h3>
            </header>
          </article>
        ))}

        {!visibleImages.length && <p className="gallery-empty">No pieces match that title.</p>}
      </div>
    </>
  );
}
