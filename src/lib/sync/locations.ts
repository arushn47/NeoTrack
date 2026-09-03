/**
 * Utilities for parsing, deduplicating, and consolidating work locations for campus placement drives.
 * 
 * DESIGN PRINCIPLE:
 * In address syntax, "Area, City" or "City, State" (e.g. "Whitefield, Bangalore", "Bangalore, Karnataka")
 * represents an address hierarchy for a SINGLE job location, NOT two distinct hiring locations.
 * Multiple distinct cities are separated by explicit conjunctions ("and", "&"), slashes ("/"),
 * pipes ("|"), semicolons (";"), or lists of 3+ comma-separated cities.
 */

/**
 * Normalizes and extracts distinct physical work locations from a raw string.
 * Consolidates address hierarchies ("Whitefield, Bangalore" -> ["Whitefield, Bangalore"])
 * while preserving distinct cities ("Bangalore, Mumbai and Gurgaon" -> ["Bangalore", "Mumbai", "Gurgaon"]).
 */
export function parseAssignedLocations(rawLocation: string | null | undefined): string[] {
  if (!rawLocation) return ['Pan India / Remote'];

  const trimmed = rawLocation.replace(/\s+/g, ' ').trim();
  if (
    !trimmed ||
    /^(?:pan\s+india\s*\/?\s*remote|remote|pan\s+india|to\s+be\s+announced|tbd|tba)$/i.test(trimmed)
  ) {
    return [trimmed || 'Pan India / Remote'];
  }

  // 1. Split across major multi-city delimiters: ";", "|", or "/" (when not hybrid/remote)
  const majorSegments = trimmed
    .split(/\s*(?:;|\|)\s*/i)
    .flatMap((seg) => {
      if (/\b(?:remote|hybrid|wfh)\b/i.test(seg)) return [seg];
      return seg.split(/\s*\/\s*/);
    })
    .map((s) => s.trim())
    .filter(Boolean);

  const results: string[] = [];

  for (const seg of majorSegments) {
    // Check if segment has list conjunction "and" / "&" (e.g. "Bangalore, Mumbai and Gurgaon")
    if (/\s+(?:and|&)\s+/i.test(seg)) {
      const andParts = seg.split(/\s+(?:and|&)\s+/i).map((p) => p.trim()).filter(Boolean);
      for (const ap of andParts) {
        if (ap.includes(',')) {
          const parts = ap.split(',').map((p) => p.trim()).filter(Boolean);
          // If sub-part has 2 tokens and andParts has another city, check if it's "Area, City"
          if (parts.length === 2 && andParts.length > 1) {
            results.push(ap);
          } else {
            results.push(...parts);
          }
        } else {
          results.push(ap);
        }
      }
    } else if (seg.includes(',')) {
      const parts = seg.split(',').map((p) => p.trim()).filter(Boolean);
      // Standard address format: "Area, City" or "City, State" (exactly 2 parts)
      // e.g. "Whitefield, Bangalore", "Bangalore, Karnataka", "Palo Alto, California" -> 1 location!
      if (parts.length === 2) {
        results.push(seg);
      } else {
        // 3+ parts: "Bangalore, Mumbai, Gurgaon" -> multiple distinct cities
        results.push(...parts);
      }
    } else {
      results.push(seg);
    }
  }

  // Clean up any stray quotes, asterisks, or parenthesis
  const cleaned = results
    .map((loc) => loc.replace(/^[*,\.\s>\-]+/, '').replace(/[*,\.\s>\-]+$/, '').trim())
    .filter((loc) => loc.length > 0 && !/^\d+$/.test(loc));

  return cleaned.length > 0 ? cleaned : ['Pan India / Remote'];
}
