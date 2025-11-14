import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Label } from './ui/label';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { Wallet } from 'lucide-react';

interface ContactWalletProps {
  contact: any;
}

// Mock data for wallet evolution - in production, this would come from the API
const generateMockEvolutionData = (): { date: string; value: number }[] => {
  const data: { date: string; value: number }[] = [];
  const today = new Date();
  for (let i = 30; i >= 0; i--) {
    const date = new Date(today);
    date.setDate(date.getDate() - i);
    data.push({
      date: date.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' }),
      value: 50000 + Math.random() * 10000 + i * 100
    });
  }
  return data;
};

export function ContactWallet({ contact }: ContactWalletProps) {
  // Get wallet data from contact object or use defaults
  const investedCapital = contact?.investedCapital || 0;
  const tradingPortfolio = contact?.tradingPortfolio || 0;
  const bonus = contact?.bonus || 0;
  
  // Calculate available funds on frontend
  const availableFunds = investedCapital - tradingPortfolio - bonus;
  
  const walletData = {
    investedCapital,
    availableFunds: Math.max(0, availableFunds), // Ensure non-negative
    tradingPortfolio,
    bonus,
  };

  const evolutionData = generateMockEvolutionData();

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('fr-FR', {
      style: 'currency',
      currency: 'EUR',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(amount);
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <Wallet className="w-5 h-5" />
          <CardTitle>Wallet</CardTitle>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Wallet Summary */}
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1">
            <Label className="text-slate-600 text-sm">Capital investi</Label>
            <p className="text-lg font-semibold text-slate-900">
              {formatCurrency(walletData.investedCapital)}
            </p>
          </div>
          <div className="space-y-1">
            <Label className="text-slate-600 text-sm">Fonds disponible</Label>
            <p className="text-lg font-semibold text-green-600">
              {formatCurrency(walletData.availableFunds)}
            </p>
          </div>
          <div className="space-y-1">
            <Label className="text-slate-600 text-sm">Wallet trading</Label>
            <p className="text-lg font-semibold text-blue-600">
              {formatCurrency(walletData.tradingPortfolio)}
            </p>
          </div>
          <div className="space-y-1">
            <Label className="text-slate-600 text-sm">Bonus</Label>
            <p className="text-lg font-semibold text-purple-600">
              {formatCurrency(walletData.bonus)}
            </p>
          </div>
        </div>

        {/* Evolution Chart */}
        <div className="mt-6">
          <Label className="text-slate-700 font-semibold mb-4 block">
            Évolution au cours du temps
          </Label>
          <ResponsiveContainer width="100%" height={250}>
            <LineChart data={evolutionData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis 
                dataKey="date" 
                stroke="#64748b"
                fontSize={12}
              />
              <YAxis 
                stroke="#64748b"
                fontSize={12}
                tickFormatter={(value) => `${(value / 1000).toFixed(0)}k`}
              />
              <Tooltip 
                formatter={(value: number) => formatCurrency(value)}
                contentStyle={{
                  backgroundColor: 'white',
                  border: '1px solid #e2e8f0',
                  borderRadius: '6px',
                  padding: '8px'
                }}
              />
              <Legend />
              <Line 
                type="monotone" 
                dataKey="value" 
                stroke="#3b82f6" 
                strokeWidth={2}
                dot={{ fill: '#3b82f6', r: 4 }}
                activeDot={{ r: 6 }}
                name="Valeur du wallet"
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}


