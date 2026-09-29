"use client";

import { useCallback, useEffect, useState } from "react";
import type { StoreCrop } from "@/db/schema";

// The gallery shop's cart, kept in this browser for this gallery (so it
// survives a refresh or a cancelled checkout). The server prices it again at
// checkout, so nothing here is trusted.

export type CartItem = {
  key: string;
  productId: string;
  variantId: string;
  photoId: string;
  quantity: number;
  crop: StoreCrop | null;
  // Designed in the gallery designer (lib/store/designs.ts).
  designId?: string | null;
  // The client chose a full wrap (for showing the price; checkout re-checks).
  wrap?: boolean;
};

const storageKey = (token: string) => `pez-cart-${token}`;

function read(token: string): CartItem[] {
  try {
    const raw = window.localStorage.getItem(storageKey(token));
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function useCart(token: string) {
  const [items, setItems] = useState<CartItem[]>([]);
  // Read after the first render, so server and browser HTML match.
  useEffect(() => {
    const saved = read(token);
    // eslint-disable-next-line react-hooks/set-state-in-effect -- loading saved browser state once
    if (saved.length) setItems(saved);
  }, [token]);

  const save = useCallback(
    (next: CartItem[]) => {
      setItems(next);
      try {
        window.localStorage.setItem(storageKey(token), JSON.stringify(next));
      } catch {
        // Private browsing: the cart still works until the page closes.
      }
    },
    [token],
  );

  return {
    items,
    add: (item: Omit<CartItem, "key">) => save([...items, { ...item, key: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}` }]),
    setQuantity: (key: string, quantity: number) =>
      save(items.map((i) => (i.key === key ? { ...i, quantity: Math.max(1, Math.min(25, quantity)) } : i))),
    remove: (key: string) => save(items.filter((i) => i.key !== key)),
    clear: () => save([]),
  };
}
