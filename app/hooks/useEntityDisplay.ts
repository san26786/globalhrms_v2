"use client";

import { useState } from "react";
import { entityApi } from "@/lib/entity/entityApi";

export function useEntityDisplay() {
  const [displayDetails, setDisplayDetails] =
    useState<any[]>([]);

  const [loading, setLoading] = useState(false);

  const loadDisplayDetails = async (
    attributeId: number
  ) => {
    try {
      setLoading(true);

      const response =
        await entityApi.getDisplayDetails(attributeId);

      setDisplayDetails(response.data ?? response);
    } finally {
      setLoading(false);
    }
  };

  const saveDisplayDetails = async (data: any) => {
    return entityApi.saveDisplayDetails(data);
  };

  return {
    displayDetails,

    loading,

    loadDisplayDetails,

    saveDisplayDetails,
  };
}