/**
 * context/AuthContext.jsx
 *
 * Global Authentication Context
 *
 * Provides the entire React tree with:
 * - `user`         — The currently logged-in user object (or null)
 * - `token`        — The JWT string (or null)
 * - `isLoading`    — True while we're verifying a stored token on app load
 * - `login()`      — Called after a successful /api/auth/login response
 * - `logout()`     — Clears auth state and navigates to /login
 * - `updateUser()` — Patches local user state (e.g., after budget update)
 * - `loginWithGoogle()` — Handles Google OAuth token verification and login
 *
 * MERN Data Flow:
 * 1. User logs in → AuthContext.login() stores JWT in localStorage.
 * 2. axios default header is set: Authorization: Bearer <token>
 * 3. All subsequent Axios calls automatically include the token.
 * 4. Express protect middleware reads the header and injects req.user.
 * 5. On page refresh, AuthContext reads the token from localStorage
 * and calls GET /api/auth/me to re-validate the session.
 */

import { createContext, useContext, useState, useEffect } from 'react';
import axios from 'axios';

// ── Create context ─────────────────────────────────────────────────────────────
const AuthContext = createContext(null);

// ── Axios Base URL ────────────────────────────────────────────────────────────
// With Vite's proxy configured, '/api' is all we need in development.
// In production, set VITE_API_BASE_URL in the environment.
axios.defaults.baseURL = import.meta.env.VITE_API_BASE_URL || '';

// ── Provider Component ─────────────────────────────────────────────────────────
export const AuthProvider = ({ children }) => {
  // State: current user profile object
  const [user, setUser] = useState(null);

  // State: raw JWT string — stored here AND in localStorage for persistence
  const [token, setToken] = useState(() => localStorage.getItem('expenseToken') || null);

  // State: true during the initial session-restoration check on mount
  const [isLoading, setIsLoading] = useState(true);

  // ── Set / Clear Axios Authorization Header ──────────────────────────────────
  /**
   * Whenever the token changes (login, logout, page refresh), sync it
   * as the default Axios Authorization header so every future API call
   * is automatically authenticated without manually passing headers.
   */
  const setAxiosAuthHeader = (jwt) => {
    if (jwt) {
      axios.defaults.headers.common['Authorization'] = `Bearer ${jwt}`;
    } else {
      delete axios.defaults.headers.common['Authorization'];
    }
  };

  // ── On Mount: Restore Session ────────────────────────────────────────────────
  /**
   * When the app loads (or the user refreshes the page), check if a valid
   * JWT exists in localStorage. If so, validate it against the backend by
   * calling GET /api/auth/me. This prevents stale/expired tokens from being
   * silently accepted.
   */
  useEffect(() => {
    const restoreSession = async () => {
      const storedToken = localStorage.getItem('expenseToken');

      if (!storedToken) {
        // No stored token — user is not logged in
        setIsLoading(false);
        return;
      }

      // Token found — set header and validate with the backend
      setAxiosAuthHeader(storedToken);

      try {
        const { data } = await axios.get('/api/auth/me');

        if (data.success) {
          // Token is valid — restore user state
          setUser(data.user);
          setToken(storedToken);
        } else {
          // Server rejected the token (shouldn't normally happen, but be safe)
          clearAuth();
        }
      } catch (error) {
        // Token is expired or invalid — clear everything
        console.warn('Session restore failed:', error?.response?.data?.message || error.message);
        clearAuth();
      } finally {
        setIsLoading(false);
      }
    };

    restoreSession();
  }, []); // Empty dep array — only runs once on mount

  // ── Helpers ───────────────────────────────────────────────────────────────────
  const clearAuth = () => {
    localStorage.removeItem('expenseToken');
    setAxiosAuthHeader(null);
    setUser(null);
    setToken(null);
  };

  // ── login() ────────────────────────────────────────────────────────────────
  /**
   * Called by LoginPage after a successful POST /api/auth/login.
   * Stores the JWT and user object, and sets the Axios default header.
   *
   * @param {string} jwt      — JWT token from the API response
   * @param {object} userData — User object from the API response
   */
  const login = (jwt, userData) => {
    localStorage.setItem('expenseToken', jwt);
    setAxiosAuthHeader(jwt);
    setToken(jwt);
    setUser(userData);
  };

  // ── loginWithGoogle() ──────────────────────────────────────────────────────
  /**
   * Called by LoginPage/RegisterPage after a successful Google OAuth popup.
   * Sends the Google ID token to our backend for verification, then logs the user in.
   * * @param {string} credentialToken — The raw JWT returned directly by Google
   */
  const loginWithGoogle = async (credentialToken) => {
    const { data } = await axios.post('/api/auth/google-login', { 
      token: credentialToken 
    });
    
    // The backend responds with our own app's JWT and the user object
    const { token: appToken, user: userData } = data;
    
    // Utilize the exact same storage flow as standard login
    localStorage.setItem('expenseToken', appToken);
    setAxiosAuthHeader(appToken);
    setToken(appToken);
    setUser(userData);
  };

  // ── logout() ─────────────────────────────────────────────────────────────────
  /**
   * Clears all auth state. The Navbar calls this when the user clicks "Logout".
   * Navigation back to /login is handled by App.jsx's ProtectedRoute component
   * (which watches the user state) or can be triggered by the caller.
   */
  const logout = () => {
    clearAuth();
  };

  // ── updateUser() ──────────────────────────────────────────────────────────────
  /**
   * Patches the local user state without re-fetching from the backend.
   * Used after budget updates (PUT /api/auth/budget) so the dashboard
   * reflects the new monthlyBudget immediately.
   *
   * @param {Partial<object>} updates — Partial user object to merge
   */
  const updateUser = (updates) => {
    setUser((prev) => ({ ...prev, ...updates }));
  };

  // ── Context Value ─────────────────────────────────────────────────────────────
  const contextValue = {
    user,
    token,
    isLoading,
    login,
    loginWithGoogle, // ✦ Now properly exported to the rest of the app
    logout,
    updateUser,
    isAuthenticated: !!user,
  };

  return (
    <AuthContext.Provider value={contextValue}>
      {children}
    </AuthContext.Provider>
  );
};

// ── Custom Hook ────────────────────────────────────────────────────────────────
/**
 * useAuth() — consume the AuthContext from any component.
 *
 * Usage:
 * const { user, login, logout, isAuthenticated } = useAuth();
 *
 * Throws a descriptive error if used outside of <AuthProvider>.
 */
export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth() must be used inside an <AuthProvider>. Check your component tree.');
  }
  return context;
};

export default AuthContext;