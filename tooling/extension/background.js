// AnchorMarks Browser Extension - Background Service Worker

chrome.runtime.onInstalled.addListener(() => {
  console.log("AnchorMarks extension installed");
});

// Listen for bookmark changes and sync
chrome.bookmarks.onCreated.addListener(async (id, bookmark) => {
  const config = await getConfig();
  if (!config.apiKey || !config.autoSync) return;

  try {
    await syncBookmark(config, bookmark);
  } catch (err) {
    console.error("Failed to sync bookmark:", err);
  }
});

chrome.bookmarks.onRemoved.addListener(async (_id, _removeInfo) => {
  // Could implement delete sync here
});

chrome.bookmarks.onChanged.addListener(async (id, _changeInfo) => {
  const config = await getConfig();
  if (!config.apiKey || !config.autoSync) return;

  try {
    const [bookmark] = await chrome.bookmarks.get(id);
    if (bookmark && bookmark.url) {
      await syncBookmark(config, bookmark);
    }
  } catch (err) {
    console.error("Failed to sync bookmark change:", err);
  }
});

async function getConfig() {
  const stored = await chrome.storage.local.get(["anchormarks_config"]);
  return (
    stored.anchormarks_config || {
      serverUrl: "http://localhost:3000",
      apiKey: "",
      autoSync: false,
    }
  );
}

async function syncBookmark(config, bookmark) {
  if (!bookmark.url) return;

  const response = await fetch(`${config.serverUrl}/api/bookmarks`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-API-Key": config.apiKey,
    },
    body: JSON.stringify({
      title: bookmark.title,
      url: bookmark.url,
    }),
  });

  if (!response.ok) {
    throw new Error("Failed to sync bookmark");
  }
}

// Context menu for quick add
chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: "anchormarks-add",
    title: "Add to AnchorMarks",
    contexts: ["page", "link"],
  });
});

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (info.menuItemId !== "anchormarks-add") return;

  const config = await getConfig();
  if (!config.apiKey) {
    console.error("AnchorMarks not configured");
    return;
  }

  const url = info.linkUrl || info.pageUrl;
  const title = info.linkUrl ? info.selectionText || url : tab.title;

  try {
    await fetch(`${config.serverUrl}/api/bookmarks`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-API-Key": config.apiKey,
      },
      body: JSON.stringify({ title, url }),
    });
  } catch (err) {
    console.error("Failed to add bookmark:", err);
  }
});
