import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Filter, Eye } from 'lucide-react';
import { apiCall } from '../utils/api';
import '../styles/PageHeader.css';

interface TransactionsProps {
  user: any;
}

export function Transactions({ user }: TransactionsProps) {
  const [transactions, setTransactions] = useState<any[]>([]);
  const [clients, setClients] = useState<any[]>([]);
  const [teams, setTeams] = useState<any[]>([]);
  const [filters, setFilters] = useState({
    dateFrom: '',
    dateTo: '',
    type: 'all',
    status: 'all',
    teamId: 'all'
  });

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    try {
      const [transactionsData, clientsData, teamsData] = await Promise.all([
        apiCall('/transactions'),
        apiCall('/clients'),
        apiCall('/teams')
      ]);
      
      setTransactions(transactionsData.transactions || []);
      setClients(clientsData.clients || []);
      setTeams(teamsData.teams || []);
    } catch (error) {
      console.error('Error loading transactions:', error);
    }
  }

  const filteredTransactions = transactions.filter(transaction => {
    const matchesDateFrom = !filters.dateFrom || new Date(transaction.createdAt) >= new Date(filters.dateFrom);
    const matchesDateTo = !filters.dateTo || new Date(transaction.createdAt) <= new Date(filters.dateTo);
    const matchesType = filters.type === 'all' || transaction.type === filters.type;
    const matchesStatus = filters.status === 'all' || transaction.status === filters.status;
    
    return matchesDateFrom && matchesDateTo && matchesType && matchesStatus;
  });

  return (
    <div className="space-y-6">
      <div className="page-header-section">
        <h1 className="page-title">Transactions</h1>
        <p className="page-subtitle">Gestion de toutes les transactions</p>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Filter className="w-5 h-5" />
            Filtres
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4">
            <div className="space-y-2">
              <Label>Date début</Label>
              <Input
                type="date"
                value={filters.dateFrom}
                onChange={(e) => setFilters({ ...filters, dateFrom: e.target.value })}
              />
            </div>
            
            <div className="space-y-2">
              <Label>Date fin</Label>
              <Input
                type="date"
                value={filters.dateTo}
                onChange={(e) => setFilters({ ...filters, dateTo: e.target.value })}
              />
            </div>
            
            <div className="space-y-2">
              <Label>Type</Label>
              <Select value={filters.type} onValueChange={(value) => setFilters({ ...filters, type: value })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tous les types</SelectItem>
                  <SelectItem value="depot">Dépôt</SelectItem>
                  <SelectItem value="retrait">Retrait</SelectItem>
                  <SelectItem value="bonus">Bonus</SelectItem>
                  <SelectItem value="achat">Achat</SelectItem>
                  <SelectItem value="vente">Vente</SelectItem>
                  <SelectItem value="interets">Intérêts</SelectItem>
                  <SelectItem value="trade">Trade</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <div className="space-y-2">
              <Label>Statut</Label>
              <Select value={filters.status} onValueChange={(value) => setFilters({ ...filters, status: value })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tous les statuts</SelectItem>
                  <SelectItem value="en attente">En attente</SelectItem>
                  <SelectItem value="validé">Validé</SelectItem>
                  <SelectItem value="confirmé">Confirmé</SelectItem>
                  <SelectItem value="terminé">Terminé</SelectItem>
                  <SelectItem value="en cours">En cours</SelectItem>
                  <SelectItem value="clôturé">Clôturé</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <div className="space-y-2">
              <Label>Équipe</Label>
              <Select value={filters.teamId} onValueChange={(value) => setFilters({ ...filters, teamId: value })}>
                <SelectTrigger>
                  <SelectValue />
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

      {/* Transactions List */}
      <Card>
        <CardHeader>
          <CardTitle>Liste des transactions ({filteredTransactions.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {filteredTransactions.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-200">
                    <th className="text-left py-3 px-4">Date</th>
                    <th className="text-left py-3 px-4">Client</th>
                    <th className="text-left py-3 px-4">Type</th>
                    <th className="text-left py-3 px-4">Description</th>
                    <th className="text-left py-3 px-4">Montant</th>
                    <th className="text-left py-3 px-4">Statut</th>
                    <th className="text-right py-3 px-4">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredTransactions.map((transaction) => {
                    const client = clients.find(c => c.id === transaction.clientId);
                    
                    return (
                      <tr key={transaction.id} className="border-b border-slate-100 hover:bg-slate-50">
                        <td className="py-3 px-4">
                          {new Date(transaction.createdAt).toLocaleDateString('fr-FR')}
                        </td>
                        <td className="py-3 px-4">
                          {client ? `${client.firstName} ${client.lastName}` : '-'}
                        </td>
                        <td className="py-3 px-4">
                          <span className="capitalize px-2 py-1 bg-blue-100 text-blue-700 rounded text-xs">
                            {transaction.type}
                          </span>
                        </td>
                        <td className="py-3 px-4 max-w-xs truncate">
                          {transaction.description || '-'}
                        </td>
                        <td className="py-3 px-4">
                          <span className={transaction.type === 'retrait' ? 'text-red-600' : 'text-green-600'}>
                            {transaction.type === 'retrait' ? '-' : '+'}{transaction.amount?.toLocaleString('fr-FR')} €
                          </span>
                        </td>
                        <td className="py-3 px-4">
                          <span className="px-2 py-1 bg-slate-100 rounded text-xs">
                            {transaction.status}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-right">
                          <Button variant="ghost" size="sm">
                            <Eye className="w-4 h-4" />
                          </Button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-sm text-slate-500">Aucune transaction trouvée</p>
          )}
        </CardContent>
      </Card>

      {/* Statistics */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="text-center">
              <p className="text-sm text-slate-600 mb-1">Total des dépôts</p>
              <p className="text-green-600">
                {filteredTransactions
                  .filter(t => t.type === 'depot')
                  .reduce((sum, t) => sum + (t.amount || 0), 0)
                  .toLocaleString('fr-FR')} €
              </p>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="pt-6">
            <div className="text-center">
              <p className="text-sm text-slate-600 mb-1">Total des retraits</p>
              <p className="text-red-600">
                {filteredTransactions
                  .filter(t => t.type === 'retrait')
                  .reduce((sum, t) => sum + (t.amount || 0), 0)
                  .toLocaleString('fr-FR')} €
              </p>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="pt-6">
            <div className="text-center">
              <p className="text-sm text-slate-600 mb-1">En attente</p>
              <p className="text-orange-600">
                {filteredTransactions
                  .filter(t => t.status === 'en attente')
                  .reduce((sum, t) => sum + (t.amount || 0), 0)
                  .toLocaleString('fr-FR')} €
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
