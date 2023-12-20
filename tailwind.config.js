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
    fontFamily: {
      base: `var(--font-base)`,
      title: `var(--font-title)`,
      mono: `var(--font-mono)`,
    },
    extend: {
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
        'code-inline': 'var(--color-text-code-inline)',
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
          md: '6rem',
          lg: '8rem',
          xl: '16rem',
          '2xl': '24rem',
        },
      },
      boxShadow: {
        tag: 'var(--box-shadow-tag)',
        "tag-focus": 'var(--box-shadow-tag-focus)',
      }
    },
  },
  plugins: [
    plugin(({ addComponents, addBase, theme }) => {
      addBase({
        a: {
          color: theme('textColor.accent'),
          '&:hover': {
            textDecoration: 'underline',
          },
        },
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
          fontFamily: theme('fontFamily.body'),
          blockquote: {
            color: theme('textColor.muted'),
          },
          pre: {
            backgroundColor: theme('backgroundColor.subtle'),
            wordWrap: 'normal',
            fontSize: '85%',
            tabSize: '2',
            padding: `${theme('padding.8')} ${theme('padding.4')} ${theme('padding.8')} ${theme('padding.8')}`,
            borderRadius: theme('borderRadius.lg'),
          },
          p: {
            lineHeight: '1.9',
            '&+p': {
              marginTop: '1.5em',
              overflowWrap: 'break-word',
            }
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
