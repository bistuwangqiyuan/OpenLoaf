/**
 * Copyright (c) OpenLoaf. All rights reserved.
 *
 * This source code is licensed under the AGPLv3 license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * Project: OpenLoaf
 * Repository: https://github.com/OpenLoaf/OpenLoaf
 */
"use client";

import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { ReadFileErrorFallback } from "@/components/file/lib/read-file-error";

type ViewerGuardProps = {
  /** File URI. Falsy renders the empty state. */
  uri?: string;
  name?: string;
  projectId?: string;
  rootUri?: string;

  /** Viewer loading flag. */
  loading?: boolean;
  /** Viewer error flag. */
  error?: boolean;
  /** Error detail passed to ReadFileErrorFallback. */
  errorDetail?: unknown;
  /** Custom error heading. */
  errorMessage?: string;
  /** Custom error description. */
  errorDescription?: string;
  /** File too large to preview. */
  tooLarge?: boolean;
  /** URI scheme not supported for local preview. */
  notSupported?: boolean;
  /** Show system-open / download action buttons in the fallback. */
  forceAction?: boolean;

  /** Label shown when uri is empty (default: common.file.noFile). */
  emptyLabel?: string;
  children: ReactNode;
};

/** Standardized guard for all file viewers.
 *
 * Renders the appropriate fallback for empty / not-supported / loading / error
 * states, and only renders `children` when none of those conditions apply.
 */
export function ViewerGuard({
  uri,
  name,
  projectId,
  rootUri,
  loading,
  error,
  errorDetail,
  errorMessage,
  errorDescription,
  tooLarge,
  notSupported,
  forceAction,
  emptyLabel,
  children,
}: ViewerGuardProps) {
  const { t } = useTranslation("common");

  if (!uri) {
    return (
      <div className="flex h-full w-full items-center justify-center p-6 text-sm text-muted-foreground">
        {emptyLabel ?? t("file.noFile")}
      </div>
    );
  }

  if (notSupported) {
    return (
      <ReadFileErrorFallback
        uri={uri}
        name={name}
        projectId={projectId}
        rootUri={rootUri}
        forceAction={forceAction}
        message={errorMessage ?? t("file.notSupported")}
        description={errorDescription ?? t("file.notSupportedDesc")}
      />
    );
  }

  if (tooLarge) {
    return (
      <ReadFileErrorFallback
        uri={uri}
        name={name}
        projectId={projectId}
        rootUri={rootUri}
        tooLarge
      />
    );
  }

  if (error) {
    return (
      <ReadFileErrorFallback
        uri={uri}
        name={name}
        projectId={projectId}
        rootUri={rootUri}
        error={errorDetail}
        message={errorMessage}
        description={errorDescription}
      />
    );
  }

  if (loading) {
    return (
      <div className="flex h-full w-full items-center justify-center text-sm text-muted-foreground">
        {t("loading")}
      </div>
    );
  }

  return <>{children}</>;
}
