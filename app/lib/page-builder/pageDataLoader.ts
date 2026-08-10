import {
  PageConfig,
  PageRuntimeState,
} from "./pageTypes";

/**
 * ==========================================================
 * Page Data Loader
 * ==========================================================
 *
 * Loads entity records for the Page Builder.
 *
 * Flow:
 *
 * PageConfig
 *     ↓
 * CRUD list endpoint
 *     ↓
 * API response
 *     ↓
 * PageDataResult
 *     ↓
 * DataTable
 */

/**
 * ==========================================================
 * Result
 * ==========================================================
 */

export interface PageDataResult<T = any> {
  data: T[];

  total?: number;

  page?: number;

  pageSize?: number;
}

/**
 * ==========================================================
 * API Response
 * ==========================================================
 *
 * Supports common API response formats:
 *
 * 1. { data: [...] }
 * 2. { rows: [...] }
 * 3. { data: [...], total: 100 }
 * 4. [...]
 */

interface PageApiResponse<T = any> {
  data?: T[];

  rows?: T[];

  items?: T[];

  total?: number;

  count?: number;

  page?: number;

  pageSize?: number;
}

/**
 * ==========================================================
 * Load Page Data
 * ==========================================================
 */

export async function loadPageData<T = any>(
  config: PageConfig,
  state: PageRuntimeState = {}
): Promise<PageDataResult<T>> {
  const endpoint =
    config.api.list ??
    config.api.baseUrl;

  if (!endpoint) {
    throw new Error(
      `List API endpoint is not configured for "${config.entity}".`
    );
  }

  /**
   * Build query parameters.
   */
  const params =
    new URLSearchParams();

  /**
   * Search
   */
  if (state.search) {
    params.set(
      "search",
      state.search
    );
  }

  /**
   * Pagination
   */
  if (state.page !== undefined) {
    params.set(
      "page",
      String(state.page)
    );
  }

  if (state.pageSize !== undefined) {
    params.set(
      "pageSize",
      String(state.pageSize)
    );
  }

  /**
   * Sorting
   */
  if (state.sortBy) {
    params.set(
      "sortBy",
      state.sortBy
    );
  }

  if (state.sortOrder) {
    params.set(
      "sortOrder",
      state.sortOrder
    );
  }

  /**
   * Filters
   */
  if (state.filters) {
    Object.entries(
      state.filters
    ).forEach(([key, value]) => {
      if (
        value !== undefined &&
        value !== null &&
        value !== ""
      ) {
        /**
         * Objects/arrays are encoded as JSON.
         */
        if (
          typeof value === "object"
        ) {
          params.set(
            key,
            JSON.stringify(value)
          );
        } else {
          params.set(
            key,
            String(value)
          );
        }
      }
    });
  }

  /**
   * Final URL
   */
  const query =
    params.toString();

  const url = query
    ? `${endpoint}?${query}`
    : endpoint;

  /**
   * Request
   */
  const response = await fetch(
    url,
    {
      method: "GET",

      headers: {
        Accept:
          "application/json",
      },

      cache: "no-store",
    }
  );

  /**
   * Handle API errors.
   */
  if (!response.ok) {
    let message =
      `Failed to load ${config.entity} data.`;

    try {
      const error =
        await response.json();

      message =
        error?.message ??
        error?.error ??
        message;
    } catch {
      // Response was not JSON.
    }

    throw new Error(message);
  }

  /**
   * Parse response.
   */
  const result =
    (await response.json()) as
      | PageApiResponse<T>
      | T[];

  /**
   * API directly returned an array.
   */
  if (Array.isArray(result)) {
    return {
      data: result,
      page: state.page,
      pageSize: state.pageSize,
    };
  }

  /**
   * Support:
   *
   * data
   * rows
   * items
   */
  const data =
    result.data ??
    result.rows ??
    result.items ??
    [];

  return {
    data,

    total:
      result.total ??
      result.count,

    page:
      result.page ??
      state.page,

    pageSize:
      result.pageSize ??
      state.pageSize,
  };
}

/**
 * ==========================================================
 * Load First Page
 * ==========================================================
 */

export async function loadFirstPage<T = any>(
  config: PageConfig,
  pageSize?: number
): Promise<PageDataResult<T>> {
  return loadPageData<T>(
    config,
    {
      page: 1,

      pageSize:
        pageSize ??
        config.table?.pageSize ??
        10,
    }
  );
}

/**
 * ==========================================================
 * Search Page Data
 * ==========================================================
 */

export async function searchPageData<T = any>(
  config: PageConfig,
  search: string,
  pageSize?: number
): Promise<PageDataResult<T>> {
  return loadPageData<T>(
    config,
    {
      search,

      page: 1,

      pageSize:
        pageSize ??
        config.table?.pageSize ??
        10,
    }
  );
}

/**
 * ==========================================================
 * Load Specific Page
 * ==========================================================
 */

export async function loadPageNumber<T = any>(
  config: PageConfig,
  page: number,
  pageSize?: number
): Promise<PageDataResult<T>> {
  return loadPageData<T>(
    config,
    {
      page,

      pageSize:
        pageSize ??
        config.table?.pageSize ??
        10,
    }
  );
}