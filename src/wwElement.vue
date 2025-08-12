<template>
    <!-- Show Course Scheduler when properties are configured -->
    <div v-if="showScheduler" class="course-scheduler-element">
        <SchedulerPage 
            :school-id="schoolId"
            :draft-id="draftId" 
            :published-by="publishedBy"
        />
    </div>
    
    <!-- Fallback to WeWeb layout structure -->
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
            <wwBackgroundVideo v-if="backgroundVideo" :video="backgroundVideo"></wwBackgroundVideo>
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
            ></wwElement>
        </template>
    </wwLayout>
</template>

<script>
import SchedulerPage from './views/scheduler/SchedulerPage.vue';

export default {
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
    setup() {
        // WeWeb required setup
        const { hasLink, tag, properties } = wwLib.wwElement.useLink();
        const backgroundVideo = wwLib.wwElement.useBackgroundVideo();

        return {
            hasLink,
            properties,
            backgroundVideo,
            tag,
        };
    },
    computed: {
        // Course Scheduler properties
        schoolId() {
            return this.content.schoolId || 'demo-school-' + Math.random().toString(36).substr(2, 9);
        },
        draftId() {
            return this.content.draftId || 'demo-draft-' + Math.random().toString(36).substr(2, 9);
        },
        publishedBy() {
            return this.content.publishedBy || null;
        },
        showScheduler() {
            // Show scheduler when any of the scheduler properties are configured
            return this.content.schoolId || this.content.draftId || this.content.publishedBy;
        },
        
        // WeWeb required computed properties
        children() {
            if (!this.content.children || !Array.isArray(this.content.children)) {
                return [];
            }
            return this.content.children;
        },
        isFixed() {
            return this.wwElementState.props.isFixed;
        },
        noDropzone() {
            return this.wwElementState.props.noDropzone;
        },
        isEditing() {
            /* wwEditor:start */
            if (typeof wwLib !== 'undefined' && this.wwEditorState) {
                return this.wwEditorState.editMode === wwLib.wwEditorHelper.EDIT_MODES.EDITION;
            }
            /* wwEditor:end */
            return false;
        },
    },
    methods: {
        onElementClick(event) {
            // WeWeb required method
            let rawIndex = event.currentTarget.dataset.wwFlexboxIndex;
            let index = parseInt(rawIndex);
            if (isNaN(index)) {
                index = 0;
            }
            this.$emit('element-event', { type: 'click', index });
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
