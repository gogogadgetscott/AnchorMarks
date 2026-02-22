const { initializeDatabase } = require("./models/database");
const { createBookmark, listBookmarks, deleteAllForUser } = require("./models/bookmark");

const db = initializeDatabase("./test-fts.db");
const userId = "test-user-1";

// Ensure clean slate
deleteAllForUser(db, userId);

createBookmark(db, userId, { title: "React Tutorial", url: "https://react.dev", description: "Learn React" });
createBookmark(db, userId, { title: "Svelte 5", url: "https://svelte.dev", description: "Learn Svelte web" });

const results1 = listBookmarks(db, userId, { search: "React" });
console.log("React search:", results1.bookmarks.length === 1 ? 'PASS' : 'FAIL');

const results2 = listBookmarks(db, userId, { search: "Learn" });
console.log("Learn search:", results2.bookmarks.length === 2 ? 'PASS' : 'FAIL');

const results3 = listBookmarks(db, userId, { search: "Tutorial" });
console.log("Tutorial search:", results3.bookmarks.length === 1 ? 'PASS' : 'FAIL');

console.log("Done");
