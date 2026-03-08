/**
 * Copyright (c) OpenLoaf. All rights reserved.
 *
 * This source code is licensed under the AGPLv3 license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * Project: OpenLoaf
 * Repository: https://github.com/OpenLoaf/OpenLoaf
 */
import { detectNamespaces } from './namespaces'
import type { OfficeEdit } from './types'

// ---------------------------------------------------------------------------
// Fast-path: string-based XML editing for common XPath patterns.
//
// AI-generated Office edits overwhelmingly use simple XPath patterns like:
//   //w:body/w:p[last()]    //x:sheetData/x:row[3]    //p:sld/p:cSld/p:spTree
//
// Parsing a 500KB+ XML into a full DOM tree with @xmldom/xmldom + xpath
// can take 30+ seconds (pure-JS). For these simple patterns we locate the
// target via regex/indexOf and splice the string directly — ~1000x faster.
//
// Complex XPath (predicates with functions, axes like ancestor/following,
// unions, etc.) falls back to the DOM-based path automatically.
// ---------------------------------------------------------------------------

type XmlEdit = Exclude<OfficeEdit, { op: 'write' } | { op: 'delete' }>

/** Apply a list of XML edits (replace/insert/remove) to an XML string. */
export async function applyXmlEdits(
  xmlStr: string,
  edits: OfficeEdit[],
  entryPath: string,
): Promise<string> {
  const xmlEdits = edits.filter(
    (e): e is XmlEdit => e.op !== 'write' && e.op !== 'delete',
  )
  if (xmlEdits.length === 0) return xmlStr

  // Try fast-path first
  const fast = tryFastPath(xmlStr, xmlEdits, entryPath)
  if (fast !== null) return fast

  // Fallback: full DOM parsing via @xmldom/xmldom + xpath
  return applyXmlEditsDom(xmlStr, xmlEdits, entryPath)
}

/** Single-edit convenience functions. */
export async function xpathReplace(
  xmlStr: string,
  xpathExpr: string,
  newXml: string,
  nsMap: Record<string, string>,
): Promise<string> {
  return applyXmlEditsDom(
    xmlStr,
    [{ op: 'replace' as const, path: '', xpath: xpathExpr, xml: newXml }],
    '',
    nsMap,
  )
}

// ---------------------------------------------------------------------------
// Fast-path implementation
// ---------------------------------------------------------------------------

/**
 * Parse a simple XPath like `//w:body/w:p[last()]` or `//w:body/w:p[3]`
 * into a series of steps. Returns null if the XPath is too complex.
 */
interface XPathStep {
  /** Tag name including namespace prefix, e.g. "w:body" */
  tag: string
  /** Predicate: 'last' | number | undefined */
  predicate?: 'last' | number
}

function parseSimpleXPath(xpath: string): XPathStep[] | null {
  // Normalize: strip leading // or /
  let expr = xpath.trim()
  if (expr.startsWith('//')) expr = expr.slice(2)
  else if (expr.startsWith('/')) expr = expr.slice(1)

  const steps: XPathStep[] = []
  // Split on / but not inside brackets
  const parts = expr.split('/')

  for (const part of parts) {
    if (!part) return null // empty segment

    // Match: tag[predicate] or just tag
    const m = part.match(/^([\w:.-]+)(?:\[(.+?)\])?$/)
    if (!m) return null // complex expression

    const tag = m[1]!
    const pred = m[2]

    if (!pred) {
      steps.push({ tag })
    } else if (pred === 'last()') {
      steps.push({ tag, predicate: 'last' })
    } else if (/^\d+$/.test(pred)) {
      steps.push({ tag, predicate: parseInt(pred, 10) })
    } else {
      // Complex predicate (contains(), @attr, etc.) — bail out
      return null
    }
  }

  return steps.length > 0 ? steps : null
}

/**
 * Find the position and bounds of a target element in raw XML using steps.
 * Returns { start, end } where start is the position of `<tag` and
 * end is the position right after the closing `</tag>` or `/>`.
 */
function locateElement(
  xml: string,
  steps: XPathStep[],
): { start: number; end: number } | null {
  let searchStart = 0
  let searchEnd = xml.length

  // Walk down the steps, narrowing the search region
  for (let si = 0; si < steps.length; si++) {
    const step = steps[si]!
    const isLast = si === steps.length - 1
    const result = findTagInRange(xml, step.tag, step.predicate, searchStart, searchEnd)
    if (!result) return null

    if (isLast) {
      return result
    }
    // Narrow search to within this element's content
    searchStart = result.contentStart
    searchEnd = result.end
  }

  return null
}

interface TagMatch {
  start: number       // position of `<tag`
  end: number         // position after closing tag or `/>`
  contentStart: number // position after the opening tag's `>`
}

/**
 * Find the Nth occurrence (or last) of a tag within [rangeStart, rangeEnd).
 */
function findTagInRange(
  xml: string,
  tag: string,
  predicate: 'last' | number | undefined,
  rangeStart: number,
  rangeEnd: number,
): TagMatch | null {
  const matches: TagMatch[] = []
  // Build regex for opening tag: <tag followed by whitespace, >, or /
  // Escape dots in tag names (e.g., "w14.something")
  const escapedTag = tag.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const openRe = new RegExp(`<${escapedTag}(?=[\\s/>])`, 'g')
  openRe.lastIndex = rangeStart

  let m: RegExpExecArray | null
  while ((m = openRe.exec(xml)) !== null) {
    if (m.index >= rangeEnd) break

    const startPos = m.index
    const tagEnd = findTagEnd(xml, startPos, tag, rangeEnd)
    if (tagEnd === null) continue

    matches.push({
      start: startPos,
      end: tagEnd.end,
      contentStart: tagEnd.contentStart,
    })

    // If we only need the first and no predicate, shortcut
    if (predicate === undefined && matches.length === 1) {
      return matches[0]!
    }

    openRe.lastIndex = tagEnd.end
  }

  if (matches.length === 0) return null

  if (predicate === undefined || predicate === 1) {
    return matches[0]!
  }
  if (predicate === 'last') {
    return matches[matches.length - 1]!
  }
  // 1-based index
  if (predicate > 0 && predicate <= matches.length) {
    return matches[predicate - 1]!
  }

  return null
}

/**
 * Given a position at `<tag`, find where the element ends.
 * Handles both self-closing `<tag/>` and paired `<tag>...</tag>`.
 */
function findTagEnd(
  xml: string,
  startPos: number,
  tag: string,
  limit: number,
): { end: number; contentStart: number } | null {
  // Find the end of the opening tag
  let i = startPos + 1
  let depth = 0

  // Skip past the tag name
  while (i < limit && xml[i] !== '>' && xml[i] !== '/') {
    if (xml[i] === '"') {
      // Skip attribute value
      i++
      while (i < limit && xml[i] !== '"') i++
    } else if (xml[i] === "'") {
      i++
      while (i < limit && xml[i] !== "'") i++
    }
    i++
  }

  if (i >= limit) return null

  // Self-closing tag: <tag ... />
  if (xml[i] === '/' && i + 1 < limit && xml[i + 1] === '>') {
    return { end: i + 2, contentStart: i + 2 }
  }

  // Opening tag ends with >
  if (xml[i] !== '>') return null
  const contentStart = i + 1

  // Find matching closing tag, handling nested same-name tags
  const escapedTag = tag.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const tagPattern = new RegExp(`<(/?)${escapedTag}(?=[\\s/>])`, 'g')
  tagPattern.lastIndex = contentStart
  depth = 1

  let match: RegExpExecArray | null
  while ((match = tagPattern.exec(xml)) !== null) {
    if (match.index >= limit) return null
    if (match[1] === '/') {
      depth--
      if (depth === 0) {
        // Find the > of the closing tag
        const closeEnd = xml.indexOf('>', match.index)
        if (closeEnd === -1) return null
        return { end: closeEnd + 1, contentStart }
      }
    } else {
      // Check if self-closing
      const afterTag = xml.indexOf('>', match.index)
      if (afterTag !== -1 && xml[afterTag - 1] === '/') {
        // Self-closing, doesn't affect depth
      } else {
        depth++
      }
    }
  }

  return null
}

/**
 * Try to apply all edits using string manipulation.
 * Returns null if any edit can't be handled by the fast path.
 */
function tryFastPath(
  xmlStr: string,
  edits: XmlEdit[],
  _entryPath: string,
): string | null {
  // Parse all XPaths first — bail if any is complex
  const parsed: { edit: XmlEdit; steps: XPathStep[] }[] = []
  for (const edit of edits) {
    const steps = parseSimpleXPath(edit.xpath)
    if (!steps) return null
    parsed.push({ edit, steps })
  }

  // Apply edits in reverse order of target position to avoid offset invalidation
  // First, locate all targets
  const located: { edit: XmlEdit; start: number; end: number }[] = []
  for (const { edit, steps } of parsed) {
    const loc = locateElement(xmlStr, steps)
    if (!loc) return null // element not found — fall back to DOM for better error
    located.push({ edit, start: loc.start, end: loc.end })
  }

  // Sort by position descending so splicing doesn't shift later positions
  located.sort((a, b) => b.start - a.start)

  let result = xmlStr
  for (const { edit, start, end } of located) {
    switch (edit.op) {
      case 'replace':
        result = result.slice(0, start) + edit.xml + result.slice(end)
        break
      case 'insert':
        if (edit.position === 'before') {
          result = result.slice(0, start) + edit.xml + result.slice(start)
        } else {
          result = result.slice(0, end) + edit.xml + result.slice(end)
        }
        break
      case 'remove':
        result = result.slice(0, start) + result.slice(end)
        break
    }
  }

  return result
}

// ---------------------------------------------------------------------------
// DOM-based fallback (original implementation)
// ---------------------------------------------------------------------------

async function applyXmlEditsDom(
  xmlStr: string,
  edits: XmlEdit[],
  entryPath: string,
  nsMapOverride?: Record<string, string>,
): Promise<string> {
  // Lazy-load heavy deps only when needed
  const { DOMParser, XMLSerializer } = await import('@xmldom/xmldom')
  const xpath = (await import('xpath')).default

  const nsMap = nsMapOverride ?? detectNamespaces(entryPath)
  const doc = new DOMParser().parseFromString(xmlStr, 'text/xml')
  const select = xpath.useNamespaces(nsMap)

  for (const edit of edits) {
    const nodes = select(edit.xpath, doc)
    if (!Array.isArray(nodes) || nodes.length === 0) {
      throw new Error(
        `XPath "${edit.xpath}" matched no nodes in "${entryPath}".`,
      )
    }

    const target = nodes[0] as any

    switch (edit.op) {
      case 'replace': {
        const newDoc = new DOMParser().parseFromString(wrapForParse(edit.xml, nsMap), 'text/xml')
        const newNode = newDoc.documentElement.firstChild
          ? doc.importNode(newDoc.documentElement.firstChild, true)
          : doc.importNode(newDoc.documentElement, true)
        if (target.parentNode) {
          target.parentNode.replaceChild(newNode, target)
        }
        break
      }

      case 'insert': {
        const newDoc = new DOMParser().parseFromString(wrapForParse(edit.xml, nsMap), 'text/xml')
        const newNode = newDoc.documentElement.firstChild
          ? doc.importNode(newDoc.documentElement.firstChild, true)
          : doc.importNode(newDoc.documentElement, true)
        if (target.parentNode) {
          if (edit.position === 'before') {
            target.parentNode.insertBefore(newNode, target)
          } else {
            const nextSibling = target.nextSibling
            if (nextSibling) {
              target.parentNode.insertBefore(newNode, nextSibling)
            } else {
              target.parentNode.appendChild(newNode)
            }
          }
        }
        break
      }

      case 'remove': {
        if (target.parentNode) {
          target.parentNode.removeChild(target)
        }
        break
      }
    }
  }

  return new XMLSerializer().serializeToString(doc)
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/** Wrap an XML fragment with namespace declarations for parsing. */
function wrapForParse(xml: string, nsMap: Record<string, string>): string {
  const nsAttrs = Object.entries(nsMap)
    .map(([prefix, uri]) => `xmlns:${prefix}="${uri}"`)
    .join(' ')
  return `<_wrap ${nsAttrs}>${xml}</_wrap>`
}
