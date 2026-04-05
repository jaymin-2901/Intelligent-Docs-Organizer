import { useCallback, useEffect, useState } from 'react';
import { getCategories } from '../services/api';

function Categories() {
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadCategories = useCallback(async () => {
    setLoading(true);
    setError('');

    try {
      const response = await getCategories();
      if (response?.success) {
        setCategories(response.data || []);
      } else {
        setError('Unable to load categories.');
      }
    } catch (_) {
      setError('Unable to load categories.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadCategories();
  }, [loadCategories]);

  if (loading) {
    return (
      <div className="categories-page categories-page--state">
        <div className="categories-spinner" />
        <p>Loading categories...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="categories-page categories-page--state">
        <p>{error}</p>
        <button className="categories-refresh" onClick={loadCategories}>Try Again</button>
      </div>
    );
  }

  return (
    <div className="categories-page">
      <div className="categories-page__header">
        <div>
          <h2>Categories</h2>
          <p>{categories.length} categories in your document library</p>
        </div>
        <button className="categories-refresh" onClick={loadCategories}>Refresh</button>
      </div>

      {categories.length === 0 ? (
        <div className="categories-empty">
          <h3>No categories yet</h3>
          <p>Upload documents first and categories will appear here.</p>
        </div>
      ) : (
        <div className="categories-grid">
          {categories.map((category) => (
            <article key={category.name} className="category-card">
              <div className="category-card__title">{category.name}</div>
              <div className="category-card__count">{category.documentCount || 0}</div>
              <div className="category-card__label">documents</div>

              {Array.isArray(category.subCategories) && category.subCategories.length > 0 && (
                <div className="category-card__subs">
                  {category.subCategories.slice(0, 5).map((sub) => (
                    <span key={`${category.name}-${sub.name}`} className="category-card__chip">
                      {sub.name} ({sub.documentCount || 0})
                    </span>
                  ))}
                </div>
              )}
            </article>
          ))}
        </div>
      )}
    </div>
  );
}

export default Categories;
