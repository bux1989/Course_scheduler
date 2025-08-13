/**
 * Safely normalize possible Vue/WeWeb proxy/numeric-key collections into arrays
 * Handles WeWeb collection data that comes as {"0": {...}, "1": {...}} objects
 *
 * @param {*} v - The value that might be an array, proxy, or numeric-key object
 * @returns {Array} - The normalized array or empty array as fallback
 */
export function toArray(v) {
    if (Array.isArray(v)) return v;

    // Vue ref/unref case
    if (v?.value && Array.isArray(v.value)) return v.value;

    // Numeric-key object (e.g., {"0": {...}, "1": {...}})
    if (v && typeof v === 'object') {
        const keys = Object.keys(v).filter(k => /^\d+$/.test(k));
        if (keys.length) {
            return keys.sort((a, b) => Number(a) - Number(b)).map(k => v[k]);
        }
    }

    return [];
}

/**
 * Safe length helper that works with arrays and array-like objects
 * @param {*} a - The value to get length from
 * @returns {number} - Length or 0
 */
export function len(a) {
    return Array.isArray(a) ? a.length : 0;
}

/**
 * Check if array/collection is non-empty
 * @param {*} a - The value to check
 * @returns {boolean} - True if non-empty
 */
export function nonEmpty(a) {
    return len(a) > 0;
}

/**
 * Normalize period data to unified shape, handling various WeWeb collection formats
 *
 * CRITICAL FIX: Ensures stable Vue :key values by always using block_number-based IDs
 * instead of database UUIDs which can cause Vue reactive DOM issues and grid disappearing.
 *
 * @param {*} periodsData - Raw periods data from WeWeb (array or numeric-key object)
 * @returns {Array} - Normalized periods array with stable IDs for Vue reactivity
 */
export function normalizePeriods(periodsData) {
    const periodsArray = toArray(periodsData);

    if (!nonEmpty(periodsArray)) {
        return [];
    }

    return periodsArray
        .map((period, index) => {
            // Normalize field names to unified shape
            const blockNumber = period.block_number || period.blocknumber || index + 1;

            // Build unified label - prefer label, fallback to name_de/name
            let label = period.label || period.name_de || period.name || `Period ${blockNumber}`;

            // Build time string from start_time/end_time if present, otherwise use existing time
            let time = period.time;
            if (period.start_time && period.end_time) {
                time = `${period.start_time} - ${period.end_time}`;
            } else if (period.start_time || period.end_time) {
                time = period.start_time || period.end_time;
            }

            // Determine if instructional based on various indicators
            let isInstructional = true;
            if (period.block_type) {
                const nonInstructionalTypes = [
                    'break',
                    'pause',
                    'lunch',
                    'recess',
                    'assembly',
                    'flexband',
                    'frühdienst',
                    'hofpause',
                ];
                isInstructional = !nonInstructionalTypes.includes(period.block_type.toLowerCase());
            } else if (period.attendance_requirement === 'optional') {
                isInstructional = false;
            } else if (label && typeof label === 'string') {
                const labelLower = label.toLowerCase();
                const nonInstructionalKeywords = ['break', 'pause', 'lunch', 'flexband', 'frühdienst', 'hofpause'];
                isInstructional = !nonInstructionalKeywords.some(keyword => labelLower.includes(keyword));
            }

            // Generate a consistent, stable ID for Vue key tracking
            // Priority: use block_number for stability, fallback to original id only if no block_number conflicts
            const stableId = `period-${blockNumber}`;

            return {
                // Preserve original data
                ...period,
                // Add normalized fields with stable ID for Vue reactivity
                id: stableId, // Always use consistent block_number-based ID for Vue :key stability
                originalId: period.id, // Preserve original UUID/ID for API operations if needed
                block_number: Number(blockNumber),
                label: label,
                name: label, // Alias for compatibility
                time: time || `${blockNumber}. Period`,
                is_instructional: period.is_instructional !== undefined ? period.is_instructional : isInstructional,
                type: period.block_type || period.type || (isInstructional ? 'lesson' : 'break'),
            };
        })
        .sort((a, b) => a.block_number - b.block_number);
}

/**
 * Legacy unwrapArray function for backward compatibility
 * Now uses the enhanced toArray function internally
 *
 * @param {*} possibleArray - The value that might be an array or wrapped array
 * @returns {Array} - The unwrapped array or empty array as fallback
 */
export function unwrapArray(possibleArray) {
    // Handle null/undefined
    if (!possibleArray) {
        return [];
    }

    // Use the enhanced toArray function first
    const arrayResult = toArray(possibleArray);
    if (nonEmpty(arrayResult)) {
        return arrayResult;
    }

    // Handle array-like objects (has length and forEach)
    if (
        possibleArray &&
        typeof possibleArray === 'object' &&
        typeof possibleArray.length === 'number' &&
        typeof possibleArray.forEach === 'function'
    ) {
        return Array.from(possibleArray);
    }

    // Handle objects with array properties (search common property names)
    if (possibleArray && typeof possibleArray === 'object') {
        // Check for common array property names
        const arrayKeys = ['data', 'items', 'list', 'array', 'results'];
        for (const key of arrayKeys) {
            if (Array.isArray(possibleArray[key])) {
                return possibleArray[key];
            }
        }

        // Search all properties for arrays
        for (const key in possibleArray) {
            if (Array.isArray(possibleArray[key])) {
                return possibleArray[key];
            }
        }
    }

    // Fallback to empty array
    return [];
}

/**
 * Enhanced validation that logs useful debugging information
 * Now uses the improved toArray function for better WeWeb compatibility
 * @param {*} data - The data to validate
 * @param {string} propName - Name of the prop for logging
 * @returns {Array} - The validated array
 */
export function validateAndUnwrapArray(data, propName = 'unknown') {
    // Try enhanced toArray first for WeWeb collections
    const result = toArray(data);

    // Fall back to legacy unwrapArray if needed
    if (!nonEmpty(result)) {
        const legacyResult = unwrapArray(data);
        if (nonEmpty(legacyResult)) {
            return legacyResult;
        }
    }

    if (!nonEmpty(result) && data) {
        const keys = data && typeof data === 'object' ? Object.keys(data) : null;
        const numericKeys = keys ? keys.filter(k => /^\d+$/.test(k)) : [];

        console.warn(`[${propName}] Could not extract array from:`, {
            type: typeof data,
            isArray: Array.isArray(data),
            hasLength: data?.length,
            hasForEach: typeof data?.forEach === 'function',
            hasValue: !!data?.value,
            keys: keys,
            numericKeys: numericKeys,
            isNumericKeyObject: numericKeys.length > 0,
            sampleData: data && typeof data === 'object' && numericKeys.length > 0 ? data[numericKeys[0]] : data,
        });
    }

    return nonEmpty(result) ? result : [];
}

/**
 * Safe length helper - returns 0 for non-arrays or undefined values
 * Enhanced to handle WeWeb numeric-key objects
 * @param {*} value - The value to get length from
 * @returns {number} - Length or 0
 */
export function safeLength(value) {
    // Use the enhanced len function for consistency
    return len(value) || (value && typeof value === 'object' && typeof value.length === 'number' ? value.length : 0);
}

/**
 * Safe array helper - ensures value is always an array
 * Enhanced to use toArray for better WeWeb compatibility
 * @param {*} value - The value to convert to safe array
 * @returns {Array} - The safe array or empty array
 */
export function safeArray(value) {
    const result = toArray(value);
    if (nonEmpty(result)) {
        return result;
    }

    // Legacy fallback
    if (Array.isArray(value)) {
        return value;
    }
    if (Array.isArray(value?.value)) {
        return value.value;
    }
    if (value && typeof value === 'object' && typeof value.length === 'number' && typeof value.forEach === 'function') {
        return Array.from(value);
    }
    return [];
}
