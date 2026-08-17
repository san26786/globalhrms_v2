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
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-3xl overflow-hidden border border-slate-100 flex flex-col max-h-[80vh] animate-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="bg-white text-slate-800 px-6 py-4.5 flex items-center justify-between border-b border-slate-100 shadow-sm shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-blue-50 flex items-center justify-center text-blue-600 shrink-0">
              <Settings className="h-5 w-5" />
            </div>
            <div className="flex flex-col">
              <h2 className="text-base font-bold tracking-tight text-slate-800">Form & List Customization</h2>
              <span className="text-xs text-slate-400 mt-0.5 font-medium">Customize columns visibility and labels</span>
            </div>
          </div>
          <button 
            onClick={onClose} 
            className="text-slate-400 hover:text-slate-600 hover:bg-slate-50 p-2 rounded-full transition-all duration-200 active:scale-95 flex items-center justify-center"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Content Area */}
        <div className="p-6 overflow-y-auto flex-1 bg-slate-50/50 scrollbar-thin scrollbar-thumb-slate-200">
          <div className="bg-white rounded-2xl border border-slate-200/60 shadow-sm overflow-hidden">
            <table className="w-full text-left border-collapse text-xs md:text-sm">
              <thead>
                <tr className="bg-slate-50/80 text-slate-500 font-bold border-b border-slate-200/80 uppercase tracking-wider text-[10px]">
                  <th className="py-4 px-6 font-bold">System Field</th>
                  <th className="py-4 px-6 font-bold">Custom Display Name</th>
                  <th className="py-4 px-6 text-center font-bold">
                    <label 
                      className="flex items-center justify-center gap-2 mx-auto hover:text-blue-600 active:scale-95 transition-all cursor-pointer select-none text-slate-500 font-bold uppercase tracking-wider text-[10px]"
                    >
                      <span>Show in List</span>
                      <Checkbox 
                        checked={localSettings.length > 0 && localSettings.every((s) => s.visibleInList)}
                        onCheckedChange={() => handleToggleAll("visibleInList")}
                        className="border-slate-300 data-[state=checked]:!bg-blue-600 data-[state=checked]:!border-blue-600 h-4.5 w-4.5 rounded-md"
                      />
                    </label>
                  </th>
                  <th className="py-4 px-6 text-center font-bold">
                    <label 
                      className="flex items-center justify-center gap-2 mx-auto hover:text-blue-600 active:scale-95 transition-all cursor-pointer select-none text-slate-500 font-bold uppercase tracking-wider text-[10px]"
                    >
                      <span>Show in Form</span>
                      <Checkbox 
                        checked={localSettings.length > 0 && localSettings.every((s) => s.visibleInForm)}
                        onCheckedChange={() => handleToggleAll("visibleInForm")}
                        className="border-slate-300 data-[state=checked]:!bg-blue-600 data-[state=checked]:!border-blue-600 h-4.5 w-4.5 rounded-md"
                      />
                    </label>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {localSettings.map((setting, idx) => (
                  <tr key={setting.systemName} className="hover:bg-slate-50/40 transition-colors group">
                    <td className="py-3.5 px-6 font-mono text-slate-400 text-[10.5px]">
                      <span className="bg-slate-100/80 px-2.5 py-1 rounded-md border border-slate-200/50 inline-block font-bold">
                        {setting.systemName}
                      </span>
                    </td>
                    <td className="py-3.5 px-6">
                      <Input
                        value={setting.displayName}
                        onChange={(e) => handleLabelChange(idx, e.target.value)}
                        className="h-9 text-xs font-semibold bg-white border-slate-200 focus:border-blue-500 focus:ring-blue-500/20 focus:ring-4 rounded-xl w-full max-w-xs transition-all placeholder:text-slate-400 font-sans shadow-sm"
                        placeholder="Enter label..."
                      />
                    </td>
                    <td className="py-3.5 px-6 text-center">
                      <div className="flex items-center justify-center">
                        <Checkbox
                          checked={setting.visibleInList}
                          onCheckedChange={() => handleToggle(idx, "visibleInList")}
                          className="border-slate-300 data-[state=checked]:!bg-blue-600 data-[state=checked]:!border-blue-600 h-4.5 w-4.5 rounded-md shadow-sm transition-all hover:scale-105 active:scale-95"
                        />
                      </div>
                    </td>
                    <td className="py-3.5 px-6 text-center">
                      <div className="flex items-center justify-center">
                        <Checkbox
                          checked={setting.visibleInForm}
                          onCheckedChange={() => handleToggle(idx, "visibleInForm")}
                          className="border-slate-300 data-[state=checked]:!bg-blue-600 data-[state=checked]:!border-blue-600 h-4.5 w-4.5 rounded-md shadow-sm transition-all hover:scale-105 active:scale-95"
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
        <div className="bg-white border-t border-slate-100 px-6 py-4 flex items-center justify-end gap-3 shrink-0">
          <Button
            type="button"
            variant="outline"
            onClick={onClose}
            className="border-slate-200 text-slate-600 hover:text-slate-900 bg-white hover:bg-slate-50 font-semibold px-5 h-10 rounded-full transition-all duration-200 active:scale-95"
          >
            Cancel
          </Button>
          <Button
            type="button"
            onClick={handleSave}
            className="!bg-none !bg-blue-600 hover:!bg-blue-700 text-white font-semibold px-6 h-10 rounded-full shadow-md shadow-blue-200/50 hover:shadow-blue-300/60 transition-all duration-200 active:scale-95 border-0"
          >
            Save Customization
          </Button>
        </div>
      </div>
    </div>
  );
}
