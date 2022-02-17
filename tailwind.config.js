/**
 * @type { import('tailwindcss/plugin').TailwindPluginCreator }
 */
const plugin = require('tailwindcss/plugin');

/**
 * @type { import('tailwindcss/tailwind-config').TailwindConfig }
 */
module.exports = {
  content: ['layouts/**/*.html', 'content/**/*.{md,html}'],
  theme: {
    extend: {
      colors: {
        primary: 'var(--color-fg-primary)',
        default: 'var(--color-fg-default)',
        'accent-muted': 'var(--color-accent-muted)',
        'accent-subtle': 'var(--color-accent-subtle)',
      },
      textColor: {
        header: 'var(--color-header-text)',
        'header-logo': 'var(--color-header-logo)',
      },
      backgroundColor: {
        primary: 'var(--color-bg-primary)',
        header: 'var(--color-header-bg)',
      },
      borderColor: {},
    },
  },
  plugins: [
    plugin(({ addComponents, theme }) => {
      addComponents({
        '.flash': {
          padding: `${theme('padding.5')} ${theme('padding.4')}`,
          borderStyle: 'solid',
          borderWidth: theme('borderWidth.DEFAULT'),
          borderRadius: theme('borderRadius.DEFAULT'),
          color: theme('colors.default'),
          backgroundColor: theme('colors.accent-subtle'),
          borderColor: theme('borderColor.accent-muted'),
        },
      });
    }),
  ],
  corePlugins: {
    preflight: false,
  },
};
