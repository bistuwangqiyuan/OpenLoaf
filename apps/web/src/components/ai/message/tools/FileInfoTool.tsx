/**
 * Copyright (c) OpenLoaf. All rights reserved.
 *
 * This source code is licensed under the AGPLv3 license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * Project: OpenLoaf
 * Repository: https://github.com/OpenLoaf/OpenLoaf
 */
'use client'

import * as React from 'react'
import {
  FileIcon,
  ImageIcon,
  VideoIcon,
  MusicIcon,
  FileTextIcon,
  TableIcon,
  FileSpreadsheetIcon,
} from 'lucide-react'
import type { AnyToolPart } from './shared/tool-utils'
import OfficeToolShell from './shared/OfficeToolShell'
import { getToolKind, EmptyView, FilePathLink } from './shared/office-tool-utils'
import { cn } from '@/lib/utils'
import type { TFunction } from 'i18next'

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60)
  const s = Math.round(seconds % 60)
  return m > 0 ? `${m}m ${s}s` : `${s}s`
}

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleString()
  } catch {
    return iso
  }
}

const FILE_TYPE_ICONS: Record<string, React.ElementType> = {
  image: ImageIcon,
  video: VideoIcon,
  audio: MusicIcon,
  pdf: FileTextIcon,
  spreadsheet: FileSpreadsheetIcon,
  document: TableIcon,
}

type Row = { label: string; value: string; mono?: boolean }

function InfoRows({ rows }: { rows: Row[] }) {
  return (
    <div className="space-y-0.5">
      {rows.map((row, i) => (
        <div key={i} className="flex items-baseline gap-2 text-xs">
          <span className="shrink-0 text-muted-foreground">{row.label}</span>
          <span className={cn('truncate text-foreground', row.mono !== false && 'font-mono')}>
            {row.value}
          </span>
        </div>
      ))}
    </div>
  )
}

function BaseInfoView({ base, fileType, t }: { base: Record<string, unknown>; fileType: string; t: TFunction }) {
  const Icon = FILE_TYPE_ICONS[fileType] ?? FileIcon
  const rows: Row[] = []

  if (typeof base.fileName === 'string') {
    rows.push({ label: t('tool.fileInfo.fileName', { defaultValue: '文件名' }), value: base.fileName })
  }
  if (typeof base.mimeType === 'string') {
    rows.push({ label: t('tool.fileInfo.mimeType', { defaultValue: '类型' }), value: base.mimeType })
  }
  if (typeof base.fileSize === 'number') {
    rows.push({ label: t('tool.fileInfo.fileSize', { defaultValue: '大小' }), value: formatFileSize(base.fileSize) })
  }
  if (typeof base.modifiedAt === 'string') {
    rows.push({ label: t('tool.fileInfo.modified', { defaultValue: '修改时间' }), value: formatDate(base.modifiedAt), mono: false })
  }
  if (typeof base.createdAt === 'string') {
    rows.push({ label: t('tool.fileInfo.created', { defaultValue: '创建时间' }), value: formatDate(base.createdAt), mono: false })
  }

  return (
    <div className="space-y-1.5">
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <Icon className="size-3.5" />
        <span className="font-medium">{fileType}</span>
      </div>
      <InfoRows rows={rows} />
    </div>
  )
}

function ImageDetailsView({ details, t }: { details: Record<string, unknown>; t: TFunction }) {
  const rows: Row[] = []
  if (typeof details.width === 'number' && typeof details.height === 'number') {
    rows.push({ label: t('tool.fileInfo.dimensions', { defaultValue: '尺寸' }), value: `${details.width} × ${details.height}` })
  }
  if (typeof details.format === 'string') {
    rows.push({ label: t('tool.fileInfo.format', { defaultValue: '格式' }), value: details.format })
  }
  if (typeof details.colorSpace === 'string') {
    rows.push({ label: t('tool.fileInfo.colorSpace', { defaultValue: '色彩空间' }), value: details.colorSpace })
  }
  if (typeof details.channels === 'number') {
    rows.push({ label: t('tool.fileInfo.channels', { defaultValue: '通道' }), value: String(details.channels) })
  }
  if (typeof details.depth === 'string') {
    rows.push({ label: t('tool.fileInfo.depth', { defaultValue: '位深' }), value: details.depth })
  }
  if (typeof details.hasAlpha === 'boolean') {
    rows.push({ label: t('tool.fileInfo.alpha', { defaultValue: '透明通道' }), value: details.hasAlpha ? 'Yes' : 'No' })
  }
  if (typeof details.density === 'number') {
    rows.push({ label: 'DPI', value: String(details.density) })
  }
  if (typeof details.isAnimated === 'boolean' && details.isAnimated) {
    rows.push({ label: t('tool.fileInfo.animated', { defaultValue: '动画' }), value: 'Yes' })
  }
  return rows.length > 0 ? <InfoRows rows={rows} /> : null
}

function VideoDetailsView({ details, t }: { details: Record<string, unknown>; t: TFunction }) {
  const rows: Row[] = []
  if (typeof details.duration === 'number') {
    rows.push({ label: t('tool.fileInfo.duration', { defaultValue: '时长' }), value: formatDuration(details.duration) })
  }
  if (typeof details.resolution === 'string') {
    rows.push({ label: t('tool.fileInfo.resolution', { defaultValue: '分辨率' }), value: details.resolution })
  }
  const codecs = details.codecs as Record<string, unknown> | undefined
  if (codecs) {
    const parts: string[] = []
    if (typeof codecs.video === 'string') parts.push(codecs.video)
    if (typeof codecs.audio === 'string') parts.push(codecs.audio)
    if (parts.length > 0) {
      rows.push({ label: t('tool.fileInfo.codecs', { defaultValue: '编解码' }), value: parts.join(' / ') })
    }
  }
  if (typeof details.bitRate === 'number') {
    rows.push({ label: t('tool.fileInfo.bitRate', { defaultValue: '比特率' }), value: `${(details.bitRate / 1000).toFixed(0)} kbps` })
  }
  return rows.length > 0 ? <InfoRows rows={rows} /> : null
}

function PdfDetailsView({ details, t }: { details: Record<string, unknown>; t: TFunction }) {
  const rows: Row[] = []
  if (typeof details.pageCount === 'number') {
    rows.push({ label: t('tool.fileInfo.pages', { defaultValue: '页数' }), value: String(details.pageCount) })
  }
  if (typeof details.hasForm === 'boolean') {
    rows.push({ label: t('tool.fileInfo.hasForm', { defaultValue: '表单' }), value: details.hasForm ? 'Yes' : 'No' })
  }
  if (typeof details.formFieldCount === 'number' && details.formFieldCount > 0) {
    rows.push({ label: t('tool.fileInfo.formFields', { defaultValue: '表单字段' }), value: String(details.formFieldCount) })
  }
  const meta = details.metadata as Record<string, unknown> | undefined
  if (meta) {
    if (typeof meta.title === 'string' && meta.title) {
      rows.push({ label: t('tool.fileInfo.title', { defaultValue: '标题' }), value: meta.title, mono: false })
    }
    if (typeof meta.author === 'string' && meta.author) {
      rows.push({ label: t('tool.fileInfo.author', { defaultValue: '作者' }), value: meta.author, mono: false })
    }
  }
  return rows.length > 0 ? <InfoRows rows={rows} /> : null
}

type SheetInfo = { name: string; rowCount: number; colCount: number; range?: string }

function SpreadsheetDetailsView({ details, t }: { details: Record<string, unknown>; t: TFunction }) {
  const sheets = Array.isArray(details.sheets) ? (details.sheets as SheetInfo[]) : []
  if (sheets.length === 0) return null

  return (
    <div>
      <div className="mb-1 text-xs text-muted-foreground">
        {t('tool.fileInfo.sheets', { defaultValue: '工作表' })}
        <span className="ml-1 font-mono">({sheets.length})</span>
      </div>
      <div className="max-h-[160px] overflow-auto rounded border border-border/40">
        <table className="w-full text-[11px]">
          <thead>
            <tr className="border-b bg-muted/30 text-muted-foreground">
              <th className="px-2 py-1 text-left font-medium">{t('tool.fileInfo.sheetName', { defaultValue: '名称' })}</th>
              <th className="px-2 py-1 text-left font-medium">{t('tool.fileInfo.sheetRows', { defaultValue: '行' })}</th>
              <th className="px-2 py-1 text-left font-medium">{t('tool.fileInfo.sheetCols', { defaultValue: '列' })}</th>
              <th className="px-2 py-1 text-left font-medium">{t('tool.fileInfo.sheetRange', { defaultValue: '范围' })}</th>
            </tr>
          </thead>
          <tbody>
            {sheets.map((s, i) => (
              <tr key={i} className="border-b border-border/20 last:border-0">
                <td className="px-2 py-0.5 font-medium">{s.name}</td>
                <td className="px-2 py-0.5 font-mono">{s.rowCount}</td>
                <td className="px-2 py-0.5 font-mono">{s.colCount}</td>
                <td className="px-2 py-0.5 font-mono text-muted-foreground">{s.range ?? '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function DetailsSection({ fileType, details, t }: { fileType: string; details: Record<string, unknown>; t: TFunction }) {
  switch (fileType) {
    case 'image':
      return <ImageDetailsView details={details} t={t} />
    case 'video':
    case 'audio':
      return <VideoDetailsView details={details} t={t} />
    case 'pdf':
      return <PdfDetailsView details={details} t={t} />
    case 'spreadsheet':
      return <SpreadsheetDetailsView details={details} t={t} />
    default:
      return null
  }
}

function FileInfoResultView({ data, t }: { data: Record<string, unknown>; t: TFunction }) {
  const fileType = typeof data.fileType === 'string' ? data.fileType : 'other'
  const base = (typeof data.base === 'object' && data.base != null ? data.base : {}) as Record<string, unknown>
  const details = (typeof data.details === 'object' && data.details != null ? data.details : {}) as Record<string, unknown>
  const filePath = typeof base.filePath === 'string' ? base.filePath : ''

  return (
    <div className="space-y-2">
      {filePath && (
        <div className="flex items-baseline gap-2 text-xs">
          <span className="shrink-0 text-muted-foreground">{t('tool.office.file', { defaultValue: '文件' })}</span>
          <FilePathLink filePath={filePath} />
        </div>
      )}
      <BaseInfoView base={base} fileType={fileType} t={t} />
      <DetailsSection fileType={fileType} details={details} t={t} />
    </div>
  )
}

export default function FileInfoTool({
  part,
  className,
}: {
  part: AnyToolPart
  className?: string
}) {
  const toolKind = getToolKind(part)

  return (
    <OfficeToolShell
      part={part}
      className={cn('max-w-lg', className)}
      toolKind={toolKind}
      isMutate={false}
      i18nPrefix="tool.office"
      defaultOpen
    >
      {(ctx) => {
        const { data, isDone, t } = ctx

        if (data && isDone) {
          return <FileInfoResultView data={data} t={t} />
        }

        return <EmptyView />
      }}
    </OfficeToolShell>
  )
}
