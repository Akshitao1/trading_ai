export const AuthUtils = {
  // Check if user is authenticated
  isAuthenticated: (): boolean => {
    const accessToken = localStorage.getItem("accessToken");
    const userEmail = localStorage.getItem("userEmail");

    if (!accessToken || !userEmail) {
      return false;
    }

    // Basic token validation - check if it's not expired
    try {
      const tokenParts = accessToken.split(".");
      if (tokenParts.length !== 3) {
        return false;
      }

      // Decode the payload to check expiration
      const payload = JSON.parse(atob(tokenParts[1]));
      const currentTime = Date.now() / 1000;

      if (payload.exp < currentTime) {
        // Token is expired, clear localStorage
        AuthUtils.logout();
        return false;
      }

      return true;
    } catch (error) {
      console.error("Error validating token:", error);
      AuthUtils.logout();
      return false;
    }
  },

  // Get current user info
  getCurrentUser: (): { email: string; token: string } | null => {
    const accessToken = localStorage.getItem("accessToken");
    const userEmail = localStorage.getItem("userEmail");

    if (!accessToken || !userEmail || !AuthUtils.isAuthenticated()) {
      return null;
    }

    return { email: userEmail, token: accessToken };
  },

  // Logout user
  logout: (): void => {
    localStorage.removeItem("accessToken");
    localStorage.removeItem("userEmail");
  },

  // Get authorization header for API calls
  getAuthHeader: (): { Authorization: string } | {} => {
    const accessToken = localStorage.getItem("accessToken");
    if (accessToken && AuthUtils.isAuthenticated()) {
      return { Authorization: `Bearer ${accessToken}` };
    }
    return {};
  },

  // Enhanced fetch with automatic token injection
  authenticatedFetch: async (
    url: string,
    options: RequestInit = {}
  ): Promise<Response> => {
    const authHeaders = AuthUtils.getAuthHeader();

    const enhancedOptions: RequestInit = {
      ...options,
      headers: {
        "Content-Type": "application/json",
        ...authHeaders,
        ...options.headers,
      },
    };

    const response = await fetch(url, enhancedOptions);

    // If we get a 401, the token might be invalid - logout user
    if (response.status === 401) {
      AuthUtils.logout();
      window.location.href = "/login";
    }

    return response;
  },
};
