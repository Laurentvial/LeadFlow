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
import { Plus, Mail, Send, Trash2, Eye } from 'lucide-react';
import { apiCall } from '../utils/api';
import '../styles/PageHeader.css';

interface MessagerieProps {
  user: any;
}

export function Messagerie({ user }: MessagerieProps) {
  const [messages, setMessages] = useState<any[]>([]);
  const [clients, setClients] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [selectedMessage, setSelectedMessage] = useState<any>(null);
  const [isNewMessageOpen, setIsNewMessageOpen] = useState(false);
  const [isViewMessageOpen, setIsViewMessageOpen] = useState(false);
  const [formData, setFormData] = useState({
    recipientId: '',
    subject: '',
    message: ''
  });

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    try {
      const [messagesData, clientsData, usersData] = await Promise.all([
        apiCall('/messages'),
        apiCall('/clients'),
        apiCall('/users')
      ]);
      
      setMessages(messagesData.messages || []);
      setClients(clientsData.clients || []);
      setUsers(usersData.users || []);
    } catch (error) {
      console.error('Error loading messages:', error);
    }
  }

  async function handleSendMessage(e: React.FormEvent) {
    e.preventDefault();
    
    try {
      await apiCall('/messages', {
        method: 'POST',
        body: JSON.stringify(formData)
      });
      
      setIsNewMessageOpen(false);
      setFormData({ recipientId: '', subject: '', message: '' });
      loadData();
    } catch (error) {
      console.error('Error sending message:', error);
    }
  }

  async function handleMarkAsRead(messageId: string) {
    try {
      await apiCall(`/messages/${messageId}/read`, { method: 'POST' });
      loadData();
    } catch (error) {
      console.error('Error marking message as read:', error);
    }
  }

  async function handleDeleteMessage(messageId: string) {
    if (!confirm('Supprimer ce message ?')) return;
    
    try {
      await apiCall(`/messages/${messageId}`, { method: 'DELETE' });
      loadData();
      setIsViewMessageOpen(false);
    } catch (error) {
      console.error('Error deleting message:', error);
    }
  }

  function viewMessage(message: any) {
    setSelectedMessage(message);
    setIsViewMessageOpen(true);
    if (!message.read && message.recipientId === user.id) {
      handleMarkAsRead(message.id);
    }
  }

  const receivedMessages = messages.filter(m => m.recipientId === user.id);
  const sentMessages = messages.filter(m => m.senderId === user.id);
  const unreadCount = receivedMessages.filter(m => !m.read).length;

  function getRecipientName(recipientId: string) {
    const client = clients.find(c => c.authId === recipientId);
    if (client) return `${client.firstName} ${client.lastName}`;
    
    const userRecord = users.find(u => u.id === recipientId);
    if (userRecord) return `${userRecord.firstName} ${userRecord.lastName}`;
    
    return 'Inconnu';
  }

  function getSenderName(senderId: string) {
    const userRecord = users.find(u => u.id === senderId);
    if (userRecord) return `${userRecord.firstName} ${userRecord.lastName}`;
    
    return 'Système';
  }

  return (
    <div className="space-y-6">
      <div className="page-header">
        <div className="page-title-section">
          <h1 className="page-title">Messagerie</h1>
          <p className="page-subtitle">Boîte de réception et messages envoyés</p>
        </div>
        
        <Dialog open={isNewMessageOpen} onOpenChange={setIsNewMessageOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="w-4 h-4 mr-2" />
              Nouveau message
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Nouveau message</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSendMessage} className="space-y-4">
              <div className="space-y-2">
                <Label>Destinataire</Label>
                <Select value={formData.recipientId} onValueChange={(value) => setFormData({ ...formData, recipientId: value })}>
                  <SelectTrigger>
                    <SelectValue placeholder="Sélectionner un destinataire" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__clients__" disabled>-- Clients --</SelectItem>
                    {clients.filter(c => c.authId).map((client) => (
                      <SelectItem key={client.id} value={client.authId}>
                        {client.firstName} {client.lastName}
                      </SelectItem>
                    ))}
                    <SelectItem value="__users__" disabled>-- Utilisateurs --</SelectItem>
                    {users.filter(u => u.id !== user.id).map((userRecord) => (
                      <SelectItem key={userRecord.id} value={userRecord.id}>
                        {userRecord.firstName} {userRecord.lastName}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              <div className="space-y-2">
                <Label>Sujet</Label>
                <Input
                  value={formData.subject}
                  onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
                  required
                />
              </div>
              
              <div className="space-y-2">
                <Label>Message</Label>
                <Textarea
                  value={formData.message}
                  onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                  rows={6}
                  required
                />
              </div>
              
              <div className="flex gap-2 justify-end">
                <Button type="button" variant="outline" onClick={() => setIsNewMessageOpen(false)}>
                  Annuler
                </Button>
                <Button type="submit">
                  <Send className="w-4 h-4 mr-2" />
                  Envoyer
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <Tabs defaultValue="received" className="space-y-6">
        <TabsList>
          <TabsTrigger value="received">
            Boîte de réception
            {unreadCount > 0 && (
              <Badge className="ml-2" variant="destructive">
                {unreadCount}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="sent">Messages envoyés</TabsTrigger>
        </TabsList>

        {/* Received Messages */}
        <TabsContent value="received">
          <Card>
            <CardHeader>
              <CardTitle>Messages reçus</CardTitle>
            </CardHeader>
            <CardContent>
              {receivedMessages.length > 0 ? (
                <div className="space-y-2">
                  {receivedMessages.map((message) => (
                    <div
                      key={message.id}
                      className={`p-4 border rounded-lg cursor-pointer transition-colors ${
                        !message.read ? 'bg-blue-50 border-blue-200' : 'border-slate-200 hover:bg-slate-50'
                      }`}
                      onClick={() => viewMessage(message)}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <Mail className="w-4 h-4 text-slate-500" />
                            <p className={!message.read ? '' : 'text-slate-600'}>
                              {message.subject}
                            </p>
                            {!message.read && (
                              <Badge variant="destructive" className="text-xs">Nouveau</Badge>
                            )}
                          </div>
                          <p className="text-sm text-slate-600">
                            De: {getSenderName(message.senderId)}
                          </p>
                          <p className="text-sm text-slate-500 mt-1">
                            {new Date(message.createdAt).toLocaleDateString('fr-FR')} à{' '}
                            {new Date(message.createdAt).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', hour12: false })}
                          </p>
                        </div>
                        <Button variant="ghost" size="sm">
                          <Eye className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-slate-500">Aucun message reçu</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Sent Messages */}
        <TabsContent value="sent">
          <Card>
            <CardHeader>
              <CardTitle>Messages envoyés</CardTitle>
            </CardHeader>
            <CardContent>
              {sentMessages.length > 0 ? (
                <div className="space-y-2">
                  {sentMessages.map((message) => (
                    <div
                      key={message.id}
                      className="p-4 border border-slate-200 rounded-lg cursor-pointer hover:bg-slate-50"
                      onClick={() => viewMessage(message)}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <Send className="w-4 h-4 text-slate-500" />
                            <p>{message.subject}</p>
                          </div>
                          <p className="text-sm text-slate-600">
                            À: {getRecipientName(message.recipientId)}
                          </p>
                          <p className="text-sm text-slate-500 mt-1">
                            {new Date(message.createdAt).toLocaleDateString('fr-FR')} à{' '}
                            {new Date(message.createdAt).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', hour12: false })}
                          </p>
                        </div>
                        <Button variant="ghost" size="sm">
                          <Eye className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-slate-500">Aucun message envoyé</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* View Message Dialog */}
      <Dialog open={isViewMessageOpen} onOpenChange={setIsViewMessageOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{selectedMessage?.subject}</DialogTitle>
          </DialogHeader>
          
          {selectedMessage && (
            <div className="space-y-4">
              <div className="flex items-center justify-between text-sm text-slate-600">
                <div>
                  <p>
                    {selectedMessage.senderId === user.id 
                      ? `À: ${getRecipientName(selectedMessage.recipientId)}`
                      : `De: ${getSenderName(selectedMessage.senderId)}`
                    }
                  </p>
                  <p className="text-xs text-slate-500 mt-1">
                    {new Date(selectedMessage.createdAt).toLocaleDateString('fr-FR')} à{' '}
                    {new Date(selectedMessage.createdAt).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                  </p>
                </div>
              </div>
              
              <div className="border-t pt-4">
                <p className="text-slate-700 whitespace-pre-wrap">{selectedMessage.message}</p>
              </div>
              
              <div className="flex gap-2 justify-end border-t pt-4">
                <Button
                  variant="outline"
                  onClick={() => handleDeleteMessage(selectedMessage.id)}
                  className="text-red-600"
                >
                  <Trash2 className="w-4 h-4 mr-2" />
                  Supprimer
                </Button>
                <Button onClick={() => setIsViewMessageOpen(false)}>
                  Fermer
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
