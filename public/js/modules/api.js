/**
 * AnchorMarks - API Module
 * Handles all API communication with the backend
 */

import * as state from './state.js';

// API Helper
export async function api(endpoint, options = {}) {
    const headers = { 'Content-Type': 'application/json' };
    if (state.csrfToken) headers['X-CSRF-Token'] = state.csrfToken;

    const response = await fetch(`${state.API_BASE}${endpoint}`, {
        ...options,
        credentials: 'include',
        headers: { ...headers, ...options.headers }
    });

    if (response.status === 401) {
        // Clear local auth state without making another API call
        state.setCsrfToken(null);
        state.setCurrentUser(null);
        state.setIsAuthenticated(false);
        // Show auth screen (import dynamically to avoid circular dependency)
        const { showAuthScreen } = await import('./auth.js');
        showAuthScreen();
        throw new Error('Session expired');
    }

    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'API Error');
    return data;
}

export default { api };
