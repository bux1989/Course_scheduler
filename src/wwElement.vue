<template>
  <div class="scheduler-root">
    <div class="header">
      <div class="title">Course Scheduler</div>
      <div class="meta">
        <span>School: {{ String(effectiveSchoolId ?? '') }}</span>
        <span v-if="!effectiveIsLiveMode">Draft: {{ String(effectiveDraftId ?? '') }}</span>
        <span class="mode" :class="{ live: effectiveIsLiveMode }">
          Mode: {{ effectiveIsLiveMode ? 'Live' : 'Planning' }}
        </span>
        <span v-if="effectiveReadOnly" class="readonly">Read-only</span>
      </div>
    </div>

    <div v-if="!hasGridBasis" class="empty">
      <p>Missing periods and/or school days data. The grid requires both.</p>
    </div>

    <div v-else class="grid-container">
      <table class="grid">
        <thead>
          <tr>
            <th class="corner"></th>
            <th v-for="day in daysList" :key="dayKey(day)" class="day-col">
              {{ labelDay(day) }}
            </th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="period in periodsList" :key="periodKey(period)">
            <th class="period-row">
              {{ labelPeriod(period) }}
            </th>
            <td v-for="day in daysList"
                :key="dayKey(day) + '::' + periodKey(period)"
                class="cell">
              <div class="cell-content">
                <!-- Basic placeholder to confirm rendering; actual assignments can be injected -->
                <div class="assignments" v-if="cellAssignments(day, period).length">
                  <div class="assignment" v-for="a in cellAssignments(day, period)" :key="assignmentKey(a)">
                    {{ labelAssignment(a) }}
                  </div>
                </div>
                <div class="empty-cell" v-else>—</div>
              </div>
            </td>
          </tr>
        </tbody>
      </table>
      <div class="footer">
        <span>Days: {{ safeLength(daysList) }}</span>
        <span>Periods: {{ safeLength(periodsList) }}</span>
        <span>Entries: {{ safeLength(activeSchedules) }}</span>
      </div>
    </div>
  </div>
</template>

<script setup>
// Defensive helpers
const safeLength = (v) => {
  if (Array.isArray(v)) return v.length;
  if (v == null) return 0;
  if (typeof v === 'string') return v.length;
  const len = v?.length;
  return typeof len === 'number' ? len : 0;
};

const coerceBoolean = (v, fallback = false) => {
  if (typeof v === 'boolean') return v;
  if (typeof v === 'string') {
    const s = v.trim().toLowerCase();
    if (s === 'true') return true;
    if (s === 'false') return false;
    // treat non-empty strings as true
    return s.length > 0 ? true : fallback;
  }
  if (typeof v === 'number') return v !== 0;
  return fallback;
};

// Accept both top-level props and legacy content.* for backward compatibility
const props = defineProps({
  content: { type: Object, default: null },

  // Preferred top-level props
  schoolId: { type: [String, Number], default: undefined },
  draftId: { type: String, default: undefined },
  isLiveMode: { type: [Boolean, String, Number], default: false },

  periods: { type: Array, default: () => [] },
  schoolDays: { type: Array, default: () => [] },

  courses: { type: Array, default: () => [] },
  teachers: { type: Array, default: () => [] },
  classes: { type: Array, default: () => [] },
  rooms: { type: Array, default: () => [] },
  subjects: { type: Array, default: () => [] },

  draftSchedules: { type: Array, default: () => [] },
  liveSchedules: { type: Array, default: () => [] },

  readOnly: { type: [Boolean, String, Number], default: false },

  // Optional Supabase (only if used). Leave empty to disable.
  supabaseUrl: { type: String, default: '' },
  supabaseKey: { type: String, default: '' },
});

// Prefer top-level; fall back to content.*
const pick = (key, fallbackValue) => {
  if (props[key] !== undefined && props[key] !== null) return props[key];
  return props.content?.[key] ?? fallbackValue;
};

// Effective identifiers
const effectiveSchoolId = computed(() => {
  const v = pick('schoolId', undefined);
  return v ?? null;
});

const effectiveDraftId = computed(() => {
  const v = pick('draftId', undefined);
  return v ?? null;
});

// Effective mode as strict boolean
const effectiveIsLiveMode = computed(() => {
  const top = props.isLiveMode;
  const legacy = props.content?.isLiveMode;
  return coerceBoolean(top !== undefined ? top : legacy, false);
});

const effectiveReadOnly = computed(() => coerceBoolean(pick('readOnly', false), false));

// Data lists (always arrays)
const periodsList = computed(() => {
  const v = pick('periods', []);
  return Array.isArray(v) ? v : [];
});

const daysList = computed(() => {
  const v = pick('schoolDays', []);
  return Array.isArray(v) ? v : [];
});

const coursesList = computed(() => {
  const v = pick('courses', []);
  return Array.isArray(v) ? v : [];
});

const teachersList = computed(() => {
  const v = pick('teachers', []);
  return Array.isArray(v) ? v : [];
});

const classesList = computed(() => {
  const v = pick('classes', []);
  return Array.isArray(v) ? v : [];
});

const roomsList = computed(() => {
  const v = pick('rooms', []);
  return Array.isArray(v) ? v : [];
});

const subjectsList = computed(() => {
  const v = pick('subjects', []);
  return Array.isArray(v) ? v : [];
});

// Schedule sets
const draftSchedulesList = computed(() => {
  const v = pick('draftSchedules', []);
  return Array.isArray(v) ? v : [];
});

const liveSchedulesList = computed(() => {
  const v = pick('liveSchedules', []);
  return Array.isArray(v) ? v : [];
});

const activeSchedules = computed(() =>
  effectiveIsLiveMode.value ? liveSchedulesList.value : draftSchedulesList.value
);

// Keys/labels to avoid runtime errors regardless of object shapes
const periodKey = (p) => String(p?.id ?? p?.key ?? p?.name ?? JSON.stringify(p));
const dayKey = (d) => String(d?.id ?? d?.key ?? d?.name ?? JSON.stringify(d));
const assignmentKey = (a) => String(a?.id ?? a?.key ?? JSON.stringify(a));
const labelPeriod = (p) => String(p?.name ?? p?.label ?? p?.period ?? p ?? '');
const labelDay = (d) => String(d?.name ?? d?.label ?? d?.day ?? d ?? '');
const labelAssignment = (a) => {
  const course = a?.courseName ?? a?.course ?? a?.name ?? 'Course';
  const teacher = a?.teacherName ?? a?.teacher ?? null;
  return teacher ? `${course} — ${teacher}` : course;
};

// Minimal cell matching: try common fields dayId/day/weekday and periodId/period/slot
const cellAssignments = (day, period) => {
  const dId = day?.id ?? day?.day ?? day?.weekday ?? dayKey(day);
  const pId = period?.id ?? period?.period ?? period?.slot ?? periodKey(period);
  const list = activeSchedules.value;
  if (!Array.isArray(list) || !list.length) return [];
  return list.filter((a) => {
    const aDay = a?.dayId ?? a?.day ?? a?.weekday ?? a?.dayKey;
    const aPer = a?.periodId ?? a?.period ?? a?.slot ?? a?.periodKey;
    return String(aDay) === String(dId) && String(aPer) === String(pId);
  });
};

// Basic grid visibility
const hasGridBasis = computed(() => safeLength(periodsList.value) > 0 && safeLength(daysList.value) > 0);

// Logging helpers to mirror your console messages
const logDataPresence = () => {
  const log = (icon, label, data) => {
    if (!safeLength(data)) {
      console.info(`%c${icon} [wwElement] ${label} processing: no data available`, 'color:#888');
    } else {
      console.info(`%c${icon} [wwElement] ${label} loaded: ${safeLength(data)} item(s)`, 'color:#0a0');
    }
  };
  log('📝', 'Draft Schedules', draftSchedulesList.value);
  log('📺', 'Live Schedules', liveSchedulesList.value);
  log('📋', 'Periods', periodsList.value);
  log('📅', 'SchoolDays', daysList.value);
  log('🎯', 'Courses', coursesList.value);
  log('👥', 'Teachers', teachersList.value);
  log('🏫', 'Classes', classesList.value);
  log('🏠', 'Rooms', roomsList.value);
  log('📚', 'Subjects', subjectsList.value);
  console.info('🔄 [wwElement] isLiveMode evaluation:', {
    rawValue: pick('isLiveMode', false),
    type: typeof pick('isLiveMode', false),
    strictBoolean: effectiveIsLiveMode.value,
  });
};

// Supabase singleton (optional; only if URL/Key provided)
// Prevent "Multiple GoTrueClient instances detected" by reusing a single client with a unique storageKey.
let supabaseClient = null;
const getSupabaseClient = async () => {
  const url = props.supabaseUrl;
  const key = props.supabaseKey;
  if (!url || !key) return null;

  if (window.__schedulerSupabase) return window.__schedulerSupabase;

  try {
    // Dynamic import to avoid bundling errors if not installed/needed
    const mod = await import(/* @vite-ignore */ '@supabase/supabase-js');
    const { createClient } = mod;
    supabaseClient = createClient(url, key, {
      auth: {
        storageKey: 'ww-scheduler-auth',
      },
    });
    window.__schedulerSupabase = supabaseClient;
    return supabaseClient;
  } catch (err) {
    console.warn('Supabase not available or failed to initialize:', err);
    return null;
  }
};

onMounted(async () => {
  logDataPresence();
  console.info('🚀 [wwElement] Component mounted - Course Scheduler loaded successfully');

  // Initialize supabase only once if credentials are provided
  await getSupabaseClient();
});

watch(
  () => ({
    live: effectiveIsLiveMode.value,
    schoolId: effectiveSchoolId.value,
    draftId: effectiveDraftId.value,
    p: periodsList.value,
    d: daysList.value,
    ds: draftSchedulesList.value,
    ls: liveSchedulesList.value,
  }),
  () => logDataPresence(),
  { deep: false }
);
</script>

<style scoped>
.scheduler-root {
  display: flex;
  flex-direction: column;
  gap: 12px;
  font-family: system-ui, -apple-system, Segoe UI, Roboto, "Helvetica Neue", Arial, "Noto Sans", "Apple Color Emoji", "Segoe UI Emoji";
}

.header {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 12px;
  flex-wrap: wrap;
}

.title {
  font-size: 18px;
  font-weight: 600;
}

.meta {
  display: flex;
  gap: 12px;
  color: #555;
  font-size: 12px;
}

.meta .mode.live {
  color: #008a00;
  font-weight: 600;
}

.meta .readonly {
  color: #9a4d00;
  font-weight: 600;
}

.empty {
  padding: 12px;
  border-radius: 8px;
  background: #fff3cd;
  color: #7a5a00;
  border: 1px solid #ffe69c;
}

.grid-container {
  overflow: auto;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
}

.grid {
  border-collapse: separate;
  border-spacing: 0;
  width: 100%;
  min-width: 560px;
}

.grid th,
.grid td {
  border-bottom: 1px solid #e5e7eb;
  border-right: 1px solid #e5e7eb;
}

.grid th.corner {
  background: #f9fafb;
  min-width: 120px;
  position: sticky;
  left: 0;
  z-index: 2;
  border-left: 1px solid #e5e7eb;
  border-top-left-radius: 8px;
}

.grid th.day-col {
  background: #f9fafb;
  text-align: center;
  padding: 8px;
}

.grid th.period-row {
  background: #f9fafb;
  position: sticky;
  left: 0;
  z-index: 1;
  padding: 6px 8px;
  min-width: 120px;
}

.grid td.cell {
  padding: 6px 8px;
  min-width: 140px;
  background: #fff;
}

.cell-content {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.assignment {
  background: #eef2ff;
  color: #1e3a8a;
  border: 1px solid #c7d2fe;
  border-radius: 6px;
  padding: 4px 6px;
  font-size: 12px;
}

.empty-cell {
  color: #999;
  font-size: 12px;
  text-align: center;
}

.footer {
  display: flex;
  gap: 16px;
  padding: 8px 10px;
  font-size: 12px;
  color: #666;
  border-top: 1px solid #e5e7eb;
  background: #fafafa;
}
</style>
