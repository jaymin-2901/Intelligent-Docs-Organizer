import React, { useState, useEffect, useCallback } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  PieChart, Pie, Cell, LineChart, Line, ResponsiveContainer, Area, AreaChart
} from 'recharts';
import './AnalyticsDashboard.css';

const API_URL = 'http://localhost:5000/api/analytics';

const COLORS = ['#8b5cf6', '#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#ec4899', '#6366f1', '#14b8a6'];

const PRIORITY_COLORS = {
  high: '#ef4444',
  medium: '#f59e0b',
  low: '#10b981'
};

function AnalyticsDashboard() {
  const [stats, setStats] = useState(null);
  const [categoryData, setCategoryData] = useState([]);
  const [uploadTrends, setUploadTrends] = useState([]);
  const [activityTrends, setActivityTrends] = useState([]);
  const [fileTypes, setFileTypes] = useState([]);
  const [mostAccessed, setMostAccessed] = useState([]);
  const [leastAccessed, setLeastAccessed] = useState([]);
  const [suggestions, setSuggestions] = useState([]);
  const [topKeywords, setTopKeywords] = useState([]);
  const [weeklySummary, setWeeklySummary] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeSection, setActiveSection] = useState('overview');
  const [trendDays, setTrendDays] = useState(30);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const endpoints = [
        { url: `${API_URL}/stats`, setter: (d) => setStats(d.data) },
        { url: `${API_URL}/categories`, setter: (d) => setCategoryData(d.data) },
        { url: `${API_URL}/upload-trends?days=${trendDays}`, setter: (d) => setUploadTrends(d.data) },
        { url: `${API_URL}/activity-trends?days=${trendDays}`, setter: (d) => setActivityTrends(d.data) },
        { url: `${API_URL}/file-types`, setter: (d) => setFileTypes(d.data) },
        { url: `${API_URL}/most-accessed?limit=10`, setter: (d) => setMostAccessed(d.data) },
        { url: `${API_URL}/least-accessed?limit=10`, setter: (d) => setLeastAccessed(d.data) },
        { url: `${API_URL}/suggestions`, setter: (d) => setSuggestions(d.data) },
        { url: `${API_URL}/top-keywords?limit=15`, setter: (d) => setTopKeywords(d.data) },
        { url: `${API_URL}/weekly-summary?weeks=8`, setter: (d) => setWeeklySummary(d.data) },
      ];

      const results = await Promise.allSettled(
        endpoints.map(ep => fetch(ep.url).then(r => r.json()))
      );

      results.forEach((result, index) => {
        if (result.status === 'fulfilled' && result.value.success) {
          endpoints[index].setter(result.value);
        }
      });
    } catch (error) {
      console.error('Analytics fetch error:', error);
    } finally {
      setLoading(false);
    }
  }, [trendDays]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const formatBytes = (bytes) => {
    if (!bytes) return '0 B';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
  };

  const formatDuration = (seconds) => {
    if (!seconds) return '0 min';
    if (seconds < 60) return `${seconds}s`;
    if (seconds < 3600) return `${Math.round(seconds / 60)} min`;
    const hours = Math.floor(seconds / 3600);
    const mins = Math.round((seconds % 3600) / 60);
    return `${hours}h ${mins}m`;
  };

  if (loading) {
    return (
      <div className="analytics-loading">
        <div className="analytics-spinner"></div>
        <p>Loading analytics data...</p>
      </div>
    );
  }

  return (
    <div className="analytics-dashboard">
      {/* Navigation Tabs */}
      <div className="analytics-nav">
        {[
          { id: 'overview', label: '📊 Overview', },
          { id: 'trends', label: '📈 Trends' },
          { id: 'insights', label: '🧠 AI Insights' },
          { id: 'details', label: '📋 Details' },
        ].map(tab => (
          <button
            key={tab.id}
            className={`analytics-nav-btn ${activeSection === tab.id ? 'active' : ''}`}
            onClick={() => setActiveSection(tab.id)}
          >
            {tab.label}
          </button>
        ))}
        <button className="analytics-refresh-btn" onClick={fetchData}>🔄 Refresh</button>
      </div>

      {/* ============ OVERVIEW SECTION ============ */}
      {activeSection === 'overview' && (
        <div className="analytics-section">
          {/* Stats Cards */}
          <div className="stats-grid">
            <div className="stat-card purple">
              <div className="stat-icon">📄</div>
              <div className="stat-info">
                <span className="stat-value">{stats?.totalDocuments || 0}</span>
                <span className="stat-label">Total Documents</span>
              </div>
            </div>
            <div className="stat-card blue">
              <div className="stat-icon">💾</div>
              <div className="stat-info">
                <span className="stat-value">{formatBytes(stats?.totalSizeBytes)}</span>
                <span className="stat-label">Total Storage</span>
              </div>
            </div>
            <div className="stat-card green">
              <div className="stat-icon">👁️</div>
              <div className="stat-info">
                <span className="stat-value">{stats?.totalViews || 0}</span>
                <span className="stat-label">Total Views</span>
              </div>
            </div>
            <div className="stat-card amber">
              <div className="stat-icon">⏱️</div>
              <div className="stat-info">
                <span className="stat-value">{formatDuration(stats?.totalReadingTimeSeconds)}</span>
                <span className="stat-label">Reading Time</span>
              </div>
            </div>
            <div className="stat-card pink">
              <div className="stat-icon">🔖</div>
              <div className="stat-info">
                <span className="stat-value">{stats?.bookmarkedCount || 0}</span>
                <span className="stat-label">Bookmarked</span>
              </div>
            </div>
            <div className="stat-card teal">
              <div className="stat-icon">📁</div>
              <div className="stat-info">
                <span className="stat-value">{stats?.categoriesCount || 0}</span>
                <span className="stat-label">Categories</span>
              </div>
            </div>
            <div className="stat-card indigo">
              <div className="stat-icon">📅</div>
              <div className="stat-info">
                <span className="stat-value">{stats?.uploadsThisWeek || 0}</span>
                <span className="stat-label">This Week</span>
              </div>
            </div>
            <div className="stat-card red">
              <div className="stat-icon">📆</div>
              <div className="stat-info">
                <span className="stat-value">{stats?.uploadsThisMonth || 0}</span>
                <span className="stat-label">This Month</span>
              </div>
            </div>
          </div>

          {/* Charts Row */}
          <div className="charts-row">
            {/* Category Distribution Pie */}
            <div className="chart-card">
              <h3>📂 Category Distribution</h3>
              {categoryData.length > 0 ? (
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={categoryData}
                      dataKey="count"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      outerRadius={100}
                      label={({ name, percent }) => `${name} (${(percent * 100).toFixed(0)}%)`}
                    >
                      {categoryData.map((entry, index) => (
                        <Cell key={entry.name} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <div className="chart-empty">No category data available</div>
              )}
            </div>

            {/* File Type Distribution */}
            <div className="chart-card">
              <h3>📎 File Types</h3>
              {fileTypes.length > 0 ? (
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={fileTypes}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                    <XAxis dataKey="type" stroke="#9ca3af" />
                    <YAxis stroke="#9ca3af" />
                    <Tooltip
                      contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: '8px' }}
                      labelStyle={{ color: '#f3f4f6' }}
                    />
                    <Bar dataKey="count" fill="#8b5cf6" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="chart-empty">No file type data available</div>
              )}
            </div>
          </div>

          {/* Weekly Summary Bar Chart */}
          <div className="chart-card full-width">
            <h3>📊 Weekly Summary (Last 8 Weeks)</h3>
            {weeklySummary.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={weeklySummary}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                  <XAxis dataKey="weekLabel" stroke="#9ca3af" tick={{ fontSize: 12 }} />
                  <YAxis stroke="#9ca3af" />
                  <Tooltip
                    contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: '8px' }}
                    labelStyle={{ color: '#f3f4f6' }}
                  />
                  <Legend />
                  <Bar dataKey="uploads" fill="#8b5cf6" name="Uploads" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="views" fill="#3b82f6" name="Views" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="readingTimeMinutes" fill="#10b981" name="Reading (min)" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="chart-empty">No weekly data available</div>
            )}
          </div>
        </div>
      )}

      {/* ============ TRENDS SECTION ============ */}
      {activeSection === 'trends' && (
        <div className="analytics-section">
          {/* Period Selector */}
          <div className="trend-controls">
            <span>Show trends for:</span>
            {[7, 14, 30, 60, 90].map(d => (
              <button
                key={d}
                className={`trend-period-btn ${trendDays === d ? 'active' : ''}`}
                onClick={() => setTrendDays(d)}
              >
                {d} days
              </button>
            ))}
          </div>

          {/* Upload Trends */}
          <div className="chart-card full-width">
            <h3>📤 Upload Trends</h3>
            {uploadTrends.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <AreaChart data={uploadTrends}>
                  <defs>
                    <linearGradient id="uploadGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                  <XAxis
                    dataKey="date"
                    stroke="#9ca3af"
                    tick={{ fontSize: 10 }}
                    tickFormatter={(val) => {
                      const d = new Date(val);
                      return `${d.getMonth() + 1}/${d.getDate()}`;
                    }}
                  />
                  <YAxis stroke="#9ca3af" allowDecimals={false} />
                  <Tooltip
                    contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: '8px' }}
                    labelStyle={{ color: '#f3f4f6' }}
                  />
                  <Area type="monotone" dataKey="count" stroke="#8b5cf6" fill="url(#uploadGradient)" name="Uploads" />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="chart-empty">No upload trend data</div>
            )}
          </div>

          {/* Activity Trends */}
          <div className="chart-card full-width">
            <h3>📖 Activity Trends (Views & Reading Time)</h3>
            {activityTrends.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={activityTrends}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                  <XAxis
                    dataKey="date"
                    stroke="#9ca3af"
                    tick={{ fontSize: 10 }}
                    tickFormatter={(val) => {
                      const d = new Date(val);
                      return `${d.getMonth() + 1}/${d.getDate()}`;
                    }}
                  />
                  <YAxis stroke="#9ca3af" yAxisId="left" />
                  <YAxis stroke="#9ca3af" yAxisId="right" orientation="right" />
                  <Tooltip
                    contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: '8px' }}
                    labelStyle={{ color: '#f3f4f6' }}
                  />
                  <Legend />
                  <Line yAxisId="left" type="monotone" dataKey="views" stroke="#3b82f6" name="Views" dot={false} strokeWidth={2} />
                  <Line yAxisId="right" type="monotone" dataKey="readingMinutes" stroke="#10b981" name="Reading (min)" dot={false} strokeWidth={2} />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div className="chart-empty">No activity data</div>
            )}
          </div>

          {/* Category Views Comparison */}
          <div className="chart-card full-width">
            <h3>👁️ Category Engagement</h3>
            {categoryData.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={categoryData} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                  <XAxis type="number" stroke="#9ca3af" />
                  <YAxis type="category" dataKey="name" stroke="#9ca3af" width={120} tick={{ fontSize: 12 }} />
                  <Tooltip
                    contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: '8px' }}
                    labelStyle={{ color: '#f3f4f6' }}
                  />
                  <Legend />
                  <Bar dataKey="count" fill="#8b5cf6" name="Documents" radius={[0, 4, 4, 0]} />
                  <Bar dataKey="totalViews" fill="#3b82f6" name="Views" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="chart-empty">No category data</div>
            )}
          </div>
        </div>
      )}

      {/* ============ AI INSIGHTS SECTION ============ */}
      {activeSection === 'insights' && (
        <div className="analytics-section">
          {/* Smart Suggestions */}
          <div className="insights-panel">
            <h3>🧠 Smart Suggestions</h3>
            {suggestions.length > 0 ? (
              <div className="suggestions-list">
                {suggestions.map((suggestion, index) => (
                  <div
                    key={index}
                    className={`suggestion-card priority-${suggestion.priority}`}
                    style={{ borderLeftColor: PRIORITY_COLORS[suggestion.priority] }}
                  >
                    <div className="suggestion-header">
                      <span className="suggestion-icon">{suggestion.icon}</span>
                      <span className="suggestion-title">{suggestion.title}</span>
                      <span
                        className="suggestion-priority"
                        style={{ backgroundColor: PRIORITY_COLORS[suggestion.priority] }}
                      >
                        {suggestion.priority}
                      </span>
                    </div>
                    <p className="suggestion-message">{suggestion.message}</p>
                  </div>
                ))}
              </div>
            ) : (
              <div className="insights-empty">
                <span className="empty-icon">✨</span>
                <p>Everything looks great! No suggestions at this time.</p>
              </div>
            )}
          </div>

          {/* Top Keywords */}
          <div className="insights-panel">
            <h3>🏷️ Top Keywords / Topics</h3>
            {topKeywords.length > 0 ? (
              <div className="keywords-cloud">
                {topKeywords.map((kw, index) => (
                  <span
                    key={kw.keyword}
                    className="keyword-tag"
                    style={{
                      fontSize: `${Math.max(12, Math.min(28, 12 + kw.count * 3))}px`,
                      backgroundColor: COLORS[index % COLORS.length] + '30',
                      color: COLORS[index % COLORS.length],
                      borderColor: COLORS[index % COLORS.length]
                    }}
                  >
                    {kw.keyword} ({kw.count})
                  </span>
                ))}
              </div>
            ) : (
              <div className="insights-empty">
                <p>No keywords extracted yet. Upload documents to generate keywords.</p>
              </div>
            )}
          </div>

          {/* Most vs Least Accessed */}
          <div className="charts-row">
            <div className="insights-panel">
              <h3>🔥 Most Studied Topics</h3>
              {mostAccessed.length > 0 ? (
                <div className="ranked-list">
                  {mostAccessed.map((doc, index) => (
                    <div key={doc.id} className="ranked-item">
                      <span className="rank-number">#{index + 1}</span>
                      <div className="ranked-info">
                        <span className="ranked-name">{doc.original_name}</span>
                        <span className="ranked-meta">{doc.main_category} • {doc.access_count} views</span>
                      </div>
                      <div className="ranked-bar">
                        <div
                          className="ranked-bar-fill hot"
                          style={{
                            width: `${(doc.access_count / (mostAccessed[0]?.access_count || 1)) * 100}%`
                          }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="insights-empty"><p>No data yet.</p></div>
              )}
            </div>

            <div className="insights-panel">
              <h3>❄️ Least Studied (Weak Areas)</h3>
              {leastAccessed.length > 0 ? (
                <div className="ranked-list">
                  {leastAccessed.map((doc, index) => (
                    <div key={doc.id} className="ranked-item cold">
                      <span className="rank-number">#{index + 1}</span>
                      <div className="ranked-info">
                        <span className="ranked-name">{doc.original_name}</span>
                        <span className="ranked-meta">{doc.main_category} • {doc.access_count} views</span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="insights-empty"><p>No data yet.</p></div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ============ DETAILS SECTION ============ */}
      {activeSection === 'details' && (
        <div className="analytics-section">
          <div className="details-grid">
            {/* Category Details Table */}
            <div className="details-panel full-width">
              <h3>📋 Category Details</h3>
              <table className="analytics-table">
                <thead>
                  <tr>
                    <th>Category</th>
                    <th>Documents</th>
                    <th>Total Size</th>
                    <th>Total Views</th>
                    <th>Avg Views/Doc</th>
                  </tr>
                </thead>
                <tbody>
                  {categoryData.map((cat) => (
                    <tr key={cat.name}>
                      <td><strong>{cat.name}</strong></td>
                      <td>{cat.count}</td>
                      <td>{formatBytes(cat.totalSize)}</td>
                      <td>{cat.totalViews}</td>
                      <td>{cat.count > 0 ? (cat.totalViews / cat.count).toFixed(1) : '0'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* All Documents Table */}
            <div className="details-panel full-width">
              <h3>📄 Most Accessed Documents</h3>
              <table className="analytics-table">
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Document</th>
                    <th>Category</th>
                    <th>Type</th>
                    <th>Size</th>
                    <th>Views</th>
                    <th>Last Accessed</th>
                  </tr>
                </thead>
                <tbody>
                  {mostAccessed.map((doc, index) => (
                    <tr key={doc.id}>
                      <td>{index + 1}</td>
                      <td>{doc.original_name}</td>
                      <td>{doc.main_category}</td>
                      <td>{doc.file_type?.toUpperCase()}</td>
                      <td>{formatBytes(doc.file_size)}</td>
                      <td>{doc.access_count}</td>
                      <td>{doc.last_accessed ? new Date(doc.last_accessed).toLocaleDateString() : 'Never'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default AnalyticsDashboard;