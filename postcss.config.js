module.exports = {
  plugins: [
    require('postcss-import')({
      addModulesDirectories: ['node_modules'],
    }),
    require('tailwindcss/nesting'),
    require('tailwindcss'),
    require('autoprefixer'),
    ...(process.env.NODE_ENV === 'production'
      ? [
          require('cssnano')({
            preset: 'default',
          }),
        ]
      : []),
  ],
};
