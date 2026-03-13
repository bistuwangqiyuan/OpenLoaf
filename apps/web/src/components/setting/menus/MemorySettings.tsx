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

import { memo, useCallback, useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { Brain, FileText } from 'lucide-react'
import { OpenLoafSettingsGroup } from '@openloaf/ui/openloaf/OpenLoafSettingsGroup'
import { OpenLoafSettingsCard } from '@openloaf/ui/openloaf/OpenLoafSettingsCard'
import { trpc } from '@/utils/trpc'
import { openFilePreview } from '@/components/file/lib/open-file'
import type { FileSystemEntry } from '@/components/project/filesystem/utils/file-system-utils'
import { cn } from '@/lib/utils'

/** MEMORY.md index file name. */
const MEMORY_INDEX = 'MEMORY.md'

type MemoryFileEntry = {
  uri: string
  name: string
  kind: 'file' | 'folder'
}

type MemoryEditorProps = {
  scope: 'user' | 'project'
  projectId?: string
}

/** Memory settings panel — file list + inline preview. */
const MemoryEditor = memo(function MemoryEditor({ scope, projectId }: MemoryEditorProps) {
  const { t } = useTranslation(['settings'])

  const dirUriQuery = useQuery({
    ...trpc.settings.getMemoryDirUri.queryOptions({ scope, projectId }),
  })
  const { dirUri, indexUri } = dirUriQuery.data ?? {}

  // List files in memory directory.
  const listQuery = useQuery({
    ...trpc.fs.list.queryOptions({
      projectId: scope === 'project' ? projectId : undefined,
      uri: dirUri ?? '',
      includeHidden: false,
      sort: { field: 'name', order: 'asc' },
    }),
    enabled: Boolean(dirUri),
  })

  // Build file list: always include MEMORY.md at the top, even if it doesn't exist.
  const files = useMemo<MemoryFileEntry[]>(() => {
    const entries = listQuery.data?.entries ?? []
    const fileEntries: MemoryFileEntry[] = entries
      .filter((e) => e.kind === 'file')
      .map((e) => ({ uri: e.uri, name: e.name, kind: 'file' as const }))

    const hasIndex = fileEntries.some((f) => f.name === MEMORY_INDEX)
    if (!hasIndex && indexUri) {
      fileEntries.unshift({ uri: indexUri, name: MEMORY_INDEX, kind: 'file' })
    }

    // Sort: MEMORY.md first, then alphabetical.
    fileEntries.sort((a, b) => {
      if (a.name === MEMORY_INDEX) return -1
      if (b.name === MEMORY_INDEX) return 1
      return a.name.localeCompare(b.name)
    })
    return fileEntries
  }, [listQuery.data?.entries, indexUri])

  const [selectedUri, setSelectedUri] = useState<string | null>(null)

  // Auto-select MEMORY.md on first load.
  const effectiveSelectedUri = selectedUri ?? indexUri ?? files[0]?.uri ?? null
  const selectedFile = files.find((f) => f.uri === effectiveSelectedUri) ?? null

  const handleSelect = useCallback((file: MemoryFileEntry) => {
    setSelectedUri(file.uri)
  }, [])

  // Render file preview content using the project's unified preview system.
  const previewContent = useMemo(() => {
    if (!selectedFile) return null
    const entry: FileSystemEntry = {
      uri: selectedFile.uri,
      name: selectedFile.name,
      kind: selectedFile.kind,
    }
    const content = openFilePreview({
      entry,
      projectId: scope === 'project' ? projectId : undefined,
      rootUri: dirUri,
      readOnly: false,
      mode: 'embed',
    })
    if (!content || typeof content === 'boolean') return null
    return content
  }, [selectedFile, scope, projectId, dirUri])

  return (
    <OpenLoafSettingsGroup
      title={t('settings:memory.title')}
      subtitle={scope === 'project' ? t('settings:memory.subtitleProject') : t('settings:memory.subtitle')}
      icon={<Brain className="h-4 w-4 text-ol-green" />}
      showBorder={false}
    >
      <div className="space-y-3">
        {/* File list */}
        <OpenLoafSettingsCard padding="none">
          <div className="max-h-[200px] overflow-auto">
            {dirUriQuery.isLoading || listQuery.isLoading ? (
              <div className="px-3 py-4 text-xs text-muted-foreground">
                {t('settings:memory.loading')}
              </div>
            ) : files.length === 0 ? (
              <div className="px-3 py-4 text-xs text-muted-foreground">
                {t('settings:memory.empty')}
              </div>
            ) : (
              <ul className="divide-y divide-border/40">
                {files.map((file) => (
                  <li key={file.uri}>
                    <button
                      type="button"
                      className={cn(
                        'flex w-full items-center gap-2 px-3 py-2 text-left text-xs transition-colors duration-150',
                        effectiveSelectedUri === file.uri
                          ? 'bg-ol-green-bg text-ol-green'
                          : 'text-foreground hover:bg-muted/50',
                      )}
                      onClick={() => handleSelect(file)}
                    >
                      <FileText className="h-3.5 w-3.5 shrink-0 opacity-50" />
                      <span className="truncate font-mono">{file.name}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </OpenLoafSettingsCard>

        {/* File preview / editor */}
        <OpenLoafSettingsCard padding="none">
          <div className="h-[400px] overflow-hidden">
            {previewContent ?? (
              <div className="flex h-full items-center justify-center text-xs text-muted-foreground">
                {t('settings:memory.empty')}
              </div>
            )}
          </div>
        </OpenLoafSettingsCard>
      </div>
    </OpenLoafSettingsGroup>
  )
})

/** Global memory settings page (scope=user). */
export function MemorySettings() {
  return <MemoryEditor scope="user" />
}

/** Project memory settings page (scope=project). */
export function ProjectMemorySettings({ projectId }: { projectId?: string; rootUri?: string }) {
  return <MemoryEditor scope="project" projectId={projectId} />
}
