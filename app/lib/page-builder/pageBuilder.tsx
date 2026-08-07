"use client";

import { useEffect, useState } from "react";

import PageLoader from "./pageLoader";

import { LoadedPage } from "./pageTypes";

import {
  PageContainer,
  PageHeader,
  Breadcrumb,
  EntityToolbar,
} from "@/components/layout";

import { DataTable } from "@/components/DataTable";

interface EntityPageProps {
  entity: string;
}

export default function EntityPage({
  entity,
}: EntityPageProps) {
  const [page, setPage] =
    useState<LoadedPage | null>(null);

  const [loading, setLoading] =
    useState(true);

  const [search, setSearch] =
    useState("");

  useEffect(() => {
    load();
  }, [entity]);

  async function load() {
    setLoading(true);

    try {
      const result =
        await PageLoader.load(entity);

      setPage(result);
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <PageContainer>

        <div className="bg-white rounded-xl border p-10">

          Loading...

        </div>

      </PageContainer>
    );
  }

  if (!page) {
    return (
      <PageContainer>

        <div className="bg-white rounded-xl border p-10 text-red-500">

          Entity not found.

        </div>

      </PageContainer>
    );
  }

  return (
    <PageContainer>

      <PageHeader
        title={page.config.title}
        subtitle={
          page.config.subtitle
        }
      />

      <Breadcrumb
        items={
          page.config.breadcrumbs ??
          []
        }
      />

      <EntityToolbar
        createLabel={`Add ${page.config.title}`}
        onRefresh={load}
        onSearch={setSearch}
      />

      <DataTable
        columns={
          page.tableColumns ?? []
        }
        data={page.tableData ?? []}
        entity={entity}
        search={search}
      />

    </PageContainer>
  );
}

/**
 * Factory
 *
 * export default createEntityPage("employee")
 */
export function createEntityPage(
  entity: string
) {
  return function Entity() {
    return (
      <EntityPage entity={entity} />
    );
  };
}