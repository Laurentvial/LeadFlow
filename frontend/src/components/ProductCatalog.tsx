import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { Input } from './ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from './ui/dialog';
import { Label } from './ui/label';
import { TrendingUp, TrendingDown, Search } from 'lucide-react';

const mockProducts = [
  { 
    id: 1, 
    name: 'Apple Inc.', 
    type: 'Action', 
    symbol: 'AAPL', 
    price: 185.40, 
    performance: 12.4, 
    risk: 'Moyen',
    description: 'Leader technologique dans les appareils électroniques grand public'
  },
  { 
    id: 2, 
    name: 'Microsoft Corp.', 
    type: 'Action', 
    symbol: 'MSFT', 
    price: 355.20, 
    performance: 18.2, 
    risk: 'Moyen',
    description: 'Géant du logiciel et des services cloud'
  },
  { 
    id: 3, 
    name: 'Bitcoin', 
    type: 'Crypto', 
    symbol: 'BTC', 
    price: 45500, 
    performance: 145.6, 
    risk: 'Élevé',
    description: 'Première et plus grande crypto-monnaie par capitalisation'
  },
  { 
    id: 4, 
    name: 'Ethereum', 
    type: 'Crypto', 
    symbol: 'ETH', 
    price: 3100, 
    performance: 98.3, 
    risk: 'Élevé',
    description: 'Plateforme blockchain pour contrats intelligents'
  },
  { 
    id: 5, 
    name: 'Livret A+', 
    type: 'Livret', 
    symbol: 'LVA', 
    price: 1, 
    performance: 3.5, 
    risk: 'Faible',
    description: 'Épargne garantie avec taux compétitif'
  },
  { 
    id: 6, 
    name: 'Livret Dynamique', 
    type: 'Livret', 
    symbol: 'LVD', 
    price: 1, 
    performance: 4.2, 
    risk: 'Faible',
    description: 'Livret d\'épargne à taux progressif'
  },
  { 
    id: 7, 
    name: 'Tesla Inc.', 
    type: 'Action', 
    symbol: 'TSLA', 
    price: 258.75, 
    performance: -8.5, 
    risk: 'Élevé',
    description: 'Constructeur de véhicules électriques et solutions énergétiques'
  },
  { 
    id: 8, 
    name: 'Amazon.com Inc.', 
    type: 'Action', 
    symbol: 'AMZN', 
    price: 142.30, 
    performance: 24.1, 
    risk: 'Moyen',
    description: 'Leader du e-commerce et cloud computing'
  },
];

interface ProductCatalogProps {
  userRole: 'client' | 'conseiller';
}

export function ProductCatalog({ userRole }: ProductCatalogProps) {
  const [filterType, setFilterType] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedProduct, setSelectedProduct] = useState<typeof mockProducts[0] | null>(null);
  const [isOrderDialogOpen, setIsOrderDialogOpen] = useState(false);

  const filteredProducts = mockProducts.filter(product => {
    const matchesType = filterType === 'all' || product.type === filterType;
    const matchesSearch = product.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         product.symbol.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesType && matchesSearch;
  });

  const getRiskBadgeVariant = (risk: string) => {
    switch (risk) {
      case 'Faible': return 'default';
      case 'Moyen': return 'secondary';
      case 'Élevé': return 'destructive';
      default: return 'default';
    }
  };

  const handleOrderClick = (product: typeof mockProducts[0]) => {
    setSelectedProduct(product);
    setIsOrderDialogOpen(true);
  };

  return (
    <div className="space-y-6">
      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle>Catalogue de produits</CardTitle>
          <CardDescription>Découvrez nos produits d'investissement</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-slate-400" />
              <Input
                placeholder="Rechercher un produit..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9"
              />
            </div>
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
        </CardContent>
      </Card>

      {/* Products Grid */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {filteredProducts.map((product) => (
          <Card key={product.id} className="hover:shadow-lg transition-shadow">
            <CardHeader>
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <CardTitle className="text-slate-900">{product.name}</CardTitle>
                  <CardDescription>{product.symbol}</CardDescription>
                </div>
                <Badge variant="outline">{product.type}</Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <p className="text-sm text-slate-500 mb-2">{product.description}</p>
              </div>
              
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-slate-500">Prix actuel</p>
                  <p className="text-slate-900">
                    {product.price.toLocaleString('fr-FR', { 
                      style: 'currency', 
                      currency: product.type === 'Livret' ? 'EUR' : 'USD' 
                    })}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-sm text-slate-500">Performance</p>
                  <div className="flex items-center gap-1">
                    {product.performance > 0 ? (
                      <TrendingUp className="h-4 w-4 text-green-600" />
                    ) : (
                      <TrendingDown className="h-4 w-4 text-red-600" />
                    )}
                    <span className={product.performance > 0 ? 'text-green-600' : 'text-red-600'}>
                      {product.performance > 0 ? '+' : ''}{product.performance}%
                    </span>
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-between pt-2">
                <Badge variant={getRiskBadgeVariant(product.risk)}>
                  Risque {product.risk}
                </Badge>
                <Button 
                  size="sm"
                  onClick={() => handleOrderClick(product)}
                >
                  {userRole === 'client' ? 'Investir' : 'Créer ordre'}
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Order Dialog */}
      <Dialog open={isOrderDialogOpen} onOpenChange={setIsOrderDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {userRole === 'client' ? 'Passer un ordre' : 'Créer un ordre pour un client'}
            </DialogTitle>
            <DialogDescription>
              {selectedProduct?.name} ({selectedProduct?.symbol})
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            {userRole === 'conseiller' && (
              <div className="space-y-2">
                <Label htmlFor="client">Client</Label>
                <Select>
                  <SelectTrigger id="client">
                    <SelectValue placeholder="Sélectionner un client" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="client1">Jean Dupont</SelectItem>
                    <SelectItem value="client2">Marie Martin</SelectItem>
                    <SelectItem value="client3">Pierre Bernard</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}
            
            <div className="space-y-2">
              <Label htmlFor="orderType">Type d'ordre</Label>
              <Select>
                <SelectTrigger id="orderType">
                  <SelectValue placeholder="Sélectionner le type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="achat">Achat</SelectItem>
                  <SelectItem value="vente">Vente</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="quantity">Quantité</Label>
              <Input id="quantity" type="number" placeholder="0" />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="price">Prix limite (optionnel)</Label>
              <Input id="price" type="number" placeholder={selectedProduct?.price.toString()} />
            </div>
            
            <div className="p-4 bg-slate-50 rounded-lg">
              <div className="flex justify-between mb-2">
                <span className="text-sm text-slate-600">Prix unitaire</span>
                <span className="text-sm">
                  {selectedProduct?.price.toLocaleString('fr-FR', { 
                    style: 'currency', 
                    currency: selectedProduct.type === 'Livret' ? 'EUR' : 'USD' 
                  })}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm">Total estimé</span>
                <span className="text-slate-900">0.00 EUR</span>
              </div>
            </div>
          </div>
          
          <div className="flex justify-end gap-3">
            <Button variant="outline" onClick={() => setIsOrderDialogOpen(false)}>
              Annuler
            </Button>
            <Button onClick={() => setIsOrderDialogOpen(false)}>
              Confirmer l'ordre
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
