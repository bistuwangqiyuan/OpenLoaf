export default {
  extends: ['@commitlint/config-conventional'],
  rules: {
    'scope-enum': [1, 'always', [
      'server', 'web', 'desktop', 'db', 'api', 'ui', 'config',
      'i18n', 'ai', 'email', 'calendar', 'board', 'tasks',
      'auth', 'editor', 'terminal', 'deps', 'ci', 'release',
    ]],
    'scope-empty': [1, 'never'],
    'subject-max-length': [2, 'always', 100],
  },
}
