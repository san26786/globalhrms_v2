"use client";

import EntityListView from "@/components/listview/EntityListView";

/**
 * CI user/user_domain::index() ("User Domain"): list, Add New and
 * row edit / delete. List: listDefinitions 'user_domain'; rules: lib/user_domain.
 */
export default function UserDomainPage() {
  return <EntityListView list="user_domain" />;
}
