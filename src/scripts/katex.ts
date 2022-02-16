import renderMathInElement from 'katex/contrib/auto-render';

document.addEventListener('DOMContentLoaded', function () {
  renderMathInElement(document.body, {
    delimiters: [
      { left: '$$', right: '$$', display: true }, // block
      { left: '$', right: '$', display: false }, // inline
    ],
  });
});
