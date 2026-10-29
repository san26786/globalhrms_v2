"use client";

import { useEffect, useState, use } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  ChevronRight,
  Database,
  X,
  Save,
  Loader2
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardFooter } from "@/components/ui/card";

export default function EditBankNamePage({
  params: paramsPromise
}: {
  params: Promise<{ id: string }>;
}) {
  const params = use(paramsPromise);
  const router = useRouter();
  const mstrIdStr = params.id;

  // Form States
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    async function loadData() {
      try {
        const res = await fetch(`/api/bank-name-master/${mstrIdStr}`);
        const json = await res.json();
        if (json.success && json.data) {
          setCode(json.data.MSTR_CD || "");
          setName(json.data.MSTR_NM || "");
          setDescription(json.data.MSTR_DESC || "");
        } else {
          toast.error(json.message || "Failed to load details");
        }
      } catch (err) {
        console.error(err);
        toast.error("Failed to load bank name details");
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, [mstrIdStr]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

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
      const res = await fetch(`/api/bank-name-master/${mstrIdStr}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          code: cleanCode,
          name: cleanName,
          description: description.trim()
        })
      });

      const json = await res.json();
      if (json.success) {
        toast.success("Bank Name updated successfully");
        router.push("/bank-manager/bank-name-master");
      } else {
        toast.error(json.message || "Failed to update bank name");
      }
    } catch (err) {
      console.error(err);
      toast.error("Failed to update bank name record");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="container mx-auto p-4 flex flex-col items-center justify-center py-40 gap-3">
        <Loader2 className="h-10 w-10 animate-spin text-[#0b5394] dark:text-[#8cb8f0]" />
        <p className="text-sm font-semibold text-[#535768] dark:text-[#aab3c5]">Loading details...</p>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-4 space-y-6 text-left max-w-4xl">
      {/* Header Panel */}
      <div className="rounded-3xl border bg-white dark:bg-[#111a2e] p-6 shadow-sm">
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-2 text-sm text-[#535768] dark:text-[#aab3c5]">
              <span>Bank Manager</span>
              <ChevronRight size={15} className="text-[#535768] dark:text-[#aab3c5]" />
              <span>Bank Name Master</span>
              <ChevronRight size={15} className="text-[#535768] dark:text-[#aab3c5]" />
              <span className="font-semibold text-[#0b5394] dark:text-[#8cb8f0]">Edit</span>
            </div>

            <div className="mt-2 flex items-center gap-2">
              <Database className="text-[#0b5394] dark:text-[#8cb8f0] h-6 w-6" />
              <h1 className="text-2xl md:text-3xl font-semibold tracking-tight text-[#1a1818] dark:text-[#f1f3f8]">
                Edit Bank Name
              </h1>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Header Save Button */}
            <Button
              type="button"
              disabled={saving}
              onClick={handleSubmit}
              size="icon"
              className="rounded-full bg-[#e15425] hover:bg-[#c2431c] text-white shadow-md shadow-[#e15425]/25 dark:shadow-black/30 hover:scale-105 active:scale-95 transition-all duration-200 cursor-pointer"
              title="Save"
            >
              {saving ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : (
                <Save className="h-5 w-5 stroke-[2.5]" />
              )}
            </Button>

            {/* Header Cancel Button */}
            <Link href="/bank-manager/bank-name-master">
              <Button
                variant="outline"
                size="icon"
                className="rounded-full border-slate-200 dark:border-white/10 hover:bg-[#f6f7f9] dark:hover:bg-white/5 text-[#323338] dark:text-[#d5dae4] shadow-sm hover:scale-105 active:scale-95 transition-all duration-200 cursor-pointer"
                title="Cancel"
              >
                <X className="h-5 w-5 stroke-[2.5]" />
              </Button>
            </Link>
          </div>
        </div>
      </div>

      {/* Main Card Form */}
      <Card className="rounded-3xl border shadow-sm bg-white dark:bg-[#111a2e] overflow-hidden">
        <form onSubmit={handleSubmit}>
          <CardContent className="p-6 space-y-6">
            
            {/* Menu Code Row */}
            <div className="flex gap-2 items-center">
              <div className="w-1/4 space-y-0 text-end">
                <label className="inline-flex items-center gap-1 text-sm font-medium text-[#1a1818] dark:text-[#e6e9f0]">
                  Menu Code <span className="text-rose-700 dark:text-rose-300">*</span>
                </label>
              </div>
              <div className="w-3/4 space-y-0">
                <Input
                  type="text"
                  placeholder="e.g. BNSBI"
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  className="h-10 rounded-xl border-slate-200 dark:border-white/10 bg-white dark:bg-[#111a2e] font-semibold focus:ring-2 focus:ring-[#e15425]/20"
                />
              </div>
            </div>

            {/* Menu Name Row */}
            <div className="flex gap-2 items-center">
              <div className="w-1/4 space-y-0 text-end">
                <label className="inline-flex items-center gap-1 text-sm font-medium text-[#1a1818] dark:text-[#e6e9f0]">
                  Menu Name <span className="text-rose-700 dark:text-rose-300">*</span>
                </label>
              </div>
              <div className="w-3/4 space-y-0">
                <Input
                  type="text"
                  placeholder="e.g. State Bank of India"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="h-10 rounded-xl border-slate-200 dark:border-white/10 bg-white dark:bg-[#111a2e] font-semibold focus:ring-2 focus:ring-[#e15425]/20"
                />
              </div>
            </div>

            {/* Description Row */}
            <div className="flex gap-2 items-start">
              <div className="w-1/4 space-y-0 text-end pt-2">
                <label className="inline-flex items-center gap-1 text-sm font-medium text-[#1a1818] dark:text-[#e6e9f0]">
                  Description
                </label>
              </div>
              <div className="w-3/4 space-y-0">
                <Textarea
                  placeholder="Description details..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="rounded-xl border-slate-200 dark:border-white/10 bg-white dark:bg-[#111a2e] min-h-24 p-3 focus:ring-2 focus:ring-[#e15425]/20"
                />
              </div>
            </div>

          </CardContent>

          {/* Shaded CardFooter buttons section */}
          <CardFooter className="flex items-center gap-2 pt-4 border-t border-slate-100 dark:border-white/10 px-6 pb-6 bg-[#f6f7f9] dark:bg-[#0e1628]">
            <Button
              type="submit"
              disabled={saving}
              className="h-10 px-5 rounded-xl bg-[#e15425] hover:bg-[#c2431c] text-white font-semibold gap-1.5 shadow-md shadow-[#e15425]/25 dark:shadow-black/30 border-0 cursor-pointer"
            >
              {saving ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Saving...
                </>
              ) : (
                "Save"
              )}
            </Button>

            <Link href="/bank-manager/bank-name-master">
              <Button type="button" variant="outline" className="h-10 px-5 rounded-xl border-slate-200 dark:border-white/10 hover:bg-[#f1f3f8] dark:hover:bg-white/5 font-semibold text-[#323338] dark:text-[#d5dae4] bg-white dark:bg-[#111a2e] cursor-pointer">
                Cancel
              </Button>
            </Link>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
}
