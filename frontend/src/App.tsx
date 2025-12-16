import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useParams, useNavigate } from 'react-router-dom';
import Login from './components/LoginPage';
import Dashboard from './components/Dashboard';
import NotFound from './components/NotFound';
import UsersAndTeams from './components/UsersTeams';
import Planning from './components/PlanningCalendar';
import PlanningAdministrateur from './components/PlanningAdministrateur';
import Contacts from './components/Contacts';
import Fosse from './components/Fosse';
import AddContact from './components/AddContact';
import { CsvImport } from './components/CsvImport';
import { MigrationPage } from './components/MigrationPage';
import { ContactDetail } from './components/ContactDetail';
import Settings from './components/Settings';
import Mails from './components/Mails';
import Chat from './components/Chat';
import FosseConfiguration from './Pages/FosseConfiguration';
import { UserProvider } from './contexts/UserContext';
import { UnreadMessagesProvider } from './contexts/UnreadMessagesContext';
import ProtectedRoute from './components/ProtectedRoute';
import PermissionProtectedRoute from './components/PermissionProtectedRoute';
import SettingsPermissionWrapper from './components/SettingsPermissionWrapper';
import { Layout } from './components/Layout';
import { Toaster } from './components/ui/sonner';
import { MessagePopupWrapper } from './components/MessagePopupWrapper';
import { EventPopupWrapper } from './components/EventPopupWrapper';

function Logout() {
    localStorage.clear();
    return <Navigate to="/login" />;
}

function ContactDetailWrapper() {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    
    if (!id) {
        return <Navigate to="/contacts" />;
    }
    
    return <ContactDetail contactId={id} onBack={() => navigate('/contacts')} />;
}

function App() {
    return (
        <Router>
            <UserProvider>
                <UnreadMessagesProvider children={
                    <>
                        <Toaster />
                        <MessagePopupWrapper />
                        <Routes>
                    <Route path="/login" element={<Login />} />
                    <Route path="/logout" element={<Logout />} />
                    <Route path="/" element={
                        <ProtectedRoute>
                            <PermissionProtectedRoute component="dashboard" action="view" fallbackPath={undefined}>
                                <Layout>
                                    <Dashboard />
                                </Layout>
                            </PermissionProtectedRoute>
                        </ProtectedRoute>
                    } />
                    <Route path="/dashboard" element={
                        <ProtectedRoute>
                            <PermissionProtectedRoute component="dashboard" action="view">
                                <Layout>
                                    <Dashboard />
                                </Layout>
                            </PermissionProtectedRoute>
                        </ProtectedRoute>
                    } />
                    <Route path="/users" element={
                        <ProtectedRoute>
                            <PermissionProtectedRoute component="users" action="view">
                                <Layout>
                                    <UsersAndTeams />
                                </Layout>
                            </PermissionProtectedRoute>
                        </ProtectedRoute>
                    } />
                    <Route path="/planning" element={
                        <ProtectedRoute>
                            <PermissionProtectedRoute component="planning" action="view">
                                <Layout>
                                    <Planning />
                                </Layout>
                            </PermissionProtectedRoute>
                        </ProtectedRoute>
                    } />
                    <Route path="/planning-administrateur" element={
                        <ProtectedRoute>
                            <PermissionProtectedRoute component="planning_administrateur" action="view">
                                <Layout>
                                    <PlanningAdministrateur />
                                </Layout>
                            </PermissionProtectedRoute>
                        </ProtectedRoute>
                    } />
                    <Route path="/contacts" element={
                        <ProtectedRoute>
                            <PermissionProtectedRoute component="contacts" action="view">
                                <Layout>
                                    <Contacts onSelectContact={() => {}} />
                                </Layout>
                            </PermissionProtectedRoute>
                        </ProtectedRoute>
                    } />
                    <Route path="/fosse" element={
                        <ProtectedRoute>
                            <PermissionProtectedRoute component="fosse" action="view">
                                <Layout>
                                    <Fosse onSelectContact={() => {}} />
                                </Layout>
                            </PermissionProtectedRoute>
                        </ProtectedRoute>
                    } />
                    <Route path="/fosse/configuration" element={
                        <ProtectedRoute>
                            <PermissionProtectedRoute component="fosse" action="create">
                                <Layout>
                                    <FosseConfiguration />
                                </Layout>
                            </PermissionProtectedRoute>
                        </ProtectedRoute>
                    } />
                    <Route path="/contacts/add" element={
                        <ProtectedRoute>
                            <PermissionProtectedRoute component="contacts" action="create">
                                <Layout>
                                    <AddContact />
                                </Layout>
                            </PermissionProtectedRoute>
                        </ProtectedRoute>
                    } />
                    <Route path="/contacts/import" element={
                        <ProtectedRoute>
                            <PermissionProtectedRoute component="contacts" action="create">
                                <Layout>
                                    <CsvImport />
                                </Layout>
                            </PermissionProtectedRoute>
                        </ProtectedRoute>
                    } />
                    <Route path="/contacts/migration" element={
                        <ProtectedRoute>
                            <PermissionProtectedRoute component="contacts" action="create">
                                <Layout>
                                    <MigrationPage />
                                </Layout>
                            </PermissionProtectedRoute>
                        </ProtectedRoute>
                    } />
                    <Route path="/contacts/:id" element={
                        <ProtectedRoute>
                            <Layout>
                                <ContactDetailWrapper />
                            </Layout>
                        </ProtectedRoute>
                    } />
                    <Route path="/settings" element={
                        <ProtectedRoute>
                            <SettingsPermissionWrapper>
                                <Layout>
                                    <Settings />
                                </Layout>
                            </SettingsPermissionWrapper>
                        </ProtectedRoute>
                    } />
                    <Route path="/mails" element={
                        <ProtectedRoute>
                            <PermissionProtectedRoute component="mails" action="view">
                                <Layout>
                                    <Mails />
                                </Layout>
                            </PermissionProtectedRoute>
                        </ProtectedRoute>
                    } />
                    <Route path="/chat" element={
                        <ProtectedRoute>
                            <Layout>
                                <Chat />
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
                    </>
                } />
            </UserProvider>
        </Router>
    );
}

export default App;

