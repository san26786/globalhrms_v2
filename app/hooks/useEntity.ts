"use client";

import { useCallback, useState } from "react";
import { entityApi } from "@/lib/entity/entityApi";
import { EntityFilters } from "@/lib/entity/entityTypes";

export function useEntity() {
  const [entities, setEntities] = useState<any[]>([]);
  const [entity, setEntity] = useState<any>(null);

  const [loading, setLoading] = useState(false);

  const [error, setError] = useState<string | null>(null);

  const loadEntities = useCallback(async (params?: EntityFilters) => {
    try {
      setLoading(true);
      setError(null);

      const response = await entityApi.getEntityList(params);

      setEntities(response.data ?? response);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  const loadEntity = useCallback(async (id: number) => {
    try {
      setLoading(true);

      const response = await entityApi.getEntity(id);

      setEntity(response.data ?? response);

      return response;
    } finally {
      setLoading(false);
    }
  }, []);

  const saveEntity = async (data: any) => {
    return entityApi.saveEntity(data);
  };

  const updateEntity = async (
    id: number,
    data: any
  ) => {
    return entityApi.updateEntity(id, data);
  };

  const deleteEntity = async (id: number) => {
    return entityApi.deleteEntity(id);
  };

  return {
    entities,
    entity,

    loading,
    error,

    loadEntities,
    loadEntity,

    saveEntity,
    updateEntity,
    deleteEntity,
  };
}