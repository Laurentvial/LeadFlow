import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Textarea } from './ui/textarea';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from './ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from './ui/table';
import { Badge } from './ui/badge';
import { Plus, Edit, Trash2, TrendingUp, DollarSign } from 'lucide-react';

const mockProducts = [
  { id: 1, name: 'Apple Inc.', type: 'Action', symbol: 'AAPL', price: 185.40, performance: 12.4, risk: 'Moyen', status: 'Actif' },
  { id: 2, name: 'Microsoft Corp.', type: 'Action', symbol: 'MSFT', price: 355.20, performance: 18.2, risk: 'Moyen', status: 'Actif' },
  { id: 3, name: 'Bitcoin', type: 'Crypto', symbol: 'BTC', price: 45500, performance: 145.6, risk: 'Élevé', status: 'Actif' },
  { id: 4, name: 'Ethereum', type: 'Crypto', symbol: 'ETH', price: 3100, performance: 98.3, risk: 'Élevé', status: 'Actif' },
  { id: 5, name: 'Livret A+', type: 'Livret', symbol: 'LVA', price: 1, performance: 3.5, risk: 'Faible', status: 'Actif' },
  { id: 6, name: 'Livret Dynamique', type: 'Livret', symbol: 'LVD', price: 1, performance: 4.2, risk: 'Faible', status: 'Actif' },
  { id: 7, name: 'Tesla Inc.', type: 'Action', symbol: 'TSLA', price: 258.75, performance: -8.5, risk: 'Élevé', status: 'Actif' },
  { id: 8, name: 'Cardano', type: 'Crypto', symbol: 'ADA', price: 0.62, performance: 52.1, risk: 'Élevé', status: 'Inactif' },
];

export function GestionProduits() {
  const [products, setProducts] = useState(mockProducts);
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [filterType, setFilterType] = useState<string>('all');

  const filteredProducts = filterType === 'all' 
    ? products 
    : products.filter(p => p.type === filterType);

  const getRiskBadgeVariant = (risk: string) => {
    switch (risk) {
      case 'Faible': return 'default';
      case 'Moyen': return 'secondary';
      case 'Élevé': return 'destructive';
      default: return 'default';
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-slate-900">Gestion des produits d'investissement</h2>
          <p className="text-sm text-slate-500 mt-1">Créez et gérez les produits disponibles sur la plateforme</p>
        </div>
        
        <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              Nouveau produit
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Créer un nouveau produit</DialogTitle>
              <DialogDescription>
                Ajoutez un nouveau produit d'investissement à la plateforme
              </DialogDescription>
            </DialogHeader>
            
            <div className="grid gap-4 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="productName">Nom du produit</Label>
                  <Input id="productName" placeholder="ex: Apple Inc." />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="productSymbol">Symbole</Label>
                  <Input id="productSymbol" placeholder="ex: AAPL" />
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="productType">Type de produit</Label>
                  <Select>
                    <SelectTrigger id="productType">
                      <SelectValue placeholder="Sélectionner un type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="action">Action</SelectItem>
                      <SelectItem value="crypto">Crypto-monnaie</SelectItem>
                      <SelectItem value="livret">Livret d'épargne</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="productRisk">Niveau de risque</Label>
                  <Select>
                    <SelectTrigger id="productRisk">
                      <SelectValue placeholder="Sélectionner le risque" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="faible">Faible</SelectItem>
                      <SelectItem value="moyen">Moyen</SelectItem>
                      <SelectItem value="eleve">Élevé</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="productPrice">Prix initial</Label>
                  <Input id="productPrice" type="number" placeholder="0.00" />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="productPerf">Performance annuelle (%)</Label>
                  <Input id="productPerf" type="number" placeholder="0.0" />
                </div>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="productDesc">Description</Label>
                <Textarea 
                  id="productDesc" 
                  placeholder="Décrivez les caractéristiques du produit..."
                  rows={3}
                />
              </div>
            </div>
            
            <div className="flex justify-end gap-3">
              <Button variant="outline" onClick={() => setIsAddDialogOpen(false)}>
                Annuler
              </Button>
              <Button onClick={() => setIsAddDialogOpen(false)}>
                Créer le produit
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm">Total produits</CardTitle>
            <DollarSign className="h-4 w-4 text-slate-500" />
          </CardHeader>
          <CardContent>
            <div className="text-slate-900">{products.length}</div>
            <p className="text-xs text-slate-500 mt-1">
              {products.filter(p => p.status === 'Actif').length} actifs
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm">Actions</CardTitle>
            <TrendingUp className="h-4 w-4 text-slate-500" />
          </CardHeader>
          <CardContent>
            <div className="text-slate-900">{products.filter(p => p.type === 'Action').length}</div>
            <p className="text-xs text-slate-500 mt-1">
              Performance moy. +7.4%
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm">Crypto-monnaies</CardTitle>
            <TrendingUp className="h-4 w-4 text-slate-500" />
          </CardHeader>
          <CardContent>
            <div className="text-slate-900">{products.filter(p => p.type === 'Crypto').length}</div>
            <p className="text-xs text-slate-500 mt-1">
              Performance moy. +99.0%
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Products Table */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Liste des produits</CardTitle>
            <Select value={filterType} onValueChange={setFilterType}>
              <SelectTrigger className="w-48">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tous les types</SelectItem>
                <SelectItem value="Action">Actions</SelectItem>
                <SelectItem value="Crypto">Crypto-monnaies</SelectItem>
                <SelectItem value="Livret">Livrets</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nom</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Symbole</TableHead>
                <TableHead className="text-right">Prix</TableHead>
                <TableHead className="text-right">Performance</TableHead>
                <TableHead>Risque</TableHead>
                <TableHead>Statut</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredProducts.map((product) => (
                <TableRow key={product.id}>
                  <TableCell>{product.name}</TableCell>
                  <TableCell>
                    <Badge variant="outline">{product.type}</Badge>
                  </TableCell>
                  <TableCell>{product.symbol}</TableCell>
                  <TableCell className="text-right">
                    {product.price.toLocaleString('fr-FR', { 
                      style: 'currency', 
                      currency: product.type === 'Livret' ? 'EUR' : 'USD' 
                    })}
                  </TableCell>
                  <TableCell className="text-right">
                    <span className={product.performance > 0 ? 'text-green-600' : 'text-red-600'}>
                      {product.performance > 0 ? '+' : ''}{product.performance}%
                    </span>
                  </TableCell>
                  <TableCell>
                    <Badge variant={getRiskBadgeVariant(product.risk)}>
                      {product.risk}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant={product.status === 'Actif' ? 'default' : 'secondary'}>
                      {product.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      <Button variant="ghost" size="sm">
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="sm">
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
