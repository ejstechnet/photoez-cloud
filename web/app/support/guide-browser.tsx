"use client";

import { useState } from "react";
import { SearchIcon } from "@/components/icons";
import { inputClass } from "@/components/form";
import type { Topic } from "./guides";

// The Support page's guides: a search box, jump links to each topic, and
// each guide as a question that opens to its steps.
export function GuideBrowser({ topics, example }: { topics: Topic[]; example: string }) {
  const [query, setQuery] = useState("");
  const words = query.toLowerCase().split(/\s+/).filter(Boolean);
  // A guide matches when every word appears in its title, keywords, or topic.
  const shown = topics
    .map((topic) => ({
      ...topic,
      guides: topic.guides.filter((g) => {
        const text = `${g.title} ${g.keywords ?? ""} ${topic.title}`.toLowerCase();
        return words.every((w) => text.includes(w));
      }),
    }))
    .filter((topic) => topic.guides.length > 0);
  const searching = words.length > 0;

  return (
    <div>
      <label className="relative mx-auto block max-w-2xl">
        <span className="sr-only">Search the guides</span>
        <SearchIcon size={20} className="pointer-events-none absolute top-1/2 left-4 -translate-y-1/2 text-muted" />
        <input
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder={`Search, like ${example}`}
          className={`${inputClass} rounded-full py-3.5 pl-12 text-lg`}
        />
      </label>

      {!searching && (
        <nav aria-label="Topics" className={`mt-8 grid gap-3 sm:grid-cols-2 ${topics.length % 4 === 0 ? "lg:grid-cols-4" : "lg:grid-cols-3"}`}>
          {topics.map((topic) => (
            <a key={topic.id} href={`#${topic.id}`} className="card flex items-start gap-3 p-4 transition hover:border-brand">
              <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-lime/15 text-lime-ink">{topic.icon}</span>
              <span>
                <span className="block font-bold">{topic.title}</span>
                <span className="block text-sm text-muted">{topic.blurb}</span>
              </span>
            </a>
          ))}
        </nav>
      )}

      {shown.length === 0 ? (
        <div className="card mx-auto mt-10 max-w-2xl p-8 text-center">
          <p className="font-display text-xl font-bold">No guides match &ldquo;{query.trim()}&rdquo;</p>
          <p className="mt-2 text-muted">
            Try another word, or{" "}
            <a href="#contact" className="link">
              send us a message
            </a>{" "}
            and we&rsquo;ll help.
          </p>
        </div>
      ) : (
        <div className="mt-12 space-y-12">
          {shown.map((topic) => (
            <section key={topic.id} id={topic.id} className="scroll-mt-6">
              <h2 className="flex items-center gap-3 font-display text-2xl font-bold sm:text-3xl">
                <span className="text-lime-ink">{topic.icon}</span> {topic.title}
              </h2>
              <div className="card mt-4 divide-y divide-border overflow-hidden">
                {topic.guides.map((guide) => (
                  <details key={guide.id} id={`${topic.id}-${guide.id}`} open={searching} className="group scroll-mt-6">
                    <summary className="flex cursor-pointer list-none items-center justify-between gap-4 px-5 py-4 font-semibold hover:bg-background/60 sm:px-6 [&::-webkit-details-marker]:hidden">
                      {guide.title}
                      <span aria-hidden="true" className="text-xl text-muted transition group-open:rotate-45">
                        +
                      </span>
                    </summary>
                    <div className="space-y-3 px-5 pb-5 leading-relaxed text-foreground/90 sm:px-6">{guide.body}</div>
                  </details>
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
