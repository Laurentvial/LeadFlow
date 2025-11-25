import React, { useState, useEffect, useRef } from 'react';
import { useUser } from '../contexts/UserContext';
import { apiCall } from '../utils/api';
import { useWebSocket } from '../hooks/useWebSocket';
import { useUnreadMessages, ActiveChatRoomProvider, useSetActiveChatRoom } from '../contexts/UnreadMessagesContext';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { ScrollArea } from './ui/scroll-area';
import { Avatar, AvatarFallback } from './ui/avatar';
import { Badge } from './ui/badge';
import { 
  MessageSquare, 
  Send, 
  Search,
  UserPlus,
  X
} from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from './ui/select';
import { toast } from 'sonner';
import '../styles/Chat.css';
import '../styles/Modal.css';

interface Message {
  id: string;
  chatRoomId: string;
  senderId: number;
  senderName: string;
  content: string;
  isRead: boolean;
  createdAt: string;
}

interface ChatRoom {
  id: string;
  participants: number[];
  otherParticipant?: {
    id: number;
    username: string;
    name: string;
    email: string;
  };
  lastMessage?: Message;
  unreadCount: number;
  updatedAt: string;
}

interface User {
  id: number;
  username: string;
  name: string;
  email: string;
}

function ChatContent({ selectedRoom, setSelectedRoom }: { selectedRoom: ChatRoom | null; setSelectedRoom: (room: ChatRoom | null) => void }) {
  const { currentUser } = useUser();
  const { refreshUnreadCount } = useUnreadMessages();
  const setActiveChatRoom = useSetActiveChatRoom();
  const [chatRooms, setChatRooms] = useState<ChatRoom[]>([]);
  
  // Update active chat room context when selectedRoom changes
  useEffect(() => {
    setActiveChatRoom(selectedRoom?.id || null);
  }, [selectedRoom, setActiveChatRoom]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [messageInput, setMessageInput] = useState('');
  const [users, setUsers] = useState<User[]>([]);
  const [isNewChatOpen, setIsNewChatOpen] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [loading, setLoading] = useState(true);
  const [pendingMessages, setPendingMessages] = useState<Map<string, Message>>(new Map());

  // Scroll to bottom of messages
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Load chat rooms
  const loadChatRooms = React.useCallback(async () => {
    try {
      const data = await apiCall('/api/chat/rooms/');
      setChatRooms(data || []);
      
      // Refresh global unread count in sidebar
      refreshUnreadCount();
    } catch (error: any) {
      console.error('Error loading chat rooms:', error);
      toast.error('Erreur lors du chargement des conversations');
    } finally {
      setLoading(false);
    }
  }, [refreshUnreadCount]);

  // Load users for new chat
  const loadUsers = async () => {
    try {
      const data = await apiCall('/api/chat/users/');
      setUsers(data || []);
    } catch (error: any) {
      console.error('Error loading users:', error);
    }
  };

  // Load messages for selected room
  const loadMessages = React.useCallback(async (roomId: string, preservePending: boolean = false) => {
    try {
      const data = await apiCall(`/api/chat/rooms/${roomId}/messages/`);
      const serverMessages = data || [];
      
      // Merge server messages with pending messages to avoid losing messages being sent
      if (preservePending && pendingMessages.size > 0) {
        const pendingArray = Array.from(pendingMessages.values());
        const allMessages = [...serverMessages, ...pendingArray];
        
        // Remove duplicates and sort by createdAt
        const uniqueMessages = allMessages.reduce((acc, msg) => {
          const existing = acc.find(m => m.id === msg.id);
          if (!existing) {
            acc.push(msg);
          }
          return acc;
        }, [] as Message[]);
        
        uniqueMessages.sort((a, b) => 
          new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
        );
        
        setMessages(uniqueMessages);
        
        // Remove pending messages that are now in server response
        setPendingMessages(prev => {
          const newMap = new Map(prev);
          serverMessages.forEach((msg: Message) => {
            newMap.delete(msg.id);
          });
          return newMap;
        });
      } else {
        setMessages(serverMessages);
      }
      
      // Mark messages as read via API (WebSocket will be handled separately)
      try {
        await apiCall(`/api/chat/rooms/${roomId}/read/`, {
          method: 'POST',
        });
      } catch (readError) {
        // Ignore read errors, not critical
      }
      
      // Update unread count in chat rooms list
      setChatRooms(prev => prev.map(room => 
        room.id === roomId ? { ...room, unreadCount: 0 } : room
      ));
    } catch (error: any) {
      console.error('Error loading messages:', error);
      toast.error('Erreur lors du chargement des messages');
    }
  }, [pendingMessages]);

  // Send message
  const sendMessage = async () => {
    if (!messageInput.trim() || !selectedRoom) return;

    const content = messageInput.trim();
    setMessageInput('');

    // Create optimistic message immediately
    const currentDjangoUserId = currentUser?.djangoUserId ?? currentUser?.id;
    const tempId = `temp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const optimisticMessage: Message = {
      id: tempId,
      chatRoomId: selectedRoom.id,
      senderId: Number(currentDjangoUserId),
      senderName: `${currentUser?.firstName || ''} ${currentUser?.lastName || ''}`.trim() || currentUser?.email || 'Vous',
      content: content,
      isRead: false,
      createdAt: new Date().toISOString(),
    };

    // Add optimistic message immediately to UI
    setMessages(prev => [...prev, optimisticMessage]);
    
    // Add to pending messages
    setPendingMessages(prev => {
      const newMap = new Map(prev);
      newMap.set(tempId, optimisticMessage);
      return newMap;
    });

    // Try WebSocket first, fallback to API
    if (chatWs.isConnected) {
      chatWs.send({
        type: 'chat_message',
        content: content,
      });
    } else {
      // Fallback to API if WebSocket is not connected
      try {
        const newMessage = await apiCall(`/api/chat/rooms/${selectedRoom.id}/messages/`, {
          method: 'POST',
          body: JSON.stringify({ content }),
        });

        // Replace optimistic message with real message
        setMessages(prev => {
          const filtered = prev.filter(m => m.id !== tempId);
          return [...filtered, newMessage];
        });
        
        // Remove from pending and add real message
        setPendingMessages(prev => {
          const newMap = new Map(prev);
          newMap.delete(tempId);
          newMap.set(newMessage.id, newMessage);
          return newMap;
        });
        
        // Update last message in chat rooms list
        setChatRooms(prev => prev.map(room => 
          room.id === selectedRoom.id 
            ? { ...room, lastMessage: newMessage, updatedAt: newMessage.createdAt }
            : room
        ));
        
        // Reload chat rooms to get updated order
        await loadChatRooms();
      } catch (error: any) {
        console.error('Error sending message:', error);
        toast.error('Erreur lors de l\'envoi du message');
        setMessageInput(content); // Restore message on error
        
        // Remove optimistic message on error
        setMessages(prev => prev.filter(m => m.id !== tempId));
        setPendingMessages(prev => {
          const newMap = new Map(prev);
          newMap.delete(tempId);
          return newMap;
        });
      }
    }
  };

  // Create new chat room
  const createChatRoom = async () => {
    if (!selectedUserId) {
      toast.error('Veuillez sélectionner un utilisateur');
      return;
    }

    try {
      const newRoom = await apiCall('/api/chat/rooms/', {
        method: 'POST',
        body: JSON.stringify({ participants: [parseInt(selectedUserId)] }),
      });

      setChatRooms(prev => [newRoom, ...prev]);
      setSelectedRoom(newRoom);
      setMessages([]);
      setIsNewChatOpen(false);
      setSelectedUserId('');
      
      // Load messages for the new room
      await loadMessages(newRoom.id);
    } catch (error: any) {
      console.error('Error creating chat room:', error);
      toast.error('Erreur lors de la création de la conversation');
    }
  };

  // Handle room selection
  const handleRoomSelect = async (room: ChatRoom) => {
    setSelectedRoom(room);
    // Clear pending messages when switching rooms
    setPendingMessages(new Map());
    await loadMessages(room.id, false);
  };

  // Initial load
  useEffect(() => {
    loadChatRooms();
    loadUsers();
  }, []);

  // WebSocket connection for chat
  const chatWs = useWebSocket({
    url: selectedRoom ? `/ws/chat/${selectedRoom.id}/` : '',
    onMessage: (message) => {
      if (message.type === 'chat_message') {
        const newMessage = message.message;
        
        // If this message is for the currently selected room, add it to messages
        if (selectedRoom && newMessage.chatRoomId === selectedRoom.id) {
          setMessages(prev => {
            // Check if message already exists (by ID or by content if it's our optimistic message)
            const exists = prev.some(m => m.id === newMessage.id);
            if (exists) return prev;
            
            // Remove any pending optimistic message with same content from same sender
            const filtered = prev.filter(m => {
              // Keep if it's not a pending message or if it doesn't match
              if (!m.id.startsWith('temp_')) return true;
              // Remove optimistic message if content and sender match
              return !(m.content === newMessage.content && 
                      m.senderId === newMessage.senderId &&
                      Math.abs(new Date(m.createdAt).getTime() - new Date(newMessage.createdAt).getTime()) < 5000);
            });
            
            return [...filtered, newMessage];
          });
          
          // Remove from pending messages since we got the real one
          setPendingMessages(prev => {
            const newMap = new Map(prev);
            // Remove any pending message that matches this real message
            newMap.forEach((pendingMsg, key) => {
              if (pendingMsg.content === newMessage.content && 
                  pendingMsg.senderId === newMessage.senderId &&
                  Math.abs(new Date(pendingMsg.createdAt).getTime() - new Date(newMessage.createdAt).getTime()) < 5000) {
                newMap.delete(key);
              }
            });
            return newMap;
          });
          
          // Mark as read if room is open
          if (chatWs.isConnected) {
            chatWs.send({
              type: 'mark_read',
            });
          }
        }
        
        // Always update chat rooms list to show new messages
        loadChatRooms();
        
        // Refresh global unread count in sidebar
        refreshUnreadCount();
      } else if (message.type === 'typing') {
        // Handle typing indicator (optional)
        // You can add typing indicator UI here
      } else if (message.type === 'messages_read') {
        // Update read status
        setMessages(prev => prev.map(m => ({ ...m, isRead: true })));
      }
    },
    onError: (error) => {
      console.error('Chat WebSocket error:', error);
    },
    reconnect: true,
  });

  // WebSocket connection for chat rooms updates (listens to all notifications)
  const roomsWs = useWebSocket({
    url: '/ws/notifications/',
    onMessage: (message) => {
      if (message.type === 'notification' && message.notification?.type === 'message') {
        const notification = message.notification;
        const chatRoomId = notification.data?.chat_room_id;
        
        // Reload chat rooms immediately when a new message notification is received
        loadChatRooms();
        
        // If the message is for the currently selected room, reload messages immediately
        if (selectedRoom && chatRoomId === selectedRoom.id) {
          // Reload messages to get the latest, preserving pending messages
          loadMessages(selectedRoom.id, true); // preservePending = true
        }
      }
    },
    onOpen: () => {
      // Reload chat rooms when WebSocket connects
      loadChatRooms();
    },
    reconnect: true,
  });

  // Auto-refresh chat rooms periodically (like WhatsApp)
  useEffect(() => {
    const interval = setInterval(() => {
      loadChatRooms();
      
      // Also reload messages for currently selected room, preserving pending messages
      if (selectedRoom) {
        loadMessages(selectedRoom.id, true); // preservePending = true
      }
    }, 5000); // Refresh every 5 seconds

    return () => clearInterval(interval);
  }, [selectedRoom, loadChatRooms, loadMessages]);

  // Filter chat rooms by search query
  const filteredRooms = chatRooms.filter(room => {
    if (!searchQuery.trim()) return true;
    const query = searchQuery.toLowerCase();
    const participantName = room.otherParticipant?.name?.toLowerCase() || '';
    const participantUsername = room.otherParticipant?.username?.toLowerCase() || '';
    const lastMessageContent = room.lastMessage?.content?.toLowerCase() || '';
    return participantName.includes(query) || 
           participantUsername.includes(query) || 
           lastMessageContent.includes(query);
  });

  // Format time
  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'À l\'instant';
    if (diffMins < 60) return `Il y a ${diffMins} min`;
    if (diffHours < 24) return `Il y a ${diffHours}h`;
    if (diffDays < 7) return `Il y a ${diffDays}j`;
    
    return date.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
  };

  // Get initials for avatar
  const getInitials = (name: string) => {
    const parts = name.split(' ');
    if (parts.length >= 2) {
      return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return name.substring(0, 2).toUpperCase();
  };

  if (loading) {
    return (
      <div className="chat-loading">
        <div>Chargement...</div>
      </div>
    );
  }

  return (
    <div className="chat-container">
      {/* Sidebar with chat rooms */}
      <div className="chat-sidebar">
        {/* Header */}
        <div className="chat-sidebar-header">
          <div className="chat-sidebar-title">
            <h2>Messages</h2>
            <Button 
              variant="outline" 
              size="icon"
              onClick={() => setIsNewChatOpen(true)}
            >
              <UserPlus className="h-4 w-4" />
            </Button>
          </div>
          
          {/* Search */}
          <div className="chat-search-container">
            <Search className="chat-search-icon" />
            <Input
              placeholder="Rechercher..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="chat-search-input"
            />
          </div>
        </div>

        {/* Chat rooms list */}
        <ScrollArea className="chat-rooms-list">
          {filteredRooms.length === 0 ? (
            <div className="chat-empty-state">
              {searchQuery ? 'Aucune conversation trouvée' : 'Aucune conversation'}
            </div>
          ) : (
            filteredRooms.map(room => (
              <div
                key={room.id}
                onClick={() => handleRoomSelect(room)}
                className={`chat-room-item ${selectedRoom?.id === room.id ? 'active' : ''}`}
              >
                <div className="chat-room-avatar">
                  <Avatar>
                    <AvatarFallback>
                      {room.otherParticipant 
                        ? getInitials(room.otherParticipant.name || room.otherParticipant.username)
                        : '?'}
                    </AvatarFallback>
                  </Avatar>
                </div>
                <div className="chat-room-content">
                  <div className="chat-room-header">
                    <span className="chat-room-name">
                      {room.otherParticipant?.name || room.otherParticipant?.username || 'Utilisateur'}
                    </span>
                    {room.unreadCount > 0 && (
                      <Badge variant="default" className="chat-room-unread-badge">
                        {room.unreadCount}
                      </Badge>
                    )}
                  </div>
                  {room.lastMessage && (
                    <>
                      <p className="chat-room-preview">
                        {room.lastMessage.content}
                      </p>
                      <p className="chat-room-time">
                        {formatTime(room.lastMessage.createdAt)}
                      </p>
                    </>
                  )}
                </div>
              </div>
            ))
          )}
        </ScrollArea>
      </div>

      {/* Chat view */}
      <div className="chat-main">
        {selectedRoom ? (
          <>
            {/* Chat header */}
            <div className="chat-header">
              <div className="chat-header-content">
                <div className="chat-header-avatar">
                  <Avatar>
                    <AvatarFallback>
                      {selectedRoom.otherParticipant 
                        ? getInitials(selectedRoom.otherParticipant.name || selectedRoom.otherParticipant.username)
                        : '?'}
                    </AvatarFallback>
                  </Avatar>
                </div>
                <div className="chat-header-info">
                  <h3>
                    {selectedRoom.otherParticipant?.name || selectedRoom.otherParticipant?.username || 'Utilisateur'}
                  </h3>
                  <p>
                    {selectedRoom.otherParticipant?.email}
                  </p>
                </div>
              </div>
            </div>

            {/* Messages */}
            <ScrollArea className="chat-messages-area">
              <div className="chat-messages-container">
                {messages.map((message) => {
                  // Compare with djangoUserId (Django User ID) which matches senderId
                  // senderId is the Django User ID, so we need to compare with djangoUserId
                  const currentDjangoUserId = currentUser?.djangoUserId ?? currentUser?.id;
                  const isOwnMessage = Number(message.senderId) === Number(currentDjangoUserId);
                  return (
                    <div
                      key={message.id}
                      className={`chat-message-wrapper ${isOwnMessage ? 'own' : 'other'}`}
                    >
                      <div
                        className={`chat-message-bubble ${isOwnMessage ? 'own' : 'other'}`}
                      >
                        {!isOwnMessage && (
                          <div className="chat-message-sender">
                            {message.senderName}
                          </div>
                        )}
                        <div className="chat-message-content">{message.content}</div>
                        <div className="chat-message-time">
                          {formatTime(message.createdAt)}
                        </div>
                      </div>
                    </div>
                  );
                })}
                <div ref={messagesEndRef} />
              </div>
            </ScrollArea>

            {/* Message input */}
            <div className="chat-input-area">
              <div className="chat-input-container">
                <Input
                  placeholder="Tapez un message..."
                  value={messageInput}
                  onChange={(e) => setMessageInput(e.target.value)}
                  onKeyPress={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      sendMessage();
                    }
                  }}
                  className="chat-input-field"
                />
                <Button onClick={sendMessage} disabled={!messageInput.trim()} className="chat-send-button">
                  <Send className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </>
        ) : (
          <div className="chat-main-empty">
            <div className="chat-main-empty-content">
              <MessageSquare className="chat-main-empty-icon" />
              <p className="chat-main-empty-text">Sélectionnez une conversation pour commencer</p>
            </div>
          </div>
        )}
      </div>

      {/* New Chat Modal */}
      {isNewChatOpen && (
        <div className="modal-overlay" onClick={() => setIsNewChatOpen(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2 className="modal-title">Nouvelle conversation</h2>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="modal-close"
                onClick={() => setIsNewChatOpen(false)}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
            <div className="modal-form">
              <div className="modal-form-field">
                <Select value={selectedUserId} onValueChange={setSelectedUserId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Sélectionner un utilisateur" />
                  </SelectTrigger>
                  <SelectContent>
                    {users.map(user => (
                      <SelectItem key={user.id} value={String(user.id)}>
                        {user.name || user.username}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="modal-form-actions">
                <Button variant="outline" onClick={() => setIsNewChatOpen(false)}>
                  Annuler
                </Button>
                <Button onClick={createChatRoom}>
                  Créer
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function Chat() {
  const [selectedRoom, setSelectedRoom] = useState<ChatRoom | null>(null);
  
  return (
    <ActiveChatRoomProvider>
      <ChatContent selectedRoom={selectedRoom} setSelectedRoom={setSelectedRoom} />
    </ActiveChatRoomProvider>
  );
}

