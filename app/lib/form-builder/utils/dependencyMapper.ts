// app/lib/form-builder/utils/dependencyMapper.ts

export interface FieldDependency {
  field: string;
  dependsOn: string;
  value?: string | number | boolean;
  operator?: "eq" | "neq" | "in" | "notIn";
}

export function mapDependencies(
  metadata: any[] = []
): FieldDependency[] {
  return metadata.map((item) => ({
    field:
      item.OBJ_ATTRBT_NM ??
      item.FIELD_NAME ??
      "",

    dependsOn:
      item.DEPENDENT_FIELD ??
      item.PARENT_FIELD ??
      "",

    value:
      item.DEPENDENT_VALUE ??
      item.VALUE,

    operator: "eq",
  }));
}

export function getFieldDependency(
  field: string,
  dependencies: FieldDependency[]
) {
  return dependencies.find(
    (d) => d.field === field
  );
}