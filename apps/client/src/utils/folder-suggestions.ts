import type { Folder } from "../types/index";

function tokenize(name: string): string[] {
  return name
    .toLowerCase()
    .replace(/[^a-z\s]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 1);
}

function overlapScore(a: string[], b: string[]): number {
  return a.reduce((acc, wa) => {
    const hit = b.some(
      (wb) => wb === wa || wb.startsWith(wa) || wa.startsWith(wb),
    );
    return acc + (hit ? 1 : 0);
  }, 0);
}

// Collect all ancestor ids of a folder (to avoid suggesting them as parents,
// which would create cycles).
function getAncestorIds(folderId: string, allFolders: Folder[]): Set<string> {
  const ids = new Set<string>([folderId]);
  const byId = new Map(allFolders.map((f) => [f.id, f]));
  let cur = byId.get(folderId);
  while (cur?.parent_id) {
    ids.add(cur.parent_id);
    cur = byId.get(cur.parent_id);
  }
  return ids;
}

// Collect all descendant ids (to avoid suggesting children as parents).
function getDescendantIds(folderId: string, allFolders: Folder[]): Set<string> {
  const ids = new Set<string>([folderId]);
  const queue = [folderId];
  while (queue.length > 0) {
    const cur = queue.shift()!;
    for (const f of allFolders) {
      if (f.parent_id === cur) {
        ids.add(f.id);
        queue.push(f.id);
      }
    }
  }
  return ids;
}

/**
 * Suggest parent folders for a given folder based on name similarity and sibling
 * naming patterns. Returns up to 3 candidates sorted by score.
 *
 * Any folder can be a parent (no depth limit), except the folder itself and
 * its own descendants (which would create a cycle).
 */
export function suggestParent(folder: Folder, allFolders: Folder[]): Folder[] {
  const invalidIds = getDescendantIds(folder.id, allFolders);

  const candidates = allFolders.filter((f) => !invalidIds.has(f.id));

  if (candidates.length === 0) return [];

  const folderWords = tokenize(folder.name);

  const scored = candidates.map((candidate) => {
    let score = 0;

    const candidateWords = tokenize(candidate.name);
    score += overlapScore(folderWords, candidateWords) * 4;

    const prefix = folder.name.slice(0, 3).toLowerCase();
    if (candidate.name.toLowerCase().startsWith(prefix)) score += 2;

    // Sibling similarity: boost candidates whose existing children share words
    const siblings = allFolders.filter(
      (f) => f.parent_id === candidate.id && f.id !== folder.id,
    );
    for (const sibling of siblings) {
      score += overlapScore(folderWords, tokenize(sibling.name)) * 2;
    }

    if (folder.color && folder.color === candidate.color) score += 1;

    return { candidate, score };
  });

  return scored
    .filter((s) => s.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 3)
    .map((s) => s.candidate);
}
