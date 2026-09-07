"use client";

import React, { useEffect, useState } from "react";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogFooter,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogAction,
  AlertDialogCancel,
} from "@/components/ui/alert-dialog";
import { alertManager, ModalState } from "../alert";
import { AlertTriangle, AlertCircle, Info, HelpCircle } from "lucide-react";
import { cn } from "@/lib/utils";

export function GlobalAlertModal() {
  const [modal, setModal] = useState<ModalState | null>(null);

  useEffect(() => {
    const unsubscribe = alertManager.subscribe((state) => {
      setModal(state);
    });
    return unsubscribe;
  }, []);

  if (!modal || !modal.isOpen) return null;

  const handleConfirm = () => {
    const resolve = modal.resolve;
    setModal(null);
    resolve(true);
  };

  const handleCancel = () => {
    const resolve = modal.resolve;
    setModal(null);
    resolve(false);
  };

  const getVariantStyles = () => {
    switch (modal.variant) {
      case "destructive":
        return {
          icon: <AlertCircle className="w-6 h-6 text-red-600" />,
          iconBg: "bg-red-50 text-red-600 border border-red-200",
          actionBtn: "bg-red-600 hover:bg-red-700 text-white focus:ring-red-500",
        };
      case "warning":
        return {
          icon: <AlertTriangle className="w-6 h-6 text-amber-600" />,
          iconBg: "bg-amber-50 text-amber-600 border border-amber-200",
          actionBtn: "bg-amber-600 hover:bg-amber-700 text-white focus:ring-amber-500",
        };
      default:
        return {
          icon: modal.type === "confirm" ? (
            <HelpCircle className="w-6 h-6 text-blue-600" />
          ) : (
            <Info className="w-6 h-6 text-blue-600" />
          ),
          iconBg: "bg-blue-50 text-blue-600 border border-blue-200",
          actionBtn: "bg-blue-600 hover:bg-blue-700 text-white focus:ring-blue-500",
        };
    }
  };

  const { icon, iconBg, actionBtn } = getVariantStyles();

  return (
    <AlertDialog
      open={modal.isOpen}
      onOpenChange={(open) => {
        if (!open) handleCancel();
      }}
    >
      <AlertDialogContent className="max-w-md p-6 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-2xl">
        <AlertDialogHeader className="space-y-3">
          <div className="flex items-start gap-4">
            <div className={cn("p-2.5 rounded-full shrink-0 flex items-center justify-center", iconBg)}>
              {icon}
            </div>
            <div className="flex-1 space-y-1">
              <AlertDialogTitle className="text-lg font-semibold text-slate-900 dark:text-slate-100">
                {modal.title}
              </AlertDialogTitle>
              {modal.description && (
                <AlertDialogDescription className="text-sm text-slate-600 dark:text-slate-400 whitespace-pre-line leading-relaxed">
                  {modal.description}
                </AlertDialogDescription>
              )}
            </div>
          </div>
        </AlertDialogHeader>

        <AlertDialogFooter className="mt-6 flex flex-row items-center justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
          {modal.type === "confirm" && (
            <AlertDialogCancel
              onClick={handleCancel}
              className="mt-0 border border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 font-medium px-4 py-2 rounded-lg text-sm transition"
            >
              {modal.cancelText || "Cancel"}
            </AlertDialogCancel>
          )}
          <AlertDialogAction
            onClick={handleConfirm}
            className={cn("font-medium px-4 py-2 rounded-lg text-sm shadow transition", actionBtn)}
          >
            {modal.confirmText}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
