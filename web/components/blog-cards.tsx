import type { BlogPost } from "@/lib/blog-feed";

// Article cards for the EJS Tech blog (home page and /articles). Each opens
// the full article on ejstech.net.
export function BlogCards({ posts }: { posts: BlogPost[] }) {
  return (
    <ul className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
      {posts.map((post) => (
        <li key={post.url}>
          <a
            href={post.url}
            target="_blank"
            rel="noopener"
            className="card group flex h-full flex-col overflow-hidden transition hover:-translate-y-1 hover:shadow-xl"
          >
            {post.image ? (
              // The blog's own images, served by ejstech.net.
              // eslint-disable-next-line @next/next/no-img-element
              <img src={post.image} alt="" loading="lazy" className="aspect-[16/9] w-full object-cover" />
            ) : (
              <div className="aspect-[16/9] w-full bg-gradient-to-br from-brand to-sky" />
            )}
            <div className="flex flex-1 flex-col p-5">
              <p className="text-xs font-bold tracking-wider text-coral uppercase">
                {post.category ?? "Article"}
                {post.date && (
                  <span className="ml-2 font-semibold text-muted normal-case">
                    {new Date(`${post.date}T12:00:00Z`).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" })}
                  </span>
                )}
              </p>
              <h3 className="mt-2 font-display text-xl font-bold group-hover:text-lime-ink">{post.title}</h3>
              {post.excerpt && <p className="mt-2 flex-1 text-sm text-muted">{post.excerpt}</p>}
              <p className="mt-4 text-sm font-bold text-lime-ink">Read on the EJS Tech blog →</p>
            </div>
          </a>
        </li>
      ))}
    </ul>
  );
}
