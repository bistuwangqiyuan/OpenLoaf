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

import { useCallback, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@openloaf/ui/alert-dialog'
import { Checkbox } from '@openloaf/ui/checkbox'
import { Label } from '@openloaf/ui/label'

/**
 * Electron 关闭确认对话框（Web 端渲染）。
 *
 * 行为规则：
 * - minimizeToTray 为 false（默认）时弹出此对话框
 * - 复选框"后台运行，下次不再提醒"默认不勾选
 * - 用户勾选并确认 → minimizeToTray 设为 true，以后关闭直接最小化
 * - 用户不勾选并确认 → 退出应用
 */
export default function CloseConfirmDialog() {
  const { t } = useTranslation('common')
  const [open, setOpen] = useState(false)
  const [dontAskAgain, setDontAskAgain] = useState(false)

  useEffect(() => {
    const handler = () => {
      setDontAskAgain(false)
      setOpen(true)
    }
    window.addEventListener('openloaf:confirm-close', handler)
    return () => window.removeEventListener('openloaf:confirm-close', handler)
  }, [])

  const respond = useCallback(
    (action: 'cancel' | 'minimize' | 'quit') => {
      setOpen(false)
      window.openloafElectron?.respondCloseConfirm?.({
        action,
        // 勾选"下次不再提醒"时持久化偏好。
        minimizeToTray: dontAskAgain,
      })
    },
    [dontAskAgain],
  )

  const handleCancel = useCallback(() => respond('cancel'), [respond])
  const handleOk = useCallback(
    () => respond(dontAskAgain ? 'minimize' : 'quit'),
    [respond, dontAskAgain],
  )

  return (
    <AlertDialog open={open} onOpenChange={(v) => { if (!v) handleCancel() }}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{t('closeConfirm.title')}</AlertDialogTitle>
          <AlertDialogDescription>
            {t('closeConfirm.description')}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <div className="flex items-center gap-2 py-2">
          <Checkbox
            id="dont-ask-again"
            checked={dontAskAgain}
            onCheckedChange={(v) => setDontAskAgain(v === true)}
          />
          <Label htmlFor="dont-ask-again" className="text-sm cursor-pointer">
            {t('closeConfirm.checkboxLabel')}
          </Label>
        </div>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={handleCancel}>
            {t('cancel')}
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={handleOk}
            className="bg-sky-500/10 text-sky-600 hover:bg-sky-500/20 dark:text-sky-400 shadow-none"
          >
            {t('closeConfirm.ok')}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
