/**
 * Copyright (c) OpenLoaf. All rights reserved.
 *
 * This source code is licensed under the AGPLv3 license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * Project: OpenLoaf
 * Repository: https://github.com/OpenLoaf/OpenLoaf
 */
import type { AutoformatRule } from '@platejs/autoformat'

import {
  BoldPlugin,
  ItalicPlugin,
  StrikethroughPlugin,
  UnderlinePlugin,
} from '@platejs/basic-nodes/react'
import { AutoformatPlugin } from '@platejs/autoformat'
import { IndentPlugin } from '@platejs/indent/react'
import { ListPlugin } from '@platejs/list/react'
import { toggleList } from '@platejs/list'
import { ExitBreakPlugin, KEYS } from 'platejs'

import { BlockList } from '@openloaf/ui/block-list'

/** Autoformat rules — marks subset for inline formatting. */
const boardAutoformatMarks: AutoformatRule[] = [
  { match: '**', mode: 'mark', type: KEYS.bold },
  { match: '*', mode: 'mark', type: KEYS.italic },
  { match: '_', mode: 'mark', type: KEYS.italic },
  { match: '__', mode: 'mark', type: KEYS.underline },
  { match: '~~', mode: 'mark', type: KEYS.strikethrough },
]

/** Autoformat rules — list shortcuts for block formatting. */
const boardAutoformatLists: AutoformatRule[] = [
  {
    match: ['* ', '- '],
    mode: 'block',
    type: 'list',
    format: (editor) => {
      toggleList(editor, { listStyleType: KEYS.ul })
    },
  },
  {
    match: [String.raw`^\d+\.$ `, String.raw`^\d+\)$ `],
    matchByRegex: true,
    mode: 'block',
    type: 'list',
    format: (editor, { matchString }) => {
      toggleList(editor, {
        listRestartPolite: Number(matchString) || 1,
        listStyleType: KEYS.ol,
      })
    },
  },
  {
    match: ['[] '],
    mode: 'block',
    type: 'list',
    format: (editor) => {
      toggleList(editor, { listStyleType: KEYS.listTodo })
      editor.tf.setNodes({ checked: false, listStyleType: KEYS.listTodo })
    },
  },
  {
    match: ['[x] '],
    mode: 'block',
    type: 'list',
    format: (editor) => {
      toggleList(editor, { listStyleType: KEYS.listTodo })
      editor.tf.setNodes({ checked: true, listStyleType: KEYS.listTodo })
    },
  },
]

/**
 * Lightweight Plate plugin kit for Board TextNode.
 *
 * Includes: Bold, Italic, Underline, Strikethrough, List (ul/ol/todo),
 * Indent, Autoformat (markdown shortcuts), ExitBreak.
 */
export const BoardTextEditorKit = [
  // Inline marks
  BoldPlugin,
  ItalicPlugin,
  UnderlinePlugin,
  StrikethroughPlugin.configure({
    shortcuts: { toggle: { keys: 'mod+shift+x' } },
  }),

  // Indent (required by ListPlugin)
  IndentPlugin.configure({
    inject: { targetPlugins: [KEYS.p] },
    options: { offset: 24 },
  }),

  // List
  ListPlugin.configure({
    inject: { targetPlugins: [KEYS.p] },
    render: { belowNodes: BlockList },
  }),

  // Autoformat — markdown shortcuts
  AutoformatPlugin.configure({
    options: {
      enableUndoOnDelete: true,
      rules: [...boardAutoformatMarks, ...boardAutoformatLists],
    },
  }),

  // Exit break — Mod+Enter inserts a new block below
  ExitBreakPlugin.configure({
    shortcuts: {
      insert: { keys: 'mod+enter' },
    },
  }),
]
