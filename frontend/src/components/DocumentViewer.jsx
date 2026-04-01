import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Document, Page, pdfjs } from 'react-pdf';
import 'react-pdf/dist/Page/AnnotationLayer.css';
import 'react-pdf/dist/Page/TextLayer.css';
import './DocumentViewer.css';

pdfjs.GlobalWorkerOptions.workerSrc =
  `https://unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

const API_URL = 'http://localhost:5000/api';

// File types that get HTML preview from backend
const PREVIEWABLE = new Set(['docx', 'doc', 'pptx', 'ppt', 'txt', 'md', 'csv', 'rtf', 'json', 'xml', 'html', 'htm', 'log']);

const DocumentViewer = ({
  document: doc,
  pageNumber     = 1,
  totalPages     = 0,
  zoom           = 1.0,
  onPageChange,
  onZoomChange,
  onTotalPagesChange,
  onClose,
  bookmarked     = false,
  onToggleBookmark,
  onDelete,
}) => {
  const containerRef    = useRef(null);
  const scrollRef       = useRef(null);
  const touchRef        = useRef(null);
  const scrollTimerRef  = useRef(null);

  const [pdfError,      setPdfError]      = useState(null);
  const [pageInput,     setPageInput]     = useState(String(pageNumber));
  const [transition,    setTransition]    = useState(null);
  const [swipeOffset,   setSwipeOffset]   = useState(0);
  const [showLeftNav,   setShowLeftNav]   = useState(false);
  const [showRightNav,  setShowRightNav]  = useState(false);
  const [scrollInd,     setScrollInd]     = useState(null);

  // Non-PDF preview state
  const [previewHtml,   setPreviewHtml]   = useState('');
  const [previewSlides, setPreviewSlides] = useState([]);
  const [previewType,   setPreviewType]   = useState(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError,  setPreviewError]  = useState(null);

  // Delete confirmation
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // Sync
  useEffect(() => { setPageInput(String(pageNumber)); }, [pageNumber]);
  useEffect(() => {
    setPdfError(null);
    setPreviewHtml('');
    setPreviewSlides([]);
    setPreviewType(null);
    setPreviewError(null);
    setPageInput('1');
    setShowDeleteConfirm(false);
  }, [doc?.id]);

  // Scroll top on page change
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
  }, [pageNumber]);

  // ════════════════════════════════════════════════════════════════
  // LOAD NON-PDF PREVIEW
  // ════════════════════════════════════════════════════════════════
  useEffect(() => {
    if (!doc) return;
    const ft = (doc.file_type || '').toLowerCase();
    if (ft === 'pdf' || !PREVIEWABLE.has(ft)) return;

    setPreviewLoading(true);
    setPreviewError(null);

    fetch(`${API_URL}/documents/${doc.id}/preview`)
      .then(res => {
        if (!res.ok) throw new Error(`Preview failed (${res.status})`);
        return res.json();
      })
      .then(data => {
        if (data.success) {
          const p = data.preview;
          setPreviewType(p.type);
          setPreviewHtml(p.html || '');
          setPreviewSlides(p.slides || []);
          onTotalPagesChange?.(p.page_count || 1);
        } else {
          setPreviewError(data.error || 'Preview failed');
        }
      })
      .catch(err => setPreviewError(err.message))
      .finally(() => setPreviewLoading(false));
  }, [doc?.id, doc?.file_type, onTotalPagesChange]);

  // ════════════════════════════════════════════════════════════════
  // PAGE NAVIGATION WITH ANIMATION
  // ════════════════════════════════════════════════════════════════
  const changePage = useCallback((newPage, direction) => {
    if (newPage < 1 || (totalPages && newPage > totalPages)) return;
    if (newPage === pageNumber) return;
    setTransition(direction === 'next' ? 'slide-left' : 'slide-right');
    onPageChange?.(newPage);
    setTimeout(() => setTransition(null), 350);
  }, [pageNumber, totalPages, onPageChange]);

  const goNext = useCallback(() => changePage(pageNumber + 1, 'next'), [changePage, pageNumber]);
  const goPrev = useCallback(() => changePage(pageNumber - 1, 'prev'), [changePage, pageNumber]);

  // ════════════════════════════════════════════════════════════════
  // GESTURE SCROLL LISTENER
  // ════════════════════════════════════════════════════════════════
  const showScrollIndicator = useCallback((dir, type = 'scroll') => {
    setScrollInd({ dir, type });
    clearTimeout(scrollTimerRef.current);
    scrollTimerRef.current = setTimeout(() => setScrollInd(null), 600);
  }, []);

  useEffect(() => {
    const handle = (e) => {
      const { direction, amount } = e.detail;
      const el = scrollRef.current;
      if (!el) return;

      const atTop    = el.scrollTop <= 2;
      const atBottom = el.scrollTop + el.clientHeight >= el.scrollHeight - 2;
      const hasPages = totalPages > 1;

      if (direction === 'up' && atTop && hasPages) {
        if (pageNumber > 1) {
          showScrollIndicator('up', 'page');
          setTimeout(goPrev, 80);
        } else {
          showScrollIndicator('up', 'limit');
        }
        return;
      }

      if (direction === 'down' && atBottom && hasPages) {
        if (pageNumber < totalPages) {
          showScrollIndicator('down', 'page');
          setTimeout(goNext, 80);
        } else {
          showScrollIndicator('down', 'limit');
        }
        return;
      }

      el.scrollBy({ top: direction === 'down' ? amount : -amount, behavior: 'smooth' });
      showScrollIndicator(direction, 'scroll');
    };

    window.addEventListener('dv-scroll', handle);
    return () => { window.removeEventListener('dv-scroll', handle); clearTimeout(scrollTimerRef.current); };
  }, [pageNumber, totalPages, goNext, goPrev, showScrollIndicator]);

  // ════════════════════════════════════════════════════════════════
  // TOUCH SWIPE (horizontal → page change)
  // ════════════════════════════════════════════════════════════════
  const handleTouchStart = useCallback((e) => {
    touchRef.current = {
      startX: e.touches[0].clientX, startY: e.touches[0].clientY,
      startTime: Date.now(), isHorizontal: null, swiping: false,
    };
  }, []);

  const handleTouchMove = useCallback((e) => {
    if (!touchRef.current) return;
    const dx = e.touches[0].clientX - touchRef.current.startX;
    const dy = e.touches[0].clientY - touchRef.current.startY;
    if (touchRef.current.isHorizontal === null && (Math.abs(dx) > 10 || Math.abs(dy) > 10)) {
      touchRef.current.isHorizontal = Math.abs(dx) > Math.abs(dy);
    }
    if (touchRef.current.isHorizontal) {
      touchRef.current.swiping = true;
      setSwipeOffset(dx * 0.4);
    }
  }, []);

  const handleTouchEnd = useCallback((e) => {
    if (!touchRef.current) return;
    const dx = e.changedTouches[0].clientX - touchRef.current.startX;
    const dt = Date.now() - touchRef.current.startTime;
    if (touchRef.current.swiping && Math.abs(dx) > 50 && dt < 600) {
      if (dx > 0 && pageNumber > 1) goPrev();
      else if (dx < 0 && (!totalPages || pageNumber < totalPages)) goNext();
    }
    setSwipeOffset(0);
    touchRef.current = null;
  }, [pageNumber, totalPages, goNext, goPrev]);

  // ════════════════════════════════════════════════════════════════
  // CTRL+WHEEL ZOOM
  // ════════════════════════════════════════════════════════════════
  const handleWheel = useCallback((e) => {
    if (!e.ctrlKey) return;
    e.preventDefault();
    const d = e.deltaY > 0 ? -0.1 : 0.1;
    onZoomChange?.(Math.min(Math.max(+(zoom + d).toFixed(2), 0.5), 3.0));
  }, [zoom, onZoomChange]);

  // ════════════════════════════════════════════════════════════════
  // KEYBOARD
  // ════════════════════════════════════════════════════════════════
  useEffect(() => {
    if (!doc) return;
    const handle = (e) => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
      switch (e.key) {
        case 'ArrowLeft':  e.preventDefault(); goPrev(); break;
        case 'ArrowRight': e.preventDefault(); goNext(); break;
        case 'PageUp':     e.preventDefault(); goPrev(); break;
        case 'PageDown':   e.preventDefault(); goNext(); break;
        case 'Home':       e.preventDefault(); changePage(1, 'prev'); break;
        case 'End':        e.preventDefault(); if (totalPages) changePage(totalPages, 'next'); break;
        case '+': case '=': e.preventDefault(); onZoomChange?.(Math.min(+(zoom + 0.15).toFixed(2), 3.0)); break;
        case '-':            e.preventDefault(); onZoomChange?.(Math.max(+(zoom - 0.15).toFixed(2), 0.5)); break;
        case '0': e.preventDefault(); onZoomChange?.(1.0); break;
        case 'Escape': e.preventDefault(); onClose?.(); break;
        case 'Delete': case 'Backspace':
          if (e.shiftKey) { e.preventDefault(); setShowDeleteConfirm(true); }
          break;
        default: break;
      }
    };
    window.addEventListener('keydown', handle);
    return () => window.removeEventListener('keydown', handle);
  }, [doc, pageNumber, totalPages, zoom, goNext, goPrev, changePage, onZoomChange, onClose]);

  // ════════════════════════════════════════════════════════════════
  // SIDE NAV HOVER
  // ════════════════════════════════════════════════════════════════
  const handleMouseMove = useCallback((e) => {
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;
    const pct = (e.clientX - rect.left) / rect.width;
    setShowLeftNav(pct < 0.12 && pageNumber > 1);
    setShowRightNav(pct > 0.88 && (!totalPages || pageNumber < totalPages));
  }, [pageNumber, totalPages]);

  // ════════════════════════════════════════════════════════════════
  // DELETE HANDLER
  // ════════════════════════════════════════════════════════════════
  const handleDelete = useCallback(async () => {
    if (!doc?.id) return;
    setDeleting(true);
    try {
      const res = await fetch(`${API_URL}/documents/${doc.id}`, { method: 'DELETE' });
      const data = await res.json();
      if (res.ok && data.success) {
        onDelete?.(doc.id);
        onClose?.();
      } else {
        alert(data.error || 'Delete failed');
      }
    } catch (err) {
      alert('Delete failed: ' + err.message);
    } finally {
      setDeleting(false);
      setShowDeleteConfirm(false);
    }
  }, [doc?.id, onDelete, onClose]);

  // ════════════════════════════════════════════════════════════════
  // PDF CALLBACKS
  // ════════════════════════════════════════════════════════════════
  const handleLoadSuccess = useCallback(({ numPages }) => {
    onTotalPagesChange?.(numPages);
    setPdfError(null);
  }, [onTotalPagesChange]);

  const commitPageInput = () => {
    const val = parseInt(pageInput, 10);
    if (!isNaN(val) && val >= 1 && val <= (totalPages || Infinity)) {
      changePage(val, val > pageNumber ? 'next' : 'prev');
    } else {
      setPageInput(String(pageNumber));
    }
  };

  // ════════════════════════════════════════════════════════════════
  // SCROLL INDICATOR CONTENT
  // ════════════════════════════════════════════════════════════════
  const getIndicator = () => {
    if (!scrollInd) return null;
    const { dir, type } = scrollInd;
    if (type === 'page')  return { icon: dir === 'up' ? '⬆️' : '⬇️', label: dir === 'up' ? 'Prev Page' : 'Next Page', color: '#FB923C' };
    if (type === 'limit') return { icon: dir === 'up' ? '🔝' : '🔚', label: dir === 'up' ? 'First Page' : 'Last Page', color: '#64748B' };
    return { icon: dir === 'up' ? '↑' : '↓', label: dir === 'up' ? 'Scroll Up' : 'Scroll Down', color: '#38BDF8' };
  };
  const indicator = getIndicator();

  // ════════════════════════════════════════════════════════════════
  // EMPTY STATE
  // ════════════════════════════════════════════════════════════════
  if (!doc) {
    return (
      <div className="dv dv--empty">
        <div className="dv-empty">
          <div className="dv-empty-glow" />
          <div className="dv-empty-icon">📄</div>
          <h3>No Document Selected</h3>
          <p>Select a document to preview</p>
          <div className="dv-empty-features">
            {[
              ['📕', 'PDF — page-by-page with zoom'],
              ['📘', 'DOCX — formatted Word preview'],
              ['📊', 'PPTX — slide-by-slide view'],
              ['📝', 'TXT, MD, CSV — code & table view'],
              ['🖐️', 'Full gesture control support'],
              ['🗑️', 'Delete unwanted documents'],
            ].map(([icon, text]) => (
              <div key={text} className="dv-feature"><span>{icon}</span><span>{text}</span></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // ════════════════════════════════════════════════════════════════
  // DERIVED
  // ════════════════════════════════════════════════════════════════
  const ft         = (doc.file_type || '').toLowerCase();
  const isPdf      = ft === 'pdf';
  const isPptx     = ft === 'pptx' || ft === 'ppt';
  const isPreview  = PREVIEWABLE.has(ft);
  const fileUrl    = doc.file_url || doc.url || doc.static_url || `${API_URL}/documents/${doc.id}/file`;
  const fileSizeMB = doc.file_size ? `${(doc.file_size / 1024 / 1024).toFixed(1)} MB` : '';
  const progressPct = totalPages > 1 ? Math.round((pageNumber / totalPages) * 100) : 0;
  const hasPages   = totalPages > 1;

  const fileIcon = {
    pdf: '📕', docx: '📘', doc: '📘', pptx: '📊', ppt: '📊',
    txt: '📝', md: '📝', csv: '📈', json: '🔧', xml: '🔧',
    html: '🌐', htm: '🌐', rtf: '📃',
  }[ft] || '📄';

  // ════════════════════════════════════════════════════════════════
  // RENDER
  // ════════════════════════════════════════════════════════════════
  return (
    <div className="dv" ref={containerRef} onMouseMove={handleMouseMove} onMouseLeave={() => { setShowLeftNav(false); setShowRightNav(false); }}>

      {/* ═══ DELETE CONFIRMATION MODAL ═══ */}
      {showDeleteConfirm && (
        <div className="dv-modal-overlay" onClick={() => setShowDeleteConfirm(false)}>
          <div className="dv-modal" onClick={e => e.stopPropagation()}>
            <div className="dv-modal-icon">🗑️</div>
            <h3>Delete Document?</h3>
            <p className="dv-modal-filename">{doc.original_name}</p>
            <p className="dv-modal-warn">This will permanently delete the file and cannot be undone.</p>
            <div className="dv-modal-actions">
              <button className="dv-modal-cancel" onClick={() => setShowDeleteConfirm(false)} disabled={deleting}>Cancel</button>
              <button className="dv-modal-delete" onClick={handleDelete} disabled={deleting}>
                {deleting ? '⏳ Deleting…' : '🗑️ Delete'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ═══ TOOLBAR ═══ */}
      <div className="dv-toolbar">
        <div className="dv-tb-left">
          <span className="dv-tb-icon">{fileIcon}</span>
          <div className="dv-tb-info">
            <h4 title={doc.original_name}>{doc.original_name}</h4>
            <span className="dv-tb-meta">
              {ft.toUpperCase()}
              {fileSizeMB && ` · ${fileSizeMB}`}
              {hasPages && ` · ${totalPages} ${isPptx ? 'slides' : 'pages'}`}
            </span>
          </div>
        </div>

        {hasPages && (
          <div className="dv-tb-center">
            <div className="dv-page-ctrl">
              <button className="dv-btn" disabled={pageNumber <= 1} onClick={goPrev}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><polyline points="15 18 9 12 15 6"/></svg>
              </button>
              <div className="dv-page-input-wrap">
                <input className="dv-page-input" type="number" min={1} max={totalPages}
                  value={pageInput}
                  onChange={e => setPageInput(e.target.value)}
                  onBlur={commitPageInput}
                  onKeyDown={e => e.key === 'Enter' && commitPageInput()}
                />
                <span className="dv-page-total">/ {totalPages}</span>
              </div>
              <button className="dv-btn" disabled={pageNumber >= totalPages} onClick={goNext}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><polyline points="9 18 15 12 9 6"/></svg>
              </button>
            </div>

            <div className="dv-zoom-ctrl">
              <button className="dv-btn" disabled={zoom <= 0.5} onClick={() => onZoomChange?.(Math.max(+(zoom - 0.15).toFixed(2), 0.5))}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="5" y1="12" x2="19" y2="12"/></svg>
              </button>
              <button className="dv-zoom-label" onClick={() => onZoomChange?.(1.0)}>
                {Math.round(zoom * 100)}%
              </button>
              <button className="dv-btn" disabled={zoom >= 3.0} onClick={() => onZoomChange?.(Math.min(+(zoom + 0.15).toFixed(2), 3.0))}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
              </button>
            </div>
          </div>
        )}

        <div className="dv-tb-right">
          <button className={`dv-btn dv-btn-icon ${bookmarked ? 'dv-bookmarked' : ''}`} onClick={onToggleBookmark} title="Bookmark">
            {bookmarked ? '🔖' : '🔗'}
          </button>
          <a className="dv-btn dv-btn-icon" href={`${API_URL}/documents/${doc.id}/download`} target="_blank" rel="noopener noreferrer" title="Download">📥</a>
          <button className="dv-btn dv-btn-icon dv-delete-btn" onClick={() => setShowDeleteConfirm(true)} title="Delete document (Shift+Delete)">
            🗑️
          </button>
          <button className="dv-btn dv-close-btn" onClick={onClose} title="Close (Esc)">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
            <span>Close</span>
          </button>
        </div>
      </div>

      {/* ═══ PROGRESS BAR ═══ */}
      {hasPages && (
        <div className="dv-progress-track">
          <div className="dv-progress-fill" style={{ width: `${progressPct}%` }} />
        </div>
      )}

      {/* ═══ CONTENT ═══ */}
      <div className="dv-content" onWheel={handleWheel} onTouchStart={handleTouchStart} onTouchMove={handleTouchMove} onTouchEnd={handleTouchEnd}>

        {/* Side nav arrows */}
        {hasPages && (
          <>
            <div className={`dv-side-nav dv-side-left ${showLeftNav ? 'visible' : ''}`} onClick={goPrev}>
              <div className="dv-side-arrow"><svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polyline points="15 18 9 12 15 6"/></svg></div>
            </div>
            <div className={`dv-side-nav dv-side-right ${showRightNav ? 'visible' : ''}`} onClick={goNext}>
              <div className="dv-side-arrow"><svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polyline points="9 18 15 12 9 6"/></svg></div>
            </div>
          </>
        )}

        {/* Scroll indicator */}
        {indicator && (
          <div className={`dv-scroll-indicator dv-si-${scrollInd.dir}`} style={{ '--si-color': indicator.color }}>
            <span className="dv-si-icon">{indicator.icon}</span>
            <span className="dv-si-label">{indicator.label}</span>
          </div>
        )}

        {/* Swipe hint */}
        {swipeOffset !== 0 && (
          <div className={`dv-swipe-hint ${swipeOffset > 30 ? 'dv-hint-prev' : swipeOffset < -30 ? 'dv-hint-next' : ''}`}>
            {swipeOffset > 30 ? `◀ Previous ${isPptx ? 'Slide' : 'Page'}` : swipeOffset < -30 ? `Next ${isPptx ? 'Slide' : 'Page'} ▶` : ''}
          </div>
        )}

        {/* ═══ SCROLLABLE AREA ═══ */}
        <div className="dv-scroll" ref={scrollRef} style={{ transform: swipeOffset ? `translateX(${swipeOffset}px)` : undefined }}>

          {/* ── PDF ── */}
          {isPdf && (
            <>
              {pdfError ? (
                <div className="dv-error">
                  <div className="dv-error-icon">⚠️</div>
                  <h3>Failed to Load PDF</h3>
                  <p>{pdfError}</p>
                  <button className="dv-btn-action" onClick={() => setPdfError(null)}>🔄 Retry</button>
                </div>
              ) : (
                <div className={`dv-page-wrapper ${transition || ''}`}>
                  <Document file={fileUrl} onLoadSuccess={handleLoadSuccess} onLoadError={e => setPdfError(e?.message || 'Load failed')}
                    loading={<div className="dv-loading"><div className="dv-shimmer" /><p>Loading PDF…</p></div>}
                  >
                    <div className="dv-page-frame">
                      <Page pageNumber={pageNumber} scale={zoom} renderTextLayer renderAnnotationLayer
                        loading={<div className="dv-page-loading"><div className="dv-spinner" /></div>}
                      />
                    </div>
                  </Document>
                </div>
              )}
            </>
          )}

          {/* ── PPTX SLIDES ── */}
          {isPptx && !previewLoading && !previewError && previewSlides.length > 0 && (
            <div className={`dv-page-wrapper ${transition || ''}`}>
              <div className="dv-slide-frame" style={{ transform: `scale(${zoom})`, transformOrigin: 'top center' }}>
                <div dangerouslySetInnerHTML={{ __html: previewSlides[pageNumber - 1] || '' }} />
              </div>
            </div>
          )}

          {/* ── DOCX / TXT / MD / CSV / HTML ── */}
          {isPreview && !isPptx && !isPdf && !previewLoading && !previewError && previewHtml && (
            <div className="dv-html-frame" style={{ transform: `scale(${zoom})`, transformOrigin: 'top center' }}>
              <div dangerouslySetInnerHTML={{ __html: previewHtml }} />
            </div>
          )}

          {/* ── LOADING ── */}
          {isPreview && !isPdf && previewLoading && (
            <div className="dv-loading">
              <div className="dv-shimmer" />
              <p>Converting {ft.toUpperCase()} to preview…</p>
            </div>
          )}

          {/* ── PREVIEW ERROR ── */}
          {isPreview && !isPdf && previewError && (
            <div className="dv-error">
              <div className="dv-error-icon">⚠️</div>
              <h3>Preview Failed</h3>
              <p>{previewError}</p>
              <div className="dv-error-actions">
                <button className="dv-btn-action" onClick={() => { setPreviewError(null); setPreviewLoading(true);
                  fetch(`${API_URL}/documents/${doc.id}/preview`).then(r => r.json()).then(d => {
                    if (d.success) { setPreviewType(d.preview.type); setPreviewHtml(d.preview.html); setPreviewSlides(d.preview.slides); onTotalPagesChange?.(d.preview.page_count); }
                    else setPreviewError(d.error);
                  }).catch(e => setPreviewError(e.message)).finally(() => setPreviewLoading(false));
                }}>🔄 Retry</button>
                <a className="dv-btn-action dv-btn-secondary" href={`${API_URL}/documents/${doc.id}/download`} target="_blank" rel="noopener noreferrer">📥 Download</a>
              </div>
            </div>
          )}

          {/* ── UNSUPPORTED ── */}
          {!isPdf && !isPreview && (
            <div className="dv-nonpdf">
              <div className="dv-nonpdf-card">
                <div className="dv-nonpdf-icon">{fileIcon}</div>
                <h3>{doc.original_name}</h3>
                <p>Preview not available for <strong>.{ft}</strong> files</p>
                <div className="dv-nonpdf-actions">
                  <a className="dv-btn-action" href={fileUrl} target="_blank" rel="noopener noreferrer">🔗 Open</a>
                  <a className="dv-btn-action dv-btn-secondary" href={`${API_URL}/documents/${doc.id}/download`} target="_blank" rel="noopener noreferrer">📥 Download</a>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ═══ STATUS BAR ═══ */}
      <div className="dv-status">
        <div className="dv-status-left">
          {hasPages && <span className="dv-page-badge">{fileIcon} {pageNumber} / {totalPages}</span>}
          {!hasPages && <span className="dv-page-badge">{fileIcon} {ft.toUpperCase()}</span>}
        </div>
        <div className="dv-status-center">
          <span className="dv-nav-hints">
            {hasPages ? '◀️▶️ Navigate' : '↕️ Scroll'} · 🤏 Zoom · 🖐️ Gestures · 🗑️ Shift+Del
          </span>
        </div>
        <div className="dv-status-right">
          <span className="dv-zoom-badge">🔍 {Math.round(zoom * 100)}%</span>
        </div>
      </div>
    </div>
  );
};

export default React.memo(DocumentViewer);