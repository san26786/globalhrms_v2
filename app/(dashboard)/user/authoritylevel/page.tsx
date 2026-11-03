"use client";

import EntityListView from "@/components/listview/EntityListView";

/**
 * CI authoritylevel/authoritylevel::index() ("Authority Level"): list, Add New and row edit /
 * delete. List: listDefinitions 'authority_level'; rules: lib/user/authorityLevel.resource.
 */
export default function AuthorityLevelPage() {
    return <EntityListView list="authority_level" />;
}
