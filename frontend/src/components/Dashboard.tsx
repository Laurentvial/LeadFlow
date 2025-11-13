import React from 'react';
import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { 
  TrendingUp, 
  Clock, 
  FileText, 
  Calendar, 
  Users as UsersIcon, 
  DollarSign,
  Mail
} from 'lucide-react';
import { apiCall } from '../utils/api';
import LoadingIndicator from './LoadingIndicator';
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
  const [selectedTeam, setSelectedTeam] = useState<string>('all');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    try {
      const [statsResponse, teamsResponse] = await Promise.all([
        apiCall('/api/stats/'),
        apiCall('/api/teams/')
      ]);
      
      setStats(statsResponse);
      setTeams(teamsResponse?.teams || teamsResponse || []);
    } catch (error) {
      console.error('Error loading dashboard:', error);
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="dashboard-loading">
        <LoadingIndicator />
      </div>
    );
  }

  const statCards = [
    { 
      label: 'Chiffre d\'affaires', 
      value: `${(stats?.totalRevenue || 0).toLocaleString('fr-FR')} €`, 
      icon: DollarSign, 
      valueClass: 'dashboard-stat-value-green',
      iconWrapperClass: 'dashboard-stat-icon-wrapper-green'
    },
    { 
      label: 'CA en attente', 
      value: `${(stats?.pendingRevenue || 0).toLocaleString('fr-FR')} €`, 
      icon: Clock, 
      valueClass: 'dashboard-stat-value-orange',
      iconWrapperClass: 'dashboard-stat-icon-wrapper-orange'
    },
    { 
      label: 'Nb de Notes', 
      value: '0', 
      icon: FileText, 
      valueClass: 'dashboard-stat-value-blue',
      iconWrapperClass: 'dashboard-stat-icon-wrapper-blue'
    },
    { 
      label: 'Nb de RDV', 
      value: stats?.totalAppointments || 0, 
      icon: Calendar, 
      valueClass: 'dashboard-stat-value-purple',
      iconWrapperClass: 'dashboard-stat-icon-wrapper-purple'
    },
    { 
      label: 'Nb de leads', 
      value: '0', 
      icon: TrendingUp, 
      valueClass: 'dashboard-stat-value-indigo',
      iconWrapperClass: 'dashboard-stat-icon-wrapper-indigo'
    },
    { 
      label: 'Nb clients', 
      value: stats?.totalClients || 0, 
      icon: UsersIcon, 
      valueClass: 'dashboard-stat-value-pink',
      iconWrapperClass: 'dashboard-stat-icon-wrapper-pink'
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
              <Input 
                type="date" 
                value={dateFrom} 
                onChange={(e) => setDateFrom(e.target.value)} 
              />
            </div>
            <div className="dashboard-filter-field">
              <Label>Au</Label>
              <Input 
                type="date" 
                value={dateTo} 
                onChange={(e) => setDateTo(e.target.value)} 
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
          </div>
        </CardContent>
      </Card>

      {/* Statistics Cards */}
      <div className="dashboard-stats-grid">
        {statCards.map((stat, index) => {
          const Icon = stat.icon;
          return (
            <Card key={index}>
              <CardContent className="dashboard-stat-card-content">
                <div className="dashboard-stat-card-inner">
                  <div className="dashboard-stat-info">
                    <p className="dashboard-stat-label">{stat.label}</p>
                    <p className={stat.valueClass}>{stat.value}</p>
                  </div>
                  <div className={`dashboard-stat-icon-wrapper ${stat.iconWrapperClass}`}>
                    <Icon className="dashboard-stat-icon" />
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Recent Messages */}
      <Card>
        <CardHeader>
          <CardTitle className="dashboard-section-header">
            <Mail className="dashboard-section-icon" />
            Messages récents
          </CardTitle>
        </CardHeader>
        <CardContent>
          {stats?.recentMessages && stats.recentMessages.length > 0 ? (
            <div className="dashboard-messages-list">
              {stats.recentMessages.slice(0, 5).map((message: any) => (
                <div key={message.id} className="dashboard-message-item">
                  <div className="dashboard-message-content">
                    <p className="dashboard-message-subject">{message.subject}</p>
                    <p className="dashboard-message-date">
                      {new Date(message.createdAt).toLocaleDateString('fr-FR')}
                    </p>
                  </div>
                  {!message.read && (
                    <span className="dashboard-message-badge">
                      Non lu
                    </span>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <p className="dashboard-empty-message">Aucun message récent</p>
          )}
        </CardContent>
      </Card>

      {/* Recent Transactions */}
      <Card>
        <CardHeader>
          <CardTitle className="dashboard-section-header">
            <TrendingUp className="dashboard-section-icon" />
            Dernières transactions
          </CardTitle>
        </CardHeader>
        <CardContent>
          {stats?.recentTransactions && stats.recentTransactions.length > 0 ? (
            <div className="dashboard-table-container">
              <table className="dashboard-table">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Type</th>
                    <th>Montant</th>
                    <th>Statut</th>
                  </tr>
                </thead>
                <tbody>
                  {stats.recentTransactions.slice(0, 10).map((transaction: any) => (
                    <tr key={transaction.id}>
                      <td>
                        {new Date(transaction.createdAt).toLocaleDateString('fr-FR')}
                      </td>
                      <td className="dashboard-table-type">{transaction.type}</td>
                      <td>{transaction.amount?.toLocaleString('fr-FR')} €</td>
                      <td>
                        <span className="dashboard-table-badge">
                          {transaction.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="dashboard-empty-message">Aucune transaction récente</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export default Dashboard;