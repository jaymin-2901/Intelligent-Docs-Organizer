/**
 * Category Tree Component
 * Displays hierarchical category structure
 */

import React, { useState, useEffect } from 'react';
import { getCategories } from '../services/api';
import './CategoryTree.css';

const CategoryTree = ({ onSelectCategory, selectedCategory }) => {
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expandedCategories, setExpandedCategories] = useState({});

  useEffect(() => {
    fetchCategories();
  }, []);

  const fetchCategories = async () => {
    setLoading(true);
    const response = await getCategories();
    if (response.success) {
      setCategories(response.data);
    }
    setLoading(false);
  };

  const toggleExpand = (categoryName) => {
    setExpandedCategories(prev => ({
      ...prev,
      [categoryName]: !prev[categoryName]
    }));
  };

  const handleCategoryClick = (mainCategory, subCategory = null) => {
    onSelectCategory(mainCategory, subCategory);
  };

  if (loading) {
    return (
      <div className="category-tree loading">
        <div className="loading-spinner"></div>
        <p>Loading categories...</p>
      </div>
    );
  }

  return (
    <div className="category-tree">
      <div className="category-header">
        <h3>Categories</h3>
        <button onClick={fetchCategories} className="refresh-btn">
          ↻
        </button>
      </div>

      <div 
        className={`category-item all ${!selectedCategory ? 'active' : ''}`}
        onClick={() => handleCategoryClick(null)}
      >
        <span className="category-icon">📁</span>
        <span className="category-name">All Documents</span>
      </div>

      {categories.map(category => (
        <div key={category.name} className="category-group">
          <div 
            className={`category-item main ${
              selectedCategory?.main === category.name ? 'active' : ''
            }`}
            onClick={() => handleCategoryClick(category.name)}
          >
            <span 
              className="expand-icon"
              onClick={(e) => {
                e.stopPropagation();
                toggleExpand(category.name);
              }}
            >
              {expandedCategories[category.name] ? '▼' : '▶'}
            </span>
            <span className="category-icon">
              {getCategoryIcon(category.name)}
            </span>
            <span className="category-name">{category.name}</span>
            <span className="document-count">{category.documentCount}</span>
          </div>

          {expandedCategories[category.name] && category.subCategories && (
            <div className="sub-categories">
              {category.subCategories.map(sub => (
                <div
                  key={sub.name}
                  className={`category-item sub ${
                    selectedCategory?.sub === sub.name ? 'active' : ''
                  }`}
                  onClick={() => handleCategoryClick(category.name, sub.name)}
                >
                  <span className="category-icon">📄</span>
                  <span className="category-name">{sub.name}</span>
                  <span className="document-count">{sub.documentCount}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  );
};

// Helper function for category icons
const getCategoryIcon = (categoryName) => {
  const icons = {
    'Education': '🎓',
    'Finance': '💰',
    'Personal': '👤',
    'Research': '🔬',
    'Work': '💼',
    'Legal': '⚖️',
    'Uncategorized': '📂'
  };
  return icons[categoryName] || '📁';
};

export default CategoryTree;