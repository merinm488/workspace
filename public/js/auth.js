/**
 * ================================================
 * WORKSPACE - Authentication Module
 * ================================================
 *
 * Same strategy as the Dox (Notes) app:
 *   1. POST { key, action: 'login' }
 *   2. 404 "User not found"  ->  POST { key, action: 'create' }  (auto-create)
 *
 * The hash is computed server-side (sha256(key + pepper)), so the raw key
 * never determines storage. On success, sessionStorage gets the workspace
 * session PLUS mirrors for both child apps, so Dox and Grids are already
 * logged in when the user navigates to them:
 *
 *   ws_hash / ws_key           -> workspace session
 *   dox_hash / dox_key         -> Dox expects these (useAuth.js)
 *   grids_user_hash / ..._key  -> Grids expects these (js/auth.js)
 */

const WS_AUTH_CONFIG = {
    apiEndpoint: '/api/workspace',
    storageKeys: {
        wsHash: 'ws_hash',
        wsKey: 'ws_key',
        doxHash: 'dox_hash',
        doxKey: 'dox_key',
        gridsHash: 'grids_user_hash',
        gridsKey: 'grids_user_key'
    }
};

class WsAuthManager {
    constructor() {
        this.userHash = null;
        this.userKey = null;
        this.userData = null;
    }

    /**
     * Read the session from sessionStorage (ws_hash / ws_key).
     */
    getSession() {
        const hash = sessionStorage.getItem(WS_AUTH_CONFIG.storageKeys.wsHash);
        const key = sessionStorage.getItem(WS_AUTH_CONFIG.storageKeys.wsKey);
        if (hash && key) {
            this.userHash = hash;
            this.userKey = key;
            return { hash, key };
        }
        return null;
    }

    /**
     * Authenticate with an access key. Logs in when the account exists,
     * auto-creates otherwise (same UX as Dox and Grids).
     */
    async authenticate(rawKey) {
        const normalizedKey = String(rawKey || '').trim();
        if (!normalizedKey) {
            return { success: false, error: 'Key cannot be empty' };
        }

        // 1) Try login
        try {
            const response = await fetch(WS_AUTH_CONFIG.apiEndpoint, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ key: normalizedKey, action: 'login' })
            });

            if (response.ok) {
                const data = await response.json();
                if (data.success) {
                    this.storeSession(normalizedKey, data.hash, data.data);
                    return { success: true, isNewUser: false, data: data.data };
                }
                return { success: false, error: data.error || 'Login failed' };
            }

            if (response.status === 404) {
                // 2) Unknown key -> auto-create (Dox behavior)
                return await this.createAccount(normalizedKey);
            }

            const err = await response.json().catch(() => ({}));
            return { success: false, error: err.error || 'Login failed' };
        } catch (error) {
            console.error('[AUTH] Login error:', error);
            return { success: false, error: 'Login failed. Please try again.' };
        }
    }

    /**
     * Create the unified account.
     */
    async createAccount(normalizedKey) {
        try {
            const response = await fetch(WS_AUTH_CONFIG.apiEndpoint, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ key: normalizedKey, action: 'create' })
            });

            const data = await response.json();

            if (data.success) {
                this.storeSession(normalizedKey, data.hash, data.data);
                return { success: true, isNewUser: true, data: data.data };
            }
            return { success: false, error: data.error || 'Failed to create account' };
        } catch (error) {
            console.error('[AUTH] Create error:', error);
            return { success: false, error: 'Failed to create account. Please try again.' };
        }
    }

    /**
     * Persist the session under all three apps' storage keys.
     */
    storeSession(key, hash, userData) {
        const s = WS_AUTH_CONFIG.storageKeys;
        sessionStorage.setItem(s.wsHash, hash);
        sessionStorage.setItem(s.wsKey, key);
        sessionStorage.setItem(s.doxHash, hash);
        sessionStorage.setItem(s.doxKey, key);
        sessionStorage.setItem(s.gridsHash, hash);
        sessionStorage.setItem(s.gridsKey, key);

        this.userHash = hash;
        this.userKey = key;
        this.userData = userData;
    }

    /**
     * Remove all three apps' keys from sessionStorage.
     */
    clearSession() {
        const s = WS_AUTH_CONFIG.storageKeys;
        Object.values(s).forEach(name => sessionStorage.removeItem(name));
    }

    /**
     * Logout: clear session and reset in-memory state.
     */
    logout() {
        this.clearSession();
        this.userHash = null;
        this.userKey = null;
        this.userData = null;
    }

    /**
     * Delete the account (removes the unified document) and clear the session.
     */
    async deleteAccount() {
        if (!this.userHash) {
            return { success: false, error: 'No user logged in' };
        }

        try {
            const response = await fetch(
                `${WS_AUTH_CONFIG.apiEndpoint}?hash=${encodeURIComponent(this.userHash)}`,
                { method: 'DELETE' }
            );
            const data = await response.json();

            if (data.success) {
                this.logout();
                return { success: true };
            }
            return { success: false, error: data.error || 'Failed to delete account' };
        } catch (error) {
            console.error('[AUTH] Delete error:', error);
            return { success: false, error: 'Failed to delete account. Please try again.' };
        }
    }

    getUserHash() {
        return this.userHash;
    }

    getUserKey() {
        return this.userKey;
    }
}

// Global instance
const wsAuth = new WsAuthManager();

if (typeof window !== 'undefined') {
    window.WsAuthManager = WsAuthManager;
    window.wsAuth = wsAuth;
}
