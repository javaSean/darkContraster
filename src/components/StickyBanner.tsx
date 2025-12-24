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

  useEffect(() => {
    if (!cartOpen) return;

    function handleOutsideClick(event: MouseEvent | TouchEvent) {
      const target = event.target as Node | null;
      if (!target) return;
      if (cartRef.current?.contains(target)) return;
      if (cartToggleRef.current?.contains(target)) return;
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
