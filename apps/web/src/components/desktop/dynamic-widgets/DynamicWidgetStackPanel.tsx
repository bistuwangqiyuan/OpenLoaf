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
import { useTranslation } from 'react-i18next'
import DynamicWidgetRenderer from './DynamicWidgetRenderer'

interface DynamicWidgetStackPanelProps {
  widgetId?: string
  projectId?: string
}

export default function DynamicWidgetStackPanel({
  widgetId,
  projectId,
}: DynamicWidgetStackPanelProps) {
  const { t } = useTranslation('desktop')
  if (!widgetId) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
        {t('dynamicWidget.missingParams')}
      </div>
    )
  }

  return (
    <div className="h-full w-full overflow-auto">
      <DynamicWidgetRenderer
        widgetId={widgetId}
        projectId={projectId}
      />
    </div>
  )
}
