import React from "react";
import { Navigate } from "react-router-dom";

interface AuthenticatedRouteProps {
  children: React.ReactNode;
}

const AuthenticatedRoute: React.FC<AuthenticatedRouteProps> = ({
  children,
}) => {
  const isAuthenticated = () => {
    const accessToken = localStorage.getItem("accessToken");
    const userEmail = localStorage.getItem("userEmail");

    // Check if both token and email exist
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
        localStorage.removeItem("accessToken");
        localStorage.removeItem("userEmail");
        return false;
      }

      return true;
    } catch (error) {
      console.error("Error validating token:", error);
      // Clear invalid token
      localStorage.removeItem("accessToken");
      localStorage.removeItem("userEmail");
      return false;
    }
  };

  if (!isAuthenticated()) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
};

export default AuthenticatedRoute;
