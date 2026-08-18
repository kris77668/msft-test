import Link from "next/link";
import { Photo } from "@/components/ui/photo";
import { formatPostDate, type JournalPost } from "@/lib/journal/queries";

/**
 * One journal entry, as a grid cell.
 *
 * Extracted from the `/journal` index so the home page can show the same card
 * without a second copy drifting from it — the two are meant to be identical.
 * The feature (hero) card on the index stays inline there; it is a genuinely
 * different, larger layout, not this card at another size.
 */
export function JournalCard({
  post,
  sizes = "(min-width: 768px) 33vw, 100vw",
}: {
  post: JournalPost;
  sizes?: string;
}) {
  return (
    <Link href={`/journal/${post.slug}`} className="group block">
      {post.coverPath && (
        <Photo
          src={post.coverPath}
          alt={post.coverAlt ?? post.title}
          ratio={4 / 3}
          sizes={sizes}
          imageClassName="transition-transform duration-700 group-hover:scale-105"
        />
      )}
      <p className="eyebrow text-gold-text mt-4">{post.category}</p>
      <h3 className="font-display mt-2 text-2xl leading-tight font-light">{post.title}</h3>
      <p className="mt-2 text-sm opacity-75">{post.excerpt}</p>
      <p className="text-dusty-text mt-3 text-xs">
        {formatPostDate(post.publishedAt)}
        {post.readMinutes ? ` · ${post.readMinutes} min read` : ""}
      </p>
    </Link>
  );
}
