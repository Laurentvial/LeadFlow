import React from 'react';
import { Navigate } from "react-router-dom";
import {jwtDecode} from "jwt-decode";
import { refreshAccessToken } from "../utils/api";
import { ACCESS_TOKEN } from "../utils/constants";
import { useState, useEffect } from "react";

interface ProtectedRouteProps {
    children?: React.ReactNode;
}

function ProtectedRoute({ children }: ProtectedRouteProps) { 
    const [isAuthenticated, setIsAuthenticated] = useState(null)

    useEffect(() => {
        authenticate().catch(() => setIsAuthenticated(false));
    }, []);

    const refreshToken = async () => {
        try {
            const newToken = await refreshAccessToken();
            if (newToken) {
                setIsAuthenticated(true);
            } else {
                setIsAuthenticated(false);
            }
        } catch (error) {
            console.error(error);
            setIsAuthenticated(false);
        }
    }

    const authenticate = async () => {
        const token = localStorage.getItem(ACCESS_TOKEN);
        if (!token) {
            setIsAuthenticated(false);
            return;
        }

        const decoded = jwtDecode(token);
        const tokenExpiry = decoded.exp;
        const currentTime = Date.now() / 1000;

        if (tokenExpiry && tokenExpiry < currentTime) {
            await refreshToken();
        } else {
            setIsAuthenticated(true);
        }
    }
    
    if (isAuthenticated === null) {
        return (
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh' }}>
                <div>Chargement...</div>
            </div>
        );
    }

    return isAuthenticated ? <>{children}</> : <Navigate to="/login/otp" />
}

export default ProtectedRoute;