import React, { useState, useEffect, useRef } from 'react';
import { Search, Loader2 } from 'lucide-react';
import { Input } from './ui/input';
import { Popover, PopoverContent, PopoverTrigger } from './ui/popover';
import { apiCall } from '../utils/api';
import '../styles/ContactSearchBar.css';

interface Contact {
  id: string;
  firstName?: string;
  lastName?: string;
  email?: string;
  phone?: string;
  mobile?: string;
}

export function ContactSearchBar() {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Contact[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const searchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Debounced search function
  useEffect(() => {
    // Clear previous timeout
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    // If query is too short, clear results
    if (!searchQuery || searchQuery.trim().length < 2) {
      setSearchResults([]);
      setIsLoading(false);
      return;
    }

    // Set loading state
    setIsLoading(true);

    // Debounce the search
    searchTimeoutRef.current = setTimeout(async () => {
      try {
        const response = await apiCall(
          `/api/contacts/?search=${encodeURIComponent(searchQuery.trim())}&page_size=10`
        );
        const results = response?.contacts || response || [];
        setSearchResults(results);
      } catch (error: any) {
        console.error('Error searching contacts:', error);
        setSearchResults([]);
      } finally {
        setIsLoading(false);
      }
    }, 300); // 300ms debounce

    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
    };
  }, [searchQuery]);

  const handleContactClick = (contactId: string) => {
    setIsOpen(false);
    setSearchQuery('');
    setSearchResults([]);
    window.open(`/contacts/${contactId}`, '_blank', 'width=1200,height=900,resizable=yes,scrollbars=yes');
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Escape') {
      setIsOpen(false);
      setSearchQuery('');
      setSearchResults([]);
    } else if (e.key === 'Enter' && searchResults.length > 0) {
      // Navigate to first result on Enter
      handleContactClick(searchResults[0].id);
    }
  };

  // Keep input focused when popover opens
  useEffect(() => {
    if (isOpen && inputRef.current) {
      // Small delay to ensure popover is rendered
      setTimeout(() => {
        inputRef.current?.focus();
      }, 0);
    }
  }, [isOpen]);

  const formatPhone = (phone?: string | number) => {
    if (!phone) return '';
    const phoneStr = String(phone).replace(/\s/g, '');
    if (phoneStr.length === 10) {
      return phoneStr.replace(/(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})/, '$1 $2 $3 $4 $5');
    }
    return phoneStr;
  };

  const getContactDisplayName = (contact: Contact) => {
    const firstName = (contact.firstName || '').trim();
    const lastName = (contact.lastName || '').trim();
    if (firstName || lastName) {
      return `${firstName}${firstName && lastName ? ' ' : ''}${lastName}`.trim();
    }
    return contact.email || 'Sans nom';
  };

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen} modal={false}>
      <PopoverTrigger asChild>
        <div className="contact-search-trigger">
          <Search className="contact-search-icon" />
          <Input
            ref={inputRef}
            type="text"
            placeholder="Rechercher un contact..."
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setIsOpen(true);
            }}
            onFocus={() => {
              if (searchQuery.trim().length >= 2 && searchResults.length > 0) {
                setIsOpen(true);
              }
            }}
            onKeyDown={handleKeyDown}
            className="contact-search-input"
            autoFocus
          />
          {isLoading && <Loader2 className="contact-search-loader" />}
        </div>
      </PopoverTrigger>
      <PopoverContent 
        className="contact-search-popover"
        align="start"
        onOpenAutoFocus={(e) => {
          // Prevent auto-focus on popover content, keep focus on input
          e.preventDefault();
          inputRef.current?.focus();
        }}
        style={{ width: 'var(--radix-popover-trigger-width)', maxHeight: '400px', maxWidth: '500px', zIndex: 10010 }}
      >
        {searchQuery.trim().length < 2 ? (
          <div className="contact-search-empty">
            <p>Tapez au moins 2 caractères pour rechercher</p>
          </div>
        ) : isLoading ? (
          <div className="contact-search-empty">
            <Loader2 className="contact-search-loader-spinner" />
            <p>Recherche en cours...</p>
          </div>
        ) : searchResults.length === 0 ? (
          <div className="contact-search-empty">
            <p>Aucun contact trouvé</p>
          </div>
        ) : (
          <div className="contact-search-results">
            {searchResults.map((contact) => (
              <div
                key={contact.id}
                className="contact-search-result-item"
                onClick={() => handleContactClick(contact.id)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    handleContactClick(contact.id);
                  }
                }}
                tabIndex={0}
                role="button"
              >
                <div className="contact-search-result-name">
                  {getContactDisplayName(contact)}
                </div>
                {contact.email && (
                  <div className="contact-search-result-email">
                    {contact.email}
                  </div>
                )}
                {(contact.phone || contact.mobile) && (
                  <div className="contact-search-result-phone">
                    {formatPhone(contact.phone || contact.mobile)}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}

