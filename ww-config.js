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
        isLiveMode: {
            label: {
                en: 'Live Mode',
                fr: 'Mode Live',
            },
            type: 'OnOff',
            bindable: true,
            defaultValue: false,
            /* wwEditor:start */
            bindingValidation: {
                validations: [
                    {
                        type: 'boolean',
                    },
                ],
                tooltip: 'Toggle between Planning Mode (false) and Live Mode (true)',
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
        subjects: {
            label: {
                en: 'Subjects',
                fr: 'Matières',
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
                tooltip: 'Array of subject objects with id, name properties',
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
    events: {
        'scheduler:drop': {
            label: {
                en: 'On course dropped',
                fr: 'Lors du dépôt de cours',
            },
            tooltip: {
                en: 'Triggered when a course is dropped onto the schedule grid',
                fr: 'Déclenché quand un cours est déposé sur la grille horaire',
            },
        },
        'scheduler:drag-start': {
            label: {
                en: 'On drag start',
                fr: 'Début du glissement',
            },
            tooltip: {
                en: 'Triggered when dragging a course begins',
                fr: "Déclenché quand le glissement d'un cours commence",
            },
        },
        'scheduler:drag-end': {
            label: {
                en: 'On drag end',
                fr: 'Fin du glissement',
            },
            tooltip: {
                en: 'Triggered when dragging ends (success or failure)',
                fr: 'Déclenché quand le glissement se termine (succès ou échec)',
            },
        },
        'scheduler:remove': {
            label: {
                en: 'On assignment removed',
                fr: 'Assignation supprimée',
            },
            tooltip: {
                en: 'Triggered when a course assignment is deleted',
                fr: 'Déclenché quand une assignation de cours est supprimée',
            },
        },
    },
    triggerEvents: [
        {
            name: 'scheduler:drop',
            label: { en: 'On Scheduler Drop' },
            event: {
                dayId: 0,
                periodId: '',
                courseId: '',
                courseName: '',
                courseCode: '',
                teacherIds: [],
                primaryTeacherId: null,
                roomId: null,
                source: 'modal-assignment',
                timestamp: '',
                // Additional fields for assignment moves
                fromDayId: null,
                fromPeriodId: null,
                action: null,
            },
        },
        {
            name: 'scheduler:drag-start',
            label: { en: 'On Drag Start' },
            event: {
                courseId: '',
                courseName: '',
                courseCode: '',
                source: 'drag-start',
                timestamp: '',
            },
        },
        {
            name: 'scheduler:drag-end',
            label: { en: 'On Drag End' },
            event: {
                courseId: '',
                courseName: '',
                courseCode: '',
                source: 'drag-end',
                success: false,
                timestamp: '',
            },
        },
        {
            name: 'scheduler:cell-click',
            label: { en: 'On Cell Click' },
            event: {
                dayId: 0,
                periodId: '',
                periodName: '',
                mode: 'add',
                preSelectedCourse: null,
                timestamp: '',
            },
        },
        {
            name: 'scheduler:assignment-details',
            label: { en: 'On Assignment Details' },
            event: {
                assignment: {},
                courseId: '',
                courseName: '',
                courseCode: '',
                teacherIds: [],
                roomId: null,
                dayId: 0,
                periodId: '',
                timestamp: '',
            },
        },
        {
            name: 'scheduler:course-edit',
            label: { en: 'On Course Edit' },
            event: {
                courseId: '',
                courseName: '',
                courseCode: '',
                source: 'inline-editor',
                timestamp: '',
            },
        },
        {
            name: 'scheduler:remove',
            label: { en: 'On Assignment Remove' },
            event: {
                dayId: 0,
                periodId: '',
                assignmentId: '',
                courseId: '',
                courseName: '',
                source: 'remove',
                timestamp: '',
            },
        },
    ],
};
