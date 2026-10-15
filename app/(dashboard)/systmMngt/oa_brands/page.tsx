"use client";

import EntityListView from "@/components/listview/EntityListView";

/**
 * CI systmMngt/oa_brands::index() ("Oa Brands"): the brand list with Edit / Delete per row. CI had no
 * Add button (commented out). List: listDefinitions 'oa_brands'; rules: lib/systmMngt/oaBrands.
 */
export default function OaBrandsPage() {
  return <EntityListView list="oa_brands" />;
}
