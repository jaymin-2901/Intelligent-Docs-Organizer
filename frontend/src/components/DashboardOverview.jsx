import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import API, { getCategories, getDocuments } from '../services/api';
import './DashboardOverview.css';

const DEFAULT_INSIGHTS = [
  {
    priority: 'medium',
    title: 'Organize By Module',
    message: 'Group documents by semester module to make retrieval faster during revision cycles.',
  },
  {
    priority: 'low',
    title: 'Pin Key References',
    message: 'Bookmark high-value references so they stay one click away while studying.',
  },
  {
    priority: 'high',
    title: 'Review Untagged Files',
    message: 'A few files may still be uncategorized. Classify them for better AI suggestions.',
  },
];

const PRIORITY_LABELS = {
  high: 'High',
  medium: 'Medium',
  low: 'Low',
};

const getDocumentTimestamp = (doc) => {
  const raw =
    doc?.uploaded_at
    || doc?.upload_date
    || doc?.created_at
    || doc?.updated_at
    || doc?.createdAt
    || doc?.date;

  const ts = raw ? new Date(raw).getTime() : 0;
  return Number.isFinite(ts) ? ts : 0;
};

const formatRelativeTime = (value) => {
  const ts = value ? new Date(value).getTime() : 0;
  if (!ts || Number.isNaN(ts)) return 'Recently added';

  const diff = Date.now() - ts;
  const minute = 60 * 1000;
  const hour = 60 * minute;
  const day = 24 * hour;

  if (diff < hour) {
    const m = Math.max(1, Math.floor(diff / minute));
    return `${m}m ago`;
  }
  if (diff < day) {
    const h = Math.max(1, Math.floor(diff / hour));
    return `${h}h ago`;
  }
  const d = Math.max(1, Math.floor(diff / day));
  return `${d}d ago`;
};

const normalizeStats = (rawStats, documents, categories) => {
  const stats = rawStats || {};
  const now = Date.now();
  const weekMs = 7 * 24 * 60 * 60 * 1000;

  const docsThisWeek = documents.filter((doc) => {
    const ts = getDocumentTimestamp(doc);
    return ts > 0 && now - ts <= weekMs;
  }).length;

  return {
    totalDocuments: stats.totalDocuments ?? documents.length,
    categoriesCount: stats.categoriesCount ?? categories.length,
    bookmarkedCount: stats.bookmarkedCount ?? documents.filter((doc) => doc.is_bookmarked).length,
    uploadsThisWeek: stats.uploadsThisWeek ?? docsThisWeek,
    totalViews: stats.totalViews ?? 0,
    readingMinutes: Math.round((stats.totalReadingTimeSeconds || 0) / 60),
  };
};

function DashboardOverview() {
  const navigate = useNavigate();

  const [documents, setDocuments] = useState([]);
  const [categories, setCategories] = useState([]);
  const [stats, setStats] = useState(null);
  const [suggestions, setSuggestions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let mounted = true;

    const load = async () => {
      setLoading(true);
      setError('');

      try {
        const [docsResult, categoriesResult, statsResult, suggestionsResult] = await Promise.allSettled([
          getDocuments(),
          getCategories(),
          API.get('/analytics/stats'),
          API.get('/analytics/suggestions'),
        ]);

        if (!mounted) return;

        const docs = docsResult.status === 'fulfilled' && docsResult.value?.success
          ? (docsResult.value.data || [])
          : [];

        const cats = categoriesResult.status === 'fulfilled' && categoriesResult.value?.success
          ? (categoriesResult.value.data || [])
          : [];

        const apiStats =
          statsResult.status === 'fulfilled' && statsResult.value?.data?.success
            ? (statsResult.value.data.data || null)
            : null;

        const aiSuggestions =
          suggestionsResult.status === 'fulfilled' && suggestionsResult.value?.data?.success
            ? (suggestionsResult.value.data.data || [])
            : [];

        setDocuments(docs);
        setCategories(cats);
        setStats(normalizeStats(apiStats, docs, cats));
        setSuggestions(Array.isArray(aiSuggestions) ? aiSuggestions : []);
      } catch (_) {
        if (!mounted) return;
        setError('Unable to load dashboard insights right now.');
      } finally {
        if (mounted) setLoading(false);
      }
    };

    load();

    return () => {
      mounted = false;
    };
  }, []);

  const recentDocuments = useMemo(() => {
    return [...documents]
      .sort((a, b) => getDocumentTimestamp(b) - getDocumentTimestamp(a))
      .slice(0, 6);
  }, [documents]);

  const topCategories = useMemo(() => {
    return [...categories]
      .sort((a, b) => (b.documentCount || 0) - (a.documentCount || 0))
      .slice(0, 6);
  }, [categories]);

  const topCategoryCount = topCategories[0]?.documentCount || 1;

  const insightItems = useMemo(() => {
    if (suggestions.length > 0) {
      return suggestions.slice(0, 3).map((s, idx) => ({
        id: `${s.title || 'insight'}-${idx}`,
        priority: s.priority || 'medium',
        title: s.title || 'AI Suggestion',
        message: s.message || 'A useful insight is available for your library.',
      }));
    }

    return DEFAULT_INSIGHTS.map((item, idx) => ({
      id: `default-${idx}`,
      ...item,
    }));
  }, [suggestions]);

  if (loading) {
    return (
      <div className="overview-page">
        <div className="overview-loading">Loading dashboard overview...</div>
      </div>
    );
  }

  return (
    <div className="overview-page">
      {error ? <div className="overview-banner overview-banner--error">{error}</div> : null}

      <div className="overview-bento">
        <section className="overview-card overview-card--recent">
          <header className="overview-card__header">
            <div>
              <h3>Recent Documents</h3>
              <p>Latest files in your workspace</p>
            </div>
            <button type="button" className="overview-link-btn" onClick={() => navigate('/dashboard/doc-view')}>
              Open library
            </button>
          </header>

          {recentDocuments.length === 0 ? (
            <div className="overview-empty">No documents yet. Upload your first file to begin.</div>
          ) : (
            <div className="overview-doc-list">
              {recentDocuments.map((doc) => {
                const category = doc.main_category || 'Uncategorized';
                const subCategory = doc.sub_category || null;
                const type = (doc.file_type || 'file').toUpperCase();
                const when = formatRelativeTime(
                  doc.uploaded_at || doc.upload_date || doc.created_at || doc.updated_at
                );

                return (
                  <article key={doc.id || doc.file_name || doc.original_name} className="overview-doc-row">
                    <div className="overview-doc-main">
                      <h4>{doc.original_name || doc.file_name || 'Untitled document'}</h4>
                      <div className="overview-doc-meta">
                        <span>{category}</span>
                        {subCategory ? <span>{subCategory}</span> : null}
                        <span>{type}</span>
                      </div>
                    </div>
                    <div className="overview-doc-side">
                      <span className="overview-pill">{when}</span>
                      <button
                        type="button"
                        className="overview-row-btn"
                        onClick={() => navigate('/dashboard/doc-view')}
                      >
                        Open
                      </button>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </section>

        <section className="overview-card overview-card--categories">
          <header className="overview-card__header">
            <div>
              <h3>Categories</h3>
              <p>Library organization snapshot</p>
            </div>
          </header>

          {topCategories.length === 0 ? (
            <div className="overview-empty">Categories will appear once documents are organized.</div>
          ) : (
            <div className="overview-categories-grid">
              {topCategories.map((category) => {
                const count = category.documentCount || 0;
                const width = `${Math.max(8, (count / topCategoryCount) * 100)}%`;

                return (
                  <article key={category.name} className="overview-category-card">
                    <div className="overview-category-card__top">
                      <h4>{category.name}</h4>
                      <strong>{count}</strong>
                    </div>
                    <div className="overview-category-bar">
                      <span style={{ width }} />
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </section>

        <section className="overview-card overview-card--analytics">
          <header className="overview-card__header">
            <div>
              <h3>Analytics Preview</h3>
              <p>Fast performance snapshot</p>
            </div>
            <button type="button" className="overview-link-btn" onClick={() => navigate('/dashboard/analytics')}>
              View analytics
            </button>
          </header>

          <div className="overview-metrics-grid">
            <div className="overview-metric">
              <span>Total Documents</span>
              <strong>{stats?.totalDocuments || 0}</strong>
            </div>
            <div className="overview-metric">
              <span>Categories</span>
              <strong>{stats?.categoriesCount || 0}</strong>
            </div>
            <div className="overview-metric">
              <span>Bookmarks</span>
              <strong>{stats?.bookmarkedCount || 0}</strong>
            </div>
            <div className="overview-metric">
              <span>Uploads This Week</span>
              <strong>{stats?.uploadsThisWeek || 0}</strong>
            </div>
          </div>
        </section>

        <section className="overview-card overview-card--insights">
          <header className="overview-card__header">
            <div>
              <h3>AI Insights</h3>
              <p>Actionable recommendations</p>
            </div>
          </header>

          <div className="overview-insights-list">
            {insightItems.map((item) => (
              <article key={item.id} className={`overview-insight overview-insight--${item.priority}`}>
                <div className="overview-insight__head">
                  <h4>{item.title}</h4>
                  <span>{PRIORITY_LABELS[item.priority] || 'Info'}</span>
                </div>
                <p>{item.message}</p>
              </article>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}

export default DashboardOverview;
