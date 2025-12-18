import axios from "axios";
import { debugLog } from "./debug";

const instance = axios.create({
  withCredentials: true,
});

// CSRF token management
let csrfToken: string | null = null;
let csrfReady: boolean = false;

// Function to set CSRF token from context (called by interceptor)
export const setCSRFToken = (token: string | null) => {
  csrfToken = token;
  csrfReady = true;
};

// Function to mark CSRF as ready
export const setCSRFReady = (ready: boolean) => {
  csrfReady = ready;
};

// Fetch CSRF token on initialization
export const fetchCSRFToken = async () => {
  try {
    const response = await axios.get('/api/csrf-token', { withCredentials: true });
    csrfToken = response.data.csrfToken;
    csrfReady = true;
    debugLog('CSRF token fetched successfully');
    return csrfToken;
  } catch (error) {
    debugLog('Failed to fetch CSRF token:', error);
    csrfReady = true; // Mark ready even on failure
    throw error;
  }
};

// Prevent multiple ban-triggered logouts/reloads
let banHandled = false;
if (typeof window !== 'undefined') {
  banHandled = false; // Reset on page load
}

let isRefreshing = false;
let refreshFailed = false; // Prevent multiple refresh attempts
let failedQueue: Array<{resolve: Function, reject: Function}> = [];

const processQueue = (error: any, token: string | null = null) => {
  failedQueue.forEach(prom => {
    if (error) {
      prom.reject(error);
    } else {
      prom.resolve(token);
    }
  });
  failedQueue = [];
};

// Request interceptor to attach CSRF token to state-changing requests
instance.interceptors.request.use(
  async (config) => {
    const method = config.method?.toLowerCase();
    
    // Only attach CSRF token to state-changing methods
    if (method && ['post', 'put', 'patch', 'delete'].includes(method)) {
      // Wait for CSRF to be ready if still loading
      if (!csrfReady) {
        debugLog('Waiting for CSRF token to be ready...');
        // Poll until ready (with timeout)
        let attempts = 0;
        while (!csrfReady && attempts < 50) { // Max 5 seconds wait
          await new Promise(resolve => setTimeout(resolve, 100));
          attempts++;
        }
      }
      
      // Attach token if available
      if (csrfToken) {
        config.headers['X-CSRF-Token'] = csrfToken;
        debugLog('CSRF token attached to request:', config.url);
      } else {
        debugLog('Warning: CSRF token not available for request:', config.url);
      }
    }
    
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

instance.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    // Don't intercept auth-related endpoints to avoid loops
    if (
      originalRequest.url?.includes('/api/login') ||
      originalRequest.url?.includes('/api/logout') ||
      originalRequest.url?.includes('/api/refresh') ||
      originalRequest.url?.includes('/api/me')
    ) {
      throw error;
    }

    if (error.response?.status === 401 && !originalRequest._retry) {
      // If already failed once or on login page, don't retry
      const isOnLoginPage = typeof window !== 'undefined' && window.location.pathname === '/login';
      if (refreshFailed || isOnLoginPage) {
        throw error;
      }

      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        })
          .then(() => {
            return instance(originalRequest);
          })
          .catch((err) => {
            throw err;
          });
      }

      originalRequest._retry = true;
      isRefreshing = true;

      try {
        // Use native axios to avoid interceptor recursion
        await axios.post('/api/refresh', {}, { withCredentials: true });
        processQueue(null, null);
        refreshFailed = false; // Reset on successful refresh
        
        // Refresh CSRF token after successful token refresh
        try {
          await fetchCSRFToken();
        } catch (csrfError) {
          debugLog('Failed to refresh CSRF token after auth refresh:', csrfError);
        }
        
        return instance(originalRequest);
      } catch (refreshError) {
        refreshFailed = true; // Mark refresh as failed
        processQueue(refreshError, null);
        
        // Only redirect if not already on login page
        if (typeof window !== 'undefined' && window.location.pathname !== '/login') {
          window.location.href = '/login';
        }
        throw refreshError;
      } finally {
        isRefreshing = false;
      }
    }

    // Handle CSRF token errors (403 Forbidden with CSRF error codes)
    if (error.response?.status === 403) {
      const errorCode = error.response?.data?.error;
      if (errorCode && ['csrf_token_missing', 'csrf_token_invalid', 'csrf_validation_failed'].includes(errorCode)) {
        debugLog('CSRF validation failed, refreshing token and retrying...');
        try {
          await fetchCSRFToken();
          // Retry the original request with new token
          return instance(originalRequest);
        } catch (csrfError) {
          debugLog('Failed to refresh CSRF token:', csrfError);
          throw error;
        }
      }
    }

    throw error;
  }
);

export default instance;
