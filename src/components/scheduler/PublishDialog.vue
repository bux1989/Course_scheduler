<template>
    <div class="publish-dialog-overlay" @click="closeDialog">
        <div class="publish-dialog" @click.stop>
            <div class="publish-dialog-header">
                <h2>Publish Schedule</h2>
                <button class="close-button" @click="closeDialog" aria-label="Close dialog">×</button>
            </div>

            <div class="publish-dialog-content">
                <div v-if="isLoading" class="loading-state">
                    <div class="spinner"></div>
                    <p>Publishing schedule...</p>
                </div>

                <div v-else-if="result" class="result-state">
                    <div :class="['result-icon', result.success ? 'success' : 'error']">
                        {{ result.success ? '✓' : '✗' }}
                    </div>
                    <h3>{{ result.success ? 'Schedule Published' : 'Publication Failed' }}</h3>
                    <p>{{ result.message }}</p>
                </div>

                <div v-else class="confirmation-state">
                    <p>Are you sure you want to publish this schedule? This will make it visible to all users.</p>

                    <div class="confirmation-details">
                        <div class="detail-item">
                            <span class="detail-label">Total entries:</span>
                            <span class="detail-value">{{ entryCount }}</span>
                        </div>
                        <div class="detail-item">
                            <span class="detail-label">Period entries:</span>
                            <span class="detail-value">{{ periodEntryCount }}</span>
                        </div>
                        <div class="detail-item">
                            <span class="detail-label">Time entries:</span>
                            <span class="detail-value">{{ timeEntryCount }}</span>
                        </div>
                    </div>
                </div>
            </div>

            <div class="publish-dialog-footer">
                <button v-if="!result" class="cancel-button" @click="closeDialog">Cancel</button>
                <button v-if="!result && !isLoading" class="publish-button" @click="publishSchedule">
                    Publish Schedule
                </button>
                <button v-if="result" class="close-button" @click="closeDialog">Close</button>
            </div>
        </div>
    </div>
</template>

<script>
import { ref, computed } from 'vue';
import { useSchedulerStore } from '../../pinia/scheduler';

export default {
    name: 'PublishDialog',
    emits: ['close'],
    setup(props, { emit }) {
        const store = useSchedulerStore();
        const isLoading = ref(false);
        const result = ref(null);

        const entryCount = computed(() => store.entries.length);
        const periodEntryCount = computed(() => store.periodEntries.length);
        const timeEntryCount = computed(() => store.adhocEntries.length);

        async function publishSchedule() {
            isLoading.value = true;

            try {
                const publishResult = await store.publish();
                result.value = publishResult;
            } catch (error) {
                result.value = {
                    success: false,
                    message: 'An unexpected error occurred during publication.',
                };
            } finally {
                isLoading.value = false;
            }
        }

        function closeDialog() {
            if (isLoading.value) return; // Prevent closing while publishing
            emit('close');
        }

        return {
            isLoading,
            result,
            entryCount,
            periodEntryCount,
            timeEntryCount,
            publishSchedule,
            closeDialog,
        };
    },
};
</script>

<style scoped>
.publish-dialog-overlay {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background-color: rgba(0, 0, 0, 0.5);
    display: flex;
    justify-content: center;
    align-items: center;
    z-index: 1000;
}

.publish-dialog {
    background-color: white;
    border-radius: 8px;
    width: 90%;
    max-width: 500px;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
    display: flex;
    flex-direction: column;
}

.publish-dialog-header {
    padding: 16px;
    border-bottom: 1px solid #eee;
    display: flex;
    justify-content: space-between;
    align-items: center;
}

.publish-dialog-header h2 {
    margin: 0;
    font-size: 1.2rem;
}

.close-button {
    background: none;
    border: none;
    font-size: 1.5rem;
    cursor: pointer;
    color: #999;
}

.close-button:hover {
    color: #333;
}

.publish-dialog-content {
    padding: 24px;
    min-height: 150px;
}

.loading-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    height: 100%;
}

.spinner {
    width: 40px;
    height: 40px;
    border: 4px solid #f3f3f3;
    border-top: 4px solid #4a6cf7;
    border-radius: 50%;
    animation: spin 1s linear infinite;
    margin-bottom: 16px;
}

@keyframes spin {
    0% {
        transform: rotate(0deg);
    }
    100% {
        transform: rotate(360deg);
    }
}

.result-state {
    text-align: center;
}

.result-icon {
    font-size: 3rem;
    margin-bottom: 16px;
    width: 80px;
    height: 80px;
    border-radius: 50%;
    display: flex;
    justify-content: center;
    align-items: center;
    margin: 0 auto 16px;
}

.result-icon.success {
    background-color: #52c41a;
    color: white;
}

.result-icon.error {
    background-color: #ff4d4f;
    color: white;
}

.confirmation-details {
    margin-top: 16px;
    padding: 12px;
    background-color: #f9f9f9;
    border-radius: 4px;
}

.detail-item {
    display: flex;
    justify-content: space-between;
    margin-bottom: 8px;
}

.detail-item:last-child {
    margin-bottom: 0;
}

.detail-label {
    font-weight: 500;
}

.publish-dialog-footer {
    padding: 16px;
    border-top: 1px solid #eee;
    display: flex;
    justify-content: flex-end;
    gap: 12px;
}

.cancel-button {
    padding: 8px 16px;
    background-color: white;
    border: 1px solid #ddd;
    border-radius: 4px;
    cursor: pointer;
}

.publish-button {
    padding: 8px 16px;
    background-color: #4a6cf7;
    color: white;
    border: none;
    border-radius: 4px;
    cursor: pointer;
}

.publish-button:hover {
    background-color: #3a5ce5;
}
</style>
