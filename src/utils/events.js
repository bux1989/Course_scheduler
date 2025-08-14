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
        console.log(`📡 [Events] Attempting to emit event: ${name}`, {
            type: typeof vmOrEmit,
            isFunction: typeof vmOrEmit === 'function',
            hasEmit: vmOrEmit && typeof vmOrEmit.emit === 'function',
            hasVue2Emit: vmOrEmit && typeof vmOrEmit.$emit === 'function',
        });

        // WeWeb requires element events to be emitted from the root WeWeb component
        // Priority: Direct emit function (from WeWeb component) > Vue instance methods
        if (typeof vmOrEmit === 'function') {
            // This is the emit function directly - use it for WeWeb element events
            console.log(`📡 [Events] Using direct emit function for WeWeb element event: ${name}`);
            console.log(`📡 [Events] Event payload:`, { name, event: name, data });
            
            vmOrEmit('element-event', { name, event: name, data });
            console.log(`📡 [Events] ✅ WeWeb element event emitted: ${name}`);
            return true;
        }
        
        // Vue 2 Options API fallback (this.$emit)
        if (vmOrEmit && typeof vmOrEmit.$emit === 'function') {
            console.log(`📡 [Events] Using Vue 2 $emit for WeWeb element event: ${name}`);
            vmOrEmit.$emit('element-event', { name, event: name, data });
            console.log(`📡 [Events] ✅ WeWeb element event emitted via $emit: ${name}`);
            return true;
        }
        
        // Vue 3 Composition API instance fallback
        if (vmOrEmit && vmOrEmit.emit && typeof vmOrEmit.emit === 'function') {
            console.log(`📡 [Events] Using Vue 3 instance emit for WeWeb element event: ${name}`);
            vmOrEmit.emit('element-event', { name, event: name, data });
            console.log(`📡 [Events] ✅ WeWeb element event emitted via instance: ${name}`);
            return true;
        }

        // Fallback to native DOM custom events (non-WeWeb environments)
        console.warn(`📡 [Events] No WeWeb emit function available for ${name}, falling back to CustomEvent`);
        if (typeof window !== 'undefined' && window.CustomEvent) {
            console.log(`📡 [Events] Emitting CustomEvent fallback: ${name}`, data);
            const event = new CustomEvent(name, {
                detail: data,
                ...eventOptions,
            });

            // Try to dispatch on the component's root element or window
            const target = (vmOrEmit && vmOrEmit.$el) || window;
            target.dispatchEvent(event);
            console.log(`📡 [Events] ⚠️ CustomEvent fallback used for: ${name}`);
            return true;
        }

        console.warn(`📡 [Events] ❌ Could not emit event: ${name} - no event system available`);
        return false;
    } catch (error) {
        console.error(`📡 [Events] ❌ Failed to emit event: ${name}`, error);
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
