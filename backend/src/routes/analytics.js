/**
 * Analytics Routes - Advanced Analytics Dashboard Backend
 */

const express = require('express');
const router = express.Router();
const database = require('../models/database');

const logger = {
  info: (msg) => console.log(`[ANALYTICS-INFO] ${msg}`),
  error: (msg, err) => console.error(`[ANALYTICS-ERROR] ${msg}`, err || '')
};

// ====================
// RECORD ANALYTICS EVENT
// ====================

router.post('/event', async (req, res) => {
  try {
    const { documentId, eventType, eventData, durationSeconds } = req.body;

    if (!eventType) {
      return res.status(400).json({ success: false, message: 'eventType is required' });
    }

    await database.run(
      `INSERT INTO analytics (document_id, event_type, event_data, duration_seconds)
       VALUES (?, ?, ?, ?)`,
      [documentId || null, eventType, JSON.stringify(eventData || {}), durationSeconds || 0]
    );

    // If it's a view event, update access_count on the document
    if (eventType === 'view' && documentId) {
      await database.run(
        `UPDATE documents SET access_count = access_count + 1, last_accessed = CURRENT_TIMESTAMP WHERE id = ?`,
        [documentId]
      );
    }

    res.json({ success: true, message: 'Event recorded' });
  } catch (error) {
    logger.error('Failed to record event', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// ====================
// OVERVIEW STATS
// ====================

router.get('/stats', async (req, res) => {
  try {
    const totalDocs = await database.get(
      `SELECT COUNT(*) as count FROM documents WHERE is_deleted = 0`
    );

    const totalSize = await database.get(
      `SELECT COALESCE(SUM(file_size), 0) as total FROM documents WHERE is_deleted = 0`
    );

    const totalViews = await database.get(
      `SELECT COALESCE(SUM(access_count), 0) as total FROM documents WHERE is_deleted = 0`
    );

    const totalReadingTime = await database.get(
      `SELECT COALESCE(SUM(duration_seconds), 0) as total FROM analytics WHERE event_type = 'view'`
    );

    const bookmarkedCount = await database.get(
      `SELECT COUNT(*) as count FROM documents WHERE is_bookmarked = 1 AND is_deleted = 0`
    );

    const categoriesCount = await database.get(
      `SELECT COUNT(DISTINCT main_category) as count FROM documents WHERE is_deleted = 0`
    );

    const uploadsThisWeek = await database.get(
      `SELECT COUNT(*) as count FROM documents
       WHERE is_deleted = 0 AND created_at >= datetime('now', '-7 days')`
    );

    const uploadsThisMonth = await database.get(
      `SELECT COUNT(*) as count FROM documents
       WHERE is_deleted = 0 AND created_at >= datetime('now', '-30 days')`
    );

    res.json({
      success: true,
      data: {
        totalDocuments: totalDocs.count,
        totalSizeBytes: totalSize.total,
        totalViews: totalViews.total,
        totalReadingTimeSeconds: totalReadingTime.total,
        bookmarkedCount: bookmarkedCount.count,
        categoriesCount: categoriesCount.count,
        uploadsThisWeek: uploadsThisWeek.count,
        uploadsThisMonth: uploadsThisMonth.count
      }
    });
  } catch (error) {
    logger.error('Failed to get stats', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// ====================
// CATEGORY DISTRIBUTION
// ====================

router.get('/categories', async (req, res) => {
  try {
    const categories = await database.all(
      `SELECT main_category as name, COUNT(*) as count,
              COALESCE(SUM(file_size), 0) as totalSize,
              COALESCE(SUM(access_count), 0) as totalViews
       FROM documents
       WHERE is_deleted = 0
       GROUP BY main_category
       ORDER BY count DESC`
    );

    res.json({ success: true, data: categories });
  } catch (error) {
    logger.error('Failed to get category stats', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// ====================
// MOST ACCESSED DOCUMENTS
// ====================

router.get('/most-accessed', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 10;

    const docs = await database.all(
      `SELECT id, original_name, main_category, sub_category, access_count,
              last_accessed, file_type, file_size
       FROM documents
       WHERE is_deleted = 0 AND access_count > 0
       ORDER BY access_count DESC
       LIMIT ?`,
      [limit]
    );

    res.json({ success: true, data: docs });
  } catch (error) {
    logger.error('Failed to get most accessed', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// ====================
// LEAST ACCESSED DOCUMENTS (WEAK AREAS)
// ====================

router.get('/least-accessed', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 10;

    const docs = await database.all(
      `SELECT id, original_name, main_category, sub_category, access_count,
              created_at, file_type, file_size
       FROM documents
       WHERE is_deleted = 0
       ORDER BY access_count ASC, created_at ASC
       LIMIT ?`,
      [limit]
    );

    res.json({ success: true, data: docs });
  } catch (error) {
    logger.error('Failed to get least accessed', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// ====================
// UPLOAD TRENDS (DAILY FOR LAST 30 DAYS)
// ====================

router.get('/upload-trends', async (req, res) => {
  try {
    const days = parseInt(req.query.days) || 30;

    const trends = await database.all(
      `SELECT DATE(created_at) as date, COUNT(*) as count
       FROM documents
       WHERE is_deleted = 0 AND created_at >= datetime('now', '-' || ? || ' days')
       GROUP BY DATE(created_at)
       ORDER BY date ASC`,
      [days]
    );

    // Fill in missing dates with 0
    const filledTrends = [];
    const now = new Date();
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(d.getDate() - i);
      const dateStr = d.toISOString().split('T')[0];
      const existing = trends.find(t => t.date === dateStr);
      filledTrends.push({
        date: dateStr,
        count: existing ? existing.count : 0
      });
    }

    res.json({ success: true, data: filledTrends });
  } catch (error) {
    logger.error('Failed to get upload trends', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// ====================
// ACTIVITY TRENDS (VIEWS PER DAY)
// ====================

router.get('/activity-trends', async (req, res) => {
  try {
    const days = parseInt(req.query.days) || 30;

    const trends = await database.all(
      `SELECT DATE(created_at) as date, COUNT(*) as count,
              COALESCE(SUM(duration_seconds), 0) as totalDuration
       FROM analytics
       WHERE event_type = 'view' AND created_at >= datetime('now', '-' || ? || ' days')
       GROUP BY DATE(created_at)
       ORDER BY date ASC`,
      [days]
    );

    const filledTrends = [];
    const now = new Date();
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(d.getDate() - i);
      const dateStr = d.toISOString().split('T')[0];
      const existing = trends.find(t => t.date === dateStr);
      filledTrends.push({
        date: dateStr,
        views: existing ? existing.count : 0,
        readingMinutes: existing ? Math.round(existing.totalDuration / 60) : 0
      });
    }

    res.json({ success: true, data: filledTrends });
  } catch (error) {
    logger.error('Failed to get activity trends', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// ====================
// FILE TYPE DISTRIBUTION
// ====================

router.get('/file-types', async (req, res) => {
  try {
    const types = await database.all(
      `SELECT file_type as type, COUNT(*) as count, COALESCE(SUM(file_size), 0) as totalSize
       FROM documents
       WHERE is_deleted = 0
       GROUP BY file_type
       ORDER BY count DESC`
    );

    res.json({ success: true, data: types });
  } catch (error) {
    logger.error('Failed to get file types', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// ====================
// SMART SUGGESTIONS
// ====================

router.get('/suggestions', async (req, res) => {
  try {
    const suggestions = [];

    // 1. Documents not viewed in a long time
    const staleDocuments = await database.all(
      `SELECT id, original_name, main_category, sub_category, last_accessed, created_at
       FROM documents
       WHERE is_deleted = 0
       AND (last_accessed IS NULL OR last_accessed < datetime('now', '-7 days'))
       ORDER BY COALESCE(last_accessed, created_at) ASC
       LIMIT 5`
    );

    for (const doc of staleDocuments) {
      const daysSince = doc.last_accessed
        ? Math.floor((Date.now() - new Date(doc.last_accessed).getTime()) / (1000 * 60 * 60 * 24))
        : Math.floor((Date.now() - new Date(doc.created_at).getTime()) / (1000 * 60 * 60 * 24));

      suggestions.push({
        type: 'review',
        priority: daysSince > 30 ? 'high' : 'medium',
        icon: '📖',
        title: `Review: ${doc.original_name}`,
        message: doc.last_accessed
          ? `You haven't opened this in ${daysSince} days. Consider reviewing it.`
          : `You uploaded this ${daysSince} days ago but never opened it.`,
        documentId: doc.id,
        category: doc.main_category
      });
    }

    // 2. Categories with low engagement
    const weakCategories = await database.all(
      `SELECT main_category, COUNT(*) as docCount,
              COALESCE(SUM(access_count), 0) as totalViews,
              ROUND(COALESCE(SUM(access_count), 0) * 1.0 / COUNT(*), 1) as avgViews
       FROM documents
       WHERE is_deleted = 0
       GROUP BY main_category
       HAVING avgViews < 2 AND docCount >= 2
       ORDER BY avgViews ASC
       LIMIT 3`
    );

    for (const cat of weakCategories) {
      suggestions.push({
        type: 'weak_area',
        priority: 'medium',
        icon: '⚠️',
        title: `Weak area: ${cat.main_category}`,
        message: `You have ${cat.docCount} documents in ${cat.main_category} but average only ${cat.avgViews} views each. Consider studying these.`,
        category: cat.main_category
      });
    }

    // 3. Frequently studied topics (positive reinforcement)
    const strongCategories = await database.all(
      `SELECT main_category, COUNT(*) as docCount,
              COALESCE(SUM(access_count), 0) as totalViews,
              ROUND(COALESCE(SUM(access_count), 0) * 1.0 / COUNT(*), 1) as avgViews
       FROM documents
       WHERE is_deleted = 0
       GROUP BY main_category
       HAVING avgViews >= 5
       ORDER BY avgViews DESC
       LIMIT 3`
    );

    for (const cat of strongCategories) {
      suggestions.push({
        type: 'strong_area',
        priority: 'low',
        icon: '🌟',
        title: `Strong focus: ${cat.main_category}`,
        message: `Great job! You've been actively studying ${cat.main_category} with an average of ${cat.avgViews} views per document.`,
        category: cat.main_category
      });
    }

    // 4. Recent uploads needing categorization
    const uncategorized = await database.get(
      `SELECT COUNT(*) as count FROM documents
       WHERE is_deleted = 0 AND (main_category = 'Uncategorized' OR main_category IS NULL)`
    );

    if (uncategorized.count > 0) {
      suggestions.push({
        type: 'organize',
        priority: 'high',
        icon: '📂',
        title: 'Organize documents',
        message: `You have ${uncategorized.count} uncategorized document(s). Consider organizing them for better access.`,
        category: 'Uncategorized'
      });
    }

    // Sort by priority
    const priorityOrder = { high: 0, medium: 1, low: 2 };
    suggestions.sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]);

    res.json({ success: true, data: suggestions });
  } catch (error) {
    logger.error('Failed to get suggestions', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// ====================
// TOP KEYWORDS
// ====================

router.get('/top-keywords', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 20;

    const keywords = await database.all(
      `SELECT keyword, COUNT(*) as count
       FROM keywords k
       JOIN documents d ON k.document_id = d.id
       WHERE d.is_deleted = 0
       GROUP BY keyword
       ORDER BY count DESC
       LIMIT ?`,
      [limit]
    );

    res.json({ success: true, data: keywords });
  } catch (error) {
    logger.error('Failed to get top keywords', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// ====================
// WEEKLY SUMMARY
// ====================

router.get('/weekly-summary', async (req, res) => {
  try {
    const weeksBack = parseInt(req.query.weeks) || 8;
    const summaries = [];

    for (let i = 0; i < weeksBack; i++) {
      const weekData = await database.get(
        `SELECT
          COUNT(*) as uploads,
          COALESCE(SUM(file_size), 0) as totalSize
         FROM documents
         WHERE is_deleted = 0
         AND created_at >= datetime('now', '-' || ? || ' days')
         AND created_at < datetime('now', '-' || ? || ' days')`,
        [(i + 1) * 7, i * 7]
      );

      const viewData = await database.get(
        `SELECT COUNT(*) as views, COALESCE(SUM(duration_seconds), 0) as readingTime
         FROM analytics
         WHERE event_type = 'view'
         AND created_at >= datetime('now', '-' || ? || ' days')
         AND created_at < datetime('now', '-' || ? || ' days')`,
        [(i + 1) * 7, i * 7]
      );

      const weekStart = new Date();
      weekStart.setDate(weekStart.getDate() - (i + 1) * 7);

      summaries.push({
        weekStart: weekStart.toISOString().split('T')[0],
        weekLabel: i === 0 ? 'This Week' : i === 1 ? 'Last Week' : `${i + 1} Weeks Ago`,
        uploads: weekData.uploads,
        totalSize: weekData.totalSize,
        views: viewData.views,
        readingTimeMinutes: Math.round(viewData.readingTime / 60)
      });
    }

    res.json({ success: true, data: summaries.reverse() });
  } catch (error) {
    logger.error('Failed to get weekly summary', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;