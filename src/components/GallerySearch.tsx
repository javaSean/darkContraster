"use client";

import Image from 'next/image';
import { useEffect, useMemo, useState } from 'react';

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
            <div className="card-media">
              <Image
                src={piece.src}
                alt={piece.title}
                fill
                sizes={
                  selectedIndex !== null
                    ? '(max-width: 1200px) 80vw, 50vw'
                    : '(max-width: 768px) 100vw, (max-width: 1200px) 45vw, 30vw'
                }
                loading="lazy"
                style={{ objectFit: selectedIndex !== null ? 'contain' : 'cover' }}
              />
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
