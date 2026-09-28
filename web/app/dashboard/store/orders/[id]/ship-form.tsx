"use client";

import { useState, useTransition } from "react";
import { inputClass } from "@/components/form";
import { markOrderShipped } from "../../actions";

// "Mark shipped": carrier and tracking number, then the client is emailed.
export function ShipForm({ orderId }: { orderId: string }) {
  const [pending, start] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  return (
    <form
      action={(formData) =>
        start(async () => {
          const result = await markOrderShipped(orderId, formData);
          setMessage(result.message ?? null);
        })
      }
      className="grid gap-3 sm:grid-cols-[10rem_1fr_auto] sm:items-end"
    >
      <label className="block">
        <span className="text-sm font-semibold">Carrier</span>
        <select name="carrier" className={`mt-1.5 ${inputClass}`} defaultValue="USPS">
          <option>USPS</option>
          <option>UPS</option>
          <option>FedEx</option>
          <option>DHL</option>
          <option value="">Other / hand delivered</option>
        </select>
      </label>
      <label className="block">
        <span className="text-sm font-semibold">Tracking number</span>
        <input name="tracking" className={`mt-1.5 ${inputClass}`} placeholder="Optional" />
      </label>
      <button type="submit" className="btn-primary" disabled={pending}>
        {pending ? "Saving…" : "Mark shipped"}
      </button>
      {message && <p className="text-sm font-semibold text-danger sm:col-span-3">{message}</p>}
    </form>
  );
}
