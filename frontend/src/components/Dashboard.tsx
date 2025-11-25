import React from 'react';
import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { DateInput } from './ui/date-input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { 
  TrendingUp, 
  Clock, 
  FileText, 
  Calendar, 
  Users as UsersIcon, 
  UserPlus,
  Target,
  Activity,
  Mail,
  ArrowUpRight
} from 'lucide-react';
import { apiCall } from '../utils/api';
import { useUser } from '../contexts/UserContext';
import '../styles/Dashboard.css';
import '../styles/PageHeader.css';

interface DashboardProps {
  user?: any;
}

export function Dashboard({ user: userProp }: DashboardProps) {
  const { currentUser } = useUser();
  const user = userProp || currentUser;
  const [stats, setStats] = useState<any>(null);
  const [teams, setTeams] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [selectedTeam, setSelectedTeam] = useState<string>('all');
  const [selectedUser, setSelectedUser] = useState<string>('all');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  
  // Loading states for each section
  const [loadingStats, setLoadingStats] = useState(true);
  const [loadingTeams, setLoadingTeams] = useState(true);
  const [loadingUsers, setLoadingUsers] = useState(true);
  
  useEffect(() => {
    loadData();
  }, [selectedTeam, selectedUser, dateFrom, dateTo]);

  async function loadData() {
    // Load teams and users first (needed for filters)
    loadTeams();
    loadUsers();
    // Load stats separately
    loadStats();
  }

  async function loadTeams() {
    setLoadingTeams(true);
    try {
      const teamsResponse = await apiCall('/api/teams/');
      setTeams(teamsResponse?.teams || teamsResponse || []);
    } catch (error) {
      console.error('Error loading teams:', error);
    } finally {
      setLoadingTeams(false);
    }
  }

  async function loadUsers() {
    setLoadingUsers(true);
    try {
      const usersResponse = await apiCall('/api/users/');
      setUsers(usersResponse?.users || usersResponse || []);
    } catch (error) {
      console.error('Error loading users:', error);
    } finally {
      setLoadingUsers(false);
    }
  }

  async function loadStats() {
    setLoadingStats(true);
    try {
      const params = new URLSearchParams();
      if (dateFrom) params.append('dateFrom', dateFrom);
      if (dateTo) params.append('dateTo', dateTo);
      if (selectedTeam !== 'all') params.append('teamId', selectedTeam);
      if (selectedUser !== 'all') params.append('userId', selectedUser);
      
      const url = `/api/stats/${params.toString() ? '?' + params.toString() : ''}`;
      const statsResponse = await apiCall(url);
      setStats(statsResponse);
    } catch (error) {
      console.error('Error loading stats:', error);
    } finally {
      setLoadingStats(false);
    }
  }

  const statCards = [
    { 
      label: 'Total Contacts', 
      value: (stats?.totalContacts || 0).toLocaleString('fr-FR'), 
      icon: UsersIcon, 
      valueClass: 'dashboard-stat-value-blue',
      iconWrapperClass: 'dashboard-stat-icon-wrapper-blue',
      subtitle: `${stats?.contactsToday || 0} aujourd'hui`
    },
    { 
      label: 'Leads', 
      value: (stats?.totalLeads || 0).toLocaleString('fr-FR'), 
      icon: Target, 
      valueClass: 'dashboard-stat-value-indigo',
      iconWrapperClass: 'dashboard-stat-icon-wrapper-indigo',
      subtitle: `${stats?.contactsThisWeek || 0} cette semaine`
    },
    { 
      label: 'Clients', 
      value: (stats?.totalClients || 0).toLocaleString('fr-FR'), 
      icon: UserPlus, 
      valueClass: 'dashboard-stat-value-green',
      iconWrapperClass: 'dashboard-stat-icon-wrapper-green',
      subtitle: `${stats?.contactsThisMonth || 0} ce mois`
    },
    { 
      label: 'Notes', 
      value: (stats?.totalNotes || 0).toLocaleString('fr-FR'), 
      icon: FileText, 
      valueClass: 'dashboard-stat-value-purple',
      iconWrapperClass: 'dashboard-stat-icon-wrapper-purple',
      subtitle: `${stats?.notesToday || 0} aujourd'hui`
    },
    { 
      label: 'Rendez-vous', 
      value: (stats?.totalEvents || 0).toLocaleString('fr-FR'), 
      icon: Calendar, 
      valueClass: 'dashboard-stat-value-orange',
      iconWrapperClass: 'dashboard-stat-icon-wrapper-orange',
      subtitle: `${stats?.eventsToday || 0} aujourd'hui`
    },
    { 
      label: 'Utilisateurs actifs', 
      value: (stats?.totalUsers || 0).toLocaleString('fr-FR'), 
      icon: Activity, 
      valueClass: 'dashboard-stat-value-pink',
      iconWrapperClass: 'dashboard-stat-icon-wrapper-pink',
      subtitle: 'Équipe'
    },
  ];

  return (
    <div className="dashboard-container">
      <div className="page-header-section">
        <h1 className="page-title">Dashboard</h1>
        <p className="page-subtitle">Vue d'ensemble de votre activité</p>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle>Filtres</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="dashboard-filters-grid">
            <div className="dashboard-filter-field">
              <Label>Du</Label>
              <DateInput 
                value={dateFrom} 
                onChange={(value) => setDateFrom(value)} 
              />
            </div>
            <div className="dashboard-filter-field">
              <Label>Au</Label>
              <DateInput 
                value={dateTo} 
                onChange={(value) => setDateTo(value)} 
              />
            </div>
            <div className="dashboard-filter-field">
              <Label>Équipe</Label>
              <Select value={selectedTeam} onValueChange={setSelectedTeam}>
                <SelectTrigger>
                  <SelectValue placeholder="Toutes les équipes" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Toutes les équipes</SelectItem>
                  {teams.map((team) => (
                    <SelectItem key={team.id} value={team.id}>
                      {team.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="dashboard-filter-field">
              <Label>Utilisateur</Label>
              <Select value={selectedUser} onValueChange={setSelectedUser}>
                <SelectTrigger>
                  <SelectValue placeholder="Tous les utilisateurs" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tous les utilisateurs</SelectItem>
                  {users.map((user) => {
                    const userName = user.firstName && user.lastName 
                      ? `${user.firstName} ${user.lastName}`.trim()
                      : user.username || user.email || 'Utilisateur';
                    return (
                      <SelectItem key={user.id} value={user.djangoUserId || user.id}>
                        {userName}
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Statistics Cards */}
      <div className="dashboard-stats-grid">
        {statCards.map((stat, index) => {
          const Icon = stat.icon;
          const isLoading = loadingStats;
          return (
            <Card key={index}>
              <CardContent className="dashboard-stat-card-content">
                {isLoading ? (
                  <div style={{ padding: '20px', textAlign: 'center' }}>
                    <p style={{ color: '#64748b', fontSize: '14px' }}>Chargement...</p>
                  </div>
                ) : (
                  <div className="dashboard-stat-card-inner">
                    <div className="dashboard-stat-info">
                      <p className="dashboard-stat-label">{stat.label}</p>
                      <p className={stat.valueClass}>{stat.value}</p>
                      {stat.subtitle && (
                        <p className="dashboard-stat-subtitle">{stat.subtitle}</p>
                      )}
                    </div>
                    <div className={`dashboard-stat-icon-wrapper ${stat.iconWrapperClass}`}>
                      <Icon className="dashboard-stat-icon" />
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      <div className="dashboard-sections-grid">
        {/* Top Sources */}
        <Card>
          <CardHeader>
            <CardTitle className="dashboard-section-header">
              <TrendingUp className="dashboard-section-icon" />
              Top Sources
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loadingStats ? (
              <p style={{ color: '#64748b', fontSize: '14px', textAlign: 'center', padding: '20px' }}>Chargement...</p>
            ) : stats?.topSources && stats.topSources.length > 0 ? (
              <div className="dashboard-list">
                {stats.topSources.map((source: any, index: number) => (
                  <div key={index} className="dashboard-list-item">
                    <div className="dashboard-list-content">
                      <p className="dashboard-list-name">{source.name}</p>
                      <p className="dashboard-list-count">{source.count} contacts</p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="dashboard-empty-message">Aucune source</p>
            )}
          </CardContent>
        </Card>

        {/* Top Teleoperators */}
        <Card>
          <CardHeader>
            <CardTitle className="dashboard-section-header">
              <UsersIcon className="dashboard-section-icon" />
              Top Téléopérateurs
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loadingStats ? (
              <p style={{ color: '#64748b', fontSize: '14px', textAlign: 'center', padding: '20px' }}>Chargement...</p>
            ) : stats?.topTeleoperators && stats.topTeleoperators.length > 0 ? (
              <div className="dashboard-list">
                {stats.topTeleoperators.map((teleoperator: any, index: number) => (
                  <div key={index} className="dashboard-list-item">
                    <div className="dashboard-list-content">
                      <p className="dashboard-list-name">{teleoperator.name}</p>
                      <p className="dashboard-list-count">{teleoperator.count} contacts</p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="dashboard-empty-message">Aucun téléopérateur</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Upcoming Events */}
      <Card>
        <CardHeader>
          <CardTitle className="dashboard-section-header">
            <Calendar className="dashboard-section-icon" />
            Prochains rendez-vous (7 jours)
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loadingStats ? (
            <p style={{ color: '#64748b', fontSize: '14px', textAlign: 'center', padding: '20px' }}>Chargement...</p>
          ) : stats?.upcomingEvents && stats.upcomingEvents.length > 0 ? (
            <div className="dashboard-table-container">
              <table className="dashboard-table">
                <thead>
                  <tr>
                    <th>Date & Heure</th>
                    <th>Contact</th>
                    <th>Utilisateur</th>
                    <th>Commentaire</th>
                  </tr>
                </thead>
                <tbody>
                  {stats.upcomingEvents.map((event: any) => (
                    <tr key={event.id}>
                      <td>
                        {new Date(event.datetime).toLocaleString('fr-FR', {
                          day: '2-digit',
                          month: '2-digit',
                          year: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit'
                        })}
                      </td>
                      <td>{event.contactName || 'N/A'}</td>
                      <td>{event.userName}</td>
                      <td className="dashboard-table-comment">{event.comment || '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="dashboard-empty-message">Aucun rendez-vous à venir</p>
          )}
        </CardContent>
      </Card>

      {/* Recent Contacts */}
      <Card>
        <CardHeader>
          <CardTitle className="dashboard-section-header">
            <ArrowUpRight className="dashboard-section-icon" />
            Contacts récents
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loadingStats ? (
            <p style={{ color: '#64748b', fontSize: '14px', textAlign: 'center', padding: '20px' }}>Chargement...</p>
          ) : stats?.recentContacts && stats.recentContacts.length > 0 ? (
            <div className="dashboard-table-container">
              <table className="dashboard-table">
                <thead>
                  <tr>
                    <th>Nom</th>
                    <th>Statut</th>
                    <th>Source</th>
                    <th>Date de création</th>
                  </tr>
                </thead>
                <tbody>
                  {stats.recentContacts.map((contact: any) => (
                    <tr key={contact.id}>
                      <td>{contact.name}</td>
                      <td>
                        <span className="dashboard-table-badge">
                          {contact.status || 'N/A'}
                        </span>
                      </td>
                      <td>{contact.source || 'N/A'}</td>
                      <td>
                        {new Date(contact.createdAt).toLocaleDateString('fr-FR', {
                          day: '2-digit',
                          month: '2-digit',
                          year: 'numeric'
                        })}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="dashboard-empty-message">Aucun contact récent</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export default Dashboard;