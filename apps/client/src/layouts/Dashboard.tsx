import React, { memo, useMemo } from "react";
import { Icon } from "../components/Icon.tsx";
import { useAppState } from "../contexts/AppContext";

export const Dashboard = memo(() => {
  const { bookmarks, folders, tags } = useAppState();

  const stats = useMemo(() => {
    const now = Date.now();
    const dayAgo = now - 24 * 60 * 60 * 1000;
    const weekAgo = now - 7 * 24 * 60 * 60 * 1000;
    const monthAgo = now - 30 * 24 * 60 * 60 * 1000;

    return {
      total: bookmarks.length,
      favorites: bookmarks.filter((b) => b.is_favorite).length,
      addedToday: bookmarks.filter(
        (b) => new Date(b.created_at || 0).getTime() > dayAgo,
      ).length,
      addedThisWeek: bookmarks.filter(
        (b) => new Date(b.created_at || 0).getTime() > weekAgo,
      ).length,
      addedThisMonth: bookmarks.filter(
        (b) => new Date(b.created_at || 0).getTime() > monthAgo,
      ).length,
      folders: folders.length,
      tags: tags.length,
    };
  }, [bookmarks, folders, tags]);

  const recentBookmarks = useMemo(() => {
    return [...bookmarks]
      .sort(
        (a, b) =>
          new Date(b.created_at || 0).getTime() -
          new Date(a.created_at || 0).getTime(),
      )
      .slice(0, 5);
  }, [bookmarks]);

  const mostVisited = useMemo(() => {
    return [...bookmarks]
      .sort((a, b) => (b.click_count || 0) - (a.click_count || 0))
      .slice(0, 5);
  }, [bookmarks]);

  return (
    <div id="dashboard-view" className="dashboard-view">
      <div className="dashboard-header">
        <h1>Dashboard</h1>
        <p className="dashboard-subtitle">
          Welcome back! Here's your bookmark overview
        </p>
      </div>

      <div className="dashboard-grid">
        {/* Stats Cards */}
        <div className="dashboard-card stats-card">
          <div className="card-icon">
            <Icon name="list" size={24} />
          </div>
          <div className="card-content">
            <div className="card-value">{stats.total}</div>
            <div className="card-label">Total Bookmarks</div>
          </div>
        </div>

        <div className="dashboard-card stats-card">
          <div className="card-icon">
            <Icon name="star" size={24} />
          </div>
          <div className="card-content">
            <div className="card-value">{stats.favorites}</div>
            <div className="card-label">Favorites</div>
          </div>
        </div>

        <div className="dashboard-card stats-card">
          <div className="card-icon">
            <Icon name="folder" size={24} />
          </div>
          <div className="card-content">
            <div className="card-value">{stats.folders}</div>
            <div className="card-label">Folders</div>
          </div>
        </div>

        <div className="dashboard-card stats-card">
          <div className="card-icon">
            <Icon name="tag" size={24} />
          </div>
          <div className="card-content">
            <div className="card-value">{stats.tags}</div>
            <div className="card-label">Tags</div>
          </div>
        </div>

        {/* Activity Card */}
        <div className="dashboard-card activity-card">
          <h3 className="card-title">Recent Activity</h3>
          <div className="activity-stats">
            <div className="activity-stat">
              <span className="activity-label">Today</span>
              <span className="activity-value">{stats.addedToday}</span>
            </div>
            <div className="activity-stat">
              <span className="activity-label">This Week</span>
              <span className="activity-value">{stats.addedThisWeek}</span>
            </div>
            <div className="activity-stat">
              <span className="activity-label">This Month</span>
              <span className="activity-value">{stats.addedThisMonth}</span>
            </div>
          </div>
        </div>

        {/* Recent Bookmarks */}
        <div className="dashboard-card recent-card">
          <h3 className="card-title">Recent Bookmarks</h3>
          <div className="recent-list">
            {recentBookmarks.length > 0 ? (
              recentBookmarks.map((bookmark) => (
                <a
                  key={bookmark.id}
                  href={bookmark.url}
                  className="recent-item"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  {bookmark.favicon && (
                    <img src={bookmark.favicon} alt="" width={16} height={16} />
                  )}
                  <span className="recent-title">{bookmark.title}</span>
                </a>
              ))
            ) : (
              <p className="empty-message">No bookmarks yet</p>
            )}
          </div>
        </div>

        {/* Most Visited */}
        <div className="dashboard-card popular-card">
          <h3 className="card-title">Most Visited</h3>
          <div className="popular-list">
            {mostVisited.length > 0 ? (
              mostVisited.map((bookmark) => (
                <a
                  key={bookmark.id}
                  href={bookmark.url}
                  className="popular-item"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  {bookmark.favicon && (
                    <img src={bookmark.favicon} alt="" width={16} height={16} />
                  )}
                  <span className="popular-title">{bookmark.title}</span>
                  <span className="popular-count">
                    {bookmark.click_count || 0} clicks
                  </span>
                </a>
              ))
            ) : (
              <p className="empty-message">No visits tracked yet</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
});

Dashboard.displayName = "Dashboard";
