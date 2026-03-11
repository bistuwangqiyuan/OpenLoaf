/** All known system-generated default workspace names across supported languages. */
const KNOWN_DEFAULT_WORKSPACE_NAMES = new Set([
  'default',
  '默认工作空间',
  '默认项目空间',
  '預設工作區',
  '預設專案空間',
  'Default Workspace',
  'Default Project Space',
  'デフォルト ワークスペース',
  '기본 작업 공간',
  'Espace de travail par défaut',
  'Standardarbeitsbereich',
  'Espacio de trabajo predeterminado',
])

/** Resolve display name for a workspace, translating system defaults to current language. */
export function resolveWorkspaceDisplayName(name: string, t: (key: string) => string): string {
  if (KNOWN_DEFAULT_WORKSPACE_NAMES.has(name)) {
    return t('defaultWorkspaceName')
  }
  return name
}
