/**
 * Unwraps arrays from Vue reactive objects and proxies to handle WeWeb prop compatibility
 *
 * WeWeb sometimes wraps arrays in reactive objects or proxies, causing Array.isArray()
 * checks to fail. This utility function safely extracts the actual array data.
 *
 * @param {*} possibleArray - The value that might be an array or wrapped array
 * @returns {Array} - The unwrapped array or empty array as fallback
 */
export function unwrapArray(possibleArray) {
    // Handle null/undefined
    if (!possibleArray) {
        return [];
    }

    // Already a plain array
    if (Array.isArray(possibleArray)) {
        return possibleArray;
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

    // Handle reactive ref with .value property containing array
    if (possibleArray && typeof possibleArray === 'object' && Array.isArray(possibleArray.value)) {
        return possibleArray.value;
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
 * @param {*} data - The data to validate
 * @param {string} propName - Name of the prop for logging
 * @returns {Array} - The validated array
 */
export function validateAndUnwrapArray(data, propName = 'unknown') {
    const result = unwrapArray(data);

    if (result.length === 0 && data) {
        console.warn(`[${propName}] Could not extract array from:`, {
            type: typeof data,
            isArray: Array.isArray(data),
            hasLength: data?.length,
            hasForEach: typeof data?.forEach === 'function',
            keys: data && typeof data === 'object' ? Object.keys(data) : null,
            data: data,
        });
    }

    return result;
}
