"use client";

import {
  useCallback,
  useEffect,
  useState,
} from "react";

import PageLoader from "@/lib/page-builder/pageLoader";
import { loadPageData } from "@/lib/page-builder/pageDataLoader";

import {
  LoadedPage,
  PageRuntimeState,
} from "@/lib/page-builder/pageTypes";

import {
  PageContainer,
  PageHeader,
  Breadcrumb,
  EntityToolbar,
} from "@/components/layout";

import { DataTable } from "@/components/DataTable";

interface EntityPageProps {
  entityId: number;
}

/**
 * Entity Page
 *
 * Connects:
 *
 * PageLoader
 *     ↓
 * PageConfig
 *     ↓
 * CRUD API
 *     ↓
 * DataTable
 */
export default function EntityPage({
  entityId,
}: EntityPageProps) {
  const [page, setPage] =
    useState<LoadedPage | null>(null);

  const [loading, setLoading] =
    useState(true);

  const [error, setError] =
    useState<string | null>(null);

  const [search, setSearch] =
    useState("");

  /**
   * Current page state
   */
  const [runtimeState, setRuntimeState] =
    useState<PageRuntimeState>({
      page: 1,
      pageSize: 10,
    });

  /**
   * --------------------------------------------------
   * Load Page
   * --------------------------------------------------
   */
  const load = useCallback(async () => {
    try {
<<<<<<< Updated upstream
      setLoading(true);
      setError(null);
=======
      const result =
        await PageLoader.load(parseInt(entity, 10));
>>>>>>> Stashed changes

      /**
       * -----------------------------------------------
       * 1. Load page definition
       * -----------------------------------------------
       */
      const loadedPage =
        await PageLoader.load(entityId);

      /**
       * -----------------------------------------------
       * 2. Load CRUD records
       * -----------------------------------------------
       */
      const result =
        await loadPageData(
          loadedPage.config,
          {
            ...runtimeState,
            search,
            pageSize:
              loadedPage.config.table
                ?.pageSize ??
              runtimeState.pageSize ??
              10,
          }
        );

      /**
       * -----------------------------------------------
       * 3. Merge page definition + data
       * -----------------------------------------------
       */
      setPage({
        ...loadedPage,

        tableData:
          result.data,

        total:
          result.total ?? result.data.length,

        loading: false,
      });
    } catch (err) {
      console.error(
        "Failed to load entity page:",
        err
      );

      setError(
        err instanceof Error
          ? err.message
          : "Failed to load page."
      );
    } finally {
      setLoading(false);
    }
  }, [
    entityId,
    runtimeState,
    search,
  ]);

  /**
   * --------------------------------------------------
   * Load when entity/search/page changes
   * --------------------------------------------------
   */
  useEffect(() => {
    load();
  }, [load]);

  /**
   * --------------------------------------------------
   * Search
   * --------------------------------------------------
   */
  const handleSearch = (
    value: string
  ) => {
    setSearch(value);

    setRuntimeState((previous) => ({
      ...previous,
      page: 1,
    }));
  };

  /**
   * --------------------------------------------------
   * Refresh
   * --------------------------------------------------
   */
  const handleRefresh = () => {
    load();
  };

  /**
   * --------------------------------------------------
   * Loading
   * --------------------------------------------------
   */
  if (loading) {
    return (
      <PageContainer>
        <div className="rounded-xl border bg-white p-10">
          Loading...
        </div>
      </PageContainer>
    );
  }

  /**
   * --------------------------------------------------
   * Error
   * --------------------------------------------------
   */
  if (error) {
    return (
      <PageContainer>
        <div className="rounded-xl border bg-white p-10 text-red-500">
          {error}
        </div>
      </PageContainer>
    );
  }

  /**
   * --------------------------------------------------
   * Page not found
   * --------------------------------------------------
   */
  if (!page) {
    return (
      <PageContainer>
        <div className="rounded-xl border bg-white p-10 text-red-500">
          Entity not found.
        </div>
      </PageContainer>
    );
  }

  /**
   * --------------------------------------------------
   * Render Page
   * --------------------------------------------------
   */
  return (
    <PageContainer>
      {/* ================================================
          Page Header
      ================================================= */}
      {page.config.layout
        ?.showHeader !== false && (
        <PageHeader
          title={page.config.title}
          subtitle={page.config.layout?.subtitle}
        />
      )}

<<<<<<< Updated upstream
      {/* ================================================
          Breadcrumb
      ================================================= */}
      {page.config.layout
        ?.showBreadcrumb !== false && (
        <Breadcrumb
          items={
            page.config.breadcrumbs ??
            []
          }
        />
      )}

      {/* ================================================
          Toolbar
      ================================================= */}
      {page.config.layout
        ?.showToolbar !== false && (
        <EntityToolbar
          createLabel={`Add ${page.config.title}`}
          onRefresh={
            page.config.toolbar
              ?.showRefresh !== false
              ? handleRefresh
              : undefined
          }
          onSearch={
            page.config.toolbar
              ?.showSearch !== false
              ? handleSearch
              : undefined
          }
        />
      )}
=======
      <PageHeader
        title={page.config.title}
        description={page.config.subtitle}
      />

      <Breadcrumb
        items={
          (page.config.breadcrumbs ?? []).map((b) => ({
            label: b.title,
            href: b.href,
          }))
        }
      />

      <EntityToolbar
        createLabel={`Add ${page.config.title}`}
        onRefresh={load}
        onSearch={setSearch}
      />
>>>>>>> Stashed changes

      {/* ================================================
          Data Table
      ================================================= */}
      <DataTable
        columns={
<<<<<<< Updated upstream
          page.tableColumns?.columns ?? []
        }
        data={
          page.tableData ?? []
        }
        entity={
          page.config.entity
        }
=======
          (page.tableColumns as any)?.columns ?? []
        }
        data={(page as any).tableData ?? []}
        entity={entity}
>>>>>>> Stashed changes
        search={search}
      />
    </PageContainer>
  );
}

/**
 * ======================================================
 * Entity Page Factory
 * ======================================================
 *
 * Example:
 *
 * export default createEntityPage(1);
 */
export function createEntityPage(
  entityId: number
) {
  return function Entity() {
    return (
      <EntityPage
        entityId={entityId}
      />
    );
  };
}