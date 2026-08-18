/**
 * The centred page used by order and booking confirmations.
 *
 * Both pages had a private `Shell` that differed only in whether the body was a
 * prop or a child. One copy, with the body as a child, covers both.
 *
 * `max-w-lg` with `px-6` keeps the column comfortably inside a 375px viewport,
 * and nothing here has a fixed width — these pages are read on a phone, right
 * after paying, more often than anywhere else.
 */
export function ConfirmationShell({
  heading,
  children,
}: {
  heading: string;
  children: React.ReactNode;
}) {
  return (
    <main className="mx-auto w-full max-w-lg flex-1 px-6 py-20 text-center">
      <p className="eyebrow text-dusty-text">Ms Fairy Tale</p>
      <h1 className="font-display mt-4 text-4xl font-light">{heading}</h1>
      {children}
    </main>
  );
}
