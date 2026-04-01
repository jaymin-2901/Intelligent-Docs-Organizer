import React, { useState, useEffect, useRef } from 'react';
import './SearchBar.css';

function SearchBar({ 
  searchTerm = '', 
  onSearchChange, 
  placeholder = "Search documents...",
  showFilters = true,
  onFilterChange,
  className = ""
}) {
  const [isFocused, setIsFocused] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [searchHistory, setSearchHistory] = useState([]);
  const [activeFilter, setActiveFilter] = useState('all');
  
  const inputRef = useRef(null);
  const suggestionsRef = useRef(null);

  // Load search history from localStorage
  useEffect(() => {
    try {
      const savedHistory = localStorage.getItem('document-search-history');
      if (savedHistory) {
        setSearchHistory(JSON.parse(savedHistory));
      }
    } catch (error) {
      console.warn('Failed to load search history:', error);
    }
  }, []);

  // Save search history when it changes
  useEffect(() => {
    try {
      localStorage.setItem('document-search-history', JSON.stringify(searchHistory));
    } catch (error) {
      console.warn('Failed to save search history:', error);
    }
  }, [searchHistory]);

  const handleInputChange = (e) => {
    const value = e.target.value;
    onSearchChange(value);
    
    // Show suggestions if there's a value and we have history
    setShowSuggestions(value.length > 0 && searchHistory.length > 0);
  };

  const handleInputFocus = () => {
    setIsFocused(true);
    if (searchTerm.length > 0 && searchHistory.length > 0) {
      setShowSuggestions(true);
    }
  };

  const handleInputBlur = (e) => {
    // Delay to allow clicking on suggestions
    setTimeout(() => {
      setIsFocused(false);
      setShowSuggestions(false);
    }, 200);
  };

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    
    if (searchTerm.trim()) {
      // Add to search history (avoid duplicates)
      setSearchHistory(prev => {
        const filtered = prev.filter(term => term !== searchTerm.trim());
        return [searchTerm.trim(), ...filtered].slice(0, 10); // Keep only last 10
      });
      
      setShowSuggestions(false);
      inputRef.current?.blur();
    }
  };

  const handleSuggestionClick = (suggestion) => {
    onSearchChange(suggestion);
    setShowSuggestions(false);
    inputRef.current?.focus();
  };

  const handleClearSearch = () => {
    onSearchChange('');
    setShowSuggestions(false);
    inputRef.current?.focus();
  };

  const handleFilterChange = (filter) => {
    setActiveFilter(filter);
    if (onFilterChange) {
      onFilterChange(filter);
    }
  };

  const clearSearchHistory = () => {
    setSearchHistory([]);
    setShowSuggestions(false);
  };

  // Filter search history based on current input
  const filteredHistory = searchHistory.filter(term => 
    term.toLowerCase().includes(searchTerm.toLowerCase()) && term !== searchTerm
  );

  const filters = [
    { key: 'all', label: 'All', icon: '📄' },
    { key: 'pdf', label: 'PDF', icon: '📕' },
    { key: 'text', label: 'Text', icon: '📝' },
    { key: 'word', label: 'Word', icon: '📘' },
    { key: 'image', label: 'Images', icon: '🖼️' }
  ];

  return (
    <div className={`search-bar ${isFocused ? 'focused' : ''} ${className}`}>
      <form className="search-form" onSubmit={handleSearchSubmit}>
        <div className="search-input-container">
          <div className="search-icon">🔍</div>
          
          <input
            ref={inputRef}
            type="text"
            className="search-input"
            placeholder={placeholder}
            value={searchTerm}
            onChange={handleInputChange}
            onFocus={handleInputFocus}
            onBlur={handleInputBlur}
          />
          
          {searchTerm && (
            <button
              type="button"
              className="clear-search-btn"
              onClick={handleClearSearch}
              title="Clear search"
            >
              ✕
            </button>
          )}
          
          {/* Search Suggestions */}
          {showSuggestions && filteredHistory.length > 0 && (
            <div ref={suggestionsRef} className="search-suggestions">
              <div className="suggestions-header">
                <span>Recent searches</span>
                <button
                  type="button"
                  className="clear-history-btn"
                  onClick={clearSearchHistory}
                  title="Clear search history"
                >
                  🗑️
                </button>
              </div>
              
              <div className="suggestions-list">
                {filteredHistory.slice(0, 5).map((suggestion, index) => (
                  <button
                    key={index}
                    type="button"
                    className="suggestion-item"
                    onClick={() => handleSuggestionClick(suggestion)}
                  >
                    <span className="suggestion-icon">🕐</span>
                    <span className="suggestion-text">{suggestion}</span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
        
        <button
          type="submit"
          className="search-submit-btn"
          disabled={!searchTerm.trim()}
          title="Search documents"
        >
          Search
        </button>
      </form>
      
      {/* Search Filters */}
      {showFilters && (
        <div className="search-filters">
          {filters.map(filter => (
            <button
              key={filter.key}
              type="button"
              className={`filter-btn ${activeFilter === filter.key ? 'active' : ''}`}
              onClick={() => handleFilterChange(filter.key)}
              title={`Filter by ${filter.label}`}
            >
              <span className="filter-icon">{filter.icon}</span>
              <span className="filter-label">{filter.label}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export default SearchBar;