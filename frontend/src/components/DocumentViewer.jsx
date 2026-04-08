import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Document, Page, pdfjs } from 'react-pdf';
import 'react-pdf/dist/Page/AnnotationLayer.css';
import 'react-pdf/dist/Page/TextLayer.css';
import API, { getAuthToken } from '../services/api';
import './DocumentViewer.css';

pdfjs.GlobalWorkerOptions.workerSrc =
  `https://unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

// File types that get HTML preview from backend
const PREVIEWABLE = new Set(['docx', 'doc', 'pptx', 'ppt', 'txt', 'md', 'csv', 'rtf', 'json', 'xml', 'html', 'htm', 'log']);

const withToken = (url) => {
  if (!url) return url;
  const token = getAuthToken();
  if (!token) return url;

  const separator = url.includes('?') ? '&' : '?';
  return `${url}${separator}token=${encodeURIComponent(token)}`;
};

const TEXT_SUMMARY_TYPES = new Set(['txt', 'md', 'csv', 'json', 'xml', 'html', 'htm', 'log', 'rtf']);

const SUMMARY_STOP_WORDS = new Set([
  'the', 'is', 'a', 'an', 'and', 'or', 'to', 'of', 'for', 'in', 'on', 'with', 'at', 'by',
  'from', 'that', 'this', 'it', 'as', 'be', 'are', 'was', 'were', 'if', 'then', 'than',
  'not', 'no', 'can', 'could', 'would', 'should', 'has', 'have', 'had', 'will', 'just',
  'into', 'about', 'over', 'under', 'your', 'you', 'our', 'their', 'they', 'them', 'but'
]);

function stripHtmlToText(html = '') {
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/\s+/g, ' ')
    .trim();
}

function buildFallbackSummary(doc, extractedText = '') {
  const fileType = (doc?.file_type || 'file').toUpperCase();
  const category = doc?.main_category || 'Uncategorized';
  const subCategory = doc?.sub_category || 'General';
  const keyTerms = [category, subCategory, fileType].filter(Boolean);

  const abstract = extractedText
    ? `A compact text sample was detected, but there was not enough structured content for a full AI summary.`
    : `A full text extraction is not available for this document format, so this summary uses document metadata.`;

  return {
    title: doc?.original_name || 'Selected document',
    abstract,
    highlights: [
      `Document type: ${fileType}`,
      `Primary category: ${category}`,
      `Subcategory: ${subCategory}`,
    ],
    keyTerms,
    metrics: {
      words: extractedText ? extractedText.split(/\s+/).filter(Boolean).length : 0,
      sentences: 0,
      pagesAnalyzed: 0,
    },
    source: extractedText ? 'Partial text sample' : 'Metadata only',
  };
}

function buildSummaryFromText(text, doc, pagesAnalyzed = 0) {
  const cleaned = (text || '').replace(/\s+/g, ' ').trim();
  if (cleaned.length < 80) {
    return buildFallbackSummary(doc, cleaned);
  }

  const sentenceCandidates =
    cleaned.match(/[^.!?\n]+[.!?]?/g)?.map((s) => s.trim()).filter((s) => s.length > 18) || [];

  const words = cleaned
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length > 2 && !SUMMARY_STOP_WORDS.has(w));

  const frequencies = new Map();
  for (const word of words) {
    frequencies.set(word, (frequencies.get(word) || 0) + 1);
  }

  const scoredSentences = sentenceCandidates.map((sentence, index) => {
    const sentenceWords = sentence
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, ' ')
      .split(/\s+/)
      .filter((w) => w.length > 2 && !SUMMARY_STOP_WORDS.has(w));

    const score = sentenceWords.reduce((total, word) => total + (frequencies.get(word) || 0), 0);
    return { sentence, score, index };
  });

  const highlights = scoredSentences
    .sort((a, b) => b.score - a.score)
    .slice(0, 3)
    .sort((a, b) => a.index - b.index)
    .map((item) => item.sentence);

  const keyTerms = Array.from(frequencies.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([term]) => term);

  return {
    title: doc?.original_name || 'Selected document',
    abstract: highlights[0] || sentenceCandidates[0] || cleaned.slice(0, 220),
    highlights: highlights.length > 0 ? highlights : sentenceCandidates.slice(0, 3),
    keyTerms,
    metrics: {
      words: words.length,
      sentences: sentenceCandidates.length,
      pagesAnalyzed,
    },
    source: pagesAnalyzed > 0
      ? `Extracted from first ${pagesAnalyzed} PDF page(s)`
      : 'Extracted text content',
  };
}

const getFullscreenElement = () => (
  document.fullscreenElement
  || document.webkitFullscreenElement
  || document.mozFullScreenElement
  || document.msFullscreenElement
);

const requestElementFullscreen = async (element) => {
  if (!element) return;
  if (element.requestFullscreen) {
    await element.requestFullscreen();
    return;
  }
  if (element.webkitRequestFullscreen) {
    await element.webkitRequestFullscreen();
    return;
  }
  if (element.msRequestFullscreen) {
    await element.msRequestFullscreen();
  }
};

const exitAnyFullscreen = async () => {
  if (document.exitFullscreen) {
    await document.exitFullscreen();
    return;
  }
  if (document.webkitExitFullscreen) {
    await document.webkitExitFullscreen();
    return;
  }
  if (document.msExitFullscreen) {
    await document.msExitFullscreen();
  }
};

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
  const pendingZoomFocusRef = useRef(null);

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
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isPseudoFullscreen, setIsPseudoFullscreen] = useState(false);
  const [showSummaryModal, setShowSummaryModal] = useState(false);
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [summaryError, setSummaryError] = useState('');
  const [summaryData, setSummaryData] = useState(null);

  const fullscreenActive = isFullscreen || isPseudoFullscreen;
  const hasBlockingLayer = showSummaryModal || showDeleteConfirm;

  useEffect(() => {
    window.dispatchEvent(new CustomEvent('dv-immersive-change', {
      detail: { active: Boolean(doc) && fullscreenActive },
    }));
  }, [doc, fullscreenActive]);

  useEffect(() => {
    return () => {
      window.dispatchEvent(new CustomEvent('dv-immersive-change', {
        detail: { active: false },
      }));
    };
  }, []);

  const enterFullscreen = useCallback(async () => {
    await requestElementFullscreen(containerRef.current);
  }, []);

  const leaveFullscreen = useCallback(async () => {
    if (!getFullscreenElement()) return;
    await exitAnyFullscreen();
  }, []);

  const toggleFullscreen = useCallback(async (options = {}) => {
    const preferPseudo = Boolean(options?.preferPseudo);

    if (isPseudoFullscreen) {
      setIsPseudoFullscreen(false);
      return;
    }

    if (getFullscreenElement()) {
      await leaveFullscreen();
      return;
    }

    if (preferPseudo) {
      setIsPseudoFullscreen(true);
      return;
    }

    try {
      await enterFullscreen();
    } catch {
      // Fullscreen API can fail without trusted user activation (e.g., gesture events).
      setIsPseudoFullscreen(true);
    }
  }, [enterFullscreen, isPseudoFullscreen, leaveFullscreen]);

  const closeTopLayer = useCallback(async () => {
    if (showDeleteConfirm) {
      setShowDeleteConfirm(false);
      return true;
    }

    if (showSummaryModal) {
      setShowSummaryModal(false);
      return true;
    }

    if (getFullscreenElement()) {
      await leaveFullscreen().catch(() => {});
      return true;
    }

    if (isPseudoFullscreen) {
      setIsPseudoFullscreen(false);
      return true;
    }

    return false;
  }, [isPseudoFullscreen, leaveFullscreen, showDeleteConfirm, showSummaryModal]);

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
    setShowSummaryModal(false);
    setSummaryLoading(false);
    setSummaryError('');
    setSummaryData(null);
  }, [doc?.id]);

  const generateSummary = useCallback(async () => {
    if (!doc) return;

    setShowSummaryModal(true);
    setSummaryLoading(true);
    setSummaryError('');

    try {
      const docFileType = (doc.file_type || '').toLowerCase();
      const docFileUrl = withToken(
        doc.file_url || doc.url || doc.static_url || `${API_URL}/documents/${doc.id}/file`
      );

      let pagesAnalyzed = 0;
      let extractedText = previewHtml ? stripHtmlToText(previewHtml) : '';

      if (!extractedText && docFileType === 'pdf') {
        const loadingTask = pdfjs.getDocument({ url: docFileUrl });
        const pdf = await loadingTask.promise;
        pagesAnalyzed = Math.min(pdf.numPages || 1, 4);
        const pageTexts = [];

        for (let i = 1; i <= pagesAnalyzed; i += 1) {
          const page = await pdf.getPage(i);
          const textContent = await page.getTextContent();
          const value = textContent.items
            .map((item) => item.str)
            .join(' ')
            .replace(/\s+/g, ' ')
            .trim();
          if (value) {
            pageTexts.push(value);
          }
        }

        extractedText = pageTexts.join(' ');
      }

      if (!extractedText && TEXT_SUMMARY_TYPES.has(docFileType)) {
        const response = await fetch(docFileUrl);
        if (response.ok) {
          extractedText = await response.text();
        }
      }

      const result = buildSummaryFromText(extractedText, doc, pagesAnalyzed);
      setSummaryData(result);
    } catch (error) {
      setSummaryError('Unable to generate AI summary for this document right now.');
      setSummaryData(buildFallbackSummary(doc));
    } finally {
      setSummaryLoading(false);
    }
  }, [doc, previewHtml]);

  // ════════════════════════════════════════════════════════════════
  // PAGE NAVIGATION + ZOOM HELPERS
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

  const applyZoomChange = useCallback((nextZoom, anchor = null) => {
    const clampedZoom = Math.min(Math.max(nextZoom, 0.5), 3.0);
    const roundedZoom = +clampedZoom.toFixed(2);

    if (roundedZoom === zoom) return;

    if (anchor && scrollRef.current) {
      const anchorX = Number.isFinite(anchor.x) ? Math.min(Math.max(anchor.x, 0), 1) : 0.5;
      const anchorY = Number.isFinite(anchor.y) ? Math.min(Math.max(anchor.y, 0), 1) : 0.5;
      pendingZoomFocusRef.current = {
        from: zoom,
        to: roundedZoom,
        anchor: { x: anchorX, y: anchorY },
      };
    } else {
      pendingZoomFocusRef.current = null;
    }

    onZoomChange?.(roundedZoom);
  }, [zoom, onZoomChange]);

  // Scroll top on page change
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
  }, [pageNumber]);

  useEffect(() => {
    const syncFullscreen = () => {
      const active = getFullscreenElement() === containerRef.current;
      setIsFullscreen(active);
      if (active) {
        setIsPseudoFullscreen(false);
      }
    };

    document.addEventListener('fullscreenchange', syncFullscreen);
    document.addEventListener('webkitfullscreenchange', syncFullscreen);

    return () => {
      document.removeEventListener('fullscreenchange', syncFullscreen);
      document.removeEventListener('webkitfullscreenchange', syncFullscreen);
    };
  }, []);

  useEffect(() => {
    const onToggle = (e) => {
      const canHandleFullscreen = Boolean(doc) || fullscreenActive;
      if (!canHandleFullscreen) {
        return;
      }

      const source = typeof e?.detail?.source === 'string' ? e.detail.source : '';
      const preferPseudo = source === 'gesture-fullscreen';

      if (e?.detail && typeof e.detail === 'object') {
        e.detail.consumed = true;
      }

      toggleFullscreen({ preferPseudo }).catch(() => {});
    };

    const onEnter = (e) => {
      if (!doc) {
        return;
      }

      if (fullscreenActive) {
        return;
      }

      if (e?.detail && typeof e.detail === 'object') {
        e.detail.consumed = true;
      }

      enterFullscreen().catch(() => {
        setIsPseudoFullscreen(true);
      });
    };

    window.addEventListener('dv-fullscreen-toggle', onToggle);
    window.addEventListener('dv-fullscreen-enter', onEnter);

    return () => {
      window.removeEventListener('dv-fullscreen-toggle', onToggle);
      window.removeEventListener('dv-fullscreen-enter', onEnter);
    };
  }, [doc, enterFullscreen, fullscreenActive, toggleFullscreen]);

  useEffect(() => {
    const onNextPage = () => {
      if (!doc || hasBlockingLayer) return;
      goNext();
    };

    const onPrevPage = () => {
      if (!doc || hasBlockingLayer) return;
      goPrev();
    };

    const onCloseDoc = (e) => {
      const canHandleClose = Boolean(doc) || fullscreenActive || hasBlockingLayer;
      if (!canHandleClose) {
        return;
      }

      if (e?.detail && typeof e.detail === 'object') {
        e.detail.consumed = true;
      }

      closeTopLayer()
        .then((closedLayer) => {
          if (!closedLayer && doc) {
            onClose?.();
          }
        })
        .catch(() => {
          if (doc) {
            onClose?.();
          }
        });
    };

    const onCloseLayer = (e) => {
      closeTopLayer().then((closedLayer) => {
        if (closedLayer && e?.detail && typeof e.detail === 'object') {
          e.detail.consumed = true;
        }
      }).catch(() => {});
    };

    const onSummary = () => {
      if (!doc || hasBlockingLayer) return;
      generateSummary().catch(() => {});
    };

    const onZoomReset = () => {
      if (!doc || hasBlockingLayer) return;
      applyZoomChange(1.0);
    };

    const onZoomAt = (e) => {
      if (!doc || hasBlockingLayer) return;
      const delta = Number(e?.detail?.delta || 0);
      if (!delta) return;
      const anchor = e?.detail?.anchor || null;
      applyZoomChange(zoom + delta, anchor);
    };

    window.addEventListener('dv-next-page', onNextPage);
    window.addEventListener('dv-prev-page', onPrevPage);
    window.addEventListener('dv-close-doc', onCloseDoc);
    window.addEventListener('dv-close-layer', onCloseLayer);
    window.addEventListener('dv-summary', onSummary);
    window.addEventListener('dv-zoom-reset', onZoomReset);
    window.addEventListener('dv-zoom-at', onZoomAt);

    return () => {
      window.removeEventListener('dv-next-page', onNextPage);
      window.removeEventListener('dv-prev-page', onPrevPage);
      window.removeEventListener('dv-close-doc', onCloseDoc);
      window.removeEventListener('dv-close-layer', onCloseLayer);
      window.removeEventListener('dv-summary', onSummary);
      window.removeEventListener('dv-zoom-reset', onZoomReset);
      window.removeEventListener('dv-zoom-at', onZoomAt);
    };
  }, [
    applyZoomChange,
    closeTopLayer,
    doc,
    fullscreenActive,
    generateSummary,
    goNext,
    goPrev,
    hasBlockingLayer,
    onClose,
    zoom,
  ]);

  useEffect(() => {
    if (!doc) {
      if (getFullscreenElement() === containerRef.current) {
        leaveFullscreen().catch(() => {});
      }
      setIsPseudoFullscreen(false);
    }
  }, [doc, leaveFullscreen]);

  // ════════════════════════════════════════════════════════════════
  // LOAD NON-PDF PREVIEW
  // ════════════════════════════════════════════════════════════════
  useEffect(() => {
    if (!doc) return;
    const ft = (doc.file_type || '').toLowerCase();
    if (ft === 'pdf' || !PREVIEWABLE.has(ft)) return;

    setPreviewLoading(true);
    setPreviewError(null);

    API.get(`/documents/${doc.id}/preview`)
      .then(({ data }) => {
        if (!data?.success) throw new Error(data?.error || 'Preview failed');
        const p = data.preview;
        setPreviewType(p.type);
        setPreviewHtml(p.html || '');
        setPreviewSlides(p.slides || []);
        onTotalPagesChange?.(p.page_count || 1);
      })
      .catch(err => setPreviewError(err.message))
      .finally(() => setPreviewLoading(false));
  }, [doc?.id, doc?.file_type, onTotalPagesChange]);

  useEffect(() => {
    const pending = pendingZoomFocusRef.current;
    if (!pending) return;
    if (Math.abs((pending.to ?? 0) - zoom) > 0.001) return;

    const el = scrollRef.current;
    if (!el || !pending.from || !Number.isFinite(pending.from)) {
      pendingZoomFocusRef.current = null;
      return;
    }

    const ratio = zoom / pending.from;
    if (!Number.isFinite(ratio) || ratio <= 0) {
      pendingZoomFocusRef.current = null;
      return;
    }

    const focusX = (pending.anchor?.x ?? 0.5) * el.clientWidth;
    const focusY = (pending.anchor?.y ?? 0.5) * el.clientHeight;
    const nextLeft = Math.max(0, (el.scrollLeft + focusX) * ratio - focusX);
    const nextTop = Math.max(0, (el.scrollTop + focusY) * ratio - focusY);

    el.scrollTo({ left: nextLeft, top: nextTop, behavior: 'auto' });
    pendingZoomFocusRef.current = null;
  }, [zoom]);

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
      const direction = e?.detail?.direction;
      const amount = Number(e?.detail?.amount || 0);
      if (!direction || !amount) return;

      if (!doc) return;

      if (e?.detail && typeof e.detail === 'object') {
        e.detail.consumed = true;
      }

      if (hasBlockingLayer) {
        return;
      }

      const el = scrollRef.current;
      if (!el) return;

      const atTop = el.scrollTop <= 2;
      const atBottom = el.scrollTop + el.clientHeight >= el.scrollHeight - 2;

      // Strict mode: vertical gestures only scroll and never change pages.
      if (direction === 'up' && atTop) {
        showScrollIndicator('up', 'limit');
        return;
      }

      if (direction === 'down' && atBottom) {
        showScrollIndicator('down', 'limit');
        return;
      }

      el.scrollBy({ top: direction === 'down' ? amount : -amount, behavior: 'smooth' });
      showScrollIndicator(direction, 'scroll');
    };

    window.addEventListener('dv-scroll', handle);
    return () => { window.removeEventListener('dv-scroll', handle); clearTimeout(scrollTimerRef.current); };
  }, [doc, hasBlockingLayer, showScrollIndicator]);

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

    const rect = e.currentTarget.getBoundingClientRect();
    const anchor = {
      x: rect.width ? (e.clientX - rect.left) / rect.width : 0.5,
      y: rect.height ? (e.clientY - rect.top) / rect.height : 0.5,
    };

    applyZoomChange(zoom + d, anchor);
  }, [zoom, applyZoomChange]);

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
        case '+': case '=': e.preventDefault(); applyZoomChange(zoom + 0.15); break;
        case '-':            e.preventDefault(); applyZoomChange(zoom - 0.15); break;
        case '0': e.preventDefault(); applyZoomChange(1.0); break;
        case 's': case 'S':
          e.preventDefault();
          generateSummary().catch(() => {});
          break;
        case 'f': case 'F':
          e.preventDefault();
          toggleFullscreen().catch(() => {});
          break;
        case 'Escape':
          e.preventDefault();
          closeTopLayer()
            .then((closedLayer) => {
              if (!closedLayer) {
                onClose?.();
              }
            })
            .catch(() => {
              onClose?.();
            });
          break;
        case 'Delete': case 'Backspace':
          if (e.shiftKey) { e.preventDefault(); setShowDeleteConfirm(true); }
          break;
        default: break;
      }
    };
    window.addEventListener('keydown', handle);
    return () => window.removeEventListener('keydown', handle);
  }, [doc, totalPages, zoom, goNext, goPrev, changePage, onClose, closeTopLayer, toggleFullscreen, generateSummary, applyZoomChange]);

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
      const { data } = await API.delete(`/documents/${doc.id}`);
      if (data?.success) {
        onDelete?.(doc.id);
        onClose?.();
      } else {
        alert(data?.error || 'Delete failed');
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
    if (type === 'limit') return { icon: dir === 'up' ? '🔝' : '🔚', label: dir === 'up' ? 'Top Reached' : 'Bottom Reached', color: '#64748B' };
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
  const rawFileUrl = doc.file_url || doc.url || doc.static_url || `${API_URL}/documents/${doc.id}/file`;
  const fileUrl    = withToken(rawFileUrl);
  const downloadUrl = withToken(`${API_URL}/documents/${doc.id}/download`);
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
    <div className={`dv ${fullscreenActive ? 'dv--fullscreen' : ''}`} ref={containerRef} onMouseMove={handleMouseMove} onMouseLeave={() => { setShowLeftNav(false); setShowRightNav(false); }}>

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

      {showSummaryModal && (
        <div className="dv-summary-overlay" onClick={() => setShowSummaryModal(false)}>
          <div className="dv-summary-card" onClick={(e) => e.stopPropagation()}>
            <div className="dv-summary-header">
              <div>
                <h3>AI Summary</h3>
                <p>{doc.original_name}</p>
              </div>
              <button className="dv-summary-close" onClick={() => setShowSummaryModal(false)}>✕</button>
            </div>

            {summaryLoading ? (
              <div className="dv-summary-loading">
                <div className="dv-spinner" />
                <p>Generating summary from document content...</p>
              </div>
            ) : (
              <div className="dv-summary-content">
                {summaryError ? <div className="dv-summary-error">{summaryError}</div> : null}

                {summaryData ? (
                  <>
                    <div className="dv-summary-abstract">{summaryData.abstract}</div>

                    <div className="dv-summary-section">
                      <h4>Key Highlights</h4>
                      <ul>
                        {(summaryData.highlights || []).slice(0, 4).map((item, idx) => (
                          <li key={`${idx}-${item}`}>{item}</li>
                        ))}
                      </ul>
                    </div>

                    {(summaryData.keyTerms || []).length > 0 && (
                      <div className="dv-summary-section">
                        <h4>Keywords</h4>
                        <div className="dv-summary-tags">
                          {summaryData.keyTerms.slice(0, 10).map((term) => (
                            <span key={term}>{term}</span>
                          ))}
                        </div>
                      </div>
                    )}

                    <div className="dv-summary-meta">
                      <span>Source: {summaryData.source}</span>
                      <span>Words: {summaryData.metrics?.words ?? 0}</span>
                      <span>Sentences: {summaryData.metrics?.sentences ?? 0}</span>
                    </div>
                  </>
                ) : null}
              </div>
            )}
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
              <button className="dv-btn" disabled={zoom <= 0.5} onClick={() => applyZoomChange(zoom - 0.15)}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="5" y1="12" x2="19" y2="12"/></svg>
              </button>
              <button className="dv-zoom-label" onClick={() => applyZoomChange(1.0)}>
                {Math.round(zoom * 100)}%
              </button>
              <button className="dv-btn" disabled={zoom >= 3.0} onClick={() => applyZoomChange(zoom + 0.15)}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
              </button>
            </div>
          </div>
        )}

        <div className="dv-tb-right">
          <button className={`dv-btn dv-btn-icon ${bookmarked ? 'dv-bookmarked' : ''}`} onClick={onToggleBookmark} title="Bookmark">
            {bookmarked ? '🔖' : '🔗'}
          </button>
          <button
            className="dv-btn dv-btn-icon dv-summary-btn"
            onClick={() => generateSummary().catch(() => {})}
            title="AI Summary (Peace Sign / S key)"
          >
            🧠
          </button>
          <a className="dv-btn dv-btn-icon" href={downloadUrl} target="_blank" rel="noopener noreferrer" title="Download">📥</a>
          <button
            className={`dv-btn dv-btn-icon dv-fullscreen-btn ${fullscreenActive ? 'is-active' : ''}`}
            onClick={() => toggleFullscreen().catch(() => {})}
            title={fullscreenActive ? 'Exit fullscreen (Esc)' : 'Fullscreen (F or YoYo gesture)'}
          >
            {fullscreenActive ? '🗗' : '⛶'}
          </button>
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
                  API.get(`/documents/${doc.id}/preview`).then(({ data }) => {
                    if (data?.success) {
                      setPreviewType(data.preview.type);
                      setPreviewHtml(data.preview.html);
                      setPreviewSlides(data.preview.slides);
                      onTotalPagesChange?.(data.preview.page_count);
                    } else {
                      setPreviewError(data?.error || 'Preview failed');
                    }
                  }).catch(e => setPreviewError(e.message)).finally(() => setPreviewLoading(false));
                }}>🔄 Retry</button>
                <a className="dv-btn-action dv-btn-secondary" href={downloadUrl} target="_blank" rel="noopener noreferrer">📥 Download</a>
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
                  <a className="dv-btn-action dv-btn-secondary" href={downloadUrl} target="_blank" rel="noopener noreferrer">📥 Download</a>
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
            {hasPages ? '◀️▶️ Navigate' : '↕️ Scroll'} · 🤏 Zoom · 👌 Reset 100% · ✌ Summary · ⛶ Fullscreen (F / YoYo)
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