/**
 * @type { import('tailwindcss/plugin').TailwindPluginCreator }
 */
const plugin = require('tailwindcss/plugin');

/**
 * @type { import('tailwindcss/tailwind-config').TailwindConfig }
 */
module.exports = {
  content: ['./src/**/*.{astro,html,js,jsx,md,mdx,svelte,ts,tsx,vue}'],
  theme: {
    extend: {
      fontFamily: {
        sans: `"Zen Kaku Gothic New",-apple-system,BlinkMacSystemFont,"Segoe UI",Helvetica,Arial,sans-serif`,
        mono: `"Source Code Pro",monospace`,
      },
      fontWeight: {
        normal: '400',
      },
      colors: {},
      textColor: {
        default: 'var(--color-text-default)',
        muted: 'var(--color-text-muted)',
        accent: 'var(--color-text-accent)',
        header: 'var(--color-header-text)',
        'header-muted': 'var(--color-header-text-muted)',
      },
      backgroundColor: {
        default: 'var(--color-bg-default)',
        muted: 'var(--color-bg-muted)',
        subtle: 'var(--color-bg-subtle)',
        header: 'var(--color-header-bg)',
      },
      borderColor: {
        default: 'var(--color-border-default)',
      },
      container: {
        center: true,
        padding: {
          DEFAULT: '2rem',
          sm: '4rem',
          lg: '8rem',
          xl: '12rem',
          '2xl': '16rem',
        },
      },
    },
  },
  plugins: [
    plugin(({ addComponents, addBase, theme }) => {
      addBase({
        a: { color: theme('textColor.accent') },
      });
      addComponents({
        '.flash': {
          padding: `${theme('padding.4')} ${theme('padding.4')}`,
          borderStyle: 'solid',
          borderWidth: theme('borderWidth.DEFAULT'),
          borderRadius: theme('borderRadius.DEFAULT'),
          color: theme('colors.default'),
          backgroundColor: theme('backgroundColor.transparent'),
          borderColor: theme('borderColor.default'),
        },
      });
      addComponents({
        '.label': {
          display: 'inline-block',
          padding: `0 ${theme('padding.2')}`,
          fontSize: '12px',
          lineHeight: '1.5',
          fontWeight: '500',
          border: '1px solid transparent',
          borderRadius: theme('borderRadius.xl'),
          borderColor: theme('borderColor.default'),
          '&:hover': {
            textDecoration: 'none',
          },
        },
      });
      addComponents({
        '.markdown-body': {
          fontFamily: theme('fontFamily.sans'),
          blockquote: {
            color: theme('textColor.muted'),
          },
          pre: {
            backgroundColor: theme('backgroundColor.subtle'),
            wordWrap: 'normal',
            fontSize: '0.85rem',
            padding: theme('padding.4'),
          },
          p: {
            lineHeight: '1.8',
          },
          'figcaption p': {
            textAlign: 'center',
          },
          'ul, ol': {
            paddingLeft: '2em',
          },
          ul: {
            listStyle: 'disc',
            ul: {
              listStyle: 'circle',
              ul: {
                listStyle: 'square',
              },
            },
          },
          ol: {
            listStyle: 'decimal',
          },
        },
      });
    }),
  ],
  corePlugins: {
    preflight: true,
  },
};
