export default {
    options: {
        lazyHydrate: true,
    },
    editor: {
        label: {
            en: 'Course Scheduler',
        },
        icon: 'calendar',
        bubble: {
            icon: 'calendar',
        },
    },
    properties: {
        schoolId: {
            label: {
                en: 'School ID',
                fr: 'ID École',
            },
            type: 'Text',
            options: {
                placeholder: 'Enter school UUID',
            },
            bindable: true,
            defaultValue: null,
            /* wwEditor:start */
            bindingValidation: {
                validations: [
                    {
                        type: 'string',
                    },
                ],
                tooltip: 'UUID of the school for which the schedule is being created',
            },
            /* wwEditor:end */
        },
        draftId: {
            label: {
                en: 'Draft ID',
                fr: 'ID Brouillon',
            },
            type: 'Text',
            options: {
                placeholder: 'Enter draft UUID',
            },
            bindable: true,
            defaultValue: null,
            /* wwEditor:start */
            bindingValidation: {
                validations: [
                    {
                        type: 'string',
                    },
                ],
                tooltip: 'UUID of the current draft being edited',
            },
            /* wwEditor:end */
        },
        publishedBy: {
            label: {
                en: 'Published By',
                fr: 'Publié par',
            },
            type: 'Text',
            options: {
                placeholder: 'Enter user UUID',
            },
            bindable: true,
            defaultValue: null,
            /* wwEditor:start */
            bindingValidation: {
                validations: [
                    {
                        type: 'string',
                    },
                ],
                tooltip: 'UUID of the user publishing the schedule, or null if not published',
            },
            /* wwEditor:end */
        },
    },
};
