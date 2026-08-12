"use client";

import * as React from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { DayPicker } from "react-day-picker";

import { cn } from "@/lib/utils";
import { buttonVariants } from "@/components/ui/button";

export type CalendarProps = React.ComponentProps<typeof DayPicker>;

function Calendar({
  className,
  classNames,
  showOutsideDays = true,
  ...props
}: CalendarProps) {
  return (
    <div className="w-full flex justify-center p-1">
      <div className="bg-white shadow-md rounded-md p-2 w-full max-w-md">
        <DayPicker
          showOutsideDays={showOutsideDays}
          className={cn("w-full text-sm", className)}
          classNames={{
            months:
              "flex flex-col sm:flex-row space-y-2 sm:space-x-2 sm:space-y-0",
            month: "space-y-2",
            caption:
              "flex justify-between items-center bg-gray-100 px-2 py-1 rounded-md",
            caption_label: "text-sm font-semibold",
            nav: "flex items-center gap-1",
            nav_button: cn(
              buttonVariants({ variant: "outline" }),
              "h-6 w-6 p-0 rounded-full"
            ),
            table: "w-full border-collapse",
            head_row: "flex justify-around",
            head_cell: "text-[11px] font-medium text-gray-600",
            row: "flex justify-around mt-1",
            cell: "relative w-9 h-9 flex items-center justify-center",
            day: cn(
              buttonVariants({ variant: "ghost" }),
              "w-8 h-8 rounded-full text-xs hover:bg-blue-100"
            ),
            day_selected:
              "bg-blue-500 text-white hover:bg-blue-600",
            day_today:
              "border border-blue-400 text-blue-700 font-semibold",
            day_outside: "text-gray-400",
            day_disabled: "text-gray-300 opacity-50",
            day_range_middle: "bg-blue-200 text-blue-700",
            day_hidden: "invisible",
            ...classNames,
          } as any}
          components={{
            IconLeft: ({ className, ...props }: any) => (
              <ChevronLeft
                className={cn("h-4 w-4", className)}
                {...props}
              />
            ),
            IconRight: ({ className, ...props }: any) => (
              <ChevronRight
                className={cn("h-4 w-4", className)}
                {...props}
              />
            ),
          } as any}
          {...props}
        />
      </div>
    </div>
  );
}

Calendar.displayName = "Calendar";

export { Calendar };
