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
        customStylePropertiesOrder: ['schoolId', 'draftId', 'publishedBy'],
    },
    properties: {
        schoolId: {
            label: {
                en: 'School ID',
                fr: 'ID de l\'école',
            },
            type: 'Text',
            options: {
                placeholder: 'Enter school UUID',
            },
            defaultValue: '',
        },
        draftId: {
            label: {
                en: 'Draft ID',
                fr: 'ID du brouillon',
            },
            type: 'Text',
            options: {
                placeholder: 'Enter draft UUID',
            },
            defaultValue: '',
        },
        publishedBy: {
            label: {
                en: 'Published By',
                fr: 'Publié par',
            },
            type: 'Text',
            options: {
                placeholder: 'Enter publisher UUID (optional)',
            },
            defaultValue: null,
        },
    },
};