import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useParams, useNavigate } from 'react-router-dom';
import Login from './components/LoginPage';
import Dashboard from './components/Dashboard';
import NotFound from './components/NotFound';
import UsersAndTeams from './components/UsersTeams';
import Planning from './components/PlanningCalendar';
import Clients from './components/Clients';
import AddClient from './components/AddClient';
import { ClientDetail } from './components/ClientDetail';
import { ManageRibs } from './components/ManageRibs';
import { ManageAssets } from './components/ManageAssets';
import { ManageUsefulLinks } from './components/ManageUsefulLinks';
import { UserProvider } from './contexts/UserContext';
import ProtectedRoute from './components/ProtectedRoute';
import { Layout } from './components/Layout';
import { Toaster } from './components/ui/sonner';

function Logout() {
    localStorage.clear();
    return <Navigate to="/login" />;
}

function ClientDetailWrapper() {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    
    if (!id) {
        return <Navigate to="/clients" />;
    }
    
    return <ClientDetail clientId={id} onBack={() => navigate('/clients')} />;
}

function App() {
    return (
        <Router>
            <UserProvider>
                <Toaster />
                <Routes>
                    <Route path="/login" element={<Login />} />
                    <Route path="/logout" element={<Logout />} />
                    <Route path="/" element={
                        <ProtectedRoute>
                            <Layout>
                                <Dashboard />
                            </Layout>
                        </ProtectedRoute>
                    } />
                    <Route path="/dashboard" element={
                        <ProtectedRoute>
                            <Layout>
                                <Dashboard />
                            </Layout>
                        </ProtectedRoute>
                    } />
                    <Route path="/users" element={
                        <ProtectedRoute>
                            <Layout>
                                <UsersAndTeams />
                            </Layout>
                        </ProtectedRoute>
                    } />
                    <Route path="/planning" element={
                        <ProtectedRoute>
                            <Layout>
                                <Planning />
                            </Layout>
                        </ProtectedRoute>
                    } />
                    <Route path="/clients" element={
                        <ProtectedRoute>
                            <Layout>
                                <Clients onSelectClient={() => {}} />
                            </Layout>
                        </ProtectedRoute>
                    } />
                    <Route path="/clients/add" element={
                        <ProtectedRoute>
                            <Layout>
                                <AddClient />
                            </Layout>
                        </ProtectedRoute>
                    } />
                    <Route path="/clients/:id" element={
                        <ProtectedRoute>
                            <Layout>
                                <ClientDetailWrapper />
                            </Layout>
                        </ProtectedRoute>
                    } />
                    <Route path="/manage/ribs" element={
                        <ProtectedRoute>
                            <Layout>
                                <ManageRibs />
                            </Layout>
                        </ProtectedRoute>
                    } />
                    <Route path="/manage/assets" element={
                        <ProtectedRoute>
                            <Layout>
                                <ManageAssets />
                            </Layout>
                        </ProtectedRoute>
                    } />
                    <Route path="/manage/useful-links" element={
                        <ProtectedRoute>
                            <Layout>
                                <ManageUsefulLinks />
                            </Layout>
                        </ProtectedRoute>
                    } />
                    <Route path="*" element={
                        <ProtectedRoute>
                            <Layout>
                                <NotFound />
                            </Layout>
                        </ProtectedRoute>
                    } />
                </Routes>
            </UserProvider>
        </Router>
    );
}

export default App;

