import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from './ui/table';
import { FileText, Download, Eye, Calendar } from 'lucide-react';

const mockReports = [
  { 
    id: 1, 
    type: 'Mensuel', 
    period: 'Septembre 2025', 
    date: '2025-10-01',
    status: 'Disponible',
    size: '2.4 MB'
  },
  { 
    id: 2, 
    type: 'Trimestriel', 
    period: 'Q3 2025', 
    date: '2025-10-01',
    status: 'Disponible',
    size: '4.8 MB'
  },
  { 
    id: 3, 
    type: 'Mensuel', 
    period: 'Août 2025', 
    date: '2025-09-01',
    status: 'Disponible',
    size: '2.2 MB'
  },
  { 
    id: 4, 
    type: 'Mensuel', 
    period: 'Juillet 2025', 
    date: '2025-08-01',
    status: 'Disponible',
    size: '2.6 MB'
  },
  { 
    id: 5, 
    type: 'Trimestriel', 
    period: 'Q2 2025', 
    date: '2025-07-01',
    status: 'Disponible',
    size: '5.1 MB'
  },
  { 
    id: 6, 
    type: 'Mensuel', 
    period: 'Juin 2025', 
    date: '2025-07-01',
    status: 'Disponible',
    size: '2.3 MB'
  },
  { 
    id: 7, 
    type: 'Annuel', 
    period: '2024', 
    date: '2025-01-15',
    status: 'Disponible',
    size: '8.7 MB'
  },
  { 
    id: 8, 
    type: 'Mensuel', 
    period: 'Octobre 2025', 
    date: '2025-11-01',
    status: 'En préparation',
    size: '-'
  },
];

export function ReportingClient() {
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Mes rapports</CardTitle>
              <CardDescription>Consultez et téléchargez vos rapports de performance</CardDescription>
            </div>
            <Calendar className="h-8 w-8 text-slate-400" />
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-3 mb-6">
            <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-blue-100 rounded-lg">
                  <FileText className="h-5 w-5 text-blue-600" />
                </div>
                <div>
                  <p className="text-sm text-blue-900">Rapports mensuels</p>
                  <p className="text-blue-600">6 disponibles</p>
                </div>
              </div>
            </div>
            
            <div className="p-4 bg-purple-50 rounded-lg border border-purple-200">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-purple-100 rounded-lg">
                  <FileText className="h-5 w-5 text-purple-600" />
                </div>
                <div>
                  <p className="text-sm text-purple-900">Rapports trimestriels</p>
                  <p className="text-purple-600">2 disponibles</p>
                </div>
              </div>
            </div>
            
            <div className="p-4 bg-green-50 rounded-lg border border-green-200">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-green-100 rounded-lg">
                  <FileText className="h-5 w-5 text-green-600" />
                </div>
                <div>
                  <p className="text-sm text-green-900">Rapports annuels</p>
                  <p className="text-green-600">1 disponible</p>
                </div>
              </div>
            </div>
          </div>

          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Type</TableHead>
                <TableHead>Période</TableHead>
                <TableHead>Date de création</TableHead>
                <TableHead>Taille</TableHead>
                <TableHead>Statut</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {mockReports.map((report) => (
                <TableRow key={report.id}>
                  <TableCell>
                    <Badge variant="outline">{report.type}</Badge>
                  </TableCell>
                  <TableCell>{report.period}</TableCell>
                  <TableCell>{new Date(report.date).toLocaleDateString('fr-FR')}</TableCell>
                  <TableCell>{report.size}</TableCell>
                  <TableCell>
                    <Badge variant={report.status === 'Disponible' ? 'default' : 'secondary'}>
                      {report.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    {report.status === 'Disponible' ? (
                      <div className="flex justify-end gap-2">
                        <Button variant="ghost" size="sm">
                          <Eye className="h-4 w-4 mr-1" />
                          Voir
                        </Button>
                        <Button variant="ghost" size="sm">
                          <Download className="h-4 w-4 mr-1" />
                          Télécharger
                        </Button>
                      </div>
                    ) : (
                      <span className="text-sm text-slate-400">Bientôt disponible</span>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>À propos des rapports</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-start gap-3">
            <div className="w-2 h-2 bg-blue-500 rounded-full mt-2"></div>
            <div>
              <p className="text-sm">
                <span>Les rapports mensuels sont générés automatiquement le 1er de chaque mois</span>
              </p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <div className="w-2 h-2 bg-blue-500 rounded-full mt-2"></div>
            <div>
              <p className="text-sm">
                <span>Les rapports trimestriels incluent une analyse détaillée de la performance</span>
              </p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <div className="w-2 h-2 bg-blue-500 rounded-full mt-2"></div>
            <div>
              <p className="text-sm">
                <span>Tous les rapports sont sécurisés et accessibles uniquement par vous</span>
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
