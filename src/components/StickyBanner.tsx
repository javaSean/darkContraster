"use client";

import Image from 'next/image';
import { forwardRef, useEffect, useRef } from 'react';
import { useCart } from '../context/CartContext';

const COUNTRY_OPTIONS = [
  { code: 'US', label: 'United States' },
  { code: 'CA', label: 'Canada' },
  { code: 'GB', label: 'United Kingdom' },
  { code: 'IE', label: 'Ireland' },
  { code: 'NL', label: 'Netherlands' },
  { code: 'DE', label: 'Germany' },
  { code: 'FR', label: 'France' },
  { code: 'IT', label: 'Italy' },
  { code: 'ES', label: 'Spain' },
  { code: 'SE', label: 'Sweden' },
  { code: 'NO', label: 'Norway' },
  { code: 'DK', label: 'Denmark' },
  { code: 'FI', label: 'Finland' },
  { code: 'BE', label: 'Belgium' },
  { code: 'CH', label: 'Switzerland' },
  { code: 'AT', label: 'Austria' },
  { code: 'PL', label: 'Poland' },
  { code: 'PT', label: 'Portugal' },
  { code: 'AU', label: 'Australia' },
  { code: 'NZ', label: 'New Zealand' },
  { code: 'SG', label: 'Singapore' },
  { code: 'JP', label: 'Japan' },
  { code: 'BR', label: 'Brazil' },
  { code: 'MX', label: 'Mexico' },
  { code: 'AR', label: 'Argentina' },
  { code: 'CL', label: 'Chile' },
  { code: 'CO', label: 'Colombia' },
  { code: 'PE', label: 'Peru' },
  { code: 'UY', label: 'Uruguay' },
  { code: 'ZA', label: 'South Africa' },
] as const;

export function StickyBanner() {
  const {
    items,
    cartCount,
    cartTotalLabel,
    cartOpen,
    shippingCountry,
    postalCode,
    shippingAmount,
    shippingLabel,
    setShippingCountry,
    setPostalCode,
    toggleCart,
    updateQuantity,
    removeItem,
    checkoutCart,
    cartError,
    purchasingId,
    closeCart,
  } = useCart();

  const cartRef = useRef<HTMLDivElement | null>(null);
  const cartToggleRef = useRef<HTMLButtonElement | null>(null);
  const mobileCartToggleRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    if (!cartOpen) return;

    function handleOutsideClick(event: MouseEvent | TouchEvent) {
      const target = event.target as Node | null;
      if (!target) return;
      if (cartRef.current?.contains(target)) return;
      if (cartToggleRef.current?.contains(target)) return;
      if (mobileCartToggleRef.current?.contains(target)) return;
      closeCart();
    }

    document.addEventListener('mousedown', handleOutsideClick);
    document.addEventListener('touchstart', handleOutsideClick);
    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
      document.removeEventListener('touchstart', handleOutsideClick);
    };
  }, [cartOpen, closeCart]);

  return (
    <>
      {purchasingId && (
        <div className="checkout-overlay">
          <div className="checkout-overlay__content">
            <div className="checkout-spinner" />
            <p>Redirecting to secure checkout…</p>
          </div>
        </div>
      )}
      <header className="brand-banner compact">
        <a
          href="#hero"
          onClick={() => {
            document.body.classList.remove('site-entered');
            window.scrollTo({ top: 0, behavior: 'smooth' });
          }}
        >
          <Image
            src="/images/darkContraster_text.png"
            alt="Dark Contraster title lockup"
            loading="eager"
            priority
            unoptimized
            width={1600}
            height={320}
          />
        </a>

        <div className="header-cart">
          <button
            type="button"
            className={`cart-toggle ${cartOpen ? 'open' : ''}`}
            onClick={toggleCart}
            aria-expanded={cartOpen}
            ref={cartToggleRef}
          >
            Cart
            <span className="cart-count">{cartCount}</span>
            {cartTotalLabel && <span className="cart-total">{cartTotalLabel}</span>}
          </button>
        </div>
      </header>

      <button
        type="button"
        className={`cart-toggle mobile-cart-toggle ${cartOpen ? 'open' : ''}`}
        onClick={toggleCart}
        aria-expanded={cartOpen}
        aria-label="Open cart"
        ref={mobileCartToggleRef}
      >
        <span className="cart-count">{cartCount}</span>
        <svg
          className="cart-icon"
          aria-hidden="true"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <circle cx="9" cy="20" r="1.6" />
          <circle cx="17" cy="20" r="1.6" />
          <path d="M3 4h2l2.2 10.5a2 2 0 0 0 2 1.5h7.5a2 2 0 0 0 1.9-1.4L21 8H7.2" />
        </svg>
        {cartTotalLabel && <span className="cart-total">{cartTotalLabel}</span>}
      </button>

      {cartOpen && (
        <CartDropdown
          ref={cartRef}
          items={items}
          updateQuantity={updateQuantity}
          removeItem={removeItem}
          shippingCountry={shippingCountry}
          postalCode={postalCode}
          setShippingCountry={setShippingCountry}
          setPostalCode={setPostalCode}
          shippingAmount={shippingAmount}
          shippingLabel={shippingLabel}
          cartError={cartError}
          checkoutCart={checkoutCart}
          purchasingId={purchasingId}
          closeCart={closeCart}
        />
      )}
    </>
  );
}

type CartDropdownProps = {
  items: ReturnType<typeof useCart>['items'];
  updateQuantity: (productId: string, variantId: string | undefined, delta: number) => void;
  removeItem: (productId: string, variantId?: string) => void;
  shippingCountry: string;
  postalCode: string;
  setShippingCountry: (next: string) => void;
  setPostalCode: (next: string) => void;
  shippingAmount: number | null;
  shippingLabel: string;
  cartError: string;
  checkoutCart: () => Promise<void>;
  purchasingId: string | null;
  closeCart: () => void;
};

const CartDropdown = forwardRef<HTMLDivElement, CartDropdownProps>(function CartDropdown(
  {
    items,
    updateQuantity,
    removeItem,
    shippingCountry,
    postalCode,
    setShippingCountry,
    setPostalCode,
    shippingAmount,
    shippingLabel,
    cartError,
    checkoutCart,
    purchasingId,
    closeCart,
  },
  ref,
) {
  return (
    <div ref={ref} className="cart-dropdown" role="dialog" aria-label="Cart">
      <div className="cart-panel-header">
        <h3>Cart</h3>
        <button type="button" className="cart-close" onClick={closeCart} aria-label="Close cart">
          ×
        </button>
      </div>
      <div className="cart-items-wrap">
        {items.length === 0 ? (
          <p className="cart-empty">Your cart is empty.</p>
        ) : (
          <ul className="cart-items" aria-live="polite">
            {items.map((item) => (
              <li key={`${item.productId}-${item.variantId ?? 'default'}`} className="cart-item">
                <div className="cart-item-info">
                  <p className="cart-item-title">{item.name}</p>
                  {item.variantTitle && <p className="cart-item-variant">{item.variantTitle}</p>}
                  <p className="cart-item-price">
                    {formatPrice(item.unitAmount, item.currency)} × {item.quantity}
                  </p>
                </div>
                <div className="cart-item-actions">
                  <div className="cart-qty">
                    <button
                      type="button"
                      aria-label="Decrease quantity"
                      onClick={() => updateQuantity(item.productId, item.variantId, -1)}
                    >
                      −
                    </button>
                    <span>{item.quantity}</span>
                    <button
                      type="button"
                      aria-label="Increase quantity"
                      onClick={() => updateQuantity(item.productId, item.variantId, 1)}
                    >
                      +
                    </button>
                  </div>
                  <button
                    type="button"
                    className="cart-remove"
                    onClick={() => removeItem(item.productId, item.variantId)}
                  >
                    Remove
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
      <div className="cart-shipping">
        <div className="cart-shipping-inputs">
          <div className="cart-field">
            <label htmlFor="ship-country">Country</label>
            <select
              id="ship-country"
              value={shippingCountry}
              onChange={(e) => setShippingCountry(e.target.value)}
            >
              <option value="">Select</option>
              {COUNTRY_OPTIONS.map((country) => (
                <option key={country.code} value={country.code}>
                  {country.label}
                </option>
              ))}
            </select>
          </div>
          <div className="cart-field">
            <label htmlFor="ship-postal">Postal code</label>
            <input
              id="ship-postal"
              value={postalCode}
              onChange={(e) => setPostalCode(e.target.value)}
              placeholder="90210"
            />
          </div>
        </div>
        {shippingAmount && (
          <p className="cart-shipping-note">
            {shippingLabel}: {formatPrice(shippingAmount / 100, 'USD')}
          </p>
        )}
      </div>
      {cartError && <p className="checkout-error">{cartError}</p>}
      <button
        type="button"
        className="buy-button checkout"
        onClick={checkoutCart}
        disabled={purchasingId === 'cart' || items.length === 0}
      >
        <span className="checkout-label">
          {purchasingId === 'cart' ? 'Redirecting…' : 'Checkout'}
        </span>
        {items.length > 0 && (
          <span className="checkout-subtotal">
            Subtotal:{' '}
            {formatPrice(
              items.reduce((sum, item) => sum + item.unitAmount * item.quantity, 0) +
                (shippingAmount ? shippingAmount / 100 : 0),
              items[0]?.currency ?? 'USD',
            )}
          </span>
        )}
      </button>
      <style jsx global>{`
        .checkout-overlay {
          position: fixed;
          inset: 0;
          background: rgba(0, 0, 0, 0.6);
          backdrop-filter: blur(2px);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 9999;
        }
        .checkout-overlay__content {
          color: #f7f7f7;
          background: #0d0d0f;
          border: 1px solid #2a2a2f;
          padding: 18px 22px;
          border-radius: 10px;
          box-shadow: 0 12px 30px rgba(0, 0, 0, 0.45);
          text-align: center;
          min-width: 240px;
          display: grid;
          gap: 10px;
          font-size: 15px;
          letter-spacing: 0.01em;
        }
        .checkout-spinner {
          width: 36px;
          height: 36px;
          margin: 0 auto;
          border-radius: 50%;
          border: 3px solid rgba(255, 255, 255, 0.25);
          border-top-color: #ffffff;
          animation: checkout-spin 0.9s linear infinite;
        }
        @keyframes checkout-spin {
          to {
            transform: rotate(360deg);
          }
        }
      `}</style>
    </div>
  );
});

function formatPrice(amount?: number, currency?: string) {
  if (typeof amount !== 'number') return '';
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency ?? 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(amount);
}
