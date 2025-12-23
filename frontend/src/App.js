import { useEffect, useState, createContext, useContext } from "react";
import { BrowserRouter, Routes, Route, Navigate, useNavigate, useLocation } from "react-router-dom";
import axios from "axios";
import { Toaster, toast } from "sonner";

// Pages
import LoginPage from "./pages/LoginPage";
import DashboardPage from "./pages/DashboardPage";
import UsersPage from "./pages/UsersPage";
import ImportPage from "./pages/ImportPage";
import BrandsPage from "./pages/BrandsPage";
import BrandDetailPage from "./pages/BrandDetailPage";
import SettingsPage from "./pages/SettingsPage";
import MyBrandsPage from "./pages/MyBrandsPage";
import ProblematicPage from "./pages/ProblematicPage";
import AnalyticsPage from "./pages/AnalyticsPage";
import SuperAdminPage from "./pages/SuperAdminPage";

// Components
import Sidebar from "./components/Sidebar";

import "./App.css";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
export const API = `${BACKEND_URL}/api`;

// Auth Context
export const AuthContext = createContext(null);

export const useAuth = () => useContext(AuthContext);

// API instance
export const api = axios.create({
  baseURL: API,
  headers: { "Content-Type": "application/json" }
});

// Add auth header interceptor
api.interceptors.request.use((config) => {
  const token = localStorage.getItem("token");
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Handle 401 errors
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem("token");
      localStorage.removeItem("user");
      window.location.href = "/login";
    }
    return Promise.reject(error);
  }
);

// Protected Route
const ProtectedRoute = ({ children, adminOnly = false }) => {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0F1115] flex items-center justify-center">
        <div className="text-[#FF9900] font-mono text-xl">Загрузка...</div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (adminOnly && user.role !== "admin") {
    return <Navigate to="/my-brands" replace />;
  }

  return children;
};

// Layout with Sidebar
const Layout = ({ children }) => {
  const { user } = useAuth();
  
  return (
    <div className="min-h-screen bg-[#0F1115] flex">
      <Sidebar user={user} />
      <main className="flex-1 ml-64 p-6 overflow-auto">
        {children}
      </main>
    </div>
  );
};

function AppContent() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const initAuth = async () => {
      const token = localStorage.getItem("token");
      const savedUser = localStorage.getItem("user");
      
      if (token && savedUser) {
        try {
          const response = await api.get("/auth/me");
          setUser(response.data);
          localStorage.setItem("user", JSON.stringify(response.data));
        } catch (error) {
          localStorage.removeItem("token");
          localStorage.removeItem("user");
        }
      }
      setLoading(false);
    };

    initAuth();
  }, []);

  // Heartbeat
  useEffect(() => {
    if (!user) return;

    const sendHeartbeat = async () => {
      try {
        await api.post("/auth/heartbeat");
      } catch (error) {
        console.error("Heartbeat failed:", error);
      }
    };

    sendHeartbeat();
    const interval = setInterval(sendHeartbeat, 30000);

    return () => clearInterval(interval);
  }, [user]);

  const login = async (email, password, secretCode) => {
    const response = await api.post("/auth/login", {
      email,
      password,
      secret_code: secretCode
    });
    
    localStorage.setItem("token", response.data.token);
    localStorage.setItem("user", JSON.stringify(response.data.user));
    setUser(response.data.user);
    
    return response.data.user;
  };

  const logout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, login, logout, loading }}>
      <BrowserRouter>
        <Toaster 
          position="top-right" 
          richColors 
          toastOptions={{
            style: {
              background: '#13161B',
              border: '1px solid #2A2F3A',
              color: '#E6E6E6'
            }
          }}
        />
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          
          {/* Admin Routes */}
          <Route path="/dashboard" element={
            <ProtectedRoute adminOnly>
              <Layout><DashboardPage /></Layout>
            </ProtectedRoute>
          } />
          <Route path="/users" element={
            <ProtectedRoute adminOnly>
              <Layout><UsersPage /></Layout>
            </ProtectedRoute>
          } />
          <Route path="/import" element={
            <ProtectedRoute adminOnly>
              <Layout><ImportPage /></Layout>
            </ProtectedRoute>
          } />
          <Route path="/brands" element={
            <ProtectedRoute adminOnly>
              <Layout><BrandsPage /></Layout>
            </ProtectedRoute>
          } />
          <Route path="/brands/:brandId" element={
            <ProtectedRoute>
              <Layout><BrandDetailPage /></Layout>
            </ProtectedRoute>
          } />
          <Route path="/settings" element={
            <ProtectedRoute adminOnly>
              <Layout><SettingsPage /></Layout>
            </ProtectedRoute>
          } />
          <Route path="/analytics" element={
            <ProtectedRoute adminOnly>
              <Layout><AnalyticsPage /></Layout>
            </ProtectedRoute>
          } />
          <Route path="/super-admin" element={
            <ProtectedRoute adminOnly>
              <Layout><SuperAdminPage /></Layout>
            </ProtectedRoute>
          } />
          
          {/* Searcher Routes */}
          <Route path="/my-brands" element={
            <ProtectedRoute>
              <Layout><MyBrandsPage /></Layout>
            </ProtectedRoute>
          } />
          <Route path="/problematic" element={
            <ProtectedRoute>
              <Layout><ProblematicPage /></Layout>
            </ProtectedRoute>
          } />
          
          {/* Default redirect */}
          <Route path="/" element={
            <ProtectedRoute>
              {user?.role === "admin" || user?.role === "super_admin" ? (
                <Navigate to="/dashboard" replace />
              ) : (
                <Navigate to="/my-brands" replace />
              )}
            </ProtectedRoute>
          } />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthContext.Provider>
  );
}

function App() {
  return <AppContent />;
}

export default App;
