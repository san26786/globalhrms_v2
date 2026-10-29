"use client";

import React, { useState, useEffect } from "react";
import { X, Settings } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";

export interface ColumnSetting {
  systemName: string;
  displayName: string;
  visibleInList: boolean;
  visibleInForm: boolean;
}

interface FormSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  settings: ColumnSetting[];
  onSave: (newSettings: ColumnSetting[]) => void;
}

export default function FormSettingsModal({
  isOpen,
  onClose,
  settings,
  onSave,
}: FormSettingsModalProps) {
  const [localSettings, setLocalSettings] = useState<ColumnSetting[]>([]);

  // Sync settings when modal opens
  useEffect(() => {
    if (isOpen) {
      setLocalSettings(JSON.parse(JSON.stringify(settings)));
    }
  }, [isOpen, settings]);

  if (!isOpen) return null;

  // Toggle individual cell
  const handleToggle = (index: number, key: "visibleInList" | "visibleInForm") => {
    const updated = [...localSettings];
    updated[index][key] = !updated[index][key];
    setLocalSettings(updated);
  };

  // Change display label
  const handleLabelChange = (index: number, val: string) => {
    const updated = [...localSettings];
    updated[index].displayName = val;
    setLocalSettings(updated);
  };

  // Toggle all for a column
  const handleToggleAll = (key: "visibleInList" | "visibleInForm") => {
    const allChecked = localSettings.every((s) => s[key]);
    const updated = localSettings.map((s) => ({
      ...s,
      [key]: !allChecked,
    }));
    setLocalSettings(updated);
  };

  const handleSave = () => {
    onSave(localSettings);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 backdrop-blur-sm animate-fade-in font-sans">
      <div className="bg-white dark:bg-[#111a2e] rounded-3xl shadow-2xl w-full max-w-3xl overflow-hidden border border-slate-100 dark:border-white/10 flex flex-col max-h-[80vh] animate-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="bg-white dark:bg-[#111a2e] text-[#1a1818] dark:text-[#f1f3f8] px-6 py-4.5 flex items-center justify-between border-b border-slate-100 dark:border-white/10 shadow-sm shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-[#e3edf9] dark:bg-[#16233d] flex items-center justify-center text-[#0b5394] dark:text-[#8cb8f0] shrink-0">
              <Settings className="h-5 w-5" />
            </div>
            <div className="flex flex-col">
              <h2 className="text-base font-semibold tracking-tight text-[#1a1818] dark:text-[#f1f3f8]">Form & List Customization</h2>
              <span className="text-xs text-[#535768] dark:text-[#aab3c5] mt-0.5 font-medium">Customize columns visibility and labels</span>
            </div>
          </div>
          <button 
            onClick={onClose} 
            className="text-[#535768] dark:text-[#aab3c5] hover:text-[#323338] dark:hover:text-[#d5dae4] hover:bg-[#f6f7f9] dark:hover:bg-white/5 p-2 rounded-full transition-all duration-200 active:scale-95 flex items-center justify-center"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Content Area */}
        <div className="p-6 overflow-y-auto flex-1 bg-[#f6f7f9] dark:bg-[#0e1628] scrollbar-thin scrollbar-thumb-slate-200">
          <div className="bg-white dark:bg-[#111a2e] rounded-2xl border border-slate-200 dark:border-white/10 shadow-sm overflow-hidden">
            <table className="w-full text-left border-collapse text-xs md:text-sm">
              <thead>
                <tr className="bg-[#f6f7f9] dark:bg-[#0e1628] text-[#535768] dark:text-[#aab3c5] font-semibold border-b border-slate-200 dark:border-white/10 uppercase tracking-wider text-[10px]">
                  <th className="py-4 px-6 font-semibold">System Field</th>
                  <th className="py-4 px-6 font-semibold">Custom Display Name</th>
                  <th className="py-4 px-6 text-center font-semibold">
                    <label 
                      className="flex items-center justify-center gap-2 mx-auto hover:text-[#0b5394] dark:hover:text-[#8cb8f0] active:scale-95 transition-all cursor-pointer select-none text-[#535768] dark:text-[#aab3c5] font-semibold uppercase tracking-wider text-[10px]"
                    >
                      <span>Show in List</span>
                      <Checkbox 
                        checked={localSettings.length > 0 && localSettings.every((s) => s.visibleInList)}
                        onCheckedChange={() => handleToggleAll("visibleInList")}
                        className="border-slate-300 dark:border-white/15 data-[state=checked]:!bg-blue-600 data-[state=checked]:!border-blue-600 h-4.5 w-4.5 rounded-md"
                      />
                    </label>
                  </th>
                  <th className="py-4 px-6 text-center font-semibold">
                    <label 
                      className="flex items-center justify-center gap-2 mx-auto hover:text-[#0b5394] dark:hover:text-[#8cb8f0] active:scale-95 transition-all cursor-pointer select-none text-[#535768] dark:text-[#aab3c5] font-semibold uppercase tracking-wider text-[10px]"
                    >
                      <span>Show in Form</span>
                      <Checkbox 
                        checked={localSettings.length > 0 && localSettings.every((s) => s.visibleInForm)}
                        onCheckedChange={() => handleToggleAll("visibleInForm")}
                        className="border-slate-300 dark:border-white/15 data-[state=checked]:!bg-blue-600 data-[state=checked]:!border-blue-600 h-4.5 w-4.5 rounded-md"
                      />
                    </label>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-white/10 text-[#1a1818] dark:text-[#e6e9f0]">
                {localSettings.map((setting, idx) => (
                  <tr key={setting.systemName} className="hover:bg-[#f6f7f9] dark:hover:bg-white/5 transition-colors group">
                    <td className="py-3.5 px-6 font-mono text-[#535768] dark:text-[#aab3c5] text-[10.5px]">
                      <span className="bg-[#f1f3f8] dark:bg-white/10 px-2.5 py-1 rounded-md border border-slate-200 dark:border-white/10 inline-block font-semibold">
                        {setting.systemName}
                      </span>
                    </td>
                    <td className="py-3.5 px-6">
                      <Input
                        value={setting.displayName}
                        onChange={(e) => handleLabelChange(idx, e.target.value)}
                        className="h-9 text-xs font-semibold bg-white dark:bg-[#111a2e] border-slate-200 dark:border-white/10 focus:border-[#e15425] focus:ring-[#e15425]/20 focus:ring-4 rounded-xl w-full max-w-xs transition-all placeholder:text-[#676879] dark:placeholder:text-[#8b95ab] font-sans shadow-sm"
                        placeholder="Enter label..."
                      />
                    </td>
                    <td className="py-3.5 px-6 text-center">
                      <div className="flex items-center justify-center">
                        <Checkbox
                          checked={setting.visibleInList}
                          onCheckedChange={() => handleToggle(idx, "visibleInList")}
                          className="border-slate-300 dark:border-white/15 data-[state=checked]:!bg-blue-600 data-[state=checked]:!border-blue-600 h-4.5 w-4.5 rounded-md shadow-sm transition-all hover:scale-105 active:scale-95"
                        />
                      </div>
                    </td>
                    <td className="py-3.5 px-6 text-center">
                      <div className="flex items-center justify-center">
                        <Checkbox
                          checked={setting.visibleInForm}
                          onCheckedChange={() => handleToggle(idx, "visibleInForm")}
                          className="border-slate-300 dark:border-white/15 data-[state=checked]:!bg-blue-600 data-[state=checked]:!border-blue-600 h-4.5 w-4.5 rounded-md shadow-sm transition-all hover:scale-105 active:scale-95"
                        />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Footer */}
        <div className="bg-white dark:bg-[#111a2e] border-t border-slate-100 dark:border-white/10 px-6 py-4 flex items-center justify-end gap-3 shrink-0">
          <Button
            type="button"
            variant="outline"
            onClick={onClose}
            className="border-slate-200 dark:border-white/10 text-[#323338] dark:text-[#d5dae4] hover:text-[#1a1818] dark:hover:text-white bg-white dark:bg-[#111a2e] hover:bg-[#f6f7f9] dark:hover:bg-white/5 font-semibold px-5 h-10 rounded-full transition-all duration-200 active:scale-95"
          >
            Cancel
          </Button>
          <Button
            type="button"
            onClick={handleSave}
            className="!bg-none !bg-blue-600 hover:!bg-blue-700 text-white font-semibold px-6 h-10 rounded-full shadow-md shadow-[#e15425]/25 dark:shadow-black/30 hover:shadow-[#e15425]/40 transition-all duration-200 active:scale-95 border-0"
          >
            Save Customization
          </Button>
        </div>
      </div>
    </div>
  );
}
