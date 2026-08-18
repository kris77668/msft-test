"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { Nav } from "@/components/chrome/nav";
import { Photo } from "@/components/ui/photo";
import { ButtonLink } from "@/components/ui/button";
import { MinusIcon, PlusIcon, CloseIcon, TruckIcon } from "@/components/ui/icons";
import { Notice } from "@/components/ui/notice";
import { useCart } from "@/lib/cart/store";
import { getPricedCart } from "@/app/actions/cart";
import { formatMoney, gstComponent, instalmentAmount } from "@/lib/money";
import { eligibleBnpl } from "@/lib/payments";
import type { PricedCart } from "@/lib/cart/pricing";

/**
 * Cart.
 *
 * Prices are never read from local storage — the client holds only ids, sizes
 * and quantities, and this page asks the server what they cost on every render.
 * A cart restored weeks later therefore shows today's prices, and there is
 * nothing in the browser worth tampering with.
 */
export default function CartPage() {
  const lines = useCart((s) => s.lines);
  const hydrated = useCart((s) => s.hydrated);
  const remove = useCart((s) => s.remove);
  const updateQty = useCart((s) => s.updateQty);

  const [priced, setPriced] = useState<PricedCart | null>(null);
  const [pending, startTransition] = useTransition();
  // Monotonic id for the in-flight reprice. Rapid +/- taps fire overlapping
  // server actions, and useTransition does not cancel prior async work, so an
  // older response could otherwise land after a newer one and show a stale
  // total. Only the most recent request is allowed to write the result.
  const repriceId = useRef(0);

  useEffect(() => {
    if (!hydrated) return;
    const id = ++repriceId.current;
    startTransition(async () => {
      const next = await getPricedCart(lines);
      if (id === repriceId.current) setPriced(next);
    });
  }, [lines, hydrated]);

  const empty = hydrated && lines.length === 0;

  return (
    <>
      <Nav />

      <main className="mx-auto w-full max-w-[1000px] flex-1 px-5 py-12 md:px-8">
        <h1 className="font-display text-4xl font-light md:text-5xl">Your bag</h1>

        {!hydrated && <p className="mt-8 text-sm opacity-60">Loading…</p>}

        {empty && (
          <div className="border-rule mt-8 border px-6 py-16 text-center">
            <p className="font-display text-2xl font-light">Your bag is empty</p>
            <p className="mt-2 text-sm opacity-75">
              Evening pieces are made to order and ship in 8–10 weeks.
            </p>
            <ButtonLink href="/shop" className="mt-7">
              Browse evening wear
            </ButtonLink>
          </div>
        )}

        {hydrated && lines.length > 0 && priced && (
          <div className="mt-8 grid gap-12 md:grid-cols-[1fr_320px]">
            <ul className="flex flex-col">
              {priced.lines.map((line) => (
                <li key={line.lineId} className="border-rule flex gap-4 border-b py-5 first:pt-0">
                  {line.imagePath && (
                    <Link href={`/product/${line.slug}`} className="w-20 shrink-0 md:w-24">
                      <Photo src={line.imagePath} alt={line.name} ratio={3 / 4} sizes="96px" />
                    </Link>
                  )}

                  <div className="flex-1">
                    <div className="flex justify-between gap-3">
                      <div>
                        <Link href={`/product/${line.slug}`} className="font-display text-xl font-light">
                          {line.name}
                        </Link>
                        <p className="text-dusty-text mt-0.5 text-xs">
                          {[line.colour, `Size ${line.size}`].filter(Boolean).join(" · ")}
                        </p>
                      </div>
                      <p className="text-sm whitespace-nowrap">{formatMoney(line.lineTotalCents)}</p>
                    </div>

                    <div className="mt-4 flex items-center justify-between">
                      <div className="border-rule flex items-center border">
                        <button
                          type="button"
                          onClick={() => updateQty(line.lineId, line.qty - 1)}
                          className="flex h-10 w-10 items-center justify-center"
                          aria-label={`Decrease quantity of ${line.name}`}
                        >
                          <MinusIcon size={14} />
                        </button>
                        <span className="w-8 text-center text-sm" aria-live="polite">
                          {line.qty}
                        </span>
                        <button
                          type="button"
                          onClick={() => updateQty(line.lineId, line.qty + 1)}
                          className="flex h-10 w-10 items-center justify-center"
                          aria-label={`Increase quantity of ${line.name}`}
                        >
                          <PlusIcon size={14} />
                        </button>
                      </div>

                      <button
                        type="button"
                        onClick={() => remove(line.lineId)}
                        className="text-dusty-text flex items-center gap-1.5 text-xs"
                      >
                        <CloseIcon size={12} /> Remove
                      </button>
                    </div>
                  </div>
                </li>
              ))}

              {priced.unavailable.length > 0 && (
                <li>
                  <Notice tone="error" className="mt-5">
                    {priced.unavailable.length === 1
                      ? "One piece is no longer available and has been excluded from your total."
                      : `${priced.unavailable.length} pieces are no longer available and have been excluded from your total.`}{" "}
                    You&apos;ll be asked to remove them before checking out.
                  </Notice>
                </li>
              )}
            </ul>

            <aside className="bg-paper h-fit p-6 md:sticky md:top-24">
              <h2 className="eyebrow text-dusty-text">Summary</h2>

              <dl className="mt-5 flex flex-col gap-2.5 text-sm">
                <Row label="Subtotal" value={formatMoney(priced.subtotalCents)} />
                <Row
                  label="Shipping"
                  value={priced.shippingCents === 0 ? "Free" : formatMoney(priced.shippingCents)}
                />
                <div className="border-rule mt-2 flex justify-between border-t pt-3">
                  <dt className="font-display text-lg">Total</dt>
                  <dd className="font-display text-lg">{formatMoney(priced.totalCents)}</dd>
                </div>
                <p className="text-dusty-text text-xs">
                  Includes {formatMoney(gstComponent(priced.totalCents))} GST
                </p>
              </dl>

              {eligibleBnpl(priced.totalCents).map((provider) => (
                <p key={provider.id} className="text-dusty-text mt-1 text-xs">
                  or {provider.instalments} payments of{" "}
                  {formatMoney(instalmentAmount(priced.totalCents, provider.instalments))} with{" "}
                  {provider.label}
                </p>
              ))}

              <ButtonLink href="/checkout" fullWidth size="lg" className="mt-6">
                {pending ? "Updating…" : "Checkout"}
              </ButtonLink>

              <p className="text-dusty-text mt-4 flex items-center gap-2 text-xs">
                <TruckIcon size={14} /> Free insured shipping across Australia
              </p>
            </aside>
          </div>
        )}
      </main>
    </>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between">
      <dt className="opacity-75">{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}
