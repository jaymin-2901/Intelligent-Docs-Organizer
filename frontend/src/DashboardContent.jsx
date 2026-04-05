import {
  Suspense,
  lazy,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { Navigate, Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import Sidebar from './components/Sidebar';
import { toast } from './components/Toast';
import { useAuth } from './context/AuthContext';
import {
  getDocuments,
  deleteDocument,
  uploadDocument,
  toggleBookmark,
  recordAnalyticsEvent,
} from './services/api';
import './styles/dashboard-shell.css';

const AnalyticsDashboard = lazy(() => import('./components/AnalyticsDashboard'));
const DashboardOverview = lazy(() => import('./components/DashboardOverview'));
const DocumentViewer = lazy(() => import('./components/DocumentViewer'));
const GestureGuide = lazy(() => import('./components/GestureGuide'));
const GestureRecognition = lazy(() => import('./components/GestureRecognition'));
const Categories = lazy(() => import('./pages/Categories'));

const DASHBOARD_SHORTCUTS = [
  { keys: '/', action: 'Focus global search' },
  { keys: 'Ctrl+K / Cmd+K', action: 'Jump to global search' },
  { keys: 'G then O', action: 'Open overview page' },
  { keys: 'G then D', action: 'Open document library' },
  { keys: 'G then A', action: 'Open analytics workspace' },
  { keys: 'G then C', action: 'Open categories page' },
  { keys: 'G then I', action: 'Open Gesture Guide page' },
  { keys: '?', action: 'Toggle this shortcuts panel' },
  { keys: 'Esc', action: 'Close menus and panels' },
  { keys: 'Arrow Up / Arrow Down', action: 'Move document selection in library' },
  { keys: 'B', action: 'Bookmark selected document' },
];

function RouteSectionFallback({ label = 'Loading section...' }) {
  return (
    <div className="route-section-fallback" aria-live="polite" aria-busy="true">
      <div className="route-section-fallback__spinner" />
      <p>{label}</p>
    </div>
  );
}

function DocViewPage() {
  const [documents, setDocuments] = useState([]);
  const [selectedDocument, setSelectedDocument] = useState(null);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [pageNumber, setPageNumber] = useState(1);
  const [totalPages, setTotalPages] = useState(0);
  const [zoom, setZoom] = useState(1.0);

  const fileInputRef = useRef(null);
  const docOpenStartRef = useRef(null);

  const loadDocuments = useCallback(async () => {
    setLoading(true);
    try {
      const response = await getDocuments();
      const nextDocs = response?.success ? response.data || [] : [];
      setDocuments(nextDocs);

      setSelectedDocument((prev) => {
        if (!prev) return nextDocs[0] || null;
        const fresh = nextDocs.find((d) => String(d.id) === String(prev.id));
        return fresh || nextDocs[0] || null;
      });
    } catch (_) {
      toast.error('Unable to load documents.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadDocuments();
  }, [loadDocuments]);

  useEffect(() => {
    const onGlobalSearch = (event) => {
      const query = typeof event?.detail?.query === 'string' ? event.detail.query : '';
      setSearchQuery(query);
    };

    window.addEventListener('dashboard-global-search', onGlobalSearch);
    return () => {
      window.removeEventListener('dashboard-global-search', onGlobalSearch);
    };
  }, []);

  const filteredDocuments = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return documents;

    return documents.filter((doc) => {
      const text = [
        doc.original_name,
        doc.main_category,
        doc.sub_category,
        ...(Array.isArray(doc.keywords) ? doc.keywords : []),
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();

      return text.includes(q);
    });
  }, [documents, searchQuery]);

  const selectDocument = useCallback((doc) => {
    if (!doc) return;
    setSelectedDocument(doc);
    setPageNumber(1);
    setTotalPages(0);
    setZoom(1.0);
    docOpenStartRef.current = Date.now();
  }, []);

  const closeDocument = useCallback(() => {
    const current = selectedDocument;
    const startedAt = docOpenStartRef.current;

    if (current?.id && startedAt) {
      const durationSeconds = Math.max(0, Math.round((Date.now() - startedAt) / 1000));
      recordAnalyticsEvent({
        documentId: current.id,
        eventType: 'view',
        eventData: { source: 'doc-view' },
        durationSeconds,
      }).catch(() => {});
    }

    docOpenStartRef.current = null;
    setSelectedDocument(null);
    setPageNumber(1);
    setTotalPages(0);
    setZoom(1.0);
  }, [selectedDocument]);

  const applyBookmarkState = useCallback((docId, nextStatus) => {
    setDocuments((prev) =>
      prev.map((doc) =>
        String(doc.id) === String(docId)
          ? { ...doc, is_bookmarked: nextStatus }
          : doc
      )
    );

    setSelectedDocument((prev) =>
      prev && String(prev.id) === String(docId)
        ? { ...prev, is_bookmarked: nextStatus }
        : prev
    );
  }, []);

  const handleToggleBookmarkForDoc = useCallback(async (docId) => {
    if (!docId) return;

    try {
      const response = await toggleBookmark(docId);
      const nextStatus = Boolean(response?.data?.isBookmarked);
      applyBookmarkState(docId, nextStatus);
      toast.success(nextStatus ? 'Document bookmarked.' : 'Bookmark removed.');
    } catch (_) {
      toast.error('Unable to update bookmark.');
    }
  }, [applyBookmarkState]);

  const handleToggleBookmark = useCallback(async () => {
    if (!selectedDocument?.id) return;
    await handleToggleBookmarkForDoc(selectedDocument.id);
  }, [selectedDocument, handleToggleBookmarkForDoc]);

  const handleDelete = useCallback((docId) => {
    let fallbackDocument = null;

    setDocuments((prev) => {
      const next = prev.filter((doc) => String(doc.id) !== String(docId));
      fallbackDocument = next[0] || null;
      return next;
    });

    setSelectedDocument((prev) => {
      if (!prev || String(prev.id) !== String(docId)) {
        return prev;
      }
      return fallbackDocument;
    });

    toast.success('Document deleted.');
  }, []);

  const handleDeleteDocumentAction = useCallback(async (docId) => {
    if (!docId) return;

    try {
      const response = await deleteDocument(docId);
      if (response?.success) {
        handleDelete(docId);
      } else {
        toast.error(response?.error || 'Unable to delete document.');
      }
    } catch (_) {
      toast.error('Unable to delete document.');
    }
  }, [handleDelete]);

  const handleUploadFiles = useCallback(async (files) => {
    if (!files?.length) return;

    setUploading(true);
    let uploadedCount = 0;

    for (const file of files) {
      try {
        const response = await uploadDocument(file);
        if (response?.success) uploadedCount += 1;
      } catch (_) {
        toast.error(`Upload failed: ${file.name}`);
      }
    }

    setUploading(false);

    if (uploadedCount > 0) {
      toast.success(`${uploadedCount} document(s) uploaded.`);
      await loadDocuments();
    }
  }, [loadDocuments]);

  useEffect(() => {
    const runFabAction = (actionName) => {
      if (actionName === 'dashboard-fab-upload') {
        fileInputRef.current?.click();
        return;
      }

      if (actionName === 'dashboard-fab-summary') {
        if (!documents.length) {
          toast.warn('Upload at least one document to generate AI summary.');
          return;
        }

        if (!selectedDocument) {
          selectDocument(documents[0]);
          window.setTimeout(() => {
            window.dispatchEvent(new Event('dv-summary'));
          }, 140);
          return;
        }

        window.dispatchEvent(new Event('dv-summary'));
      }
    };

    const consumePendingFabAction = () => {
      const pendingAction = sessionStorage.getItem('dashboardFabAction');
      if (!pendingAction) return;

      sessionStorage.removeItem('dashboardFabAction');
      window.setTimeout(() => runFabAction(pendingAction), 120);
    };

    const onFabUpload = () => runFabAction('dashboard-fab-upload');
    const onFabSummary = () => runFabAction('dashboard-fab-summary');

    consumePendingFabAction();
    window.addEventListener('dashboard-fab-upload', onFabUpload);
    window.addEventListener('dashboard-fab-summary', onFabSummary);

    return () => {
      window.removeEventListener('dashboard-fab-upload', onFabUpload);
      window.removeEventListener('dashboard-fab-summary', onFabSummary);
    };
  }, [documents, selectedDocument, selectDocument]);

  useEffect(() => {
    const onBookmark = () => { handleToggleBookmark(); };
    const onSelectNext = () => {
      if (!filteredDocuments.length) return;

      const currentIdx = selectedDocument
        ? filteredDocuments.findIndex((d) => String(d.id) === String(selectedDocument.id))
        : -1;

      const nextIdx = currentIdx < 0
        ? 0
        : (currentIdx + 1) % filteredDocuments.length;

      selectDocument(filteredDocuments[nextIdx]);
    };

    window.addEventListener('dv-bookmark', onBookmark);
    window.addEventListener('dv-select-next-doc', onSelectNext);

    return () => {
      window.removeEventListener('dv-bookmark', onBookmark);
      window.removeEventListener('dv-select-next-doc', onSelectNext);
    };
  }, [filteredDocuments, handleToggleBookmark, selectDocument, selectedDocument]);

  useEffect(() => {
    const onDocListShortcuts = (event) => {
      if (event.defaultPrevented) return;

      const target = event.target;
      const tag = target?.tagName;
      const isEditable =
        target?.isContentEditable
        || tag === 'INPUT'
        || tag === 'TEXTAREA'
        || tag === 'SELECT';

      if (isEditable || !filteredDocuments.length) return;

      const currentIndex = selectedDocument
        ? filteredDocuments.findIndex((d) => String(d.id) === String(selectedDocument.id))
        : -1;

      const selectByOffset = (offset) => {
        const baseIndex = currentIndex < 0 ? 0 : currentIndex;
        const nextIndex = (baseIndex + offset + filteredDocuments.length) % filteredDocuments.length;
        selectDocument(filteredDocuments[nextIndex]);
      };

      if (event.key === 'ArrowDown' || event.key.toLowerCase() === 'j') {
        event.preventDefault();
        selectByOffset(1);
        return;
      }

      if (event.key === 'ArrowUp' || event.key.toLowerCase() === 'k') {
        event.preventDefault();
        selectByOffset(-1);
        return;
      }

      if (event.key.toLowerCase() === 'b' && selectedDocument?.id) {
        event.preventDefault();
        handleToggleBookmark();
      }
    };

    window.addEventListener('keydown', onDocListShortcuts);
    return () => {
      window.removeEventListener('keydown', onDocListShortcuts);
    };
  }, [filteredDocuments, handleToggleBookmark, selectDocument, selectedDocument]);

  return (
    <div className="docview-page">
      <div className="docview-toolbar">
        <div className="docview-toolbar__left">
          <h2>Doc View</h2>
          <span>{documents.length} documents</span>
        </div>

        <div className="docview-toolbar__right">
          <input
            className="docview-search"
            type="text"
            placeholder="Search documents..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />

          <button className="docview-btn" onClick={loadDocuments} disabled={loading}>
            Refresh
          </button>

          <button
            className="docview-btn docview-btn--primary"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
          >
            {uploading ? 'Uploading...' : 'Upload'}
          </button>

          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf,.doc,.docx,.txt,.ppt,.pptx,.xls,.xlsx"
            multiple
            hidden
            onChange={(e) => {
              const files = Array.from(e.target.files || []);
              handleUploadFiles(files);
              e.target.value = '';
            }}
          />
        </div>
      </div>

      <div className="docview-layout">
        <aside className="docview-list">
          {loading ? (
            <div className="docview-list__state">Loading...</div>
          ) : filteredDocuments.length === 0 ? (
            <div className="docview-list__state">No documents found.</div>
          ) : (
            filteredDocuments.map((doc) => {
              const selected = selectedDocument && String(selectedDocument.id) === String(doc.id);
              const bookmarked = Boolean(doc.is_bookmarked);
              const tags = [
                doc.main_category || 'Uncategorized',
                doc.sub_category || null,
                doc.file_type?.toUpperCase() || 'FILE',
              ].filter(Boolean);

              return (
                <article
                  key={doc.id}
                  className={`docview-item ${selected ? 'active' : ''}`}
                  onClick={() => selectDocument(doc)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' || event.key === ' ') {
                      event.preventDefault();
                      selectDocument(doc);
                    }
                  }}
                >
                  <div className="docview-item__header">
                    <div className="docview-item__title" title={doc.original_name}>{doc.original_name}</div>
                    {bookmarked ? <span className="docview-item__bookmark">★</span> : null}
                  </div>

                  <div className="docview-item__meta">
                    {tags.map((tag) => (
                      <span key={`${doc.id}-${tag}`}>{tag}</span>
                    ))}
                  </div>

                  <div className="docview-item__actions" onClick={(event) => event.stopPropagation()}>
                    <button
                      type="button"
                      className="docview-item__action docview-item__action--open"
                      onClick={() => selectDocument(doc)}
                    >
                      Open
                    </button>
                    <button
                      type="button"
                      className={`docview-item__action ${bookmarked ? 'is-bookmarked' : ''}`}
                      onClick={() => handleToggleBookmarkForDoc(doc.id)}
                    >
                      {bookmarked ? 'Bookmarked' : 'Bookmark'}
                    </button>
                    <button
                      type="button"
                      className="docview-item__action docview-item__action--danger"
                      onClick={() => handleDeleteDocumentAction(doc.id)}
                    >
                      Delete
                    </button>
                  </div>
                </article>
              );
            })
          )}
        </aside>

        <section className="docview-viewer">
          <Suspense fallback={<div className="docview-viewer__loading">Preparing viewer...</div>}>
            <DocumentViewer
              document={selectedDocument}
              pageNumber={pageNumber}
              totalPages={totalPages}
              zoom={zoom}
              onPageChange={setPageNumber}
              onZoomChange={setZoom}
              onTotalPagesChange={setTotalPages}
              onClose={closeDocument}
              bookmarked={Boolean(selectedDocument?.is_bookmarked)}
              onToggleBookmark={handleToggleBookmark}
              onDelete={handleDelete}
            />
          </Suspense>
        </section>
      </div>
    </div>
  );
}

function DashboardContent() {
  const { logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const topSearchInputRef = useRef(null);
  const pendingGotoRef = useRef(false);
  const pendingGotoTimeoutRef = useRef(null);
  const [gestureEnabled, setGestureEnabled] = useState(false);
  const [gestureStatus, setGestureStatus] = useState('disabled');
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [globalSearch, setGlobalSearch] = useState('');
  const [isTopSearchFocused, setIsTopSearchFocused] = useState(false);
  const [fabOpen, setFabOpen] = useState(false);
  const [showShortcuts, setShowShortcuts] = useState(false);

  const pageMeta = useMemo(() => {
    const path = location.pathname;

    if (path.includes('/overview')) {
      return { title: 'Dashboard', subtitle: 'Your intelligent command center for documents and syllabus planning' };
    }

    if (path.includes('/analytics')) {
      return { title: 'Analytics', subtitle: 'Track activity and document behavior trends' };
    }
    if (path.includes('/categories')) {
      return { title: 'Categories', subtitle: 'Browse and manage your document taxonomy' };
    }
    if (path.includes('/gesture-guide')) {
      return { title: 'Gesture Guide', subtitle: 'Gesture controls and interaction tips' };
    }
    if (path.includes('/doc-view')) {
      return { title: 'All Documents', subtitle: 'Search, organize, and interact with your files' };
    }

    return { title: 'Dashboard', subtitle: 'Intelligent Document & Syllabus Organizer' };
  }, [location.pathname]);

  useEffect(() => {
    window.dispatchEvent(new CustomEvent('dashboard-global-search', {
      detail: { query: globalSearch },
    }));
  }, [globalSearch]);

  useEffect(() => {
    setFabOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    if (!fabOpen && !showShortcuts) return;

    const onEscape = (event) => {
      if (event.key === 'Escape') {
        setFabOpen(false);
        setShowShortcuts(false);
      }
    };

    window.addEventListener('keydown', onEscape);
    return () => {
      window.removeEventListener('keydown', onEscape);
    };
  }, [fabOpen, showShortcuts]);

  useEffect(() => {
    const schedule = window.requestIdleCallback
      ? window.requestIdleCallback
      : (callback) => window.setTimeout(callback, 500);

    const cancel = window.cancelIdleCallback
      ? window.cancelIdleCallback
      : (id) => window.clearTimeout(id);

    const idleId = schedule(() => {
      import('./components/AnalyticsDashboard');
      import('./components/DashboardOverview');
      import('./components/GestureGuide');
      import('./pages/Categories');
    });

    return () => {
      cancel(idleId);
    };
  }, []);

  const triggerDocViewAction = useCallback((actionName) => {
    if (location.pathname.includes('/doc-view')) {
      window.dispatchEvent(new Event(actionName));
      return;
    }

    sessionStorage.setItem('dashboardFabAction', actionName);
    navigate('/dashboard/doc-view');
  }, [location.pathname, navigate]);

  const handleFabAction = useCallback((actionName) => {
    setFabOpen(false);

    switch (actionName) {
      case 'upload':
        triggerDocViewAction('dashboard-fab-upload');
        break;
      case 'summary':
        triggerDocViewAction('dashboard-fab-summary');
        toast.info('Preparing AI summary...');
        break;
      case 'insights':
        navigate('/dashboard/gesture-guide');
        break;
      default:
        break;
    }
  }, [navigate, triggerDocViewAction]);

  useEffect(() => {
    const onQuickSearch = (event) => {
      if (event.key !== '/' || event.ctrlKey || event.metaKey || event.altKey) {
        return;
      }

      const target = event.target;
      const tag = target?.tagName;
      const isEditable =
        target?.isContentEditable
        || tag === 'INPUT'
        || tag === 'TEXTAREA'
        || tag === 'SELECT';

      if (isEditable) {
        return;
      }

      event.preventDefault();
      topSearchInputRef.current?.focus();
    };

    window.addEventListener('keydown', onQuickSearch);
    return () => {
      window.removeEventListener('keydown', onQuickSearch);
    };
  }, []);

  useEffect(() => {
    const keyToRoute = {
      o: '/dashboard/overview',
      d: '/dashboard/doc-view',
      a: '/dashboard/analytics',
      c: '/dashboard/categories',
      i: '/dashboard/gesture-guide',
    };

    const clearPendingGoto = () => {
      pendingGotoRef.current = false;
      if (pendingGotoTimeoutRef.current) {
        window.clearTimeout(pendingGotoTimeoutRef.current);
        pendingGotoTimeoutRef.current = null;
      }
    };

    const armPendingGoto = () => {
      clearPendingGoto();
      pendingGotoRef.current = true;
      pendingGotoTimeoutRef.current = window.setTimeout(() => {
        pendingGotoRef.current = false;
        pendingGotoTimeoutRef.current = null;
      }, 950);
    };

    const onCommandShortcuts = (event) => {
      const rawKey = event.key || '';
      const key = rawKey.toLowerCase();

      const target = event.target;
      const tag = target?.tagName;
      const isEditable =
        target?.isContentEditable
        || tag === 'INPUT'
        || tag === 'TEXTAREA'
        || tag === 'SELECT';

      if ((event.ctrlKey || event.metaKey) && key === 'k') {
        event.preventDefault();
        setShowShortcuts(false);
        topSearchInputRef.current?.focus();
        return;
      }

      if (!isEditable && rawKey === '?') {
        event.preventDefault();
        setShowShortcuts((prev) => !prev);
        return;
      }

      if (isEditable) return;

      if (pendingGotoRef.current) {
        const route = keyToRoute[key];
        if (route) {
          event.preventDefault();
          setFabOpen(false);
          setShowShortcuts(false);
          navigate(route);
          clearPendingGoto();
          return;
        }

        if (key !== 'g') {
          clearPendingGoto();
        }
      }

      if (!event.ctrlKey && !event.metaKey && !event.altKey && key === 'g') {
        event.preventDefault();
        armPendingGoto();
      }
    };

    window.addEventListener('keydown', onCommandShortcuts);

    return () => {
      window.removeEventListener('keydown', onCommandShortcuts);
      clearPendingGoto();
    };
  }, [navigate]);

  const handleGestureDetected = useCallback((event) => {
    const action = event?.action;
    const pointerAnchor = event?.pointer &&
      typeof event.pointer.x === 'number' &&
      typeof event.pointer.y === 'number'
      ? {
          x: Math.min(1, Math.max(0, event.pointer.x)),
          y: Math.min(1, Math.max(0, event.pointer.y)),
        }
      : null;

    if (!action) return;

    switch (action) {
      case 'nextPage':
        window.dispatchEvent(new Event('dv-next-page'));
        break;
      case 'prevPage':
        window.dispatchEvent(new Event('dv-prev-page'));
        break;
      case 'zoomIn':
        window.dispatchEvent(new CustomEvent('dv-zoom-at', {
          detail: { delta: 0.16, anchor: pointerAnchor },
        }));
        break;
      case 'zoomOut':
        window.dispatchEvent(new CustomEvent('dv-zoom-at', {
          detail: { delta: -0.16, anchor: pointerAnchor },
        }));
        break;
      case 'scrollUp':
        window.dispatchEvent(new CustomEvent('dv-scroll', { detail: { direction: 'up', amount: 240 } }));
        break;
      case 'scrollDown':
        window.dispatchEvent(new CustomEvent('dv-scroll', { detail: { direction: 'down', amount: 240 } }));
        break;
      case 'bookmark':
        window.dispatchEvent(new Event('dv-bookmark'));
        break;
      case 'select':
        window.dispatchEvent(new Event('dv-select-next-doc'));
        break;
      case 'close':
        window.dispatchEvent(new Event('dv-close-doc'));
        break;
      case 'showDocuments':
        navigate('/dashboard/doc-view');
        break;
      case 'customRock':
      case 'fullscreen':
      case 'fullScreen':
      case 'toggleFullscreen':
      case 'yoyo':
        window.dispatchEvent(new Event('dv-fullscreen-enter'));
        break;
      case 'customThree':
        navigate('/dashboard/gesture-guide');
        break;
      case 'customFour':
        navigate('/dashboard/analytics');
        break;
      case 'summary':
        window.dispatchEvent(new Event('dv-summary'));
        toast.info('Generating AI summary...');
        break;
      case 'confirm':
        window.dispatchEvent(new Event('dv-zoom-reset'));
        toast.success('Zoom reset to 100%.');
        break;
      default:
        break;
    }
  }, [navigate]);

  return (
    <div className={`dashboard-shell ${sidebarCollapsed ? 'dashboard-shell--collapsed' : 'dashboard-shell--expanded'}`}>
      <a className="dashboard-skip-link" href="#dashboard-main-content">
        Skip to main content
      </a>

      <aside className="dashboard-shell__sidebar">
        <Sidebar
          collapsed={sidebarCollapsed}
          onToggleCollapse={() => setSidebarCollapsed((prev) => !prev)}
        />
      </aside>

      <section className="dashboard-shell__workspace">
        <header className="dashboard-topbar">
          <div className="dashboard-topbar__title">
            <h1>{pageMeta.title}</h1>
            <p>{pageMeta.subtitle}</p>
          </div>

          <div className={`dashboard-topbar__search ${isTopSearchFocused ? 'is-focused' : ''}`}>
            <span className="dashboard-topbar__search-icon" aria-hidden="true">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="11" cy="11" r="7" />
                <line x1="21" y1="21" x2="16.65" y2="16.65" />
              </svg>
            </span>
            <input
              ref={topSearchInputRef}
              type="search"
              value={globalSearch}
              onChange={(e) => setGlobalSearch(e.target.value)}
              onFocus={() => setIsTopSearchFocused(true)}
              onBlur={() => setIsTopSearchFocused(false)}
              onKeyDown={(event) => {
                if (event.key === 'Escape') {
                  setGlobalSearch('');
                  event.currentTarget.blur();
                  return;
                }

                if (event.key === 'Enter' && !location.pathname.includes('/doc-view')) {
                  navigate('/dashboard/doc-view');
                }
              }}
              placeholder="Search documents, categories, keywords, and tags..."
              aria-label="Search documents"
              aria-keyshortcuts="/,Control+K,Meta+K"
            />

            {globalSearch ? (
              <button
                type="button"
                className="dashboard-topbar__search-clear"
                onClick={() => {
                  setGlobalSearch('');
                  topSearchInputRef.current?.focus();
                }}
                aria-label="Clear search"
              >
                ✕
              </button>
            ) : null}

            <span className="dashboard-topbar__search-shortcut" aria-hidden="true">/</span>
          </div>

          <div className="dashboard-topbar__actions">
            <span
              className={`gesture-chip gesture-chip--${gestureStatus.replace(/\s+/g, '-').toLowerCase()}`}
              aria-live="polite"
              role="status"
            >
              Gesture: {gestureStatus}
            </span>

            <button
              className={`dashboard-btn ${gestureEnabled ? 'dashboard-btn--active' : ''}`}
              onClick={() => {
                setGestureEnabled((prev) => {
                  const next = !prev;
                  if (!next) {
                    setGestureStatus('disabled');
                  }
                  return next;
                });
              }}
              aria-pressed={gestureEnabled}
            >
              {gestureEnabled ? 'Disable Gestures' : 'Enable Gestures'}
            </button>

            <button
              className="dashboard-btn"
              onClick={() => setShowShortcuts(true)}
              aria-haspopup="dialog"
              aria-expanded={showShortcuts}
            >
              Shortcuts
            </button>

            <button
              className="dashboard-btn"
              onClick={() => {
                logout();
                navigate('/login', { replace: true });
              }}
            >
              Logout
            </button>
          </div>
        </header>

        <main id="dashboard-main-content" className="dashboard-shell__main" tabIndex={-1}>
          <Suspense fallback={<RouteSectionFallback label="Loading workspace section..." />}>
            <Routes>
              <Route index element={<Navigate to="overview" replace />} />
              <Route path="overview" element={<DashboardOverview />} />
              <Route path="doc-view" element={<DocViewPage />} />
              <Route path="analytics" element={<AnalyticsDashboard />} />
              <Route path="gesture-guide" element={<GestureGuide />} />
              <Route path="categories" element={<Categories />} />
              <Route path="*" element={<Navigate to="overview" replace />} />
            </Routes>
          </Suspense>
        </main>
      </section>

      <div className={`dashboard-fab-stack ${fabOpen ? 'is-open' : ''}`}>
        <div id="dashboard-quick-actions" className="dashboard-fab-menu" role="menu" aria-hidden={!fabOpen} aria-label="Quick actions">
          <button
            type="button"
            className="dashboard-fab-action"
            onClick={() => handleFabAction('upload')}
          >
            <span className="dashboard-fab-action__icon">↑</span>
            <span>Upload Document</span>
          </button>

          <button
            type="button"
            className="dashboard-fab-action"
            onClick={() => handleFabAction('summary')}
          >
            <span className="dashboard-fab-action__icon">🧠</span>
            <span>Generate AI Summary</span>
          </button>

          <button
            type="button"
            className="dashboard-fab-action"
            onClick={() => handleFabAction('insights')}
          >
            <span className="dashboard-fab-action__icon">✨</span>
            <span>Gesture Guide</span>
          </button>
        </div>

        <button
          type="button"
          className="dashboard-fab-trigger"
          onClick={() => setFabOpen((prev) => !prev)}
          aria-expanded={fabOpen}
          aria-label={fabOpen ? 'Close quick actions' : 'Open quick actions'}
          title={fabOpen ? 'Close quick actions' : 'Quick actions'}
          aria-controls="dashboard-quick-actions"
        >
          {fabOpen ? '✕' : '+'}
        </button>
      </div>

      {showShortcuts ? (
        <div
          className="dashboard-shortcuts-backdrop"
          role="dialog"
          aria-modal="true"
          aria-labelledby="dashboard-shortcuts-title"
          onClick={() => setShowShortcuts(false)}
        >
          <div className="dashboard-shortcuts" onClick={(event) => event.stopPropagation()}>
            <div className="dashboard-shortcuts__header">
              <h2 id="dashboard-shortcuts-title">Keyboard Shortcuts</h2>
              <button
                type="button"
                className="dashboard-shortcuts__close"
                onClick={() => setShowShortcuts(false)}
                aria-label="Close keyboard shortcuts"
              >
                ✕
              </button>
            </div>

            <p className="dashboard-shortcuts__hint">
              Power shortcuts for faster navigation and document management.
            </p>

            <div className="dashboard-shortcuts__list">
              {DASHBOARD_SHORTCUTS.map((item) => (
                <div key={item.keys} className="dashboard-shortcuts__item">
                  <span className="dashboard-shortcuts__keys">{item.keys}</span>
                  <span className="dashboard-shortcuts__action">{item.action}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      ) : null}

      {gestureEnabled ? (
        <Suspense fallback={null}>
          <GestureRecognition
            enabled={gestureEnabled}
            onGestureDetected={handleGestureDetected}
            onStatusChange={setGestureStatus}
          />
        </Suspense>
      ) : null}
    </div>
  );
}

export default DashboardContent;
