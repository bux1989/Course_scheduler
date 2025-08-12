<template>
    <div class="course-scheduler-wrapper">
        <SchedulerPage
            :school-id="content.schoolId || 'default-school'"
            :draft-id="content.draftId || null"
            :published-by="content.publishedBy || null"
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
            }),
        },
        wwElementState: { type: Object, required: true },
        /* wwEditor:start */
        wwEditorState: { type: Object, required: true },
        /* wwEditor:end */
    },
    setup() {
        // Create a Pinia instance for the component
        const pinia = createPinia();
        return { pinia };
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
