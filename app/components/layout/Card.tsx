import { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface Props {
  children: ReactNode;
  className?: string;
}

export default function Card({
  children,
  className,
}: Props) {
  return (
    <div
      className={cn(
        "rounded-xl border bg-background shadow-sm",
        className
      )}
    >
      {children}
    </div>
  );
}