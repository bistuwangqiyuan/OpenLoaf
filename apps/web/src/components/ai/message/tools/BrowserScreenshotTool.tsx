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
import type { AnyToolPart } from './shared/tool-utils'
import OfficeToolShell from './shared/OfficeToolShell'
import { getToolKind, EmptyView } from './shared/office-tool-utils'
import { cn } from '@/lib/utils'
import { fetchBlobFromUri } from '@/lib/image/uri'
import type { TFunction } from 'i18next'

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function ScreenshotPreview({ url }: { url: string }) {
  const [objectUrl, setObjectUrl] = React.useState<string | null>(null)

  React.useEffect(() => {
    let revoked = false
    fetchBlobFromUri(url)
      .then((blob) => {
        if (revoked) return
        setObjectUrl(URL.createObjectURL(blob))
      })
      .catch(() => {})
    return () => {
      revoked = true
      setObjectUrl((prev) => {
        if (prev) URL.revokeObjectURL(prev)
        return null
      })
    }
  }, [url])

  if (!objectUrl) return null
  return (
    <div className="flex justify-center">
      <img
        src={objectUrl}
        alt="screenshot"
        className="max-h-[240px] max-w-full rounded border border-border/40 object-contain"
        draggable={false}
      />
    </div>
  )
}

function ScreenshotResultView({ data, t }: { data: Record<string, unknown>; t: TFunction }) {
  const url = typeof data.url === 'string' ? data.url : ''
  const format = typeof data.format === 'string' ? data.format : ''
  const bytes = typeof data.bytes === 'number' ? data.bytes : 0

  return (
    <div className="space-y-2">
      {url && <ScreenshotPreview url={url} />}
      <div className="space-y-0.5">
        {format && (
          <div className="flex items-baseline gap-2 text-xs">
            <span className="shrink-0 text-muted-foreground">{t('tool.browser.format', { defaultValue: '格式' })}</span>
            <span className="font-mono text-foreground">{format.toUpperCase()}</span>
          </div>
        )}
        {bytes > 0 && (
          <div className="flex items-baseline gap-2 text-xs">
            <span className="shrink-0 text-muted-foreground">{t('tool.browser.fileSize', { defaultValue: '大小' })}</span>
            <span className="font-mono text-foreground">{formatFileSize(bytes)}</span>
          </div>
        )}
      </div>
    </div>
  )
}

export default function BrowserScreenshotTool({
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
          return <ScreenshotResultView data={data} t={t} />
        }

        return <EmptyView />
      }}
    </OfficeToolShell>
  )
}
