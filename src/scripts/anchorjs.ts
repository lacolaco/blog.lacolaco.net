import AnchorJS from 'anchor-js';

const anchors = new AnchorJS();

window.addEventListener('DOMContentLoaded', () => {
  anchors.add('.markdown-body > h1, .markdown-body > h2, .markdown-body > h3, .markdown-body > h4');
});
