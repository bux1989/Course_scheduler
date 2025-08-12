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
        periods: {
            label: {
                en: 'Periods',
                fr: 'Périodes',
            },
            type: 'Array',
            bindable: true,
            defaultValue: [],
            /* wwEditor:start */
            bindingValidation: {
                validations: [
                    {
                        type: 'array',
                    },
                ],
                tooltip: 'Array of period objects with id, name, start_time, end_time properties',
            },
            /* wwEditor:end */
        },
        courses: {
            label: {
                en: 'Courses',
                fr: 'Cours',
            },
            type: 'Array',
            bindable: true,
            defaultValue: [],
            /* wwEditor:start */
            bindingValidation: {
                validations: [
                    {
                        type: 'array',
                    },
                ],
                tooltip: 'Array of course objects with id, name, color properties',
            },
            /* wwEditor:end */
        },
        teachers: {
            label: {
                en: 'Teachers',
                fr: 'Enseignants',
            },
            type: 'Array',
            bindable: true,
            defaultValue: [],
            /* wwEditor:start */
            bindingValidation: {
                validations: [
                    {
                        type: 'array',
                    },
                ],
                tooltip: 'Array of teacher objects with id, name, color properties',
            },
            /* wwEditor:end */
        },
        classes: {
            label: {
                en: 'Classes',
                fr: 'Classes',
            },
            type: 'Array',
            bindable: true,
            defaultValue: [],
            /* wwEditor:start */
            bindingValidation: {
                validations: [
                    {
                        type: 'array',
                    },
                ],
                tooltip: 'Array of class objects with id, name, color properties',
            },
            /* wwEditor:end */
        },
        rooms: {
            label: {
                en: 'Rooms',
                fr: 'Salles',
            },
            type: 'Array',
            bindable: true,
            defaultValue: [],
            /* wwEditor:start */
            bindingValidation: {
                validations: [
                    {
                        type: 'array',
                    },
                ],
                tooltip: 'Array of room objects with id, name properties',
            },
            /* wwEditor:end */
        },
        schoolDays: {
            label: {
                en: 'School Days',
                fr: 'Jours scolaires',
            },
            type: 'Array',
            bindable: true,
            defaultValue: [
                { id: 1, name: 'Monday' },
                { id: 2, name: 'Tuesday' },
                { id: 3, name: 'Wednesday' },
                { id: 4, name: 'Thursday' },
                { id: 5, name: 'Friday' },
            ],
            /* wwEditor:start */
            bindingValidation: {
                validations: [
                    {
                        type: 'array',
                    },
                ],
                tooltip: 'Array of school day objects with id, name properties (1=Sunday to 7=Saturday)',
            },
            /* wwEditor:end */
        },
        draftSchedules: {
            label: {
                en: 'Draft Schedules',
                fr: 'Brouillons horaires',
            },
            type: 'Array',
            bindable: true,
            defaultValue: [],
            /* wwEditor:start */
            bindingValidation: {
                validations: [
                    {
                        type: 'array',
                    },
                ],
                tooltip: 'Array of draft schedule entries with day_id, period_id/time, course_id, teacher_ids, etc.',
            },
            /* wwEditor:end */
        },
        liveSchedules: {
            label: {
                en: 'Live Schedules',
                fr: 'Horaires publiés',
            },
            type: 'Array',
            bindable: true,
            defaultValue: [],
            /* wwEditor:start */
            bindingValidation: {
                validations: [
                    {
                        type: 'array',
                    },
                ],
                tooltip: 'Array of published schedule entries for reference/conflict checking',
            },
            /* wwEditor:end */
        },
    },
};
