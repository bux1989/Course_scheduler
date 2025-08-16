// WeWeb component configuration for Course Scheduler
// Ensures boolean props are booleans and arrays default to [] so the component can render safely.

export default {
  editor: {
    label: 'Course Scheduler',
    icon: 'calendar',
    bubble: {
      icon: 'calendar',
      title: 'Course Scheduler',
    },
  },
  options: {
    // If your builder expects sizing or alignment options, add here.
  },
  properties: {
    // Mode and flags
    isLiveMode: {
      label: 'Live mode',
      type: 'boolean',
      bindable: true,
      defaultValue: false,
      section: 'Behavior',
    },
    readOnly: {
      label: 'Read-only',
      type: 'boolean',
      bindable: true,
      defaultValue: false,
      section: 'Behavior',
    },

    // Identifiers
    schoolId: {
      label: 'School ID',
      type: 'text',
      bindable: true,
      placeholder: 'e.g. 42',
      section: 'Data',
    },
    draftId: {
      label: 'Draft ID',
      type: 'text',
      bindable: true,
      placeholder: 'e.g. DRAFT-2025-01',
      section: 'Data',
    },

    // Data collections (all default to empty arrays)
    periods: {
      label: 'Periods',
      type: 'array',
      bindable: true,
      defaultValue: [],
      section: 'Data',
    },
    schoolDays: {
      label: 'School Days',
      type: 'array',
      bindable: true,
      defaultValue: [],
      section: 'Data',
    },
    courses: {
      label: 'Courses',
      type: 'array',
      bindable: true,
      defaultValue: [],
      section: 'Data',
    },
    teachers: {
      label: 'Teachers',
      type: 'array',
      bindable: true,
      defaultValue: [],
      section: 'Data',
    },
    classes: {
      label: 'Classes',
      type: 'array',
      bindable: true,
      defaultValue: [],
      section: 'Data',
    },
    rooms: {
      label: 'Rooms',
      type: 'array',
      bindable: true,
      defaultValue: [],
      section: 'Data',
    },
    subjects: {
      label: 'Subjects',
      type: 'array',
      bindable: true,
      defaultValue: [],
      section: 'Data',
    },
    draftSchedules: {
      label: 'Draft Schedules',
      type: 'array',
      bindable: true,
      defaultValue: [],
      section: 'Data',
    },
    liveSchedules: {
      label: 'Live Schedules',
      type: 'array',
      bindable: true,
      defaultValue: [],
      section: 'Data',
    },

    // Optional Supabase (only if you use it)
    supabaseUrl: {
      label: 'Supabase URL',
      type: 'text',
      bindable: true,
      placeholder: 'https://xyzcompany.supabase.co',
      section: 'Integrations',
    },
    supabaseKey: {
      label: 'Supabase Key',
      type: 'text',
      bindable: true,
      options: { secret: true },
      placeholder: 'public-anon-key',
      section: 'Integrations',
    },
  },
};
