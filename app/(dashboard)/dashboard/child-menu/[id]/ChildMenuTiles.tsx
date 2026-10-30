"use client";

import Link from "next/link";
import { motion } from "motion/react";
import { ArrowUpRight, ChevronRight, Home } from "lucide-react";

import { DashboardPage, pageRise, Section } from "@/components/dashboard/DashboardUi";
import { getModuleIcon } from "@/lib/menu/iconMap";
import type { ChildMenuItem, ChildMenuModel } from "@/lib/navigation/navigationService";
import { useInit } from "../../../systmMngt/_shared/useInit";

/**
 * CI dashboard/dashboardnew_v: the menu's name and one tile per permitted child item, in menu order.
 * Items that have not been migrated yet are shown muted, like the header's unmigrated links.
 */
const TILE =
  "group flex h-full min-h-[132px] flex-col justify-between gap-4 rounded-2xl bg-white p-5 ring-1 ring-slate-200 shadow-[0_1px_2px_rgba(16,24,40,0.04)] transition-all duration-300 dark:bg-[#111a2e] dark:ring-white/10";

function Tile({ item }: { item: ChildMenuItem }) {
  const { icon: Icon, color } = getModuleIcon(item.name);
  const body = (external: boolean) => (
    <>
      <span className="flex items-start justify-between gap-3">
        <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#f1f3f8] dark:bg-white/5 ${color}`}>
          <Icon aria-hidden="true" className="h-5 w-5" />
        </span>
        {external && <ArrowUpRight aria-hidden="true" className="h-4 w-4 text-[#535768] dark:text-[#aab3c5]" />}
      </span>
      <span className="text-[15px] font-medium leading-snug text-[#1a1818] dark:text-[#f1f3f8]">{item.name}</span>
    </>
  );

  const interactive = `${TILE} hover:-translate-y-0.5 hover:ring-[#da5427]/40 hover:shadow-[0_18px_40px_-24px_rgba(6,27,49,0.35)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#da5427]`;
  if (item.link.kind === "internal") {
    return (
      <Link href={item.link.href} title={item.name} className={interactive}>
        {body(false)}
      </Link>
    );
  }
  if (item.link.kind === "external") {
    return (
      <a href={item.link.href} target="_blank" rel="noopener noreferrer" title={item.name} className={interactive}>
        {body(true)}
      </a>
    );
  }
  return (
    <span aria-disabled="true" title="This screen has not been migrated to the new application yet." className={`${TILE} cursor-not-allowed opacity-50`}>
      {body(false)}
    </span>
  );
}

export default function ChildMenuTiles({ menuId }: { menuId: string }) {
  const { data, error } = useInit<ChildMenuModel>(`/api/dashboard/child-menu/${encodeURIComponent(menuId)}`);

  if (error) return <p className="p-6 text-sm text-rose-700 dark:text-rose-300">{error}</p>;
  if (!data) return <p className="p-6 text-sm text-[#535768] dark:text-[#aab3c5]">Loading…</p>;

  return (
    <div className="p-4">
      <DashboardPage>
        <motion.section variants={pageRise} className="rounded-2xl bg-white p-6 ring-1 ring-slate-200 dark:bg-[#111a2e] dark:ring-white/10">
          <nav aria-label="Breadcrumb" className="flex items-center gap-2 text-sm text-[#535768] dark:text-[#aab3c5]">
            <Link href="/dashboard" className="flex items-center gap-1.5 hover:text-[#1a1818] dark:hover:text-white">
              <Home aria-hidden="true" className="h-4 w-4" />
              Home
            </Link>
            <ChevronRight aria-hidden="true" className="h-4 w-4" />
            <span className="font-medium text-[#0b5394] dark:text-[#8cb8f0]">{data.title}</span>
          </nav>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight md:text-3xl">{data.title}</h1>
        </motion.section>

        {data.items.length === 0 ? (
          <motion.p variants={pageRise} className="rounded-2xl bg-white p-6 text-sm text-[#535768] ring-1 ring-slate-200 dark:bg-[#111a2e] dark:text-[#aab3c5] dark:ring-white/10">
            There is nothing in this menu that you have access to.
          </motion.p>
        ) : (
          <Section className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {data.items.map((item) => (
              <motion.div key={item.id} variants={pageRise}>
                <Tile item={item} />
              </motion.div>
            ))}
          </Section>
        )}
      </DashboardPage>
    </div>
  );
}
