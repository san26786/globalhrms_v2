import { InputBlock } from "@/components/FormBlocks/Input/InputBlock";
import { SelectBlock } from "@/components/FormBlocks/Select/SelectBlock";
import { CheckboxBlock } from "@/components/FormBlocks/Checkbox/CheckboxBlock";
import { TextareaBlock } from "@/components/FormBlocks/Textarea/TextAreaBlock";

export default function FormRenderer({
  fields,
  register,
  control,
  errors,
}: any) {
  return (
    <>
      {fields.map((field: any) => {
        switch (field.type) {
          case "input":
            return (
              <InputBlock
                key={field.name}
                {...field}
                register={register}
                control={control}
                errors={errors}
              />
            );

          case "select":
            return (
              <SelectBlock
                key={field.name}
                {...field}
                register={register}
                control={control}
                errors={errors}
              />
            );

          case "checkbox":
            return (
              <CheckboxBlock
                key={field.name}
                {...field}
                register={register}
                control={control}
                errors={errors}
              />
            );

          case "textarea":
            return (
              <TextareaBlock
                key={field.name}
                {...field}
                register={register}
                control={control}
                errors={errors}
              />
            );

          default:
            return null;
        }
      })}
    </>
  );
}