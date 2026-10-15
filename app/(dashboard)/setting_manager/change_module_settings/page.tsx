import ModuleSettingsForm from "./ModuleSettingsForm";

/**
 * CI setting_manager/change_module_settings/index/{moduleId}/{funcAreaId}/{settingGroupId}/{CS|SS}
 * → /setting_manager/change_module_settings?screen=&moduleId=&funcAreaId=&settingGroupId=
 * (old CI URLs are redirected here by proxy.ts through the route registry).
 */
export default async function ChangeModuleSettingsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const one = (key: string) => {
    const v = sp[key];
    return typeof v === "string" ? v : "";
  };
  const screen = one("screen") === "CS" || one("screen") === "SS" ? (one("screen") as "CS" | "SS") : "module";
  return (
    <ModuleSettingsForm
      screen={screen}
      moduleId={one("moduleId")}
      funcAreaId={one("funcAreaId")}
      settingGroupId={one("settingGroupId")}
    />
  );
}
