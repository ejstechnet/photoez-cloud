import Link from "next/link";
import { count, eq } from "drizzle-orm";
import { db } from "@/db";
import { clients, galleries, photos } from "@/db/schema";
import { ArrowRightIcon, HeartIcon, ImagesIcon, SparklesIcon, UsersIcon } from "@/components/icons";
import { requirePhotographer } from "@/lib/session";

export default async function DashboardPage() {
  const user = await requirePhotographer();
  const [[{ clientCount }], [{ galleryCount }], [{ photoCount }]] = await Promise.all([
    db.select({ clientCount: count() }).from(clients).where(eq(clients.photographerId, user.id)),
    db.select({ galleryCount: count() }).from(galleries).where(eq(galleries.photographerId, user.id)),
    db
      .select({ photoCount: count() })
      .from(photos)
      .innerJoin(galleries, eq(galleries.id, photos.galleryId))
      .where(eq(galleries.photographerId, user.id)),
  ]);

  const tiles = [
    {
      label: "Galleries",
      value: galleryCount,
      icon: <ImagesIcon size={22} />,
      tint: "bg-violet",
      href: "/dashboard/galleries",
    },
    {
      label: "Clients",
      value: clientCount,
      icon: <UsersIcon size={22} />,
      tint: "bg-coral",
      href: "/dashboard/clients",
    },
    { label: "Photos", value: photoCount, icon: <HeartIcon size={22} />, tint: "bg-sun", href: "/dashboard/galleries" },
    { label: "AI tools", value: "Soon", icon: <SparklesIcon size={22} />, tint: "bg-lime" },
  ];

  return (
    <>
      <p className="text-sm font-bold tracking-wider text-lime-ink uppercase">
        {user.businessName ?? "Your studio"}
      </p>
      <h1 className="mt-1 font-display text-4xl font-bold tracking-tight sm:text-5xl">
        Hello, <span className="italic">{user.name.split(" ")[0]}</span>
      </h1>

      <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
        {tiles.map((tile) => {
          const body = (
            <>
              <div className="flex items-center justify-between">
                <span className={`grid size-11 place-items-center rounded-2xl text-brand-deep ${tile.tint}`}>
                  {tile.icon}
                </span>
                {tile.href && <ArrowRightIcon size={18} className="text-muted transition group-hover:translate-x-1" />}
              </div>
              <p className="mt-6 font-display text-4xl font-bold">{tile.value}</p>
              <p className="mt-1 text-sm font-semibold text-muted">{tile.label}</p>
            </>
          );
          return tile.href ? (
            <Link key={tile.label} href={tile.href} className="card group p-6 transition hover:-translate-y-1 hover:shadow-xl">
              {body}
            </Link>
          ) : (
            <div key={tile.label} className="card p-6 opacity-75">
              {body}
            </div>
          );
        })}
      </div>
    </>
  );
}
