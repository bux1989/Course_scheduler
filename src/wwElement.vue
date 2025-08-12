<template>
    <div class="course-scheduler-element">
        <SchedulerPage 
            :school-id="schoolId"
            :draft-id="draftId" 
            :published-by="publishedBy"
        />
    </div>
</template>

<script>
import SchedulerPage from './views/scheduler/SchedulerPage.vue';

export default {
    name: 'CourseScheduler',
    components: {
        SchedulerPage
    },
    props: {
        content: { type: Object, required: true },
        wwElementState: { type: Object, required: true },
        /* wwEditor:start */
        wwEditorState: { type: Object, required: true },
        /* wwEditor:end */
    },
    emits: ['update:content:effect', 'update:content', 'element-event'],
    computed: {
        schoolId() {
            return this.content.schoolId || 'demo-school-' + Math.random().toString(36).substr(2, 9);
        },
        draftId() {
            return this.content.draftId || 'demo-draft-' + Math.random().toString(36).substr(2, 9);
        },
        publishedBy() {
            return this.content.publishedBy || null;
        },
        isEditing() {
            /* wwEditor:start */
            if (typeof wwLib !== 'undefined' && this.wwEditorState) {
                return this.wwEditorState.editMode === wwLib.wwEditorHelper.EDIT_MODES.EDITION;
            }
            /* wwEditor:end */
            return false;
        },
    }
};
</script>

<style lang="scss" scoped>
.course-scheduler-element {
    width: 100%;
    min-height: 600px;
    background: #fff;
    border-radius: 4px;
    overflow: hidden;
    border: 1px solid #ddd;
}
</style>

<style lang="scss" scoped>
.-link {
    cursor: pointer;
}
</style>
