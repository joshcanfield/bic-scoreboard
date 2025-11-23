// src/ui/src/utils/state-patch.ts

/**
 * Helper function to apply dot-separated patches to a nested object.
 * This is a simplified version and might need to be more robust for production.
 * @param state The original state object.
 * @param patch The patch object with dot-separated keys.
 * @returns A new state object with the patch applied.
 */
export function applyPatch<T extends object>(state: T, patch: Record<string, any>): T {
    const newState: Record<string, any> = Array.isArray(state) ? [...(state as unknown as any[])] : { ...state };

    for (const keyPath of Object.keys(patch)) {
        if (!Object.prototype.hasOwnProperty.call(patch, keyPath)) continue;
        const value = patch[keyPath];
        const parts = keyPath.split('.');
        let current: any = newState;

        for (let i = 0; i < parts.length; i++) {
            const part = parts[i];
            if (i === parts.length - 1) {
                current[part] = value;
            } else {
                const existing = current[part];
                if (existing && typeof existing === 'object') {
                    current[part] = Array.isArray(existing) ? [...existing] : { ...existing };
                } else {
                    current[part] = {};
                }
                current = current[part];
            }
        }
    }

    return newState as T;
}
