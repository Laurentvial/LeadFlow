import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Label } from './ui/label';
import { apiCall } from '../utils/api';
import { toast } from 'sonner';

interface ContactTransactionsTabProps {
  contactId: string;
}

interface Transaction {
  id: string;
  contactId: string | null;
  type: 'Retrait' | 'Depot' | 'Ouverture';
  status: 'pending' | 'completed' | 'cancelled' | 'failed' | 'to_verify';
  payment_type: 'carte' | 'virement' | '';
  ribId: string | null;
  ribText: string | null;
  amount: number;
  date: string;
  comment: string;
  createdBy: string;
  created_at: string;
  updated_at: string;
  platform?: string;
  bonus?: boolean;
}

export function ContactTransactionsTab({ contactId }: ContactTransactionsTabProps) {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);

  useEffect(() => {
    loadTransactions(1);
  }, [contactId]);

  async function loadTransactions(pageNum: number = 1, append: boolean = false) {
    try {
      if (pageNum === 1) {
        setLoading(true);
      } else {
        setLoadingMore(true);
      }

      const data = await apiCall(`/api/transactions/?contactId=${contactId}&page=${pageNum}&page_size=20`);
      const transactionsList = data.transactions || [];
      
      if (append) {
        setTransactions(prev => [...prev, ...transactionsList]);
      } else {
        setTransactions(transactionsList);
      }
      
      setHasMore(data.has_next || false);
      setPage(pageNum);
    } catch (error: any) {
      console.error('Error loading transactions:', error);
      if (!error.isNetworkError) {
        toast.error('Erreur lors du chargement des transactions');
      }
      if (!append) {
        setTransactions([]);
      }
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }

  async function handleLoadMore() {
    if (!hasMore || loadingMore) return;
    await loadTransactions(page + 1, true);
  }

  function formatDate(dateString: string): string {
    try {
      const date = new Date(dateString);
      return date.toLocaleString('fr-FR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch {
      return dateString;
    }
  }

  function formatAmount(amount: number): string {
    return new Intl.NumberFormat('fr-FR', {
      style: 'currency',
      currency: 'EUR'
    }).format(amount);
  }

  function getStatusLabel(status: string): string {
    const labels: { [key: string]: string } = {
      'pending': 'En attente',
      'completed': 'Terminé',
      'cancelled': 'Annulé',
      'failed': 'Échoué',
      'to_verify': 'A vérifier'
    };
    return labels[status] || status;
  }

  function getStatusColor(status: string): React.CSSProperties {
    const colors: { [key: string]: React.CSSProperties } = {
      'pending': { backgroundColor: '#dbeafe', color: '#000000' }, // blue-100 - En attente
      'completed': { backgroundColor: '#bbf7d0', color: '#000000' }, // green-200 - Terminé
      'cancelled': { backgroundColor: '#fee2e2', color: '#000000' }, // red-100 - Annulé
      'failed': { backgroundColor: '#f3e8ff', color: '#000000' }, // purple-100 - Échoué
      'to_verify': { backgroundColor: '#ffedd5', color: '#000000' } // orange-100 - A vérifier
    };
    return colors[status] || { backgroundColor: '#f3f4f6', color: '#000000' };
  }

  function getTypeColor(type: string): React.CSSProperties {
    if (type === 'Depot') return { backgroundColor: '#bbf7d0', color: '#000000' }; // green-200 - Depot
    if (type === 'Ouverture') return { backgroundColor: '#ffedd5', color: '#000000' }; // orange-100 - Ouverture
    return { backgroundColor: '#dbeafe', color: '#000000' }; // blue-100 - Retrait
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Transactions</CardTitle>
      </CardHeader>
      <CardContent>
        {loading ? (
          <p className="text-slate-500 text-center py-8">Chargement...</p>
        ) : transactions.length > 0 ? (
          <div className="space-y-3">
            {transactions.map((transaction) => (
              <div 
                key={transaction.id} 
                className="p-4 border border-slate-200 hover:bg-slate-50 transition-colors"
              >
                <div className="space-y-2">
                    <div className="flex items-center gap-3 flex-wrap">
                      <span className="px-2 py-1 rounded text-xs font-medium inline-block" style={getTypeColor(transaction.type)}>
                        {transaction.type}
                      </span>
                      {transaction.bonus && (
                        <span className="px-2 py-1 rounded text-xs font-medium inline-block" style={{ backgroundColor: '#f3e8ff', color: '#000000' }}>
                          Bonus
                        </span>
                      )}
                      <span className="px-2 py-1 rounded text-xs font-medium inline-block" style={getStatusColor(transaction.status)}>
                        {getStatusLabel(transaction.status)}
                      </span>
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm">
                      <div>
                        <Label className="text-xs text-slate-500">Montant</Label>
                        <p className="font-semibold text-slate-900">{formatAmount(transaction.amount)}</p>
                      </div>
                      <div>
                        <Label className="text-xs text-slate-500">Date</Label>
                        <p className="text-slate-700">{formatDate(transaction.date)}</p>
                      </div>
                      {transaction.payment_type && (
                        <div>
                          <Label className="text-xs text-slate-500">Mode de paiement</Label>
                          <p className="text-slate-700">
                            {transaction.payment_type === 'carte' ? 'Carte' : transaction.payment_type === 'virement' ? 'Virement' : '-'}
                          </p>
                        </div>
                      )}
                      {transaction.ribText && (
                        <div>
                          <Label className="text-xs text-slate-500">RIB</Label>
                          <p className="text-slate-700 text-xs">{transaction.ribText}</p>
                        </div>
                      )}
                      {transaction.platform && (
                        <div>
                          <Label className="text-xs text-slate-500">Plateforme</Label>
                          <p className="text-slate-700">{transaction.platform}</p>
                        </div>
                      )}
                      {transaction.createdBy && (
                        <div>
                          <Label className="text-xs text-slate-500">Créé par</Label>
                          <p className="text-slate-700">{transaction.createdBy}</p>
                        </div>
                      )}
                    </div>
                    
                    {transaction.comment && (
                      <div>
                        <Label className="text-xs text-slate-500">Commentaire</Label>
                        <p className="text-slate-700 text-sm mt-1">{transaction.comment}</p>
                      </div>
                    )}
                </div>
              </div>
            ))}
            
            {hasMore && (
              <div className="flex justify-center pt-4">
                <Button
                  variant="outline"
                  onClick={handleLoadMore}
                  disabled={loadingMore}
                >
                  {loadingMore ? 'Chargement...' : 'Charger plus'}
                </Button>
              </div>
            )}
          </div>
        ) : (
          <p className="text-slate-500 text-center py-8">Aucune transaction disponible</p>
        )}
      </CardContent>
    </Card>
  );
}

