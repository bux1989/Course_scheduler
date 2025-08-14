// src/utils/events.js
// Lightweight event emitter utility for WeWeb element events with fallback to window CustomEvent

/**
 * Emit a WeWeb element event or fallback to CustomEvent
 * @param {Vue instance|emit function} vmOrEmit - Vue component instance or emit function
 * @param {string} name - Event name (e.g., 'scheduler:drop')
 * @param {Object} data - Event payload data
 * @param {Object} options - Additional options
 * @param {boolean} options.bubbles - Whether the event should bubble (default: true)
 * @param {boolean} options.cancelable - Whether the event can be cancelled (default: true)
 */
export function emitElementEvent(vmOrEmit, name, data, options = {}) {
    const eventOptions = {
        bubbles: true,
        cancelable: true,
        ...options,
    };

    try {
        // Handle different emit patterns for Vue 3 compatibility
        let emitFn = null;

        // Check if vmOrEmit is the emit function directly
        if (typeof vmOrEmit === 'function') {
            emitFn = vmOrEmit;
        }
        // Check for Vue 3 Composition API instance (getCurrentInstance())
        else if (vmOrEmit && vmOrEmit.emit && typeof vmOrEmit.emit === 'function') {
            emitFn = vmOrEmit.emit;
        }
        // Check for Vue 2 Options API instance (this.$emit)
        else if (vmOrEmit && vmOrEmit.$emit && typeof vmOrEmit.$emit === 'function') {
            emitFn = vmOrEmit.$emit.bind(vmOrEmit);
        }

        // Try WeWeb's element event system first
        if (emitFn) {
            console.log(`📡 [Events] Emitting WeWeb element event: ${name}`, data);
            emitFn('element-event', { name, event: name, data });
            return true;
        }

        // Fallback to native DOM custom events
        if (typeof window !== 'undefined' && window.CustomEvent) {
            console.log(`📡 [Events] Emitting CustomEvent fallback: ${name}`, data);
            const event = new CustomEvent(name, {
                detail: data,
                ...eventOptions,
            });

            // Try to dispatch on the component's root element or window
            const target = (vmOrEmit && vmOrEmit.$el) || window;
            target.dispatchEvent(event);
            return true;
        }

        console.warn(`📡 [Events] Could not emit event: ${name} - no event system available`);
        return false;
    } catch (error) {
        console.error(`📡 [Events] Failed to emit event: ${name}`, error);
        return false;
    }
}

/**
 * Emit scheduler:drop event when a course is successfully assigned
 * @param {Function|Vue instance} emitOrVm - Emit function or Vue component instance
 * @param {Object} payload - Drop event data
 * @param {string|null} payload.schoolId - School ID
 * @param {string|null} payload.draftId - Draft ID
 * @param {number} payload.dayId - Backend day ID
 * @param {string} payload.periodId - Period UUID
 * @param {string} payload.courseId - Course ID
 * @param {string} payload.courseName - Course name
 * @param {string} payload.source - Event source ('drag-drop')
 */
export function emitSchedulerDropEvent(emitOrVm, payload) {
    const eventData = {
        schoolId: payload.schoolId || null,
        draftId: payload.draftId || null,
        dayId: Number(payload.dayId), // Ensure it's a number (backend dayId)
        periodId: String(payload.periodId), // Ensure it's a string (period UUID)
        courseId: String(payload.courseId),
        courseName: String(payload.courseName || ''),
        source: payload.source || 'drag-drop',
        timestamp: new Date().toISOString(),
    };

    return emitElementEvent(emitOrVm, 'scheduler:drop', eventData);
}

/**
 * Emit scheduler:drag-start event when dragging begins
 * @param {Function|Vue instance} emitOrVm - Emit function or Vue component instance
 * @param {Object} payload - Drag start event data
 */
export function emitSchedulerDragStartEvent(emitOrVm, payload) {
    const eventData = {
        courseId: String(payload.courseId),
        courseName: String(payload.courseName || ''),
        source: 'drag-start',
        timestamp: new Date().toISOString(),
    };

    return emitElementEvent(emitOrVm, 'scheduler:drag-start', eventData);
}

/**
 * Emit scheduler:drag-end event when dragging ends
 * @param {Function|Vue instance} emitOrVm - Emit function or Vue component instance
 * @param {Object} payload - Drag end event data
 */
export function emitSchedulerDragEndEvent(emitOrVm, payload) {
    const eventData = {
        courseId: payload.courseId ? String(payload.courseId) : null,
        courseName: payload.courseName ? String(payload.courseName) : null,
        success: Boolean(payload.success),
        source: 'drag-end',
        timestamp: new Date().toISOString(),
    };

    return emitElementEvent(emitOrVm, 'scheduler:drag-end', eventData);
}

/**
 * Emit scheduler:remove event when an assignment is deleted
 * @param {Function|Vue instance} emitOrVm - Emit function or Vue component instance
 * @param {Object} payload - Remove event data
 */
export function emitSchedulerRemoveEvent(emitOrVm, payload) {
    const eventData = {
        schoolId: payload.schoolId || null,
        draftId: payload.draftId || null,
        dayId: Number(payload.dayId),
        periodId: String(payload.periodId),
        assignmentId: String(payload.assignmentId),
        courseId: payload.courseId ? String(payload.courseId) : null,
        courseName: payload.courseName ? String(payload.courseName) : null,
        source: 'remove',
        timestamp: new Date().toISOString(),
    };

    return emitElementEvent(emitOrVm, 'scheduler:remove', eventData);
}
