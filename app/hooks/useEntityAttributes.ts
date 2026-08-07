"use client";

import { useState } from "react";
import { entityApi } from "@/lib/entity/entityApi";

export function useEntityAttributes() {
  const [attributes, setAttributes] = useState<any[]>([]);

  const [loading, setLoading] = useState(false);

  const loadAttributes = async (
    entityId: number
  ) => {
    try {
      setLoading(true);

      const response =
        await entityApi.getEntityAttributes(entityId);

      setAttributes(response.data ?? response);
    } finally {
      setLoading(false);
    }
  };

  const saveAttribute = async (data: any) => {
    return entityApi.saveAttribute(data);
  };

  return {
    attributes,

    loading,

    loadAttributes,

    saveAttribute,
  };
}