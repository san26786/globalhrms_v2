"use client";

import React, { useState, useEffect } from "react";
import { X } from "lucide-react";
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

  useEffect(() => {
    if (isOpen) {
      setLocalSettings(JSON.parse(JSON.stringify(settings)));
    }
  }, [isOpen, settings]);

  if (!isOpen) return null;

  const handleToggle = (index: number, key: "visibleInList" | "visibleInForm") => {
    const updated = [...localSettings];
    updated[index][key] = !updated[index][key];
    setLocalSettings(updated);
  };

  const handleLabelChange = (index: number, val: string) => {
    const updated = [...localSettings];
    updated[index].displayName = val;
    setLocalSettings(updated);
  };

  const handleSave = () => {
    onSave(localSettings);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[999] flex items-center justify-center bg-black/40 backdrop-blur-sm font-sans">
      <div className="bg-white rounded-t-lg rounded-b-lg shadow-2xl w-full max-w-2xl overflow-hidden border border-slate-200 flex flex-col max-h-[85vh] animate-in zoom-in-95 duration-200">
        {/* Header - Blue Background */}
        <div className="bg-blue-600 text-white px-5 py-3 flex items-center justify-between shrink-0">
          <h2 className="text-sm font-bold tracking-wide">Form Settings</h2>
          <button 
            onClick={onClose} 
            className="text-white/80 hover:text-white hover:bg-white/10 p-1.5 rounded-full transition-all duration-200"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Content Area */}
        <div className="p-4 overflow-y-auto flex-1 bg-white scrollbar-thin scrollbar-thumb-slate-200">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold uppercase tracking-wider text-[10px]">
                <th className="py-2.5 px-4 font-bold border-r border-slate-200">System Column Name</th>
                <th className="py-2.5 px-4 font-bold border-r border-slate-200">Display Column Name</th>
                <th className="py-2.5 px-4 text-center font-bold border-r border-slate-200">
                  <span className="flex items-center justify-center gap-1.5 select-none">
                    Visible in List
                    <Checkbox
                      checked={localSettings.length > 0 && localSettings.every((s) => s.visibleInList)}
                      onCheckedChange={(val) => {
                        const checked = !!val;
                        setLocalSettings(localSettings.map(s => ({ ...s, visibleInList: checked })));
                      }}
                      className="border-slate-300 data-[state=checked]:!bg-blue-600 data-[state=checked]:!border-blue-600 h-3.5 w-3.5"
                    />
                  </span>
                </th>
                <th className="py-2.5 px-4 text-center font-bold">
                  <span className="flex items-center justify-center gap-1.5 select-none">
                    Visible in Form
                    <Checkbox
                      checked={localSettings.length > 0 && localSettings.every((s) => s.visibleInForm)}
                      onCheckedChange={(val) => {
                        const checked = !!val;
                        setLocalSettings(localSettings.map(s => ({ ...s, visibleInForm: checked })));
                      }}
                      className="border-slate-300 data-[state=checked]:!bg-blue-600 data-[state=checked]:!border-blue-600 h-3.5 w-3.5"
                    />
                  </span>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 text-slate-700">
              {localSettings.map((setting, idx) => (
                <tr key={setting.systemName} className="hover:bg-slate-50/50">
                  <td className="py-2 px-4 font-mono text-[11px] text-slate-500 border-r border-slate-200 font-semibold">
                    {setting.systemName}
                  </td>
                  <td className="py-2 px-4 border-r border-slate-200">
                    <Input
                      value={setting.displayName}
                      onChange={(e) => handleLabelChange(idx, e.target.value)}
                      className="h-8 text-xs font-semibold bg-white border-slate-200 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 rounded-md w-full max-w-xs placeholder:text-slate-400 font-sans shadow-none"
                    />
                  </td>
                  <td className="py-2 px-4 text-center border-r border-slate-200">
                    <div className="flex items-center justify-center">
                      <Checkbox
                        checked={setting.visibleInList}
                        onCheckedChange={() => handleToggle(idx, "visibleInList")}
                        className="border-slate-300 data-[state=checked]:!bg-blue-600 data-[state=checked]:!border-blue-600 h-3.5 w-3.5 rounded"
                      />
                    </div>
                  </td>
                  <td className="py-2 px-4 text-center">
                    <div className="flex items-center justify-center">
                      <Checkbox
                        checked={setting.visibleInForm}
                        onCheckedChange={() => handleToggle(idx, "visibleInForm")}
                        className="border-slate-300 data-[state=checked]:!bg-blue-600 data-[state=checked]:!border-blue-600 h-3.5 w-3.5 rounded"
                      />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Footer */}
        <div className="bg-slate-50 border-t border-slate-200 px-5 py-3.5 flex items-center justify-end gap-2.5 shrink-0">
          <Button
            type="button"
            variant="outline"
            onClick={onClose}
            className="border-slate-300 text-slate-600 hover:text-slate-900 bg-white hover:bg-slate-50 font-semibold px-4 h-8 rounded text-xs transition-all duration-200"
          >
            Close
          </Button>
          <Button
            type="button"
            onClick={handleSave}
            className="bg-blue-600 hover:bg-blue-700 text-white font-semibold px-4.5 h-8 rounded text-xs transition-all duration-200 border-0 shadow-sm"
          >
            Save changes
          </Button>
        </div>
      </div>
    </div>
  );
}
