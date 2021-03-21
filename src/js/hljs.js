import { registerLanguage, highlightAll } from 'highlight.js/lib/core';
import css from 'highlight.js/lib/languages/css';
import javascript from 'highlight.js/lib/languages/javascript';
import json from 'highlight.js/lib/languages/json';
import markdown from 'highlight.js/lib/languages/markdown';
import scss from 'highlight.js/lib/languages/scss';
import typescript from 'highlight.js/lib/languages/typescript';
import xml from 'highlight.js/lib/languages/xml';
import yaml from 'highlight.js/lib/languages/yaml';

registerLanguage('css', css);
registerLanguage('javascript', javascript);
registerLanguage('json', json);
registerLanguage('markdown', markdown);
registerLanguage('scss', scss);
registerLanguage('typescript', typescript);
registerLanguage('xml', xml);
registerLanguage('yaml', yaml);
highlightAll();
