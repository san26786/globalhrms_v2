"use client";

import { useState } from "react";
import { entityApi } from "@/lib/entity/entityApi";

export function useEntityMapping() {
  const [mappings, setMappings] =
    useState<any[]>([]);

  const [dependentData, setDependentData] =
    useState<any[]>([]);

  const [privileges, setPrivileges] =
    useState<any[]>([]);

  const [loading, setLoading] = useState(false);

  const loadMappings = async (
    entityId: number
  ) => {
    try {
      setLoading(true);

      const response =
        await entityApi.getEntityMappings(entityId);

      setMappings(response.data ?? response);
    } finally {
      setLoading(false);
    }
  };

  const loadDependentData = async (
    attributeId: number
  ) => {
    const response =
      await entityApi.getDependentData(attributeId);

    setDependentData(response.data ?? response);
  };

  const loadPrivileges = async (
    attributeId: number
  ) => {
    const response =
      await entityApi.getPrivileges(attributeId);

    setPrivileges(response.data ?? response);
  };

  const saveMapping = async (data: any) => {
    return entityApi.saveEntityMapping(data);
  };

  const saveDependentData = async (data: any) => {
    return entityApi.saveDependentData(data);
  };

  const savePrivileges = async (data: any) => {
    return entityApi.savePrivileges(data);
  };

  return {
    mappings,

    dependentData,

    privileges,

    loading,

    loadMappings,

    loadDependentData,

    loadPrivileges,

    saveMapping,

    saveDependentData,

    savePrivileges,
  };
}