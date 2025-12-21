import React, { memo, useState, useCallback, useEffect, useRef } from 'react';
import { Icon } from '../components/Icon';
import { useAppState } from '../contexts/AppContext';

interface OmnibarProps {
  placeholder?: string;
  onSearch?: (query: string) => void;
}

export const Omnibar = memo<OmnibarProps>(({
  placeholder = 'Search bookmarks... (Ctrl+K)',
  onSearch,
}) => {
  const [query, setQuery] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const { bookmarks } = useAppState();

  const handleSearch = useCallback((value: string) => {
    setQuery(value);
    onSearch?.(value);
  }, [onSearch]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      setIsOpen(false);
      inputRef.current?.blur();
    }
  }, []);

  // Global keyboard shortcut
  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        setIsOpen(true);
        inputRef.current?.focus();
      }
    };

    document.addEventListener('keydown', handleGlobalKeyDown);
    return () => document.removeEventListener('keydown', handleGlobalKeyDown);
  }, []);

  const filteredBookmarks = query
    ? bookmarks.filter(b =>
        b.title.toLowerCase().includes(query.toLowerCase()) ||
        b.url.toLowerCase().includes(query.toLowerCase()) ||
        (b.tags && b.tags.toLowerCase().includes(query.toLowerCase()))
      ).slice(0, 10)
    : [];

  return (
    <div className={`omnibar ${isOpen ? 'omnibar-open' : ''}`}>
      <div className="omnibar-input-wrapper">
        <Icon name="search" size={18} />
        <input
          ref={inputRef}
          type="text"
          className="omnibar-input"
          placeholder={placeholder}
          value={query}
          onChange={(e) => handleSearch(e.target.value)}
          onFocus={() => setIsOpen(true)}
          onKeyDown={handleKeyDown}
          id="search-input"
        />
        {query && (
          <button
            className="omnibar-clear"
            onClick={() => handleSearch('')}
            aria-label="Clear search"
          >
            <Icon name="close" size={16} />
          </button>
        )}
        <kbd className="omnibar-shortcut">Ctrl+K</kbd>
      </div>

      {isOpen && query && (
        <div className="omnibar-results">
          {filteredBookmarks.length > 0 ? (
            <div className="omnibar-results-list">
              {filteredBookmarks.map(bookmark => (
                <a
                  key={bookmark.id}
                  href={bookmark.url}
                  className="omnibar-result-item"
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() => {
                    setIsOpen(false);
                    setQuery('');
                  }}
                >
                  {bookmark.favicon && (
                    <img
                      src={bookmark.favicon}
                      alt=""
                      className="omnibar-result-favicon"
                      width={16}
                      height={16}
                    />
                  )}
                  <div className="omnibar-result-content">
                    <div className="omnibar-result-title">{bookmark.title}</div>
                    <div className="omnibar-result-url">{bookmark.url}</div>
                  </div>
                </a>
              ))}
            </div>
          ) : (
            <div className="omnibar-no-results">
              <p>No bookmarks found for "{query}"</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
});

Omnibar.displayName = 'Omnibar';
