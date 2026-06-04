"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { useFlyToCart, type FlyEvent } from "@/components/cart/fly-to-cart-context";

/**
 * Fixed-position overlay that animates a small thumbnail from the
 * AddToCartButton's click origin to the basket icon in the top nav.
 *
 * Mounted exactly once near the root of the app. Listens for fly events
 * from `useFlyToCart()` and renders each as a short-lived motion node
 * via AnimatePresence so multiple rapid adds stack cleanly.
 *
 * Skipped entirely when the user prefers reduced motion -- the basket
 * "bump" in PrimaryTabs still fires, which is the accessible confirmation
 * channel.
 */

const FLIGHT_DURATION_MS = 700;
const FLIGHT_DURATION_S = FLIGHT_DURATION_MS / 1000;

interface ActiveFlight extends FlyEvent {
  // Resolved coordinates at trigger time so the animation is stable even
  // if the layout shifts mid-flight.
  fromX: number;
  fromY: number;
  toX: number;
  toY: number;
}

export function FlyToCartLayer() {
  const { subscribe } = useFlyToCart();
  const reduceMotion = useReducedMotion();
  const [flights, setFlights] = useState<ActiveFlight[]>([]);

  useEffect(() => {
    return subscribe((event) => {
      if (reduceMotion) return;
      const { originRect, targetRect } = event;
      if (!originRect || !targetRect) return;

      const flight: ActiveFlight = {
        ...event,
        fromX: originRect.left + originRect.width / 2,
        fromY: originRect.top + originRect.height / 2,
        toX: targetRect.left + targetRect.width / 2,
        toY: targetRect.top + targetRect.height / 2,
      };

      setFlights((prev) => [...prev, flight]);
      window.setTimeout(() => {
        setFlights((prev) => prev.filter((f) => f.id !== flight.id));
      }, FLIGHT_DURATION_MS + 100);
    });
  }, [subscribe, reduceMotion]);

  if (reduceMotion) return null;

  return (
    <div
      aria-hidden
      className="pointer-events-none fixed inset-0 z-[60]"
      data-testid="fly-to-cart-layer"
    >
      <AnimatePresence>
        {flights.map((flight) => (
          <FlightNode key={flight.id} flight={flight} />
        ))}
      </AnimatePresence>
    </div>
  );
}

function FlightNode({ flight }: { flight: ActiveFlight }) {
  // Mid-arc waypoint -- bows the path upward so the chip arcs into the
  // basket rather than sliding in a flat line. Subtle but reads as
  // "tossed into" rather than "slid into".
  const arcLiftPx = Math.min(120, Math.max(40, Math.abs(flight.toY - flight.fromY) * 0.35 + 40));
  const midX = (flight.fromX + flight.toX) / 2;
  const midY = Math.min(flight.fromY, flight.toY) - arcLiftPx;

  return (
    <motion.div
      initial={{ x: flight.fromX, y: flight.fromY, scale: 1, opacity: 0 }}
      animate={{
        x: [flight.fromX, midX, flight.toX],
        y: [flight.fromY, midY, flight.toY],
        scale: [1, 0.85, 0.35],
        opacity: [0, 1, 1, 0.6],
      }}
      exit={{ opacity: 0 }}
      transition={{
        duration: FLIGHT_DURATION_S,
        ease: [0.32, 0.72, 0.32, 1],
        times: [0, 0.15, 1],
      }}
      style={{
        position: "fixed",
        left: 0,
        top: 0,
        translateX: "-50%",
        translateY: "-50%",
      }}
    >
      <FlightChip image={flight.image} />
    </motion.div>
  );
}

function FlightChip({ image }: { image: string | null }) {
  if (image) {
    return (
      <div className="size-12 rounded-full overflow-hidden shadow-lg ring-2 ring-white">
        <Image src={image} alt="" width={48} height={48} className="w-full h-full object-cover" />
      </div>
    );
  }
  return (
    <div className="size-10 rounded-full bg-primary text-primary-foreground shadow-lg ring-2 ring-white flex items-center justify-center">
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={2.5}
        strokeLinecap="round"
        strokeLinejoin="round"
        className="size-5"
        aria-hidden
      >
        <polyline points="20 6 9 17 4 12" />
      </svg>
    </div>
  );
}
