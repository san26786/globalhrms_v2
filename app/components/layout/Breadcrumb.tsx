"use client";

import Link from "next/link";
import { ChevronRight, Home } from "lucide-react";
import type { BreadcrumbItem } from "@/lib/page-builder/pageTypes";

interface Props {
  items: BreadcrumbItem[];
}

export default function Breadcrumb({ items }: Props) {
  if (!items.length) return null;

  return (
    <nav className="flex items-center text-sm text-muted-foreground">
      <Home className="mr-1 h-4 w-4" />

      {items.map((item, index) => (
        <div key={index} className="flex items-center">
          <ChevronRight className="mx-2 h-3 w-3" />

          {item.href ? (
            <Link
              href={item.href}
              className="hover:text-primary transition-colors"
            >
              {item.title}
            </Link>
          ) : (
            <span className="font-medium text-foreground">
              {item.title}
            </span>
          )}
        </div>
      ))}
    </nav>
  );
}