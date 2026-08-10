import { PageConfig } from "./pageTypes";

/**
 * ==========================================================
 * Page Actions
 * ==========================================================
 *
 * Connects Page Builder with the generic CRUD API.
 *
 * Page Builder
 *      ↓
 * Page Actions
 *      ↓
 * PageConfig.api
 *      ↓
 * Generic CRUD API
 */

/**
 * ==========================================================
 * Generic Request Helper
 * ==========================================================
 */
async function request<T = any>(
  url: string,
  method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE",
  data?: unknown
): Promise<T> {
  const response = await fetch(url, {
    method,
    headers: {
      "Content-Type": "application/json",
    },
    body:
      data !== undefined
        ? JSON.stringify(data)
        : undefined,
  });

  /**
   * Handle unsuccessful responses.
   */
  if (!response.ok) {
    let message = `Request failed with status ${response.status}`;

    try {
      const error = await response.json();

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
   * DELETE / 204 responses may not contain JSON.
   */
  if (response.status === 204) {
    return null as T;
  }

  const contentType =
    response.headers.get("content-type");

  if (
    !contentType?.includes("application/json")
  ) {
    return null as T;
  }

  return response.json();
}

/**
 * ==========================================================
 * Create Record
 * ==========================================================
 */
export async function createPageRecord<T = any>(
  config: PageConfig,
  data: Record<string, any>
): Promise<T> {
  const url =
    config.api.create ??
    config.api.baseUrl;

  return request<T>(
    url,
    "POST",
    data
  );
}

/**
 * ==========================================================
 * Update Record
 * ==========================================================
 */
export async function updatePageRecord<T = any>(
  config: PageConfig,
  id: string | number,
  data: Record<string, any>
): Promise<T> {
  const url =
    config.api.update ??
    `${config.api.baseUrl}/${id}`;

  return request<T>(
    url,
    "PUT",
    data
  );
}

/**
 * ==========================================================
 * Delete Record
 * ==========================================================
 */
export async function deletePageRecord<T = any>(
  config: PageConfig,
  id: string | number
): Promise<T> {
  const url =
    config.api.delete ??
    `${config.api.baseUrl}/${id}`;

  return request<T>(
    url,
    "DELETE"
  );
}

/**
 * ==========================================================
 * Get Record Details
 * ==========================================================
 */
export async function getPageRecord<T = any>(
  config: PageConfig,
  id: string | number
): Promise<T> {
  const baseUrl =
    config.api.details ??
    `${config.api.baseUrl}/${id}`;

  /**
   * If details endpoint doesn't contain
   * the ID, append it.
   */
  const url =
    config.api.details &&
    !config.api.details.endsWith(
      `/${id}`
    )
      ? `${config.api.details}/${id}`
      : baseUrl;

  return request<T>(
    url,
    "GET"
  );
}

/**
 * ==========================================================
 * List Records
 * ==========================================================
 *
 * Although list loading is primarily handled by
 * pageDataLoader.ts, this helper is useful when
 * Page Actions need to refresh/read data.
 */
export async function listPageRecords<T = any>(
  config: PageConfig,
  params?: Record<string, string | number | boolean>
): Promise<T> {
  const url =
    config.api.list ??
    config.api.baseUrl;

  const searchParams =
    new URLSearchParams();

  Object.entries(
    params ?? {}
  ).forEach(([key, value]) => {
    if (
      value !== undefined &&
      value !== null
    ) {
      searchParams.set(
        key,
        String(value)
      );
    }
  });

  const query =
    searchParams.toString();

  const requestUrl = query
    ? `${url}?${query}`
    : url;

  return request<T>(
    requestUrl,
    "GET"
  );
}