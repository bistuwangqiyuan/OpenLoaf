/**
 * Copyright (c) OpenLoaf. All rights reserved.
 *
 * This source code is licensed under the AGPLv3 license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * Project: OpenLoaf
 * Repository: https://github.com/OpenLoaf/OpenLoaf
 */
"use client"

import * as React from "react"
import { useTranslation } from "react-i18next"
import { useQuery } from "@tanstack/react-query"
import {
  ChevronsUpDown,
  Lightbulb,
  LogIn,
  LogOut,
  RefreshCcw,
} from "lucide-react"
import { toast } from "sonner"

import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@openloaf/ui/sidebar"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@openloaf/ui/dropdown-menu"
import { Avatar, AvatarFallback, AvatarImage } from "@openloaf/ui/avatar"
import { Button } from "@openloaf/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@openloaf/ui/dialog"
import { useSaasAuth } from "@/hooks/use-saas-auth"
import { fetchUserProfile } from "@/lib/saas-auth"
import { SaasLoginDialog } from "@/components/auth/SaasLoginDialog"
import { isElectronEnv } from "@/utils/is-electron-env"
import { useGlobalOverlay } from "@/lib/globalShortcuts"

/** 会员等级胶囊徽章样式 — 低透明彩色背景 + 对应文字色，light/dark 双套。 */
const MEMBERSHIP_BADGE_STYLES: Record<string, string> = {
  free: "bg-secondary text-secondary-foreground",
  vip: "bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-400",
  svip: "bg-violet-100 text-violet-700 dark:bg-violet-500/15 dark:text-violet-400",
  infinity: "bg-sky-100 text-sky-700 dark:bg-sky-500/15 dark:text-sky-400",
}

export function SidebarUserAccount() {
  const { t } = useTranslation('workspace', { keyPrefix: 'workspace' })
  const { t: tNav } = useTranslation('nav')

  const [loginOpen, setLoginOpen] = React.useState(false)
  const [dropdownOpen, setDropdownOpen] = React.useState(false)
  const setFeedbackOpen = useGlobalOverlay((s) => s.setFeedbackOpen)

  const {
    loggedIn: authLoggedIn,
    user: authUser,
    refreshSession,
    logout,
  } = useSaasAuth()

  const userProfileQuery = useQuery({
    queryKey: ["saas", "userProfile"],
    queryFn: fetchUserProfile,
    enabled: authLoggedIn,
    staleTime: 60_000,
  })

  React.useEffect(() => {
    void refreshSession()
  }, [refreshSession])

  React.useEffect(() => {
    if (authLoggedIn) {
      setLoginOpen(false)
    }
  }, [authLoggedIn])

  const MEMBERSHIP_LABELS: Record<string, string> = {
    free: t('membership.free'),
    vip: t('membership.vip'),
    svip: t('membership.svip'),
    infinity: t('membership.infinity'),
  }

  const isWechatLogin = Boolean(authUser?.email?.endsWith("@wechat.local"))
  const baseAccountLabel =
    authUser?.email ?? authUser?.name ?? (authLoggedIn ? t('loggedIn') : undefined)
  const sidebarAccountLabel = isWechatLogin
    ? authUser?.name?.trim() || t('wechatUser')
    : baseAccountLabel
  const dropdownAccountLabel = isWechatLogin ? t('wechatLogin') : baseAccountLabel
  const avatarAlt = sidebarAccountLabel ?? "User"
  const displayAvatar = authUser?.avatarUrl

  const handleOpenLogin = () => setLoginOpen(true)

  const handleLogout = () => {
    logout()
    toast.success(t('loggedOut'))
  }

  // ─── Electron incremental update ─────────────────────────────
  const isElectron = isElectronEnv()
  const isDevDesktop = isElectron && process.env.NODE_ENV !== "production"

  const [updateStatus, setUpdateStatus] = React.useState<OpenLoafIncrementalUpdateStatus | null>(null)
  const [restartDialogOpen, setRestartDialogOpen] = React.useState(false)
  const updateTriggeredRef = React.useRef(false)

  const UPDATE_TOAST_ID = 'sidebar-update-check'

  React.useEffect(() => {
    if (!isElectron) return
    const onUpdateStatus = (event: Event) => {
      const detail = (event as CustomEvent<OpenLoafIncrementalUpdateStatus>).detail
      if (detail) setUpdateStatus(detail)
    }
    window.addEventListener("openloaf:incremental-update:status", onUpdateStatus)
    void window.openloafElectron?.getIncrementalUpdateStatus?.().then((s) => {
      if (s) setUpdateStatus(s)
    })
    return () => window.removeEventListener("openloaf:incremental-update:status", onUpdateStatus)
  }, [isElectron])

  React.useEffect(() => {
    if (!updateStatus) return
    switch (updateStatus.state) {
      case 'checking':
        break
      case 'downloading': {
        const pct = updateStatus.progress?.percent
        const msg = pct != null
          ? `${t('downloadingUpdate')} ${Math.round(pct)}%`
          : t('downloadingUpdate')
        toast.loading(msg, { id: UPDATE_TOAST_ID })
        break
      }
      case 'ready':
        toast.dismiss(UPDATE_TOAST_ID)
        setRestartDialogOpen(true)
        break
      case 'error':
        toast.error(updateStatus.error ?? t('checkUpdateError'), { id: UPDATE_TOAST_ID })
        updateTriggeredRef.current = false
        break
      case 'idle':
        if (updateTriggeredRef.current && updateStatus.lastCheckedAt) {
          toast.success(t('isLatest'), { id: UPDATE_TOAST_ID })
          updateTriggeredRef.current = false
        }
        break
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [updateStatus])

  const handleCheckUpdate = React.useCallback(async () => {
    if (isDevDesktop) {
      toast.message(t('devModeNoUpdate'))
      return
    }
    const api = window.openloafElectron
    if (!api?.checkIncrementalUpdate) {
      toast.message(t('envNoUpdate'))
      return
    }
    updateTriggeredRef.current = true
    toast.loading(t('checkingUpdate'), { id: UPDATE_TOAST_ID })
    await api.checkIncrementalUpdate()
  }, [isDevDesktop, t])

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <SaasLoginDialog open={loginOpen} onOpenChange={setLoginOpen} />

        <DropdownMenu open={dropdownOpen} onOpenChange={setDropdownOpen}>
          <DropdownMenuTrigger asChild>
            <SidebarMenuButton
              size="default"
              className="h-12 rounded-lg border-none px-1.5 py-3 [&:not([data-highlight])]:hover:bg-sidebar-accent [&:not([data-highlight])]:hover:text-sidebar-accent-foreground data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
            >
              <Avatar className="size-8 rounded-md">
                <AvatarImage src={displayAvatar || undefined} alt={avatarAlt} />
                <AvatarFallback className="bg-transparent">
                  <img
                    src="/head_s.png"
                    alt="OpenLoaf"
                    className="size-full object-contain"
                  />
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0 text-left">
                <div className="truncate text-sm font-medium leading-5">
                  {authUser?.name || "OpenLoaf"}
                </div>
                <div className="truncate text-[11px] text-muted-foreground leading-4">
                  {sidebarAccountLabel ?? (authLoggedIn ? t('loggedIn') : t('notLoggedIn'))}
                </div>
              </div>
              <ChevronsUpDown className="text-muted-foreground size-4 group-data-[collapsible=icon]:hidden" />
            </SidebarMenuButton>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            align="start"
            side="bottom"
            sideOffset={8}
            className="w-72 rounded-xl p-2"
          >
            {authLoggedIn && (
              <>
                <div className="flex items-center gap-3 px-2 py-2">
                  <Avatar className="size-9">
                    <AvatarImage src={displayAvatar || undefined} alt={avatarAlt} />
                    <AvatarFallback>
                      <img
                        src="/logo.svg"
                        alt="OpenLoaf"
                        className="size-full object-cover"
                      />
                    </AvatarFallback>
                  </Avatar>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5 leading-5">
                      <span className="min-w-0 truncate text-sm font-medium">
                        {authUser?.name || t('currentAccount')}
                      </span>
                      {userProfileQuery.data && (
                        <span
                          className={`inline-flex shrink-0 items-center rounded-full px-1.5 py-px text-[10px] font-medium leading-4 transition-colors duration-150 ${MEMBERSHIP_BADGE_STYLES[userProfileQuery.data.membershipLevel] ?? "bg-secondary text-secondary-foreground"}`}
                        >
                          {MEMBERSHIP_LABELS[userProfileQuery.data.membershipLevel] ?? userProfileQuery.data.membershipLevel}
                        </span>
                      )}
                      {userProfileQuery.data && (
                        <span className="ml-auto shrink-0 whitespace-nowrap text-[11px] leading-4 text-muted-foreground">
                          {Math.floor(userProfileQuery.data.creditsBalance).toLocaleString()} {t('credits')}
                        </span>
                      )}
                    </div>
                    <div className="truncate text-xs text-muted-foreground leading-4">{dropdownAccountLabel}</div>
                  </div>
                </div>

                <DropdownMenuSeparator className="my-2" />
              </>
            )}

            <div className="space-y-1">
              {!authLoggedIn && (
                <DropdownMenuItem
                  onSelect={() => handleOpenLogin()}
                  className="rounded-lg bg-sky-500/8 text-sky-600 dark:bg-sky-500/10 dark:text-sky-400 focus:bg-sky-500/15 focus:text-sky-600 dark:focus:bg-sky-500/15 dark:focus:text-sky-400"
                >
                  <LogIn className="size-4 text-sky-600 dark:text-sky-400" />
                  {t('loginAccount')}
                </DropdownMenuItem>
              )}
              <DropdownMenuItem
                onSelect={() => setFeedbackOpen(true)}
                className="rounded-lg"
              >
                <Lightbulb className="size-4" />
                {tNav('sidebar.feedback.title')}
              </DropdownMenuItem>
              {isElectron && (
                <DropdownMenuItem
                  onSelect={() => void handleCheckUpdate()}
                  disabled={
                    isDevDesktop ||
                    updateStatus?.state === "checking" ||
                    updateStatus?.state === "downloading" ||
                    updateStatus?.state === "ready"
                  }
                  className="rounded-lg text-amber-600 dark:text-amber-400 focus:bg-amber-500/10 focus:text-amber-600 dark:focus:bg-amber-500/10 dark:focus:text-amber-400"
                >
                  <RefreshCcw className="size-4 text-amber-600 dark:text-amber-400" />
                  <span className="flex-1">
                    {updateStatus?.state === "ready"
                      ? t('updateReady')
                      : updateStatus?.state === "checking" || updateStatus?.state === "downloading"
                        ? t('updating')
                        : t('checkUpdate')}
                  </span>
                  {updateStatus?.state === "ready" && (
                    <span className="ml-1 size-2 rounded-full bg-blue-500" />
                  )}
                </DropdownMenuItem>
              )}
              {authLoggedIn && (
                <DropdownMenuItem
                  variant="destructive"
                  onSelect={() => void handleLogout()}
                  className="rounded-lg"
                >
                  <LogOut className="size-4" />
                  {t('logout')}
                </DropdownMenuItem>
              )}
            </div>
          </DropdownMenuContent>
        </DropdownMenu>

        <Dialog open={restartDialogOpen} onOpenChange={setRestartDialogOpen}>
          <DialogContent className="sm:max-w-sm shadow-none border-border/60">
            <DialogHeader>
              <DialogTitle>{t('updateReady')}</DialogTitle>
              <DialogDescription>{t('restartToApply')}</DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setRestartDialogOpen(false)}
              >
                {t('cancelButton')}
              </Button>
              <Button
                type="button"
                className="bg-sky-500/10 text-sky-600 hover:bg-sky-500/20 dark:text-sky-400 dark:hover:bg-sky-500/20 shadow-none"
                onClick={async () => {
                  setRestartDialogOpen(false)
                  await window.openloafElectron?.relaunchApp?.()
                }}
              >
                {t('relaunchNow')}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </SidebarMenuItem>
    </SidebarMenu>
  )
}
