"use client";

import EntityListView from "@/components/listview/EntityListView";

/** CI systmMngt/document_template::index() — list, Add New Document Template, edit / delete per row. */
export default function DocumentTemplatePage() {
  return <EntityListView list="document_template" />;
}
