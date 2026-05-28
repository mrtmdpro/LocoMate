"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactNode,
  type RefObject,
} from "react";

/**
 * Shared registry for the "fly to cart" micro-interaction. Provides:
 *
 *   - `flyToCart({ origin, image })` -- triggers an animated flight from
 *     the click origin rect to the basket icon's current bounding rect.
 *     Originally driven by the AddToCartButton on success.
 *   - `registerBasketRef(ref)` -- the primary nav basket calls this once
 *     on mount so the overlay knows where to fly to.
 *   - `subscribe(listener)` -- the FlyToCartLayer subscribes to receive
 *     each flight event and render a one-off animation.
 *
 * Keeping this in context (rather than a global event bus) means SSR is
 * safe, tests can wrap with a provider, and the basket ref / overlay
 * cleanly unmount when the layout does.
 */

export interface FlyEvent {
  id: number;
  originRect: DOMRect | null;
  targetRect: DOMRect | null;
  image: string | null;
}

interface FlyOptions {
  origin: DOMRect | null;
  image?: string | null;
}

interface FlyToCartContextValue {
  flyToCart: (opts: FlyOptions) => void;
  registerBasketRef: (ref: RefObject<HTMLElement | null>) => () => void;
  subscribe: (listener: (event: FlyEvent) => void) => () => void;
  /** Incremented on every successful add. Drives the basket "bump" animation. */
  bumpCounter: number;
}

const FlyToCartContext = createContext<FlyToCartContextValue | null>(null);

export function FlyToCartProvider({ children }: { children: ReactNode }) {
  const basketRefRef = useRef<RefObject<HTMLElement | null> | null>(null);
  const listenersRef = useRef<Set<(event: FlyEvent) => void>>(new Set());
  const nextIdRef = useRef(1);
  const [bumpCounter, setBumpCounter] = useState(0);

  const registerBasketRef = useCallback((ref: RefObject<HTMLElement | null>) => {
    basketRefRef.current = ref;
    return () => {
      if (basketRefRef.current === ref) {
        basketRefRef.current = null;
      }
    };
  }, []);

  const subscribe = useCallback((listener: (event: FlyEvent) => void) => {
    listenersRef.current.add(listener);
    return () => {
      listenersRef.current.delete(listener);
    };
  }, []);

  const flyToCart = useCallback(({ origin, image }: FlyOptions) => {
    const targetEl = basketRefRef.current?.current ?? null;
    const targetRect = targetEl?.getBoundingClientRect() ?? null;
    const event: FlyEvent = {
      id: nextIdRef.current++,
      originRect: origin,
      targetRect,
      image: image ?? null,
    };
    listenersRef.current.forEach((listener) => listener(event));
    // Bump the basket regardless of whether the flight animation runs --
    // a user with reduced-motion still gets a subtle confirmation in the
    // nav even when the flight is skipped.
    setBumpCounter((c) => c + 1);
  }, []);

  const value = useMemo<FlyToCartContextValue>(
    () => ({ flyToCart, registerBasketRef, subscribe, bumpCounter }),
    [flyToCart, registerBasketRef, subscribe, bumpCounter],
  );

  return <FlyToCartContext.Provider value={value}>{children}</FlyToCartContext.Provider>;
}

/**
 * Safe to call outside a provider -- returns no-ops. Lets AddToCartButton
 * render on routes (e.g. tests / storybook) that don't mount the layer.
 */
export function useFlyToCart(): FlyToCartContextValue {
  const ctx = useContext(FlyToCartContext);
  if (ctx) return ctx;
  return {
    flyToCart: () => {},
    registerBasketRef: () => () => {},
    subscribe: () => () => {},
    bumpCounter: 0,
  };
}
