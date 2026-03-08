/**
 * Copyright (c) OpenLoaf. All rights reserved.
 *
 * This source code is licensed under the AGPLv3 license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * Project: OpenLoaf
 * Repository: https://github.com/OpenLoaf/OpenLoaf
 */
import { DOMParser, XMLSerializer } from '@xmldom/xmldom'
import xpath from 'xpath'
import { detectNamespaces } from './namespaces'
import type { OfficeEdit } from './types'

const parser = new DOMParser()
const serializer = new XMLSerializer()

/** Apply a list of XML edits (replace/insert/remove) to an XML string. */
export function applyXmlEdits(
  xmlStr: string,
  edits: OfficeEdit[],
  entryPath: string,
): string {
  const nsMap = detectNamespaces(entryPath)
  const doc = parser.parseFromString(xmlStr, 'text/xml')
  const select = xpath.useNamespaces(nsMap)

  for (const edit of edits) {
    if (edit.op === 'write' || edit.op === 'delete') continue

    const nodes = select(edit.xpath, doc)
    if (!Array.isArray(nodes) || nodes.length === 0) {
      throw new Error(
        `XPath "${edit.xpath}" matched no nodes in "${entryPath}".`,
      )
    }

    const target = nodes[0] as Node

    switch (edit.op) {
      case 'replace': {
        const newDoc = parser.parseFromString(wrapForParse(edit.xml, nsMap), 'text/xml')
        const newNode = newDoc.documentElement.firstChild
          ? doc.importNode(newDoc.documentElement.firstChild, true)
          : doc.importNode(newDoc.documentElement, true)
        if (target.parentNode) {
          target.parentNode.replaceChild(newNode, target)
        }
        break
      }

      case 'insert': {
        const newDoc = parser.parseFromString(wrapForParse(edit.xml, nsMap), 'text/xml')
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

  return serializer.serializeToString(doc)
}

/** Single-edit convenience functions. */
export function xpathReplace(
  xmlStr: string,
  xpathExpr: string,
  newXml: string,
  nsMap: Record<string, string>,
): string {
  const doc = parser.parseFromString(xmlStr, 'text/xml')
  const select = xpath.useNamespaces(nsMap)
  const nodes = select(xpathExpr, doc) as Node[]
  if (nodes.length === 0) throw new Error(`XPath "${xpathExpr}" matched no nodes.`)
  const target = nodes[0]!
  const newDoc = parser.parseFromString(wrapForParse(newXml, nsMap), 'text/xml')
  const newNode = newDoc.documentElement.firstChild
    ? doc.importNode(newDoc.documentElement.firstChild, true)
    : doc.importNode(newDoc.documentElement, true)
  target.parentNode?.replaceChild(newNode, target)
  return serializer.serializeToString(doc)
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
