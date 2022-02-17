module.exports = {
  content: ['layouts/**/*.html', 'content/**/*.{md,html}'],
  theme: {
    extend: {
      colors: {
        primary: 'var(--color-fg-primary)',
      },
      textColor: {
        header: 'var(--color-header-text)',
        'header-logo': 'var(--color-header-logo)',
      },
      backgroundColor: {
        primary: 'var(--color-bg-primary)',
        header: 'var(--color-header-bg)',
      },
    },
  },
  plugins: [],
  corePlugins: {
    preflight: false,
  },
};
