<template>
    <div class="course-scheduler-wrapper">
        <SchedulerPage
            :school-id="content.schoolId || 'default-school'"
            :draft-id="content.draftId || null"
            :published-by="content.publishedBy || null"
            :periods="content.periods || []"
            :courses="content.courses || []"
            :teachers="content.teachers || []"
            :classes="content.classes || []"
            :rooms="content.rooms || []"
            :school-days="content.schoolDays || []"
            :draft-schedules="content.draftSchedules || []"
            :live-schedules="content.liveSchedules || []"
            @update-draft-schedules="handleDraftUpdate"
            @publish-schedule="handlePublish"
            @save-draft="handleSaveDraft"
        />
    </div>
</template>

<script>
import { createPinia } from 'pinia';
import SchedulerPage from './views/scheduler/SchedulerPage.vue';

export default {
    name: 'CourseScheduler',
    components: {
        SchedulerPage,
    },
    props: {
        content: {
            type: Object,
            required: true,
            default: () => ({
                schoolId: null,
                draftId: null,
                publishedBy: null,
                periods: [],
                courses: [],
                teachers: [],
                classes: [],
                rooms: [],
                schoolDays: [],
                draftSchedules: [],
                liveSchedules: [],
            }),
        },
        wwElementState: { type: Object, required: true },
        /* wwEditor:start */
        wwEditorState: { type: Object, required: true },
        /* wwEditor:end */
    },
    setup(props, { emit }) {
        // Create a Pinia instance for the component
        const pinia = createPinia();

        // Event handlers for WeWeb integration
        const handleDraftUpdate = draftSchedules => {
            // Emit event to WeWeb to update the draft schedules
            emit('trigger-event', {
                name: 'updateDraftSchedules',
                event: {
                    draftSchedules,
                },
            });
        };

        const handlePublish = publishData => {
            // Emit event to WeWeb when schedule is published
            emit('trigger-event', {
                name: 'publishSchedule',
                event: {
                    ...publishData,
                },
            });
        };

        const handleSaveDraft = draftData => {
            // Emit event to WeWeb to save draft
            emit('trigger-event', {
                name: 'saveDraft',
                event: {
                    ...draftData,
                },
            });
        };

        return {
            pinia,
            handleDraftUpdate,
            handlePublish,
            handleSaveDraft,
        };
    },
    mounted() {
        // Set up the Pinia store with the global app
        if (this.$app && this.$app.config && this.$app.config.globalProperties) {
            if (!this.$app.config.globalProperties.$pinia) {
                this.$app.use(this.pinia);
            }
        }
    },
};
</script>

<style lang="scss" scoped>
.course-scheduler-wrapper {
    width: 100%;
    height: 100vh;
    min-height: 600px;
}
</style>
