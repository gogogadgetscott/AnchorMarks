/**
 * Shared example bookmarks used for:
 * - New user account creation
 * - Reset bookmarks functionality
 *
 * Each bookmark has: title, url, description, tags
 * folder_id will be assigned dynamically when used
 */

const EXAMPLE_BOOKMARKS = [
  // Getting Started / AnchorMarks
  {
    title: "AnchorMarks Documentation",
    url: "https://github.com/gogogadgetscott/AnchorMarks",
    description: "Official documentation and source code for AnchorMarks",
    tags: "docs,anchormarks",
    inStarterFolder: true, // Place in the starter folder
  },
  // Productivity
  {
    title: "Google",
    url: "https://www.google.com",
    description: "Search the web",
    tags: "search,productivity",
  },
  {
    title: "Gmail",
    url: "https://mail.google.com",
    description: "Google email service",
    tags: "email,productivity",
  },
  {
    title: "Google Calendar",
    url: "https://calendar.google.com",
    description: "Manage your schedule",
    tags: "calendar,productivity",
  },
  {
    title: "Google Drive",
    url: "https://drive.google.com",
    description: "Cloud storage and collaboration",
    tags: "storage,productivity",
  },
  {
    title: "Notion",
    url: "https://www.notion.so",
    description: "All-in-one workspace",
    tags: "notes,productivity",
  },
  // Development
  {
    title: "GitHub",
    url: "https://github.com",
    description: "Code hosting and collaboration",
    tags: "development,git",
  },
  {
    title: "Stack Overflow",
    url: "https://stackoverflow.com",
    description: "Programming Q&A community",
    tags: "development,help",
  },
  {
    title: "MDN Web Docs",
    url: "https://developer.mozilla.org",
    description: "Web development documentation",
    tags: "development,docs",
  },
  {
    title: "CodePen",
    url: "https://codepen.io",
    description: "Frontend code playground",
    tags: "development,sandbox",
  },
  // Learning
  {
    title: "Wikipedia",
    url: "https://www.wikipedia.org",
    description: "Free encyclopedia",
    tags: "learning,reference",
  },
  {
    title: "YouTube",
    url: "https://www.youtube.com",
    description: "Video streaming platform",
    tags: "learning,entertainment",
  },
  {
    title: "Coursera",
    url: "https://www.coursera.org",
    description: "Online courses and degrees",
    tags: "learning,education",
  },
  // News & Social
  {
    title: "Reddit",
    url: "https://www.reddit.com",
    description: "Social news and discussion",
    tags: "social,news",
  },
  {
    title: "Hacker News",
    url: "https://news.ycombinator.com",
    description: "Tech news and discussion",
    tags: "news,tech",
  },
  {
    title: "Twitter / X",
    url: "https://twitter.com",
    description: "Social microblogging",
    tags: "social,news",
  },
];

/**
 * Starter folder configuration
 */
const STARTER_FOLDER = {
  name: "Getting Started",
  color: "#10b981",
  icon: "folder",
};

module.exports = {
  EXAMPLE_BOOKMARKS,
  STARTER_FOLDER,
};
