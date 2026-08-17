"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  ChevronRight,
  Database,
  Plus,
  X,
  Save,
  Loader2
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardFooter } from "@/components/ui/card";

export default function AddBankNamePage() {
  const router = useRouter();

  // Form States
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  
  const [saving, setSaving] = useState(false);
  const [submitType, setSubmitType] = useState<"save" | "saveAndAdd">("save");

  const performSubmit = async (targetSubmitType: "save" | "saveAndAdd") => {
    const cleanCode = code.trim().toUpperCase();
    const cleanName = name.trim();

    if (!cleanCode) {
      toast.error("Please enter a Bank Code");
      return;
    }
    if (!cleanName) {
      toast.error("Please enter a Bank Name");
      return;
    }

    setSaving(true);
    try {
      const res = await fetch("/api/bank-name-master", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          code: cleanCode,
          name: cleanName,
          description: description.trim()
        })
      });

      const json = await res.json();
      if (json.success) {
        toast.success("Bank Name created successfully");
        if (targetSubmitType === "saveAndAdd") {
          setCode("");
          setName("");
          setDescription("");
        } else {
          router.push("/bank-manager/bank-name-master");
        }
      } else {
        toast.error(json.message || "Failed to create bank name");
      }
    } catch (err) {
      console.error(err);
      toast.error("Failed to save bank name record");
    } finally {
      setSaving(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    performSubmit(submitType);
  };

  return (
    <div className="container mx-auto p-4 space-y-6 text-left max-w-4xl">
      {/* Header Panel */}
      <div className="rounded-3xl border bg-white p-6 shadow-sm">
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-2 text-sm text-gray-500">
              <span>Bank Manager</span>
              <ChevronRight size={15} className="text-slate-400" />
              <span>Bank Name Master</span>
              <ChevronRight size={15} className="text-slate-400" />
              <span className="font-semibold text-blue-600">Add</span>
            </div>

            <div className="mt-2 flex items-center gap-2">
              <Database className="text-blue-600 h-6 w-6" />
              <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-slate-800">
                Add Bank Name
              </h1>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Header Save Button */}
            <Button
              type="button"
              disabled={saving}
              onClick={() => performSubmit("save")}
              size="icon"
              className="rounded-full bg-blue-600 hover:bg-blue-700 text-white shadow-md shadow-blue-200/50 hover:scale-105 active:scale-95 transition-all duration-200 cursor-pointer"
              title="Save"
            >
              {saving && submitType === "save" ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : (
                <Save className="h-5 w-5 stroke-[2.5]" />
              )}
            </Button>

            {/* Header Save & Add (+) Button */}
            <Button
              type="button"
              disabled={saving}
              onClick={() => performSubmit("saveAndAdd")}
              size="icon"
              className="rounded-full bg-emerald-600 hover:bg-emerald-700 text-white shadow-md shadow-emerald-200/50 hover:scale-105 active:scale-95 transition-all duration-200 cursor-pointer"
              title="Save and Add"
            >
              {saving && submitType === "saveAndAdd" ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : (
                <Plus className="h-5 w-5 stroke-[2.5]" />
              )}
            </Button>

            {/* Header Cancel Button */}
            <Link href="/bank-manager/bank-name-master">
              <Button
                variant="outline"
                size="icon"
                className="rounded-full border-slate-200 hover:bg-slate-50 text-slate-600 shadow-sm hover:scale-105 active:scale-95 transition-all duration-200 cursor-pointer"
                title="Cancel"
              >
                <X className="h-5 w-5 stroke-[2.5]" />
              </Button>
            </Link>
          </div>
        </div>
      </div>

      {/* Main Card Form */}
      <Card className="rounded-3xl border shadow-sm bg-white overflow-hidden">
        <form onSubmit={handleSubmit}>
          <CardContent className="p-6 space-y-6">
            
            {/* Menu Code Row */}
            <div className="flex gap-2 items-center">
              <div className="w-1/4 space-y-0 text-end">
                <label className="inline-flex items-center gap-1 text-sm font-medium text-gray-700">
                  Menu Code <span className="text-red-500">*</span>
                </label>
              </div>
              <div className="w-3/4 space-y-0">
                <Input
                  type="text"
                  placeholder="e.g. BNSBI"
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  className="h-10 rounded-xl border-slate-200 bg-white font-semibold focus:ring-2 focus:ring-blue-500/20"
                />
              </div>
            </div>

            {/* Menu Name Row */}
            <div className="flex gap-2 items-center">
              <div className="w-1/4 space-y-0 text-end">
                <label className="inline-flex items-center gap-1 text-sm font-medium text-gray-700">
                  Menu Name <span className="text-red-500">*</span>
                </label>
              </div>
              <div className="w-3/4 space-y-0">
                <Input
                  type="text"
                  placeholder="e.g. State Bank of India"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="h-10 rounded-xl border-slate-200 bg-white font-semibold focus:ring-2 focus:ring-blue-500/20"
                />
              </div>
            </div>

            {/* Description Row */}
            <div className="flex gap-2 items-start">
              <div className="w-1/4 space-y-0 text-end pt-2">
                <label className="inline-flex items-center gap-1 text-sm font-medium text-gray-700">
                  Description
                </label>
              </div>
              <div className="w-3/4 space-y-0">
                <Textarea
                  placeholder="Description details..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="rounded-xl border-slate-200 bg-white min-h-24 p-3 focus:ring-2 focus:ring-blue-500/20"
                />
              </div>
            </div>

          </CardContent>

          {/* Shaded CardFooter buttons section */}
          <CardFooter className="flex items-center gap-2 pt-4 border-t border-slate-100 px-6 pb-6 bg-slate-50/50">
            <Button
              type="submit"
              disabled={saving}
              onClick={() => setSubmitType("save")}
              className="h-10 px-5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold gap-1.5 shadow-md shadow-blue-200/50 border-0 cursor-pointer"
            >
              {saving && submitType === "save" ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Saving...
                </>
              ) : (
                "Save"
              )}
            </Button>

            <Button
              type="submit"
              disabled={saving}
              onClick={() => setSubmitType("saveAndAdd")}
              className="h-10 px-5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold gap-1.5 shadow-md shadow-emerald-200/50 border-0 cursor-pointer"
            >
              {saving && submitType === "saveAndAdd" ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Saving...
                </>
              ) : (
                "Save And Add"
              )}
            </Button>

            <Link href="/bank-manager/bank-name-master">
              <Button type="button" variant="outline" className="h-10 px-5 rounded-xl border-slate-200 hover:bg-slate-100/50 font-bold text-slate-600 bg-white cursor-pointer">
                Cancel
              </Button>
            </Link>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
}
