import { useState, useCallback } from 'react';
import { generateHash, isValidKey, normalizeKey } from '../lib/cryptoUtils';

/**
 * Authentication Hook
 * Manages login, account creation via TextDB API
 */
export function useAuth() {
  const [userHash, setUserHash] = useState(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [errorCode, setErrorCode] = useState(null);

  /**
   * Login with a custom key (existing account only)
   * @param {string} key - The user's custom key
   * @returns {Promise<Object>} - Login result { success, error }
   */
  const login = useCallback(async (key) => {
    setIsLoading(true);
    setError(null);
    setErrorCode(null);

    try {
      const normalizedKey = normalizeKey(key);

      if (!isValidKey(normalizedKey)) {
        setError('Key cannot be empty');
        setErrorCode('INVALID_FORMAT');
        setIsLoading(false);
        return { success: false, error: 'Invalid key format' };
      }

      // Send the key to server for hashing and authentication
      const response = await fetch('/api/notes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key: normalizedKey, action: 'login' })
      });

      const data = await response.json();

      if (!response.ok) {
        if (response.status === 404) {
          // User doesn't exist - automatically create account
          setIsLoading(false);
          return createAccount(key);
        }

        throw new Error(data.error || 'Login failed');
      }

      // User exists - set session and login
      setUserHash(data.hash);
      setIsAuthenticated(true);
      setSessionKeys(data.hash, normalizedKey);

      setIsLoading(false);
      return {
        success: true,
        message: 'Welcome back!',
        isNewAccount: false
      };

    } catch (err) {
      setError('Login failed. Please try again.');
      setErrorCode('LOGIN_ERROR');
      setIsLoading(false);
      return { success: false, error: err.message };
    }
  }, []);

  /**
   * Create a new account with a custom key
   * @param {string} key - The user's custom key
   * @returns {Promise<Object>} - Creation result { success, error }
   */
  const createAccount = useCallback(async (key) => {
    setIsLoading(true);
    setError(null);
    setErrorCode(null);

    try {
      const normalizedKey = normalizeKey(key);

      if (!isValidKey(normalizedKey)) {
        setError('Key cannot be empty');
        setErrorCode('INVALID_FORMAT');
        setIsLoading(false);
        return { success: false, error: 'Invalid key format' };
      }

      // Create account via API
      const response = await fetch('/api/notes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key: normalizedKey, action: 'create' })
      });

      const data = await response.json();

      if (!response.ok) {
        if (data.code === 'USER_EXISTS') {
          setError('An account with this key already exists');
          setErrorCode('USER_EXISTS');
        } else {
          setError(data.error || 'Account creation failed');
          setErrorCode('CREATE_ERROR');
        }
        setIsLoading(false);
        return { success: false, error: data.error };
      }

      // Account created - use server-generated hash
      setUserHash(data.hash);
      setIsAuthenticated(true);
      setSessionKeys(data.hash, normalizedKey);

      setIsLoading(false);
      return {
        success: true,
        message: 'Account created successfully!',
        isNewAccount: true
      };

    } catch (err) {
      setError('Account creation failed. Please try again.');
      setErrorCode('CREATE_ERROR');
      setIsLoading(false);
      return { success: false, error: err.message };
    }
  }, []);

  /**
   * Store the session for Dox AND its Workspace siblings (single origin,
   * shared sessionStorage). Mirrors the keys Workspace and Grids read, so
   * navigating between the three apps never requires re-login.
   */
  const setSessionKeys = useCallback((hash, key) => {
    sessionStorage.setItem('dox_hash', hash);
    sessionStorage.setItem('dox_key', key);
    sessionStorage.setItem('ws_hash', hash);
    sessionStorage.setItem('ws_key', key);
    sessionStorage.setItem('grids_user_hash', hash);
    sessionStorage.setItem('grids_user_key', key);
  }, []);

  /**
   * Logout - clear the shared session (all three apps)
   */
  const logout = useCallback(() => {
    setUserHash(null);
    setIsAuthenticated(false);
    ['dox_hash', 'dox_key', 'ws_hash', 'ws_key', 'grids_user_hash', 'grids_user_key']
      .forEach(name => sessionStorage.removeItem(name));
  }, []);

  /**
   * Delete account - remove user data from server and clear session
   * @param {string} hash - User's hash to delete
   * @returns {Promise<Object>} - Deletion result { success, error }
   */
  const deleteAccount = useCallback(async (hash) => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/notes?hash=${encodeURIComponent(hash)}`, {
        method: 'DELETE'
      });

      if (!response.ok) {
        throw new Error('Failed to delete account');
      }

      // Clear local session and storage
      setUserHash(null);
      setIsAuthenticated(false);
      ['dox_hash', 'dox_key', 'ws_hash', 'ws_key', 'grids_user_hash', 'grids_user_key']
        .forEach(name => sessionStorage.removeItem(name));

      setIsLoading(false);
      return { success: true, message: 'Account deleted successfully' };

    } catch (err) {
      setError('Failed to delete account. Please try again.');
      setIsLoading(false);
      return { success: false, error: err.message };
    }
  }, []);

  /**
   * Check for existing session on mount
   */
  const checkSession = useCallback(async () => {
    // Fall back to legacy key so existing sessions survive the rename
    const savedHash = sessionStorage.getItem('dox_hash') || sessionStorage.getItem('secure_notes_hash');
    if (savedHash) {
      try {
        const response = await fetch(`/api/notes?hash=${encodeURIComponent(savedHash)}`);
        if (response.ok) {
          setUserHash(savedHash);
          setIsAuthenticated(true);
          return true;
        }
      } catch (error) {
        console.error('Session check failed:', error);
      }
    }
    return false;
  }, []);

  /**
   * Get the stored user key
   * @returns {string|null} - The user's key or null if not found
   */
  const getUserKey = useCallback(() => {
    return sessionStorage.getItem('dox_key') || sessionStorage.getItem('secure_notes_key');
  }, []);

  return {
    userHash,
    isAuthenticated,
    isLoading,
    error,
    errorCode,
    login,
    createAccount,
    logout,
    deleteAccount,
    checkSession,
    getUserKey
  };
}
