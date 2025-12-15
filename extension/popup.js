// AnchorMarks Browser Extension - Popup Script

let config = {
  serverUrl: "http://localhost:3000",
  apiKey: "",
};

// DOM Elements
const loginView = document.getElementById("login-view");
const connectedView = document.getElementById("connected-view");
const serverUrlInput = document.getElementById("server-url");
const apiKeyInput = document.getElementById("api-key");
const connectBtn = document.getElementById("connect-btn");
const syncBtn = document.getElementById("sync-btn");
const pushBtn = document.getElementById("push-btn");
const disconnectBtn = document.getElementById("disconnect-btn");
const addCurrentBtn = document.getElementById("add-current-btn");
const statusDot = document.getElementById("status-dot");
const statusText = document.getElementById("status-text");
const bookmarkCount = document.getElementById("bookmark-count");
const folderCount = document.getElementById("folder-count");
const currentPage = document.getElementById("current-page");

// API Helper
async function api(endpoint, options = {}) {
  const response = await fetch(`${config.serverUrl}/api${endpoint}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      "X-API-Key": config.apiKey,
      ...options.headers,
    },
  });

  if (!response.ok) {
    const data = await response.json();
    throw new Error(data.error || "API Error");
  }

  return response.json();
}

// Load config from storage
async function loadConfig() {
  const stored = await chrome.storage.local.get([
    "anchormarks_config",
    "anchormarks_config",
  ]);
  if (stored.anchormarks_config && !stored.anchormarks_config) {
    await chrome.storage.local.set({
      anchormarks_config: stored.anchormarks_config,
    });
    await chrome.storage.local.remove("anchormarks_config");
  }

  if (stored.anchormarks_config) {
    config = stored.anchormarks_config;
    serverUrlInput.value = config.serverUrl;
    apiKeyInput.value = config.apiKey;
    if (config.apiKey) {
      await checkConnection();
    }
  }
}

// Save config to storage
async function saveConfig() {
  await chrome.storage.local.set({ anchormarks_config: config });
}

// Check connection status
async function checkConnection() {
  try {
    const status = await api("/sync/status");
    showConnectedView(status);
  } catch (err) {
    showLoginView();
  }
}

// Show login view
function showLoginView() {
  loginView.classList.remove("hidden");
  connectedView.classList.add("hidden");
}

// Show connected view
function showConnectedView(status) {
  loginView.classList.add("hidden");
  connectedView.classList.remove("hidden");
  bookmarkCount.textContent = status.bookmarks || 0;
  folderCount.textContent = status.folders || 0;

  // Get current tab info
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    if (tabs[0]) {
      currentPage.textContent = tabs[0].title || tabs[0].url;
    }
  });
}

// Connect to server
async function connect() {
  config.serverUrl = serverUrlInput.value.replace(/\/$/, "");
  config.apiKey = apiKeyInput.value;

  try {
    statusText.textContent = "Connecting...";
    const status = await api("/sync/status");
    await saveConfig();
    showConnectedView(status);
  } catch (err) {
    alert("Connection failed: " + err.message);
  }
}

// Disconnect
async function disconnect() {
  config.apiKey = "";
  await saveConfig();
  showLoginView();
}

// Sync bookmarks
async function syncBookmarks() {
  statusDot.classList.add("syncing");
  statusText.textContent = "Syncing...";

  try {
    const status = await api("/sync/status");
    bookmarkCount.textContent = status.bookmarks || 0;
    folderCount.textContent = status.folders || 0;
    statusText.textContent = "Synced successfully!";
  } catch (err) {
    statusText.textContent = "Sync failed";
  } finally {
    statusDot.classList.remove("syncing");
    setTimeout(() => {
      statusText.textContent = "Connected to AnchorMarks";
    }, 2000);
  }
}

// Push browser bookmarks to AnchorMarks
async function pushBrowserBookmarks() {
  statusDot.classList.add("syncing");
  statusText.textContent = "Pushing bookmarks...";

  try {
    const tree = await chrome.bookmarks.getTree();
    const bookmarks = [];
    const folders = [];

    function processNode(node, parentId = null) {
      if (node.url) {
        bookmarks.push({
          title: node.title,
          url: node.url,
          folder_id: parentId,
        });
      } else if (node.children) {
        if (node.title) {
          folders.push({
            id: node.id,
            name: node.title,
            parent_id: parentId,
          });
        }
        node.children.forEach((child) => processNode(child, node.id));
      }
    }

    tree.forEach((node) => processNode(node));

    const result = await api("/sync/push", {
      method: "POST",
      body: JSON.stringify({ bookmarks, folders }),
    });

    statusText.textContent = `Pushed ${result.created} new, ${result.updated} updated`;
    await syncBookmarks();
  } catch (err) {
    statusText.textContent = "Push failed: " + err.message;
  } finally {
    statusDot.classList.remove("syncing");
  }
}

// Add current page as bookmark
async function addCurrentPage() {
  try {
    const [tab] = await chrome.tabs.query({
      active: true,
      currentWindow: true,
    });
    if (!tab) return;

    await api("/bookmarks", {
      method: "POST",
      body: JSON.stringify({
        title: tab.title,
        url: tab.url,
      }),
    });

    statusText.textContent = "Bookmark added!";
    await syncBookmarks();
  } catch (err) {
    statusText.textContent = "Failed to add bookmark";
  }
}

// Event Listeners
connectBtn.addEventListener("click", connect);
disconnectBtn.addEventListener("click", disconnect);
syncBtn.addEventListener("click", syncBookmarks);
pushBtn.addEventListener("click", pushBrowserBookmarks);
addCurrentBtn.addEventListener("click", addCurrentPage);

// Initialize
loadConfig();
