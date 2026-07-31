import { FormConfig } from "./formTypes";

export async function buildForm(config: FormConfig) {

    const isEdit = !!config.id;

    let initialData = {};

    if (isEdit) {
        initialData = await config.service.getById(config.id);
    }

    const controls = await config.controls();

    return {

        title: `${isEdit ? "Edit" : "Add"} ${config.title}`,

        mode: isEdit ? "edit" : "add",

        action:
            isEdit
                ? `/api/${config.module}/${config.id}`
                : `/api/${config.module}`,

        cancelUrl: `/${config.module}`,

        breadcrumb: [

            {
                title: config.title,
                href: `/${config.module}`,
            },

            {
                title: isEdit ? "Edit" : "Add",
            },

        ],

        controls,

        values: initialData,

    };
}