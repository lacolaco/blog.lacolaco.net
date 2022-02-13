module.exports = {
  plugins: [
    require('postcss-import')({
      addModulesDirectories: ['node_modules'],
    }),
    require('tailwindcss/nesting'),
    require('tailwindcss'),
    require('autoprefixer'),
    require('cssnano')({
      preset: 'default',
    }),
  ],
};
