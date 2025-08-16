<template>
  <!-- Show Course Scheduler grid when any scheduler property is configured -->
  <div v-if="showScheduler" class="course-scheduler-element">
    <SchedulerGrid
      :school-id="schoolId"
      :draft-id="draftId"
      :is-live-mode="isLiveMode"
      :read-only="readOnly"
      :periods="periods"
      :school-days="schoolDays"
      :draft-schedules="draftSchedules"
      :live-schedules="liveSchedules"
    />
  </div>

  <!-- WeWeb layout fallbacks to preserve editor behavior -->
  <wwSimpleLayout
    v-else-if="noDropzone"
    :tag="tag"
    class="ww-flexbox"
    ww-responsive="wwLayoutSlot"
    v-bind="properties"
    :class="{ '-link': hasLink && !isEditing }"
  >
    <slot></slot>
  </wwSimpleLayout>

  <wwLayout
    v-else
    class="ww-flexbox"
    path="children"
    :direction="content.direction"
    :disable-edit="isFixed"
    ww-responsive="wwLayout"
    :tag="tag"
    v-bind="properties"
    :class="{ '-link': hasLink && !isEditing }"
  >
    <template #header>
      <wwBackgroundVideo v-if="backgroundVideo" :video="backgroundVideo" />
      <slot v-if="!noDropzone"></slot>
    </template>
    <template #default="{ item, index, itemStyle }">
      <wwElement
        v-bind="item"
        :extra-style="itemStyle"
        class="ww-flexbox__object"
        :ww-responsive="`wwobject-${index}`"
        :data-ww-flexbox-index="index"
        @click="onElementClick"
      />
    </template>
  </wwLayout>
</template>

<script>
import SchedulerGrid from './components/SchedulerGrid.vue';

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

const arrayOrEmpty = (v) => (Array.isArray(v) ? v : []);

export default {
  name: 'CourseSchedulerElement',
  components: { SchedulerGrid },
  props: {
    content: { type: Object, required: true },
    wwElementState: { type: Object, required: true },
    /* wwEditor:start */
    wwEditorState: { type: Object, required: true },
    /* wwEditor:end */
  },
  emits: ['update:content:effect', 'update:content', 'element-event'],
  setup() {
    // WeWeb helpers
    const { hasLink, tag, properties } = wwLib.wwElement.useLink();
    const backgroundVideo = wwLib.wwElement.useBackgroundVideo();

    return { hasLink, tag, properties, backgroundVideo };
  },
  computed: {
    // Scheduler inputs (read from content; provide robust defaults)
    schoolId() {
      return this.content.schoolId ?? null;
    },
    draftId() {
      return this.content.draftId ?? null;
    },
    isLiveMode() {
      return coerceBoolean(this.content.isLiveMode, false);
    },
    readOnly() {
      return coerceBoolean(this.content.readOnly, false);
    },

    periods() {
      return arrayOrEmpty(this.content.periods);
    },
    schoolDays() {
      return arrayOrEmpty(this.content.schoolDays);
    },
    courses() {
      return arrayOrEmpty(this.content.courses);
    },
    teachers() {
      return arrayOrEmpty(this.content.teachers);
    },
    classes() {
      return arrayOrEmpty(this.content.classes);
    },
    rooms() {
      return arrayOrEmpty(this.content.rooms);
    },
    subjects() {
      return arrayOrEmpty(this.content.subjects);
    },
    draftSchedules() {
      return arrayOrEmpty(this.content.draftSchedules);
    },
    liveSchedules() {
      return arrayOrEmpty(this.content.liveSchedules);
    },

    // Show the scheduler if any main scheduler field is set
    showScheduler() {
      return Boolean(this.content.schoolId || this.content.draftId || this.content.isLiveMode || (this.content.periods && this.content.periods.length) || (this.content.schoolDays && this.content.schoolDays.length));
    },

    // WeWeb required computed
    children() {
      const c = this.content.children;
      return Array.isArray(c) ? c : [];
    },
    isFixed() {
      return this.wwElementState?.props?.isFixed;
    },
    noDropzone() {
      return this.wwElementState?.props?.noDropzone;
    },
    isEditing() {
      /* wwEditor:start */
      if (typeof wwLib !== 'undefined' && this.wwEditorState) {
        return this.wwEditorState.editMode;
      }
      /* wwEditor:end */
      return false;
    },
  },
  methods: {
    onElementClick() {
      // noop placeholder for WeWeb click passthrough
    },
  },
  mounted() {
    // Lightweight mount marker to confirm correct build is loaded
    console.info('CourseSchedulerElement mounted (build: compact-2025-08-16)');
  },
};
</script>
