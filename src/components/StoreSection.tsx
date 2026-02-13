'use client';

import Image from 'next/image';
import { useEffect, useMemo, useRef, useState } from 'react';
import type { StoreProduct, StoreVariant, StoreCategory } from '../types/store';
import { useCart } from '../context/CartContext';

const FILTERS = [
  { label: 'All', value: 'all' },
  { label: 'Prints', value: 'prints' },
  { label: 'Accessories', value: 'accessories' },
] as const;

type FilterValue = (typeof FILTERS)[number]['value'];

type StoreSectionProps = {
  products: StoreProduct[];
};

type ProductKind = 'tee' | 'hoodie' | 'print' | 'book' | 'tote' | 'default';

export function StoreSection({ products }: StoreSectionProps) {
  const [activeFilter, setActiveFilter] = useState<FilterValue>('all');
  const [selectedVariants, setSelectedVariants] = useState<Record<string, string>>({});
  const [selectedOptions, setSelectedOptions] = useState<Record<string, Record<string, string>>>({});
  const [expandedDescriptions, setExpandedDescriptions] = useState<Record<string, boolean>>({});
  const [checkoutErrors, setCheckoutErrors] = useState<Record<string, string>>({});
  const [imageIndexes, setImageIndexes] = useState<Record<string, number>>({});
  const [lightbox, setLightbox] = useState<{
    productId: string;
    images: string[];
    index: number;
    title: string;
  } | null>(null);
  const {
    addItem,
    toggleCart,
    cartCount,
    cartTotalLabel,
    cartOpen,
  } = useCart();

  useEffect(() => {
    setSelectedVariants((prev) => {
      const next: Record<string, string> = {};
      products.forEach((product) => {
        if (product.variants.length > 1) {
          next[product.id] = prev[product.id] ?? product.variants[0]!.id;
        }
      });
      return next;
    });
    setExpandedDescriptions((prev) => {
      const next: Record<string, boolean> = {};
      products.forEach((product) => {
        next[product.id] = prev[product.id] ?? false;
      });
      return next;
    });
    setSelectedOptions((prev) => {
      const next: Record<string, Record<string, string>> = {};
      products.forEach((product) => {
        if (product.options.length > 0) {
          const productSelections = prev[product.id] ?? {};
          const defaults: Record<string, string> = {};
          product.options.forEach((option) => {
            const defaultValue = productSelections[option.name] ?? option.values[0] ?? '';
            if (defaultValue) {
              defaults[option.name] = defaultValue;
            }
          });
          next[product.id] = defaults;
        }
      });
      return next;
    });
    setImageIndexes({});
  }, [products]);

  const filteredProducts = useMemo(() => {
    if (activeFilter === 'all') return products;
    return products.filter((product) => product.category === activeFilter);
  }, [activeFilter, products]);

  function addToCart(product: StoreProduct, variant?: StoreVariant) {
    if (!variant?.price || !variant.currency) {
      setCheckoutErrors((prev) => ({
        ...prev,
        [product.id]: 'Price unavailable for this selection.',
      }));
      return;
    }
    setCheckoutErrors((prev) => ({ ...prev, [product.id]: '' }));
    addItem({
      productId: product.id,
      variantId: variant.id,
      name: product.name,
      variantTitle: variant.title,
      unitAmount: variant.price,
      currency: variant.currency ?? 'USD',
      image: variant.image ?? product.image,
      quantity: 1,
      kind: mapKindFromCategory(product.category, product.name),
    });
  }

  return (
    <>
    <section className="section" id="store">
      <div className="store-header">
        <div className="store-heading">
          <h2>Store</h2>
        </div>
        <div className="store-filters-wrap" role="group" aria-label="Filter store products">
          <div className="store-filters">
            {FILTERS.map((filter) => (
              <button
                key={filter.value}
                type="button"
                className={`store-filter ${activeFilter === filter.value ? 'active' : ''}`}
                onClick={() => setActiveFilter(filter.value)}
              >
                {filter.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="store-scroll">
        <div className="store-grid">
          {filteredProducts.length > 0 ? (
            filteredProducts.map((product) => {
              const optionSelections = selectedOptions[product.id] ?? {};
              const resolvedVariant = product.options.length
                ? findVariantFromOptions(product, optionSelections)
                : findVariantById(product, selectedVariants[product.id]) ?? product.variants[0];
              const displayPrice = resolvedVariant?.formattedPrice ?? product.price ?? '';
              const baseGallery: string[] =
                (resolvedVariant?.images && resolvedVariant.images.length > 0 && resolvedVariant.images) ||
                (product.productImages && product.productImages.length > 0 && product.productImages) ||
                (resolvedVariant?.image ? [resolvedVariant.image] : product.image ? [product.image] : []);
              const gallerySource = baseGallery.length > 0 ? baseGallery : product.productImages ?? [];
              const gallery: string[] = gallerySource;
              const galleryKey = `${product.id}-${resolvedVariant?.id ?? 'fallback'}`;
              const imageIndex = imageIndexes[galleryKey] ?? 0;
              const displayImage = gallery[imageIndex] ?? gallery[0] ?? '';

              return (
                <article key={product.id} className="card store-card">
                <header className="store-card-header">
                  <h3>{product.name}</h3>
                  {displayPrice && <span className="price-tag">{displayPrice}</span>}
                </header>
                {displayImage && (
                  <div
                    className="card-media"
                    role="button"
                    tabIndex={0}
                    onClick={() =>
                      gallery.length &&
                      setLightbox({ productId: product.id, images: gallery, index: imageIndex, title: product.name })
                    }
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        gallery.length &&
                          setLightbox({ productId: product.id, images: gallery, index: imageIndex, title: product.name });
                      }
                    }}
                    key={galleryKey}
                  >
                    <Image
                      src={displayImage}
                      alt={product.name}
                      width={480}
                      height={480}
                      sizes="(max-width: 768px) 100vw, (max-width: 1200px) 45vw, 30vw"
                      loading="lazy"
                      unoptimized
                      style={{ objectFit: 'cover' }}
                      key={displayImage}
                    />
                    {gallery.length > 1 && (
                      <div className="image-carousel">
                        <button
                          type="button"
                          aria-label="Previous image"
                          onClick={() =>
                            setImageIndexes((prev) => ({
                              ...prev,
                              [galleryKey]: (imageIndex - 1 + gallery.length) % gallery.length,
                            }))
                          }
                        >
                          ‹
                        </button>
                        <div className="dots">
                          {gallery.map((_, idx) => (
                            <button
                              key={idx}
                              type="button"
                              className={`dot ${idx === imageIndex ? 'active' : ''}`}
                              aria-label={`Image ${idx + 1}`}
                              onClick={() =>
                                setImageIndexes((prev) => ({
                                  ...prev,
                                  [galleryKey]: idx,
                                }))
                              }
                            />
                          ))}
                        </div>
                        <button
                          type="button"
                          aria-label="Next image"
                          onClick={() =>
                            setImageIndexes((prev) => ({
                              ...prev,
                              [galleryKey]: (imageIndex + 1) % gallery.length,
                            }))
                          }
                        >
                          ›
                        </button>
                      </div>
                    )}
                  </div>
                )}
              {product.options.length > 0 ? (
                <div className="variant-selector">
                  {product.options.map((option) => {
                    const choices = option.values.map((value) => ({
                      value,
                      label: value,
                    }));
                    const currentValue =
                      selectedOptions[product.id]?.[option.name] ?? choices[0]?.value ?? '';

                    return (
                      <div key={option.name} className="variant-option-block">
                        <span className="variant-label">{option.name}</span>
                        {choices.length <= 1 ? (
                          <p className="variant-single">{choices[0]?.label}</p>
                        ) : (
                          <VariantDropdown
                            ariaLabel={`${product.name} ${option.name}`}
                            options={choices}
                            value={currentValue}
                            onChange={(nextValue) => {
                              setSelectedOptions((prev) => ({
                                ...prev,
                                [product.id]: {
                                  ...(prev[product.id] ?? {}),
                                  [option.name]: nextValue,
                                },
                              }));
                              const nextSelections = {
                                ...optionSelections,
                                [option.name]: nextValue,
                              };
                              const nextVariant =
                                product.options.length > 0
                                  ? findVariantFromOptions(product, nextSelections)
                                  : findVariantById(product, selectedVariants[product.id]) ?? product.variants[0];
                              const nextKey = `${product.id}-${nextVariant?.id ?? 'fallback'}`;
                              setImageIndexes((prev) => ({ ...prev, [nextKey]: 0 }));

                              // Debug: log which image will display after option change
                              const nextGallery = nextVariant?.images?.length
                                ? nextVariant.images
                                : nextVariant?.image
                                  ? [nextVariant.image]
                                  : product.image
                                    ? [product.image]
                                    : [];
                              console.log('Variant image', {
                                product: product.name,
                                selection: nextSelections,
                                variant: nextVariant?.title ?? nextVariant?.id,
                                image: nextGallery[0] ?? null,
                                galleryLength: nextGallery.length,
                              });
                            }}
                          />
                        )}
                      </div>
                    );
                  })}
                </div>
              ) : product.variants.length > 1 ? (
                <div className="variant-selector">
                  <span className="variant-label">Variant</span>
                  <VariantDropdown
                    ariaLabel={`${product.name} variant`}
                    options={product.variants.map((variant) => ({
                      value: variant.id,
                      label: variant.title,
                    }))}
                    value={selectedVariants[product.id] ?? product.variants[0]!.id}
                    onChange={(nextValue) => {
                      setSelectedVariants((prev) => ({
                        ...prev,
                        [product.id]: nextValue,
                      }));
                      setImageIndexes((prev) => ({ ...prev, [`${product.id}-${nextValue}`]: 0 }));

                      // Debug: log which image will display after variant change
                      const nextVariant = findVariantById(product, nextValue);
                      const nextGallery = nextVariant?.images?.length
                        ? nextVariant.images
                        : nextVariant?.image
                          ? [nextVariant.image]
                          : product.image
                            ? [product.image]
                            : [];
                      console.log('Variant image', {
                        product: product.name,
                        variant: nextVariant?.title ?? nextVariant?.id,
                        image: nextGallery[0] ?? null,
                        galleryLength: nextGallery.length,
                      });
                    }}
                  />
                </div>
              ) : null}
              {product.status && product.status.toLowerCase() !== 'active' && (
                <span className="product-status warning">
                  {product.status.replace(/_/g, ' ')}
                </span>
              )}
              <button
                type="button"
                className="buy-button"
                disabled={!resolvedVariant?.price}
                onClick={() => addToCart(product, resolvedVariant)}
              >
                Add to cart
              </button>
              {checkoutErrors[product.id] && <p className="checkout-error">{checkoutErrors[product.id]}</p>}
              {product.description && (
                <div className="card-description-block">
                  {expandedDescriptions[product.id] && (
                    <p className="card-description expanded">{product.description}</p>
                  )}
                  <button
                    type="button"
                    className="description-toggle"
                    onClick={() =>
                      setExpandedDescriptions((prev) => ({
                        ...prev,
                        [product.id]: !prev[product.id],
                      }))
                    }
                  >
                    {expandedDescriptions[product.id] ? 'Show less' : 'Show more'}
                  </button>
                </div>
              )}
            </article>
          );
        })
          ) : (
            <p className="gallery-empty">No products in this category yet.</p>
          )}
        </div>
      </div>
    </section>
    {lightbox && (
      <div
        className="lightbox"
        role="dialog"
        aria-modal="true"
        aria-label={`${lightbox.title} preview`}
        onClick={() => setLightbox(null)}
      >
        <button type="button" className="lightbox-close" aria-label="Close" onClick={() => setLightbox(null)}>
          ×
        </button>
        <div
          className={`lightbox-body ${lightbox.images.length > 1 ? '' : 'single'}`}
          onClick={(e) => e.stopPropagation()}
        >
          {lightbox.images.length > 1 && (
            <button
              type="button"
              className="lightbox-nav prev"
              aria-label="Previous image"
              onClick={() =>
                setLightbox((prev) =>
                  prev
                    ? {
                        ...prev,
                        index: (prev.index - 1 + prev.images.length) % prev.images.length,
                      }
                    : prev,
                )
              }
            >
              ‹
            </button>
          )}
          <div className="lightbox-image">
            <Image
              src={lightbox.images[lightbox.index]}
              alt={lightbox.title}
              width={1400}
              height={1400}
              sizes="(max-width: 768px) 95vw, 80vw"
              unoptimized
              style={{ objectFit: 'contain', maxHeight: '80vh', width: '100%' }}
            />
          </div>
          {lightbox.images.length > 1 && (
            <button
              type="button"
              className="lightbox-nav next"
              aria-label="Next image"
              onClick={() =>
                setLightbox((prev) =>
                  prev
                    ? {
                        ...prev,
                        index: (prev.index + 1) % prev.images.length,
                      }
                    : prev,
                )
              }
            >
              ›
            </button>
          )}
        </div>
        {lightbox.images.length > 1 && (
          <div className="lightbox-dots">
            {lightbox.images.map((_, idx) => (
              <button
                key={idx}
                type="button"
                className={`dot ${idx === lightbox.index ? 'active' : ''}`}
                aria-label={`Image ${idx + 1}`}
                onClick={() =>
                  setLightbox((prev) =>
                    prev
                      ? {
                          ...prev,
                          index: idx,
                        }
                      : prev,
                  )
                }
              />
            ))}
          </div>
        )}
      </div>
    )}
    </>
  );
}

type DropdownOption = {
  value: string;
  label: string;
};

type VariantDropdownProps = {
  ariaLabel: string;
  options: DropdownOption[];
  value: string;
  onChange: (nextValue: string) => void;
};

function VariantDropdown({ ariaLabel, options, value, onChange }: VariantDropdownProps) {
  const [open, setOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const currentOption = options.find((option) => option.value === value) ?? options[0];

  useEffect(() => {
    const handleClick = (event: MouseEvent) => {
      if (!wrapperRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    };

    const handleKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClick);
    document.addEventListener('keydown', handleKey);
    return () => {
      document.removeEventListener('mousedown', handleClick);
      document.removeEventListener('keydown', handleKey);
    };
  }, []);

  if (!currentOption) {
    return null;
  }

  return (
    <div className={`variant-dropdown ${open ? 'open' : ''}`} ref={wrapperRef}>
      <button
        type="button"
        className="variant-select"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={ariaLabel}
        onClick={() => setOpen((prev) => !prev)}
      >
        <span>{currentOption.label}</span>
        <span className="variant-caret" aria-hidden="true">
          ⌄
        </span>
      </button>
      {open && (
        <ul className="variant-menu" role="listbox" aria-label={ariaLabel}>
          {options.map((option) => (
            <li key={option.value}>
              <button
                type="button"
                role="option"
                aria-selected={option.value === currentOption.value}
                className={`variant-menu-option ${option.value === currentOption.value ? 'active' : ''}`}
                onClick={() => {
                  onChange(option.value);
                  setOpen(false);
                }}
              >
                {option.label}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function findVariantFromOptions(product: StoreProduct, selections: Record<string, string> = {}) {
  const signature = buildSelectionSignature(selections);
  if (!product.variants.length) return undefined;
  if (!signature) return product.variants[0];
  const exact = product.variants.find((variant) => variant.optionSignature === signature);
  if (exact) return exact;

  // Fallback: try loose matching by option values when signature formats differ
  const selectionValues = Object.values(selections)
    .filter(Boolean)
    .map((v) => v.trim().toLowerCase());
  const loose = product.variants.find((variant) => {
    const optionVals = Object.values(variant.options ?? {}).map((v) => v.trim().toLowerCase());
    return selectionValues.every((val) => optionVals.includes(val) || (variant.title?.toLowerCase() ?? '').includes(val));
  });
  return loose ?? product.variants[0];
}

function findVariantById(product: StoreProduct, variantId?: string) {
  if (!variantId) return product.variants[0];
  return product.variants.find((variant) => variant.id === variantId) ?? product.variants[0];
}

function buildSelectionSignature(selections: Record<string, string>) {
  const pairs = Object.entries(selections)
    .filter(([name, value]) => Boolean(name) && Boolean(value))
    .map(([name, value]) => `${normalizeOptionKey(name)}::${normalizeOptionValue(value)}`)
    .sort();

  return pairs.join('|');
}

function normalizeOptionKey(input: string) {
  return input.trim().toLowerCase();
}

function normalizeOptionValue(input: string) {
  return input.trim().toLowerCase();
}

function mapKindFromCategory(category: StoreCategory, name: string): ProductKind {
  const lower = name.toLowerCase();
  if (category === 'prints') return 'print';
  if (category === 'accessories') {
    if (lower.includes('tote') || lower.includes('bag')) return 'tote';
    return 'default';
  }
  if (lower.includes('tee') || lower.includes('t-shirt') || lower.includes('shirt')) return 'tee';
  if (lower.includes('hoodie') || lower.includes('pullover') || lower.includes('sweatshirt')) return 'hoodie';
  if (lower.includes('book')) return 'book';
  if (lower.includes('print') || lower.includes('poster')) return 'print';
  return 'default';
}

function appendVariantCacheBuster(src: string) {
  return src;
}
