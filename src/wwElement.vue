<template>
  <div class="scheduler-root">
    <div class="header">
      <div class="title">Course Scheduler</div>
      <div class="meta">
        <span>School: {{ String(effectiveSchoolId ?? '') }}</span>
        <span v-if="!effectiveIsLiveMode && effectiveDraftId">Draft: {{ String(effectiveDraftId) }}</span>
        <span class="mode" :class="{ live: effectiveIsLiveMode }">
          Mode: {{ effectiveIsLiveMode ? 'Live' : 'Planning' }}
        </span>
        <span v-if="effectiveReadOnly" class="readonly">Read-only</span>
      </div>
    </div>

    <div v-if="!hasGridBasis" class="empty">
      <p>No periods or school days provided. Showing fallback grid to help you verify rendering.</p>
    </div>

    <div class="grid-container">
      <table class="grid">
        <thead>
          <tr>
            <th class="corner"></th>
            <th v-for="day in daysToRender" :key="dayKey(day)" class="day-col">
              {{ labelDay(day) }}
            </th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="period in periodsToRender" :key="periodKey(period)">
            <th class="period-row">
              {{ labelPeriod(period) }}
            </th>
            <td
              v-for="day in daysToRender"
              :key="dayKey(day) + '::' + periodKey(period)"
              class="cell"
            >
              <div class="cell-content">
                <div class="assignments" v-if="cellAssignments(day, period).length">
                  <div
                    class="assignment"
                    v-for="a in cellAssignments(day, period)"
                    :key="assignmentKey(a)"
                  >
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
        <span>Days: {{ daysToRender.length }}</span>
        <span>Periods: {{ periodsToRender.length }}</span>
        <span>Entries: {{ activeSchedules.length }}</span>
        <span v-if="usingFallback" class="fallback-indicator">(Fallback grid active)</span>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed, defineProps, onMounted } from 'vue';

const coerceBoolean = (v, fallback = false) => {
  if (typeof v === 'boolean') return v;
  if (typeof v === 'string') {
    const s = v.trim().toLowerCase();
    if (s === 'true') return true;
    if (s === 'false') return false;
    return s.length > 0 ? true : fallback;
  }
  if (typeof v === 'number') return v !== 0;
  return fallback;
};

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
});

// Backward compatible access (prefer top-level; fallback to content.*)
const pick = (key, fallbackValue) => {
  if (props[key] !== undefined && props[key] !== null) return props[key];
  return props.content?.[key] ?? fallbackValue;
};

const effectiveSchoolId = computed(() => pick('schoolId', null));
const effectiveDraftId = computed(() => pick('draftId', null));
const effectiveIsLiveMode = computed(() => {
  const top = props.isLiveMode;
  const legacy = props.content?.isLiveMode;
  return coerceBoolean(top !== undefined ? top : legacy, false);
});
const effectiveReadOnly = computed(() => coerceBoolean(pick('readOnly', false), false));

// Data arrays (always arrays)
const periodsList = computed(() => {
  const v = pick('periods', []);
  return Array.isArray(v) ? v : [];
});
const daysList = computed(() => {
  const v = pick('schoolDays', []);
  return Array.isArray(v) ? v : [];
});
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

// Fallback grid data if nothing is provided (ensures grid renders)
const fallbackDays = Object.freeze([
  { id: 'mon', name: 'Mon' },
  { id: 'tue', name: 'Tue' },
  { id: 'wed', name: 'Wed' },
  { id: 'thu', name: 'Thu' },
  { id: 'fri', name: 'Fri' },
]);
const fallbackPeriods = Object.freeze(
  Array.from({ length: 6 }, (_, i) => ({ id: `p${i + 1}`, name: `Period ${i + 1}` }))
);

const hasGridBasis = computed(
  () => daysList.value.length > 0 && periodsList.value.length > 0
);

// Render lists with fallback if needed
const daysToRender = computed(() =>
  daysList.value.length ? daysList.value : fallbackDays
);
const periodsToRender = computed(() =>
  periodsList.value.length ? periodsList.value : fallbackPeriods
);
const usingFallback = computed(
  () => !(daysList.value.length && periodsList.value.length)
);

// Helpers
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

// Minimal matching: match day and period IDs/keys if present
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

onMounted(() => {
  console.info('🚀 [wwElement] Component mounted - Course Scheduler loaded successfully');
  if (!daysList.value.length || !periodsList.value.length) {
    console.info('ℹ️ [wwElement] Using fallback grid (no schoolDays/periods provided).');
  }
});
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

.fallback-indicator {
  color: #8a6d3b;
}
</style>
