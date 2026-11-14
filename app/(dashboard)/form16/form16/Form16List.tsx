"use client";

import { CalendarRange, ListChecks, Settings } from "lucide-react";

import HubList from "../../employeeMngt/_hub/HubList";
import { QUARTERS_BASE } from "./form16Client";

/**
 * CI form16/form16 list (listview_v over form16_vw): the Form 16s the caller may see, CI's "Add New Form-16", row
 * Edit / Delete (View without the edit grant; Delete Selected, export and Form Settings come with the list page).
 * Rules: hub/screens/form16.ts. The PDF is on the Form 16's own page, where its years are chosen.
 *
 * Addition: links to the Form-16 Quarters list, the Quarter Settings and the Form-16 Settings for those who may add
 * or edit Form 16s (CI had no menu entry for them, so they were reachable only by typing the URL).
 */
export default function Form16List({ emp }: { emp?: string }) {
  return (
    <HubList
      screen="form16"
      emp={emp}
      listActions={({ permissions }) =>
        permissions.create || permissions.update
          ? [
              { key: "quarters", title: "Form-16 Quarters", icon: ListChecks, href: QUARTERS_BASE },
              { key: "quarter-settings", title: "Form-16 Quarter Settings", icon: CalendarRange, href: "/form16/form16/quarter_settings" },
              { key: "settings", title: "Form-16 Settings", icon: Settings, href: "/form16/form16/settings" },
            ]
          : []
      }
    />
  );
}
