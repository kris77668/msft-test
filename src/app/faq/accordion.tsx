"use client";

import { useState } from "react";
import { ChevronDownIcon } from "@/components/ui/icons";
import { clsx } from "@/lib/clsx";

/**
 * FAQ accordion.
 *
 * Uses real <button aria-expanded> pairs rather than the prototype's divs, so
 * the state is announced and it works from the keyboard. Its accordion also
 * initialised with `useState(0)` while keying on strings, so nothing was ever
 * open on first paint despite the code intending the first item to be.
 */
export function Accordion({
  items,
}: {
  items: readonly { question: string; answer: string }[];
}) {
  const [openIndex, setOpenIndex] = useState<number | null>(0);

  return (
    <div>
      {items.map((item, i) => {
        const open = openIndex === i;

        return (
          <div key={item.question} className="border-softrule border-b">
            <h3>
              <button
                type="button"
                onClick={() => setOpenIndex(open ? null : i)}
                aria-expanded={open}
                className="flex w-full items-center justify-between gap-4 py-4 text-left"
              >
                <span className="text-sm">{item.question}</span>
                <ChevronDownIcon
                  size={16}
                  className={clsx("shrink-0 transition-transform", open && "rotate-180")}
                />
              </button>
            </h3>

            {open && <p className="pb-5 text-sm opacity-80">{item.answer}</p>}
          </div>
        );
      })}
    </div>
  );
}
