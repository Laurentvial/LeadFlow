import React, { useState, useEffect, useRef } from 'react';
import { useUser } from '../contexts/UserContext';
import { apiCall } from '../utils/api';
import { handleModalOverlayClick } from '../utils/modal';
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
  X,
  Check
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
  name?: string;
  participants: number[];
  participantsList?: Array<{
    id: number;
    username: string;
    name: string;
    email: string;
  }>;
  isGroup?: boolean;
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
  const [selectedUserIds, setSelectedUserIds] = useState<number[]>([]);
  const [groupChatName, setGroupChatName] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const conversationsListRef = useRef<HTMLDivElement>(null);
  const [loading, setLoading] = useState(true);
  const [pendingMessages, setPendingMessages] = useState<Map<string, Message>>(new Map());
  const [hasMoreMessages, setHasMoreMessages] = useState(false);
  const [loadingOlderMessages, setLoadingOlderMessages] = useState(false);
  const [messagesOffset, setMessagesOffset] = useState(0);
  const isLoadingOlderRef = useRef(false); // Track if we're loading older messages to prevent auto-scroll
  const [hasMoreConversations, setHasMoreConversations] = useState(false);
  const [loadingMoreConversations, setLoadingMoreConversations] = useState(false);
  const [conversationsOffset, setConversationsOffset] = useState(0);
  const MESSAGES_PER_PAGE = 15;
  const CONVERSATIONS_PER_PAGE = 15;

  // Scroll to bottom of messages
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  // Load chat rooms
  const loadChatRooms = React.useCallback(async (offset: number = 0, append: boolean = false) => {
    try {
      const data = await apiCall(`/api/chat/rooms/?limit=${CONVERSATIONS_PER_PAGE}&offset=${offset}`);
      
      // Handle both old format (array) and new format (object with chatRooms array)
      const responseData = Array.isArray(data) ? { chatRooms: data, hasMore: false } : data;
      const serverChatRooms = responseData.chatRooms || [];
      const hasMore = responseData.hasMore || false;
      
      if (append) {
        // Append to existing conversations
        setChatRooms(prev => {
          // Merge and remove duplicates
          const merged = [...prev, ...serverChatRooms];
          const unique = merged.reduce((acc, room) => {
            const existing = acc.find(r => r.id === room.id);
            if (!existing) {
              acc.push(room);
            }
            return acc;
          }, [] as ChatRoom[]);
          
          // Sort by updatedAt descending
          unique.sort((a, b) => 
            new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
          );
          
          return unique;
        });
      } else {
        // Replace all conversations
        setChatRooms(serverChatRooms);
      }
      
      setConversationsOffset(offset);
      setHasMoreConversations(hasMore);
      
      // Refresh global unread count in sidebar
      refreshUnreadCount();
    } catch (error: any) {
      console.error('Error loading chat rooms:', error);
      toast.error('Erreur lors du chargement des conversations');
    } finally {
      setLoading(false);
    }
  }, [refreshUnreadCount, CONVERSATIONS_PER_PAGE]);
  
  // Load more conversations when scrolling down
  const loadMoreConversations = React.useCallback(async () => {
    if (loadingMoreConversations || !hasMoreConversations) return;
    
    setLoadingMoreConversations(true);
    const newOffset = conversationsOffset + CONVERSATIONS_PER_PAGE;
    
    try {
      await loadChatRooms(newOffset, true);
    } finally {
      setLoadingMoreConversations(false);
    }
  }, [loadingMoreConversations, hasMoreConversations, conversationsOffset, loadChatRooms, CONVERSATIONS_PER_PAGE]);

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
  // offset=0: loads the 15 most recent messages
  // offset>0: loads older messages (for scrolling up)
  const loadMessages = React.useCallback(async (roomId: string, preservePending: boolean = false, offset: number = 0) => {
    try {
      // Always limit to MESSAGES_PER_PAGE (15) messages per request
      const data = await apiCall(`/api/chat/rooms/${roomId}/messages/?limit=${MESSAGES_PER_PAGE}&offset=${offset}`);
      
      // Handle both old format (array) and new format (object with messages array)
      const responseData = Array.isArray(data) ? { messages: data, hasMore: false } : data;
      const serverMessages = responseData.messages || [];
      const hasMore = responseData.hasMore || false;
      
      // Merge server messages with pending messages to avoid losing messages being sent
      if (preservePending && pendingMessages.size > 0 && offset === 0) {
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
        
        // Update pagination state even when preserving pending
        setMessagesOffset(offset);
        setHasMoreMessages(hasMore);
      } else {
        if (offset === 0) {
          // Initial load or refresh - replace all messages
          setMessages(serverMessages);
          setMessagesOffset(0);
        } else {
          // Loading older messages - prepend to existing messages
          setMessages(prev => {
            // Merge and remove duplicates
            const merged = [...serverMessages, ...prev];
            const unique = merged.reduce((acc, msg) => {
              const existing = acc.find(m => m.id === msg.id);
              if (!existing) {
                acc.push(msg);
              }
              return acc;
            }, [] as Message[]);
            
            // Sort by createdAt
            unique.sort((a, b) => 
              new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
            );
            
            return unique;
          });
        }
        setMessagesOffset(offset);
        setHasMoreMessages(hasMore);
      }
      
      // Mark messages as read via API (WebSocket will be handled separately)
      if (offset === 0) {
        try {
          await apiCall(`/api/chat/rooms/${roomId}/read/`, {
            method: 'POST',
          });
        } catch (readError) {
          // Ignore read errors, not critical
        }
      }
      
      // Update unread count in chat rooms list
      if (offset === 0) {
        setChatRooms(prev => prev.map(room => 
          room.id === roomId ? { ...room, unreadCount: 0 } : room
        ));
      }
    } catch (error: any) {
      console.error('Error loading messages:', error);
      toast.error('Erreur lors du chargement des messages');
    }
  }, [pendingMessages, MESSAGES_PER_PAGE]);
  
  // Load older messages when scrolling up
  const loadOlderMessages = React.useCallback(async (roomId: string) => {
    if (loadingOlderMessages || !hasMoreMessages) return;
    
    setLoadingOlderMessages(true);
    isLoadingOlderRef.current = true; // Set flag to prevent auto-scroll
    const newOffset = messagesOffset + MESSAGES_PER_PAGE;
    
    // Find the scrollable viewport element
    const findScrollableElement = () => {
      const container = messagesContainerRef.current;
      if (!container) return null;
      
      let parent = container.parentElement;
      while (parent) {
        if (parent.getAttribute('data-slot') === 'scroll-area-viewport') {
          return parent;
        }
        parent = parent.parentElement;
      }
      return null;
    };
    
    const scrollableElement = findScrollableElement();
    if (!scrollableElement) {
      setLoadingOlderMessages(false);
      isLoadingOlderRef.current = false;
      return;
    }
    
    // Save current scroll position and height before loading
    const scrollHeight = scrollableElement.scrollHeight;
    const scrollTop = scrollableElement.scrollTop;
    
    try {
      await loadMessages(roomId, false, newOffset);
      
      // Restore scroll position after loading older messages
      // Use multiple requestAnimationFrame to ensure DOM is fully updated
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          if (scrollableElement) {
            const newScrollHeight = scrollableElement.scrollHeight;
            const heightDifference = newScrollHeight - scrollHeight;
            // Maintain the same visual position by adding the height difference
            scrollableElement.scrollTop = scrollTop + heightDifference;
            // Clear flag after scroll position is restored
            setTimeout(() => {
              isLoadingOlderRef.current = false;
            }, 100);
          }
        });
      });
    } finally {
      setLoadingOlderMessages(false);
    }
  }, [loadingOlderMessages, hasMoreMessages, messagesOffset, loadMessages, MESSAGES_PER_PAGE]);

  // Scroll to bottom only when new messages arrive (not when loading older messages)
  useEffect(() => {
    // Don't scroll when loading older messages - let loadOlderMessages handle scroll position
    if (loadingOlderMessages || isLoadingOlderRef.current) return;
    
    // Find the scrollable viewport element
    const findScrollableElement = () => {
      const container = messagesContainerRef.current;
      if (!container) return null;
      
      let parent = container.parentElement;
      while (parent) {
        if (parent.getAttribute('data-slot') === 'scroll-area-viewport') {
          return parent;
        }
        parent = parent.parentElement;
      }
      return null;
    };
    
    const scrollableElement = findScrollableElement();
    if (scrollableElement) {
      // Only auto-scroll if we're at or very near the bottom (within 50px)
      // This handles new messages arriving (not older messages being loaded or auto-refresh)
      const scrollBottom = scrollableElement.scrollHeight - scrollableElement.scrollTop - scrollableElement.clientHeight;
      const isAtBottom = scrollBottom <= 50; // Reduced threshold for more precise detection
      
      // Also check if user has scrolled up to view older messages
      // If messagesOffset > 0, user has loaded older messages, so don't auto-scroll unless at bottom
      if (isAtBottom || messagesOffset === 0) {
        if (isAtBottom) {
          scrollToBottom();
        }
      }
    } else {
      // If no container ref yet, scroll to bottom (initial load only)
      if (messagesOffset === 0) {
        scrollToBottom();
      }
    }
  }, [messages, loadingOlderMessages, messagesOffset]);
  

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
    // Only use WebSocket if it's connected and not disabled
    if (chatWs.isConnected && !chatWs.isDisabled) {
      chatWs.send({
        type: 'chat_message',
        content: content,
      });
    } else {
      // Fallback to API if WebSocket is not connected or disabled
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
        await loadChatRooms(0, false);
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
    if (selectedUserIds.length === 0) {
      toast.error('Veuillez sélectionner au moins un utilisateur');
      return;
    }

    try {
      const requestBody: any = { participants: selectedUserIds };
      
      // Add name if it's a group chat (more than 1 selected user) and name is provided
      if (selectedUserIds.length > 1 && groupChatName.trim()) {
        requestBody.name = groupChatName.trim();
      }
      
      const newRoom = await apiCall('/api/chat/rooms/', {
        method: 'POST',
        body: JSON.stringify(requestBody),
      });

      setChatRooms(prev => [newRoom, ...prev]);
      setSelectedRoom(newRoom);
      setMessages([]);
      setIsNewChatOpen(false);
      setSelectedUserIds([]);
      setGroupChatName('');
      
      // Reset pagination state for new room
      setMessagesOffset(0);
      setHasMoreMessages(false);
      setConversationsOffset(0);
      setHasMoreConversations(false);
      
      // Load messages for the new room
      await loadMessages(newRoom.id, false, 0);
    } catch (error: any) {
      console.error('Error creating chat room:', error);
      toast.error('Erreur lors de la création de la conversation');
    }
  };
  
  // Toggle user selection for group chat
  const toggleUserSelection = (userId: number) => {
    setSelectedUserIds(prev => {
      if (prev.includes(userId)) {
        return prev.filter(id => id !== userId);
      } else {
        return [...prev, userId];
      }
    });
  };

  // Handle room selection
  const handleRoomSelect = async (room: ChatRoom) => {
    setSelectedRoom(room);
    // Clear pending messages when switching rooms
    setPendingMessages(new Map());
    setMessagesOffset(0);
    setHasMoreMessages(false);
    isLoadingOlderRef.current = false; // Reset flag when switching rooms
    await loadMessages(room.id, false, 0);
  };

  // Initial load
  useEffect(() => {
    loadChatRooms(0, false);
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
          
          // Mark as read if room is open and WebSocket is available
          if (chatWs.isConnected && !chatWs.isDisabled) {
            chatWs.send({
              type: 'mark_read',
            });
          }
        }
        
        // Always update chat rooms list to show new messages
        loadChatRooms(0, false);
        
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
      if (message.type === 'new_message') {
        // Reload chat rooms when a new message is received (especially for first-time messages)
        // This ensures the chat appears in the recipient's list
        console.log('[Chat] Received new_message event, reloading chat rooms', message);
        loadChatRooms(0, false);
        
        const chatRoomId = message.chat_room_id || message.message?.chatRoomId;
        
        // If the message is for the currently selected room, reload messages immediately
        if (selectedRoom && chatRoomId === selectedRoom.id) {
          // Reload messages to get the latest, preserving pending messages
          // Reset pagination when refreshing
          setMessagesOffset(0);
          loadMessages(selectedRoom.id, true, 0); // preservePending = true, offset = 0
        }
      } else if (message.type === 'new_chat_room') {
        // Add new chat room to the list when it's created
        console.log('[Chat] Received new_chat_room event', message);
        const newChatRoom = message.chat_room;
        if (newChatRoom) {
          setChatRooms(prev => {
            // Check if room already exists
            const exists = prev.some(r => r.id === newChatRoom.id);
            if (exists) {
              // Update existing room
              console.log('[Chat] Updating existing chat room', newChatRoom.id);
              return prev.map(room => 
                room.id === newChatRoom.id ? { ...room, ...newChatRoom } : room
              ).sort((a, b) => 
                new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
              );
            } else {
              // Add new room at the beginning
              console.log('[Chat] Adding new chat room to list', newChatRoom.id);
              return [newChatRoom, ...prev].sort((a, b) => 
                new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
              );
            }
          });
          // Also reload to ensure consistency
          loadChatRooms(0, false);
        }
      } else if (message.type === 'notification' && message.notification?.type === 'message') {
        const notification = message.notification;
        const chatRoomId = notification.data?.chat_room_id;
        
        // Reload chat rooms immediately when a new message notification is received
        loadChatRooms(0, false);
        
        // If the message is for the currently selected room, reload messages immediately
        if (selectedRoom && chatRoomId === selectedRoom.id) {
          // Reload messages to get the latest, preserving pending messages
          // Reset pagination when refreshing
          setMessagesOffset(0);
          loadMessages(selectedRoom.id, true, 0); // preservePending = true, offset = 0
        }
      }
    },
    onOpen: () => {
      // Reload chat rooms when WebSocket connects
      loadChatRooms(0, false);
    },
    reconnect: true,
  });

  // Handle scroll to load more conversations
  useEffect(() => {
    // Find the scrollable viewport element for conversations list
    const findScrollableElement = () => {
      const container = conversationsListRef.current;
      if (!container) return null;
      
      let parent = container.parentElement;
      while (parent) {
        if (parent.getAttribute('data-slot') === 'scroll-area-viewport') {
          return parent;
        }
        parent = parent.parentElement;
      }
      return null;
    };
    
    const scrollableElement = findScrollableElement();
    if (!scrollableElement) return;
    
    const handleScroll = () => {
      // Load more conversations when scrolled near bottom (within 100px)
      const scrollHeight = scrollableElement.scrollHeight;
      const scrollTop = scrollableElement.scrollTop;
      const clientHeight = scrollableElement.clientHeight;
      
      if (scrollHeight - scrollTop - clientHeight < 100 && hasMoreConversations && !loadingMoreConversations) {
        loadMoreConversations();
      }
    };
    
    scrollableElement.addEventListener('scroll', handleScroll);
    return () => scrollableElement.removeEventListener('scroll', handleScroll);
  }, [hasMoreConversations, loadingMoreConversations, loadMoreConversations]);

  // Filter chat rooms by search query
  const filteredRooms = chatRooms.filter(room => {
    if (!searchQuery.trim()) return true;
    const query = searchQuery.toLowerCase();
    
    // Search in group chat name
    if (room.isGroup && room.name?.toLowerCase().includes(query)) {
      return true;
    }
    
    // Search in participant names (for both 1-on-1 and group chats)
    const participantName = room.otherParticipant?.name?.toLowerCase() || '';
    const participantUsername = room.otherParticipant?.username?.toLowerCase() || '';
    
    // Search in all participants for group chats
    if (room.isGroup && room.participantsList) {
      const participantMatches = room.participantsList.some(p => 
        p.name.toLowerCase().includes(query) || 
        p.username.toLowerCase().includes(query)
      );
      if (participantMatches) return true;
    }
    
    const lastMessageContent = room.lastMessage?.content?.toLowerCase() || '';
    return participantName.includes(query) || 
           participantUsername.includes(query) || 
           lastMessageContent.includes(query);
  });
  
  // Get display name for a chat room
  const getRoomDisplayName = (room: ChatRoom) => {
    if (room.isGroup) {
      return room.name || room.participantsList?.map(p => p.name || p.username).join(', ') || 'Groupe';
    }
    return room.otherParticipant?.name || room.otherParticipant?.username || 'Utilisateur';
  };
  
  // Get display info for a chat room
  const getRoomDisplayInfo = (room: ChatRoom) => {
    if (room.isGroup) {
      const participantCount = room.participantsList?.length || 0;
      return `${participantCount} participant${participantCount > 1 ? 's' : ''}`;
    }
    return room.otherParticipant?.email || '';
  };

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
          <div ref={conversationsListRef}>
            {filteredRooms.length === 0 ? (
              <div className="chat-empty-state">
                {searchQuery ? 'Aucune conversation trouvée' : 'Aucune conversation'}
              </div>
            ) : (
              <>
                {filteredRooms.map(room => (
                  <div
                    key={room.id}
                    onClick={() => handleRoomSelect(room)}
                    className={`chat-room-item ${selectedRoom?.id === room.id ? 'active' : ''}`}
                  >
                    <div className="chat-room-avatar">
                      <Avatar>
                        <AvatarFallback>
                          {room.isGroup 
                            ? 'G'
                            : room.otherParticipant 
                              ? getInitials(room.otherParticipant.name || room.otherParticipant.username)
                              : '?'}
                        </AvatarFallback>
                      </Avatar>
                    </div>
                    <div className="chat-room-content">
                      <div className="chat-room-header">
                        <span className="chat-room-name">
                          {getRoomDisplayName(room)}
                        </span>
                        {room.unreadCount > 0 && (
                          <Badge variant="default" className="chat-room-unread-badge">
                            {room.unreadCount}
                          </Badge>
                        )}
                      </div>
                      {room.isGroup && (
                        <p className="chat-room-preview" style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '2px' }}>
                          {getRoomDisplayInfo(room)}
                        </p>
                      )}
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
                ))}
                {loadingMoreConversations && (
                  <div className="chat-loading-more-conversations">
                    <div>Chargement des conversations...</div>
                  </div>
                )}
              </>
            )}
          </div>
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
                      {selectedRoom.isGroup 
                        ? 'G'
                        : selectedRoom.otherParticipant 
                          ? getInitials(selectedRoom.otherParticipant.name || selectedRoom.otherParticipant.username)
                          : '?'}
                    </AvatarFallback>
                  </Avatar>
                </div>
                <div className="chat-header-info">
                  <h3>
                    {getRoomDisplayName(selectedRoom)}
                  </h3>
                  <p>
                    {getRoomDisplayInfo(selectedRoom)}
                  </p>
                </div>
              </div>
            </div>

            {/* Messages */}
            <ScrollArea className="chat-messages-area">
              <div className="chat-messages-container" ref={messagesContainerRef}>
                {hasMoreMessages && (
                  <div className="chat-load-more-container">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => selectedRoom && loadOlderMessages(selectedRoom.id)}
                      disabled={loadingOlderMessages}
                      className="chat-load-more-button"
                    >
                      {loadingOlderMessages ? 'Chargement...' : 'Charger plus de messages'}
                    </Button>
                  </div>
                )}
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
        <div className="modal-overlay" onClick={(e) => handleModalOverlayClick(e, () => setIsNewChatOpen(false))}>
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
                <label style={{ marginBottom: '8px', display: 'block', fontWeight: '500' }}>
                  Sélectionner des utilisateurs {selectedUserIds.length > 1 && '(Groupe)'}
                </label>
                <div style={{ 
                  maxHeight: '200px', 
                  overflowY: 'auto'
                }}>
                  {users.filter(user => {
                    const currentUserId = currentUser?.djangoUserId ?? currentUser?.id;
                    return user.id !== currentUserId;
                  }).map(user => {
                    const isSelected = selectedUserIds.includes(user.id);
                    return (
                      <div
                        key={user.id}
                        onClick={() => toggleUserSelection(user.id)}
                        style={{
                          padding: '8px 12px',
                          cursor: 'pointer',
                          backgroundColor: isSelected ? '#e0f2fe' : 'transparent',
                          marginBottom: '4px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between'
                        }}
                      >
                        <span>{user.name || user.username}</span>
                        {isSelected && (
                          <Check className="h-4 w-4" style={{ color: '#3b82f6', flexShrink: 0 }} />
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
              {selectedUserIds.length > 1 && (
                <div className="modal-form-field">
                  <label style={{ marginBottom: '8px', display: 'block', fontWeight: '500' }}>
                    Nom du groupe (optionnel)
                  </label>
                  <Input
                    placeholder="Nom du groupe"
                    value={groupChatName}
                    onChange={(e) => setGroupChatName(e.target.value)}
                  />
                </div>
              )}
              <div className="modal-form-actions">
                <Button variant="outline" onClick={() => {
                  setIsNewChatOpen(false);
                  setSelectedUserIds([]);
                  setGroupChatName('');
                }}>
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

