import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Textarea } from './ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from './ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { Badge } from './ui/badge';
import { Plus, Pencil, Trash2, Package, Folder } from 'lucide-react';
import { apiCall } from '../utils/api';
import '../styles/PageHeader.css';

interface PlacementsProps {
  user: any;
}

export function Placements({ user }: PlacementsProps) {
  const [products, setProducts] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [isCategoryDialogOpen, setIsCategoryDialogOpen] = useState(false);
  const [isProductDialogOpen, setIsProductDialogOpen] = useState(false);
  
  const [categoryForm, setCategoryForm] = useState({
    title: '',
    url: '',
    subcategories: [] as string[]
  });
  
  const [productForm, setProductForm] = useState({
    name: '',
    reference: '',
    categoryId: '',
    price: '',
    profitability: '',
    duration: '',
    description: ''
  });

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    try {
      const [productsData, categoriesData] = await Promise.all([
        apiCall('/products'),
        apiCall('/categories')
      ]);
      
      setProducts(productsData.products || []);
      setCategories(categoriesData.categories || []);
    } catch (error) {
      console.error('Error loading placements:', error);
    }
  }

  async function handleCreateCategory(e: React.FormEvent) {
    e.preventDefault();
    
    try {
      await apiCall('/categories', {
        method: 'POST',
        body: JSON.stringify(categoryForm)
      });
      
      setIsCategoryDialogOpen(false);
      setCategoryForm({ title: '', url: '', subcategories: [] });
      loadData();
    } catch (error) {
      console.error('Error creating category:', error);
    }
  }

  async function handleCreateProduct(e: React.FormEvent) {
    e.preventDefault();
    
    try {
      await apiCall('/products', {
        method: 'POST',
        body: JSON.stringify({
          ...productForm,
          price: parseFloat(productForm.price),
          profitability: parseFloat(productForm.profitability)
        })
      });
      
      setIsProductDialogOpen(false);
      setProductForm({
        name: '',
        reference: '',
        categoryId: '',
        price: '',
        profitability: '',
        duration: '',
        description: ''
      });
      loadData();
    } catch (error) {
      console.error('Error creating product:', error);
    }
  }

  async function handleToggleProductActive(productId: string) {
    try {
      await apiCall(`/products/${productId}/toggle-active`, { method: 'POST' });
      loadData();
    } catch (error) {
      console.error('Error toggling product status:', error);
    }
  }

  async function handleDeleteCategory(categoryId: string) {
    if (!confirm('Supprimer cette catégorie ?')) return;
    
    try {
      await apiCall(`/categories/${categoryId}`, { method: 'DELETE' });
      loadData();
    } catch (error) {
      console.error('Error deleting category:', error);
    }
  }

  async function handleDeleteProduct(productId: string) {
    if (!confirm('Supprimer ce produit ?')) return;
    
    try {
      await apiCall(`/products/${productId}`, { method: 'DELETE' });
      loadData();
    } catch (error) {
      console.error('Error deleting product:', error);
    }
  }

  function addSubcategory() {
    setCategoryForm({
      ...categoryForm,
      subcategories: [...categoryForm.subcategories, '']
    });
  }

  function updateSubcategory(index: number, value: string) {
    const newSubcategories = [...categoryForm.subcategories];
    newSubcategories[index] = value;
    setCategoryForm({ ...categoryForm, subcategories: newSubcategories });
  }

  function removeSubcategory(index: number) {
    const newSubcategories = categoryForm.subcategories.filter((_, i) => i !== index);
    setCategoryForm({ ...categoryForm, subcategories: newSubcategories });
  }

  return (
    <div className="space-y-6">
      <div className="page-header-section">
        <h1 className="page-title">Placements</h1>
        <p className="page-subtitle">Gestion des produits financiers et catégories</p>
      </div>

      <Tabs defaultValue="products" className="space-y-6">
        <TabsList>
          <TabsTrigger value="products">Produits financiers</TabsTrigger>
          <TabsTrigger value="categories">Catégories</TabsTrigger>
        </TabsList>

        {/* Products Tab */}
        <TabsContent value="products" className="space-y-6">
          <div className="flex justify-end">
            <Dialog open={isProductDialogOpen} onOpenChange={setIsProductDialogOpen}>
              <DialogTrigger asChild>
                <Button>
                  <Plus className="w-4 h-4 mr-2" />
                  Créer un produit
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>Nouveau produit financier</DialogTitle>
                </DialogHeader>
                <form onSubmit={handleCreateProduct} className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Nom du produit</Label>
                      <Input
                        value={productForm.name}
                        onChange={(e) => setProductForm({ ...productForm, name: e.target.value })}
                        required
                      />
                    </div>
                    
                    <div className="space-y-2">
                      <Label>Référence</Label>
                      <Input
                        value={productForm.reference}
                        onChange={(e) => setProductForm({ ...productForm, reference: e.target.value })}
                        required
                      />
                    </div>
                  </div>
                  
                  <div className="space-y-2">
                    <Label>Catégorie</Label>
                    <Select value={productForm.categoryId} onValueChange={(value) => setProductForm({ ...productForm, categoryId: value })}>
                      <SelectTrigger>
                        <SelectValue placeholder="Sélectionner une catégorie" />
                      </SelectTrigger>
                      <SelectContent>
                        {categories.map((category) => (
                          <SelectItem key={category.id} value={category.id}>
                            {category.title}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  
                  <div className="grid grid-cols-3 gap-4">
                    <div className="space-y-2">
                      <Label>Prix (€)</Label>
                      <Input
                        type="number"
                        step="0.01"
                        value={productForm.price}
                        onChange={(e) => setProductForm({ ...productForm, price: e.target.value })}
                        required
                      />
                    </div>
                    
                    <div className="space-y-2">
                      <Label>Rentabilité (%)</Label>
                      <Input
                        type="number"
                        step="0.01"
                        value={productForm.profitability}
                        onChange={(e) => setProductForm({ ...productForm, profitability: e.target.value })}
                        required
                      />
                    </div>
                    
                    <div className="space-y-2">
                      <Label>Durée</Label>
                      <Input
                        value={productForm.duration}
                        onChange={(e) => setProductForm({ ...productForm, duration: e.target.value })}
                        placeholder="Ex: 12 mois"
                      />
                    </div>
                  </div>
                  
                  <div className="space-y-2">
                    <Label>Description</Label>
                    <Textarea
                      value={productForm.description}
                      onChange={(e) => setProductForm({ ...productForm, description: e.target.value })}
                      rows={4}
                    />
                  </div>
                  
                  <div className="flex gap-2 justify-end">
                    <Button type="button" variant="outline" onClick={() => setIsProductDialogOpen(false)}>
                      Annuler
                    </Button>
                    <Button type="submit">Créer</Button>
                  </div>
                </form>
              </DialogContent>
            </Dialog>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Liste des produits</CardTitle>
            </CardHeader>
            <CardContent>
              {products.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-slate-200">
                        <th className="text-left py-3 px-4">Référence</th>
                        <th className="text-left py-3 px-4">Nom</th>
                        <th className="text-left py-3 px-4">Catégorie</th>
                        <th className="text-left py-3 px-4">Prix</th>
                        <th className="text-left py-3 px-4">Rentabilité</th>
                        <th className="text-left py-3 px-4">Durée</th>
                        <th className="text-left py-3 px-4">Statut</th>
                        <th className="text-right py-3 px-4">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {products.map((product) => {
                        const category = categories.find(c => c.id === product.categoryId);
                        
                        return (
                          <tr key={product.id} className="border-b border-slate-100 hover:bg-slate-50">
                            <td className="py-3 px-4 text-slate-600">{product.reference}</td>
                            <td className="py-3 px-4">{product.name}</td>
                            <td className="py-3 px-4">
                              {category ? (
                                <Badge variant="outline">{category.title}</Badge>
                              ) : (
                                '-'
                              )}
                            </td>
                            <td className="py-3 px-4">{product.price?.toLocaleString('fr-FR')} €</td>
                            <td className="py-3 px-4 text-green-600">{product.profitability}%</td>
                            <td className="py-3 px-4">{product.duration || '-'}</td>
                            <td className="py-3 px-4">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleToggleProductActive(product.id)}
                                className={product.active ? 'text-green-600' : 'text-red-600'}
                              >
                                {product.active ? 'Actif' : 'Inactif'}
                              </Button>
                            </td>
                            <td className="py-3 px-4">
                              <div className="flex gap-2 justify-end">
                                <Button variant="ghost" size="sm">
                                  <Pencil className="w-4 h-4" />
                                </Button>
                                <Button 
                                  variant="ghost" 
                                  size="sm"
                                  onClick={() => handleDeleteProduct(product.id)}
                                  className="text-red-600 hover:text-red-700"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </Button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="text-sm text-slate-500">Aucun produit créé</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Categories Tab */}
        <TabsContent value="categories" className="space-y-6">
          <div className="flex justify-end">
            <Dialog open={isCategoryDialogOpen} onOpenChange={setIsCategoryDialogOpen}>
              <DialogTrigger asChild>
                <Button>
                  <Plus className="w-4 h-4 mr-2" />
                  Créer une catégorie
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>Nouvelle catégorie</DialogTitle>
                </DialogHeader>
                <form onSubmit={handleCreateCategory} className="space-y-4">
                  <div className="space-y-2">
                    <Label>Titre</Label>
                    <Input
                      value={categoryForm.title}
                      onChange={(e) => setCategoryForm({ ...categoryForm, title: e.target.value })}
                      required
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <Label>URL</Label>
                    <Input
                      value={categoryForm.url}
                      onChange={(e) => setCategoryForm({ ...categoryForm, url: e.target.value })}
                      placeholder="Ex: actions-francaises"
                      required
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label>Sous-catégories</Label>
                      <Button type="button" size="sm" variant="outline" onClick={addSubcategory}>
                        <Plus className="w-4 h-4 mr-2" />
                        Ajouter
                      </Button>
                    </div>
                    
                    {categoryForm.subcategories.length > 0 && (
                      <div className="space-y-2">
                        {categoryForm.subcategories.map((sub, index) => (
                          <div key={index} className="flex gap-2">
                            <Input
                              value={sub}
                              onChange={(e) => updateSubcategory(index, e.target.value)}
                              placeholder="Nom de la sous-catégorie"
                            />
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => removeSubcategory(index)}
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                  
                  <div className="flex gap-2 justify-end">
                    <Button type="button" variant="outline" onClick={() => setIsCategoryDialogOpen(false)}>
                      Annuler
                    </Button>
                    <Button type="submit">Créer</Button>
                  </div>
                </form>
              </DialogContent>
            </Dialog>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Liste des catégories</CardTitle>
            </CardHeader>
            <CardContent>
              {categories.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-slate-200">
                        <th className="text-left py-3 px-4">ID</th>
                        <th className="text-left py-3 px-4">Catégorie</th>
                        <th className="text-left py-3 px-4">Sous-catégories</th>
                        <th className="text-right py-3 px-4">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {categories.map((category) => (
                        <tr key={category.id} className="border-b border-slate-100 hover:bg-slate-50">
                          <td className="py-3 px-4 text-slate-500">
                            {category.id.substring(0, 8)}
                          </td>
                          <td className="py-3 px-4">
                            <div className="flex items-center gap-2">
                              <Folder className="w-4 h-4 text-blue-600" />
                              {category.title}
                            </div>
                          </td>
                          <td className="py-3 px-4">
                            {category.subcategories && category.subcategories.length > 0 ? (
                              <div className="flex gap-1 flex-wrap">
                                {category.subcategories.map((sub: string, index: number) => (
                                  <Badge key={index} variant="outline" className="text-xs">
                                    {sub}
                                  </Badge>
                                ))}
                              </div>
                            ) : (
                              <span className="text-slate-500">-</span>
                            )}
                          </td>
                          <td className="py-3 px-4">
                            <div className="flex gap-2 justify-end">
                              <Button variant="ghost" size="sm">
                                <Pencil className="w-4 h-4" />
                              </Button>
                              <Button 
                                variant="ghost" 
                                size="sm"
                                onClick={() => handleDeleteCategory(category.id)}
                                className="text-red-600 hover:text-red-700"
                              >
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="text-sm text-slate-500">Aucune catégorie créée</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
export default Placements;