// Talks to SwaggPress Creations' partner API (swaggpress.com/api/partner),
// Elle's print and merch company and the store's first lab partner. Each
// photographer uses their own SwaggPress API key; SwaggPress charges their
// card on file at wholesale when an order arrives.

const BASE = (process.env.SWAGGPRESS_URL ?? "https://swaggpress.com").replace(/\/+$/, "");

export type SwaggVariant = {
  id: number;
  color: string | null;
  color_hex: string | null;
  size: string | null;
  wholesale_price: number;
  print_w_in: number | null;
  print_h_in: number | null;
  image: string | null;
};

export type SwaggProduct = {
  id: number;
  name: string;
  description: string | null;
  category: string;
  wholesale_price: number;
  mockup_front: string | null;
  photos: string[];
  full_wrap: boolean;
  variants: SwaggVariant[];
  // How it's designed: SwaggPress's product canvas, print areas and mockups.
  design?: SwaggDesign;
  // Options besides color and size; each choice's price change in dollars.
  options?: {
    name: string;
    required: boolean;
    choices: { label: string; mod: number }[];
    show_if?: { option: string; choice: string } | null;
  }[];
  // How customers buy it, and the fields a custom_text product asks for.
  purchase_mode?: "custom_design" | "custom_text" | "standard";
  custom_fields?: {
    key: string;
    label: string;
    placeholder?: string;
    max?: number;
    required?: boolean;
    type?: "text" | "select" | "image";
    source?: "upload" | "gallery";
    options?: string[];
    show_if?: { option: string; choice: string } | null;
  }[];
};

type SwaggArea = { x: number; y: number; w: number; h: number };
export type SwaggDesign = {
  canvas: { w: number; h: number };
  front: { mockup: string | null; area: SwaggArea };
  back: { mockup: string | null; area: SwaggArea } | null;
  print_mask: string | null;
  full_wrap: boolean;
  print_px: { w: number; h: number; dpi: number };
  // "Customer chooses": panels or a full wrap costing wrap_upcharge more.
  wrap_optional?: boolean;
  wrap_upcharge?: number;
  // The whole wrap laid flat, in inches.
  wrap_in?: { w: number; h: number } | null;
};

export type SwaggCatalog = {
  partner: { business_name: string; card_on_file: boolean };
  currency: string;
  live_shipping: boolean;
  products: SwaggProduct[];
};

export type SwaggRate = { id: string; carrier: string; service: string; amount: number; days: number | null };

export type SwaggShipTo = { name: string; line1: string; line2?: string; city: string; state: string; zip: string; phone?: string };

export type SwaggOrder = {
  partner_ref: string;
  order_number: string;
  status: "pending" | "paid" | "processing" | "shipped" | "delivered" | "cancelled" | "refunded";
  wholesale_total: number;
  shipping: number;
  carrier: string | null;
  tracking_number: string | null;
  updated_at: string | null;
};

export class SwaggPressError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}

async function call<T>(apiKey: string, path: string, init: { method?: string; body?: unknown } = {}): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`${BASE}/api/partner/${path}`, {
      method: init.method ?? "GET",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        Accept: "application/json",
        ...(init.body ? { "Content-Type": "application/json" } : {}),
      },
      body: init.body ? JSON.stringify(init.body) : undefined,
      cache: "no-store",
      signal: AbortSignal.timeout(120_000),
    });
  } catch {
    throw new SwaggPressError("SwaggPress couldn't be reached. Please try again in a minute.", 0);
  }
  const data = (await response.json().catch(() => ({}))) as { error?: string } & T;
  if (!response.ok || data.error) {
    throw new SwaggPressError(data.error ?? `SwaggPress answered ${response.status}.`, response.status);
  }
  return data;
}

export const isSwaggPressKey = (key: string) => /^spk_[a-f0-9]{48}$/i.test(key.trim());

export function swaggCatalog(apiKey: string) {
  return call<SwaggCatalog>(apiKey, "catalog.php");
}

export async function swaggRates(apiKey: string, items: { variant_id?: number; product_id?: number; qty: number }[], shipTo: SwaggShipTo) {
  return (await call<{ rates: SwaggRate[] }>(apiKey, "rates.php", { method: "POST", body: { items, ship_to: shipTo } })).rates;
}

export async function swaggPlaceOrder(
  apiKey: string,
  order: {
    partner_ref: string;
    items: { variant_id?: number; product_id?: number; qty: number; image_url: string; back_image_url?: string; preview_url?: string; print_style?: "panel" | "wrap";
      options?: Record<string, string>;
      custom_text?: Record<string, string>;
      asset_urls?: string[];
      note?: string;
    }[];
    ship_to: SwaggShipTo;
    shipping_rate_id: string;
  },
) {
  return (await call<{ order: SwaggOrder; duplicate?: boolean }>(apiKey, "orders.php", { method: "POST", body: order })).order;
}

export async function swaggOrderStatus(apiKey: string, refs: string[]) {
  if (refs.length === 0) return [];
  return (await call<{ orders: SwaggOrder[] }>(apiKey, `orders.php?refs=${encodeURIComponent(refs.slice(0, 50).join(","))}`)).orders;
}
