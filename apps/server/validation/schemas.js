"use strict";

const { z } = require("zod");

// ---- Helpers ----
const nonEmptyString = (msg = "Required") =>
  z
    .string()
    .min(1, msg)
    .transform((s) => s.trim());
const optionalString = z
  .string()
  .optional()
  .transform((s) => (s === "" ? undefined : s));
const uuidLike = z.string().uuid().optional().or(z.string().min(1));
const MAX_URL_LENGTH = 2048;
const MAX_STRING_LENGTH = 10000;

const httpUrl = z
  .string()
  .min(1, "URL is required")
  .max(MAX_URL_LENGTH, `URL must be less than ${MAX_URL_LENGTH} characters`)
  .refine(
    (s) => {
      try {
        const u = new URL(s);
        return ["http:", "https:"].includes(u.protocol);
      } catch {
        return false;
      }
    },
    { message: "URL must use http or https" },
  );

// ---- Auth ----
const authRegister = z
  .object({
    email: z
      .string()
      .min(1, "Email is required")
      .transform((s) => s.trim().toLowerCase()),
    password: z.string().min(6, "Password must be at least 6 characters"),
  })
  .strict();

const authLogin = z
  .object({
    email: z
      .string()
      .min(1, "Email is required")
      .transform((s) => s.trim().toLowerCase()),
    password: z.string().min(1, "Password is required"),
  })
  .strict();

const authProfile = z
  .object({
    email: z
      .string()
      .email("Invalid email")
      .transform((s) => s.trim().toLowerCase()),
  })
  .strict();

const authPassword = z
  .object({
    currentPassword: z.string().min(1, "Current password is required"),
    newPassword: z
      .string()
      .min(6, "New password must be at least 6 characters"),
  })
  .strict();

// ---- Bookmarks ----
const bookmarkCreate = z
  .object({
    url: httpUrl,
    title: optionalString,
    description: optionalString,
    folder_id: uuidLike,
    tags: optionalString,
    color: optionalString,
    og_image: optionalString,
    tag_colors: z
      .union([
        z.array(z.object({ name: z.string(), color: z.string() })),
        z.record(z.string()),
      ])
      .optional(),
    tagColorOverrides: z.record(z.string()).optional(),
  })
  .strict();

const bookmarkUpdate = z
  .object({
    title: optionalString,
    url: optionalString,
    description: optionalString,
    folder_id: uuidLike,
    tags: optionalString,
    color: optionalString,
    og_image: optionalString,
    tag_colors: z
      .union([
        z.array(z.object({ name: z.string(), color: z.string() })),
        z.record(z.string()),
      ])
      .optional(),
    tagColorOverrides: z.record(z.string()).optional(),
    is_favorite: z.union([z.boolean(), z.literal(0), z.literal(1)]).optional(),
    is_archived: z.union([z.boolean(), z.literal(0), z.literal(1)]).optional(),
  })
  .strict();

const fetchMetadata = z.object({ url: httpUrl }).strict();

const bulkIds = z
  .object({
    ids: z.array(z.string().uuid()).min(1, "At least one ID required"),
  })
  .strict();

// ---- Folders ----
const folderCreate = z
  .object({
    name: nonEmptyString("Folder name is required"),
    parent_id: uuidLike,
    color: optionalString,
    icon: optionalString,
  })
  .strict();

const folderUpdate = z
  .object({
    name: optionalString,
    parent_id: uuidLike,
    color: optionalString,
    icon: optionalString,
    position: z.coerce.number().int().optional(),
  })
  .strict();

// ---- Tags ----
const tagCreate = z
  .object({
    name: nonEmptyString("Tag name is required"),
    color: optionalString,
    icon: optionalString,
  })
  .strict();

const tagUpdate = z
  .object({
    name: optionalString,
    color: optionalString,
    icon: optionalString,
    position: z.coerce.number().int().optional(),
  })
  .strict();

const tagsBulkAddRemove = z
  .object({
    bookmark_ids: z
      .array(z.string())
      .min(1, "At least one bookmark ID required"),
    tags: z.string().min(1, "Tags are required"),
  })
  .strict();

const tagsRename = z
  .object({
    from: z.string().min(1, "from is required"),
    to: z.string().min(1, "to is required"),
  })
  .strict();

// Validated bookmark for import/sync (ensures URLs are valid) — must be defined before syncPush/importJson
const importedBookmark = z
  .object({
    url: httpUrl,
    title: optionalString.pipe(
      z.string().max(500, "Title too long").optional(),
    ),
    description: optionalString.pipe(
      z.string().max(MAX_STRING_LENGTH, "Description too long").optional(),
    ),
    tags: optionalString.pipe(z.string().max(500, "Tags too long").optional()),
    color: optionalString.pipe(z.string().max(20, "Color too long").optional()),
    favicon: optionalString.pipe(
      z.string().max(500, "Favicon too long").optional(),
    ),
    og_image: optionalString.pipe(
      z.string().max(500, "OG image too long").optional(),
    ),
    is_favorite: z.boolean().optional(),
    is_archived: z.boolean().optional(),
    created_at: optionalString,
    updated_at: optionalString,
    folder_id: z.string().uuid().nullable().optional(),
    folder_name: optionalString.pipe(
      z.string().max(200, "Folder name too long").optional(),
    ),
  })
  .strict();

// ---- Sync ----
const syncPush = z
  .object({
    bookmarks: z.array(importedBookmark).optional().default([]),
    folders: z.array(z.any()).optional().default([]),
  })
  .strict();

// ---- Import / Export ----
const importHtml = z
  .object({ html: z.string().min(1, "HTML content is required") })
  .strict();

const importJson = z
  .object({
    bookmarks: z.array(importedBookmark).optional().default([]),
    folders: z.array(z.any()).optional().default([]),
  })
  .strict();

const exportQuery = z
  .object({
    format: z.enum(["json", "html"]).optional(),
  })
  .strict();

// ---- Settings (flexible key-value) ----
// z.record() has no .strict() in Zod 3 (only z.object() does). Use plain record for flexible key-value.
const settingsUpdate = z.record(z.string(), z.unknown());

// ---- Collections ----
const collectionCreate = z
  .object({
    name: nonEmptyString("Name is required"),
    icon: optionalString,
    color: optionalString,
    filters: z.union([z.record(z.any()), z.array(z.any())]),
  })
  .strict();

const collectionUpdate = z
  .object({
    name: optionalString,
    icon: optionalString,
    color: optionalString,
    filters: z.union([z.record(z.any()), z.array(z.any())]).optional(),
    position: z.coerce.number().int().optional(),
  })
  .strict();

// ---- Dashboard views ----
const dashboardViewCreate = z
  .object({
    name: nonEmptyString("Name is required"),
    config: z.record(z.any()).or(z.array(z.any())),
  })
  .strict();

const dashboardViewUpdate = z
  .object({
    name: optionalString,
    config: z.record(z.any()).or(z.array(z.any())).optional(),
    position: z.coerce.number().int().optional(),
  })
  .strict();

// ---- Bookmark views ----
const bookmarkViewCreate = z
  .object({
    name: nonEmptyString("Name is required"),
    config: z.record(z.any()).or(z.array(z.any())),
  })
  .strict();

const bookmarkViewUpdate = z
  .object({
    name: optionalString,
    config: z.record(z.any()).or(z.array(z.any())).optional(),
  })
  .strict();

// ---- Maintenance ----
const checkLink = z.object({ url: httpUrl }).strict();

// ---- Smart organization ----
const smartCollectionCreate = z
  .object({
    name: z
      .string({
        required_error: "Name is required",
        invalid_type_error: "Name is required",
      })
      .min(1, "Name is required")
      .transform((s) => (s && s.trim()) || undefined),
    type: z.string().min(1, "Type is required").default("tag_cluster"),
    icon: optionalString,
    color: optionalString,
    tags: z.array(z.any()).optional(),
    domain: optionalString,
    filters: z.record(z.any()).or(z.array(z.any())).optional(),
  })
  .strip()
  .refine(
    (data) =>
      data.type !== "tag_cluster" ||
      (data.tags && Array.isArray(data.tags) && data.tags.length > 0),
    {
      message: "Rules are required for tag cluster collections",
      path: ["tags"],
    },
  );

// ---- Query schemas (for GET) ----
const bookmarksListQuery = z
  .object({
    folder_id: optionalString,
    search: optionalString,
    favorites: z.coerce.boolean().optional(),
    tags: optionalString,
    tagMode: z
      .enum(["AND", "OR", "and", "or"])
      .optional()
      .transform((s) => (s ? s.toUpperCase() : undefined)),
    sort: optionalString,
    limit: z.coerce.number().int().min(1).max(500).optional(),
    offset: z.coerce.number().int().min(0).optional(),
    include_children: z.coerce.boolean().optional(),
    archived: z.coerce.boolean().optional(),
  })
  .strict();

const quickSearchQuery = z
  .object({
    q: z.string().optional(),
    limit: z.coerce.number().int().min(1).max(100).optional(),
  })
  .strict();

const smartOrgSuggestQuery = z
  .object({
    url: z.string().min(1, "URL parameter required"),
    limit: z.coerce.number().int().min(1).max(50).optional(),
    include_domain: z.enum(["true", "false"]).optional(),
    include_activity: z.enum(["true", "false"]).optional(),
    include_similar: z.enum(["true", "false"]).optional(),
    domain_weight: z.coerce.number().min(0).max(1).optional(),
    activity_weight: z.coerce.number().min(0).max(1).optional(),
    similarity_weight: z.coerce.number().min(0).max(1).optional(),
  })
  .strict();

const domainQuery = z
  .object({
    domain: z
      .string({
        required_error: "Domain parameter required",
        invalid_type_error: "Domain parameter required",
      })
      .min(1, "Domain parameter required"),
  })
  .strict();

// ---- Health ----
const healthDeadlinksQuery = z
  .object({
    check: z.enum(["true"]).optional(),
    limit: z.coerce.number().int().min(1).max(500).optional(),
  })
  .strict();

const healthPerformanceQuery = z
  .object({
    window: z.coerce
      .number()
      .int()
      .min(60000)
      .max(86400000 * 7)
      .optional(), // 1 min to 7 days (ms)
  })
  .strict();

// ---- Tags suggest (non-AI) ----
const tagsSuggestQuery = z
  .object({
    url: z.string().optional(),
  })
  .strict();

// ---- Tags suggest AI ----
const tagsSuggestAiQuery = z
  .object({
    url: z
      .string()
      .min(1, "URL parameter required")
      .refine(
        (s) => {
          try {
            const u = new URL(s);
            return ["http:", "https:"].includes(u.protocol);
          } catch {
            return false;
          }
        },
        { message: "Invalid URL" },
      ),
    limit: z.coerce.number().int().min(1).max(100).optional(),
  })
  .strict();

// ---- Smart collections suggest ----
const smartCollectionsSuggestQuery = z
  .object({
    type: z.enum(["tag_cluster", "activity", "domain"]).optional(),
    limit: z.coerce.number().int().min(1).max(50).optional(),
  })
  .strict();

module.exports = {
  authRegister,
  authLogin,
  authProfile,
  authPassword,
  bookmarkCreate,
  bookmarkUpdate,
  fetchMetadata,
  bulkIds,
  folderCreate,
  folderUpdate,
  tagCreate,
  tagUpdate,
  tagsBulkAddRemove,
  tagsRename,
  syncPush,
  importHtml,
  importJson,
  exportQuery,
  settingsUpdate,
  collectionCreate,
  collectionUpdate,
  dashboardViewCreate,
  dashboardViewUpdate,
  bookmarkViewCreate,
  bookmarkViewUpdate,
  checkLink,
  smartCollectionCreate,
  bookmarksListQuery,
  quickSearchQuery,
  smartOrgSuggestQuery,
  domainQuery,
  healthDeadlinksQuery,
  healthPerformanceQuery,
  tagsSuggestQuery,
  tagsSuggestAiQuery,
  smartCollectionsSuggestQuery,
};
