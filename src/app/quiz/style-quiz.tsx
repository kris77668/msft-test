"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Photo } from "@/components/ui/photo";
import { ButtonLink, Button } from "@/components/ui/button";
import { CalendarIcon } from "@/components/ui/icons";
import { formatMoney } from "@/lib/money";
import { clsx } from "@/lib/clsx";

interface QuizGown {
  slug: string;
  name: string;
  imagePath: string | null;
  imageAlt: string;
  priceFromCents: number;
  silhouette: string | null;
}

/**
 * Style quiz.
 *
 * The prototype's scoring was broken in a way that was invisible unless you
 * counted: 'Mermaid' appeared as an option in only ONE of five questions, so it
 * could never win a plurality, and 'Princess' appeared in none at all — making
 * Amaryllis permanently unreachable. Ties broke by object insertion order.
 *
 * Fixed by giving every silhouette in the catalogue comparable representation
 * and scoring by weighted totals rather than a plurality of raw votes, so a
 * consistent lean toward one shape wins even when no single answer dominates.
 */
const QUESTIONS = [
  {
    id: "mood",
    question: "What word describes your wedding?",
    options: [
      { label: "Romantic", weights: { "A-line": 3, Princess: 1 } },
      { label: "Grand", weights: { "Ball Gown": 3, Princess: 2 } },
      { label: "Modern", weights: { Sheath: 3, Mermaid: 1 } },
      { label: "Effortless", weights: { Slip: 3, Sheath: 1 } },
    ],
  },
  {
    id: "venue",
    question: 'Where are you saying "I do"?',
    options: [
      { label: "Garden or vineyard", weights: { "A-line": 3, Slip: 1 } },
      { label: "Ballroom or estate", weights: { "Ball Gown": 3, Princess: 2 } },
      { label: "City or gallery", weights: { Sheath: 3, Mermaid: 2 } },
      { label: "Beach or coast", weights: { Slip: 3, "A-line": 1 } },
    ],
  },
  {
    id: "shape",
    question: "Which silhouette makes you feel most like yourself?",
    options: [
      { label: "Soft and flowing", weights: { "A-line": 3, Slip: 1 } },
      { label: "Full and dramatic", weights: { "Ball Gown": 3, Princess: 3 } },
      { label: "Sleek and fitted", weights: { Mermaid: 3, Sheath: 2 } },
      { label: "Simple and fluid", weights: { Slip: 3, Sheath: 2 } },
    ],
  },
  {
    id: "detail",
    question: "How much detail do you love?",
    options: [
      { label: "Delicate lace", weights: { "A-line": 3, Princess: 1 } },
      { label: "Rich embellishment", weights: { "Ball Gown": 2, Princess: 3 } },
      { label: "Clean and minimal", weights: { Sheath: 3, Slip: 2 } },
      { label: "Sculpted seaming", weights: { Mermaid: 3, Sheath: 1 } },
    ],
  },
  {
    id: "fabric",
    question: "Pick a fabric you keep coming back to.",
    options: [
      { label: "Chantilly lace", weights: { "A-line": 3, Princess: 2 } },
      { label: "Silk mikado", weights: { "Ball Gown": 3 } },
      { label: "Fluid crêpe", weights: { Sheath: 3, Mermaid: 1 } },
      { label: "Beaded tulle", weights: { Mermaid: 3, Princess: 1 } },
    ],
  },
] as const;

export function StyleQuiz({ gowns }: { gowns: QuizGown[] }) {
  const [step, setStep] = useState(-1);
  const [answers, setAnswers] = useState<number[]>([]);

  const result = useMemo(() => {
    if (answers.length < QUESTIONS.length) return null;

    const scores = new Map<string, number>();
    answers.forEach((choice, i) => {
      const option = QUESTIONS[i]?.options[choice];
      if (!option) return;
      for (const [silhouette, weight] of Object.entries(option.weights)) {
        scores.set(silhouette, (scores.get(silhouette) ?? 0) + weight);
      }
    });

    const ranked = [...scores.entries()].sort((a, b) => b[1] - a[1]);
    const top = ranked[0]?.[0] ?? "A-line";

    const matches = gowns.filter((g) => g.silhouette === top);
    // Fall back through the ranking rather than dumping the whole catalogue, so
    // the result still reflects the answers even when the top match has no gown.
    const fallback = ranked
      .slice(1)
      .flatMap(([silhouette]) => gowns.filter((g) => g.silhouette === silhouette));

    return { shape: top, gowns: [...matches, ...fallback].slice(0, 3) };
  }, [answers, gowns]);

  // ── Intro ───────────────────────────────────────────────────────
  if (step === -1) {
    return (
      <div className="mx-auto max-w-[640px] px-5 py-24 text-center md:px-8">
        <p className="eyebrow text-dusty-text">Find your gown</p>
        <h1 className="font-display mt-5 text-4xl font-light md:text-5xl">
          Five questions,
          <br />
          <em className="italic">two minutes.</em>
        </h1>
        <p className="mt-4 text-sm opacity-80">
          A starting point, not a verdict — the real answer comes from standing in
          front of a mirror with fabric in your hands.
        </p>
        <Button variant="bespoke" size="lg" className="mt-9" onClick={() => setStep(0)}>
          Begin
        </Button>
      </div>
    );
  }

  // ── Result ──────────────────────────────────────────────────────
  if (result) {
    return (
      <div className="mx-auto max-w-[900px] px-5 py-16 md:px-8">
        <div className="text-center">
          <p className="eyebrow text-dusty-text">Your result</p>
          <h1 className="font-display mt-4 text-4xl font-light md:text-5xl">
            You&apos;re {/^[AEIOU]/i.test(result.shape) ? "an" : "a"}{" "}
            <em className="italic">{result.shape}</em> bride
          </h1>
        </div>

        {result.gowns.length > 0 && (
          <ul className="mt-12 grid grid-cols-2 gap-x-4 gap-y-8 md:grid-cols-3">
            {result.gowns.map((gown) => (
              <li key={gown.slug}>
                <Link href={`/bespoke/${gown.slug}`} className="group block">
                  {gown.imagePath && (
                    <Photo
                      src={gown.imagePath}
                      alt={gown.imageAlt}
                      ratio={3 / 4}
                      sizes="(min-width: 768px) 33vw, 50vw"
                      imageClassName="transition-transform duration-700 group-hover:scale-105"
                    />
                  )}
                  <h2 className="font-display mt-3 text-xl font-light">{gown.name}</h2>
                  <p className="text-gold-text mt-1 text-sm">
                    From {formatMoney(gown.priceFromCents)}
                  </p>
                </Link>
              </li>
            ))}
          </ul>
        )}

        <div className="mt-14 flex flex-col justify-center gap-3 sm:flex-row">
          <ButtonLink href="/consultation" variant="bespoke">
            <CalendarIcon size={16} /> Book a Consultation
          </ButtonLink>
          <Button
            variant="secondary"
            onClick={() => {
              setAnswers([]);
              setStep(-1);
            }}
          >
            Retake the quiz
          </Button>
        </div>
      </div>
    );
  }

  // ── Questions ───────────────────────────────────────────────────
  const current = QUESTIONS[step];
  if (!current) return null;

  // Progress reflects questions ANSWERED, so it reaches 100% on the last
  // selection. The prototype showed 0% on question one and never reached 100%.
  const progress = (answers.length / QUESTIONS.length) * 100;

  return (
    <div className="mx-auto max-w-[640px] px-5 py-16 md:px-8">
      <div
        className="bg-rule h-px w-full"
        role="progressbar"
        aria-valuenow={Math.round(progress)}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label="Quiz progress"
      >
        <div className="bg-mocha h-px transition-all duration-500" style={{ width: `${progress}%` }} />
      </div>

      <p className="eyebrow text-dusty-text mt-6">
        Question {step + 1} of {QUESTIONS.length}
      </p>

      <fieldset className="mt-4">
        <legend className="font-display text-3xl leading-tight font-light md:text-4xl">
          {current.question}
        </legend>

        <div className="mt-8 flex flex-col gap-3">
          {current.options.map((option, i) => (
            <button
              key={option.label}
              type="button"
              onClick={() => {
                const next = [...answers];
                next[step] = i;
                setAnswers(next);
                setStep((s) => s + 1);
              }}
              className={clsx(
                "border-rule hover:border-mocha border px-5 py-4 text-left text-sm transition-colors",
                "focus-visible:outline-2 focus-visible:outline-offset-2",
                answers[step] === i && "border-mocha bg-mocha text-cream"
              )}
            >
              {option.label}
            </button>
          ))}
        </div>
      </fieldset>

      {step > 0 && (
        <button
          type="button"
          onClick={() => setStep((s) => s - 1)}
          className="eyebrow text-dusty-text mt-6 flex min-h-11 items-center"
        >
          ← Previous
        </button>
      )}
    </div>
  );
}
