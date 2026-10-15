const PAGE = "/periodMngt/period_mst";

export function buildPeriodUrl(periodTypeId?: string, periodStatusId?: string) {
  const p = new URLSearchParams();
  if (periodTypeId && periodTypeId !== "0") p.set("periodTypeId", periodTypeId);
  if (periodStatusId && periodStatusId !== "0") p.set("periodStatusId", periodStatusId);
  return p.size ? `${PAGE}?${p}` : PAGE;
}