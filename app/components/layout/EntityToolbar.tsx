"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

import {
  Search,
  RotateCw,
  Download,
  Plus,
} from "lucide-react";

interface Props {
  showSearch?: boolean;
  showRefresh?: boolean;
  showExport?: boolean;

  createLabel?: string;

  onCreate?: () => void;

  onRefresh?: () => void;

  onExport?: () => void;

  onSearch?: (
    value: string
  ) => void;
}

export default function EntityToolbar({
  showSearch = true,
  showRefresh = true,
  showExport = true,

  createLabel = "Add",

  onCreate,

  onRefresh,

  onExport,

  onSearch,
}: Props) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 bg-white border rounded-xl p-4 shadow-sm">

      <div className="flex items-center gap-2">

        {showSearch && (
          <Input
            placeholder="Search..."
            className="w-72"
            onChange={(e) =>
              onSearch?.(
                e.target.value
              )
            }
          />
        )}

      </div>

      <div className="flex items-center gap-2">

        {showRefresh && (
          <Button
            variant="outline"
            onClick={onRefresh}
          >
            <RotateCw className="mr-2 h-4 w-4" />
            Refresh
          </Button>
        )}

        {showExport && (
          <Button
            variant="outline"
            onClick={onExport}
          >
            <Download className="mr-2 h-4 w-4" />
            Export
          </Button>
        )}

        <Button onClick={onCreate}>
          <Plus className="mr-2 h-4 w-4" />
          {createLabel}
        </Button>

      </div>
    </div>
  );
}