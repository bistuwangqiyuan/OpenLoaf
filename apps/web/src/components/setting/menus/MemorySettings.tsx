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

import { memo, useCallback } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { Brain, FolderOpen } from 'lucide-react'
import { Button } from '@openloaf/ui/button'
import { OpenLoafSettingsGroup } from '@openloaf/ui/openloaf/OpenLoafSettingsGroup'
import { trpc } from '@/utils/trpc'
import { useLayoutState } from '@/hooks/use-layout-state'
import { useGlobalOverlay } from '@/lib/globalShortcuts'

type MemoryEditorProps = {
  scope: 'user' | 'project'
  projectId?: string
}

/** Memory settings panel — opens memory directory in folder-tree-preview. */
const MemoryEditor = memo(function MemoryEditor({ scope, projectId }: MemoryEditorProps) {
  const { t } = useTranslation(['settings'])
  const pushStackItem = useLayoutState((s) => s.pushStackItem)
  const setSettingsOpen = useGlobalOverlay((s) => s.setSettingsOpen)

  const dirUriQuery = useQuery({
    ...trpc.settings.getMemoryDirUri.queryOptions({ scope, projectId }),
  })

  const handleOpenMemoryFolder = useCallback(() => {
    const { dirUri, indexUri } = dirUriQuery.data ?? {}
    if (!dirUri) return

    pushStackItem({
      id: `memory:${scope}:${projectId || 'global'}`,
      sourceKey: `memory:${scope}:${projectId || 'global'}`,
      component: 'folder-tree-preview',
      title: scope === 'user'
        ? t('settings:memory.title')
        : t('settings:memory.titleProject'),
      params: {
        rootUri: dirUri,
        currentUri: indexUri || dirUri,
        currentEntryKind: 'file',
        projectId: scope === 'project' ? projectId : undefined,
        projectTitle: t('settings:memory.title'),
      },
    })
    setSettingsOpen(false)
  }, [dirUriQuery.data, scope, projectId, pushStackItem, setSettingsOpen, t])

  return (
    <OpenLoafSettingsGroup
      title={t('settings:memory.title')}
      subtitle={scope === 'project' ? t('settings:memory.subtitleProject') : t('settings:memory.subtitle')}
      icon={<Brain className="h-4 w-4 text-ol-green" />}
      showBorder={false}
    >
      <div className="space-y-3">
        <p className="text-xs text-muted-foreground leading-relaxed">
          {t('settings:memory.folderDescription')}
        </p>
        <Button
          size="sm"
          className="h-8 rounded-md px-4 text-xs bg-ol-green-bg text-ol-green hover:bg-ol-green-bg-hover hover:text-ol-green"
          onClick={handleOpenMemoryFolder}
          disabled={!dirUriQuery.data?.dirUri}
        >
          <FolderOpen className="mr-1.5 h-3.5 w-3.5" />
          {t('settings:memory.openFolder')}
        </Button>
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
