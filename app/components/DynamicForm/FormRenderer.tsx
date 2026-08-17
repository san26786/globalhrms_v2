"use client";

import { Control, FieldErrors, FieldValues, UseFormRegister } from "react-hook-form";

import FormSection from "./FormSection";
import FormGrid, { FormGridItem } from "./FormGrid";
import FieldFactory from "./FieldFactory";

interface DynamicField {
  name: string;
  label?: string;
  type: string;
  section?: string;
  colSpan?: number;
  order?: number;
  hidden?: boolean;
  [key: string]: unknown;
}

interface Props {
  fields: DynamicField[];
  register: UseFormRegister<FieldValues>;
  control: Control<FieldValues>;
  errors: FieldErrors<FieldValues>;
}

export default function FormRenderer({
  fields,
  register,
  control,
  errors,
}: Props) {

  // Group fields by section
  const groupedFields = fields.reduce<Record<string, DynamicField[]>>(
    (acc, field) => {
      const section = field.section || "General";

      if (!acc[section]) {
        acc[section] = [];
      }

      acc[section].push(field);

      return acc;
    },
    {}
  );

  return (
    <>
      {Object.entries(groupedFields).map(([section, sectionFields]) => {
        const grid = (
          <FormGrid columns={12} key={section}>
            {sectionFields
              .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
              .map((field) => (
                <FormGridItem
                  key={field.name}
                  span={field.colSpan ?? 12}
                >
                  <FieldFactory
                    field={field as any}
                    register={register}
                    control={control}
                    errors={errors}
                  />
                </FormGridItem>
              ))}
          </FormGrid>
        );

        if (section === "General") {
          return grid;
        }

        return (
          <FormSection
            key={section}
            title={section}
          >
            {grid}
          </FormSection>
        );
      })}
    </>
  );
}
