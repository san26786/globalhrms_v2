import { DynamicForm } from "./formTypes";
import { mapAttributesToFields } from "./utils/fieldMapper";

/**
 * Builds a DynamicForm from raw entity metadata.
 *
 * This used to carry its own local copy of attribute -> field mapping
 * (including a second, less complete `mapControlType` switch) that
 * duplicated `utils/fieldMapper.ts`. There was also a third copy in
 * the now-removed `fieldFactory.ts`. `utils/fieldMapper.ts` is the
 * canonical version (most complete type coverage, handles both
 * IS_REQUIRED and IS_MANDATORY, disabled/readOnly/width) - everything
 * else now delegates to it.
 */
export function buildForm(metadata: any): DynamicForm {
  return {
    title: metadata.OBJ_NM,
    fields: mapAttributesToFields(metadata.entity_obj_attrbt ?? []),
  };
}
