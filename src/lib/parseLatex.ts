/**
 * Parses a LaTeX document (as produced by buildLatexDocument) back into HTML
 * suitable for our WYSIWYG editor. This is a pragmatic parser that supports:
 * - Document wrapper (\documentclass..\begin{document} ... \end{document})
 * - Inline math: \( ... \) mapped to <math-field data-latex="..."/>
 * - Basic formatting: \textbf, \textit, \underline
 * - Text color via \textcolor{#RRGGBB}{...}
 * - Background highlight via \hl{...} (assumes \sethlcolor already defined)
 * - Paragraphs separated by blank lines -> <p> ... </p>
 * - Simple tables produced by buildLatex.ts (tabular with | c | columns)
 *
 * NOTE: This is not a general LaTeX parser; it aims to invert buildLatex.ts output.
 */

const stripDocumentWrapper = (latex: string): string => {
  // Remove preamble and \begin{document} ... \end{document}
  const beginIdx = latex.indexOf('\n\\begin{document}');
  const endIdx = latex.lastIndexOf('\\end{document}');
  if (beginIdx !== -1 && endIdx !== -1) {
    return latex.slice(beginIdx + '\n\\begin{document}'.length, endIdx).trim();
  }
  return latex;
};

const unescapeHtml = (text: string): string => text;

const htmlEscape = (text: string): string => {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
};

const htmlAttributeEscape = (text: string): string => {
  return text
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
};

const processInline = (input: string): string => {
  type InlineState = { highlightColor: string };

  const parseBracedContent = (src: string, start: number): { content: string; nextIndex: number } | null => {
    if (src[start] !== '{') return null;
    let depth = 0;
    let i = start;
    for (; i < src.length; i++) {
      const ch = src[i];
      if (ch === '{') depth++;
      else if (ch === '}') {
        depth--;
        if (depth === 0) {
          return { content: src.slice(start + 1, i), nextIndex: i + 1 };
        }
      }
    }
    return null;
  };

  const process = (s: string, state: InlineState): string => {
    let i = 0;
    const out: string[] = [];

    const pushEscaped = (text: string) => {
      if (!text) return;
      out.push(htmlEscape(text));
    };

    while (i < s.length) {
      // Inline math: \( ... \)
      if (s[i] === '\\' && s[i + 1] === '(') {
        const end = s.indexOf('\\)', i + 2);
        if (end !== -1) {
          const latex = s.slice(i + 2, end).trim();
          const escaped = htmlAttributeEscape(latex);
          out.push(`<math-field class="math-field" data-latex="${escaped}"></math-field>`);
          i = end + 2;
          continue;
        }
      }

      // \sethlcolor{#RRGGBB}
      if (s.startsWith('\\sethlcolor{', i)) {
        const brace = parseBracedContent(s, i + '\\sethlcolor'.length);
        if (brace) {
          const val = brace.content.trim();
          if (/^#[0-9a-fA-F]{6}$/.test(val)) state.highlightColor = val;
          i = brace.nextIndex;
          continue;
        }
      }

      // \hl{...}
      if (s.startsWith('\\hl{', i)) {
        const brace = parseBracedContent(s, i + '\\hl'.length);
        if (brace) {
          const inner = process(brace.content, state);
          out.push(`<span style="background-color: ${state.highlightColor}">${inner}</span>`);
          i = brace.nextIndex;
          continue;
        }
      }

      // \textcolor{#RRGGBB}{...}
      if (s.startsWith('\\textcolor{', i)) {
        const colorBrace = parseBracedContent(s, i + '\\textcolor'.length);
        if (colorBrace) {
          const color = colorBrace.content.trim();
          const nextChar = s[colorBrace.nextIndex];
          if (nextChar === '{') {
            const innerBrace = parseBracedContent(s, colorBrace.nextIndex);
            if (innerBrace) {
              const inner = process(innerBrace.content, state);
              out.push(`<span style="color: ${color}">${inner}</span>`);
              i = innerBrace.nextIndex;
              continue;
            }
          }
        }
      }

      // \textbf{...}
      if (s.startsWith('\\textbf{', i)) {
        const brace = parseBracedContent(s, i + '\\textbf'.length);
        if (brace) {
          const inner = process(brace.content, state);
          out.push(`<strong>${inner}</strong>`);
          i = brace.nextIndex;
          continue;
        }
      }

      // \textit{...}
      if (s.startsWith('\\textit{', i)) {
        const brace = parseBracedContent(s, i + '\\textit'.length);
        if (brace) {
          const inner = process(brace.content, state);
          out.push(`<em>${inner}</em>`);
          i = brace.nextIndex;
          continue;
        }
      }

      // \underline{...}
      if (s.startsWith('\\underline{', i)) {
        const brace = parseBracedContent(s, i + '\\underline'.length);
        if (brace) {
          const inner = process(brace.content, state);
          out.push(`<u>${inner}</u>`);
          i = brace.nextIndex;
          continue;
        }
      }

      // Fallback: accumulate plain text until next backslash or end
      const nextSpecial = s.indexOf('\\', i);
      if (nextSpecial === -1) {
        pushEscaped(s.slice(i));
        break;
      } else {
        pushEscaped(s.slice(i, nextSpecial));
        i = nextSpecial;
      }
    }

    return out.join('');
  };

  return process(input, { highlightColor: '#ffff99' });
};

const parseTable = (block: string): string => {
  // Expect pattern similar to:
  // \\begin{table}[h]\n\\centering\n\\begin{tabular}{| c | c |} \\hline
  // cell & cell \\\\ \\hline ... \\end{tabular}\n\\caption{...}\n\\label{...}\n\\end{table}
  // We'll parse rows between \\begin{tabular} and \\end{tabular}
  const tabularStart = block.indexOf('\\begin{tabular}');
  const tabularEnd = block.indexOf('\\end{tabular}');
  if (tabularStart === -1 || tabularEnd === -1) return '';
  const tabular = block.slice(tabularStart, tabularEnd);

  // Count columns from column def
  const colMatch = tabular.match(/\\begin\{tabular\}\{([^}]*)\}/);
  let cols = 0;
  if (colMatch) {
    const def = colMatch[1];
    cols = (def.match(/c/g) || []).length;
  }

  // Split lines after first \\hline
  const afterHline = tabular.split(/\\hline\s*/).slice(1).join('');
  const rows: string[] = afterHline
    .split(/\\\\\s*\\hline/)
    .map(r => r.trim())
    .filter(Boolean);

  // Build HTML table (first row is header from EditorPage)
  const header = rows[0] || '';
  const headerCells = header.split('&').map(c => c.trim());
  const bodyRows = rows.slice(1).map(r => r.split('&').map(c => c.trim()));

  const table: string[] = [];
  table.push(`<table class="editor-table" data-rows="${Math.max(1 + bodyRows.length, 1)}" data-cols="${cols || headerCells.length}">`);
  table.push('<thead><tr>');
  headerCells.forEach((c, i) => {
    table.push(`<th contenteditable="true">${processInline(c) || `Header ${i + 1}`}</th>`);
  });
  table.push('</tr></thead>');

  table.push('<tbody>');
  bodyRows.forEach(r => {
    table.push('<tr>');
    r.forEach(c => table.push(`<td contenteditable="true">${processInline(c) || 'Cell'}</td>`));
    table.push('</tr>');
  });
  table.push('</tbody></table>');
  return table.join('');
};

export const parseLatexToHtml = (latexDocument: string): string => {
  let body = stripDocumentWrapper(latexDocument).trim();

  if (!body) return '<p><br></p>';

  // Remove auxiliary commands we inject for highlight color; safe no-ops
  body = body.replace(/\\definecolor\{highlightcolor\}[^\n]*\n/g, '');
  body = body.replace(/\\sethlcolor\{[^}]+\}\n/g, '');

  // Normalize alignment wrappers into inline markers to simplify paragraph split
  body = body
    .replace(/\\begin\{center\}\s*/g, '__ALIGN_CENTER_BEGIN__')
    .replace(/\\end\{center\}\s*/g, '__ALIGN_CENTER_END__')
    .replace(/\\begin\{flushright\}\s*/g, '__ALIGN_RIGHT_BEGIN__')
    .replace(/\\end\{flushright\}\s*/g, '__ALIGN_RIGHT_END__');

  // Extract list environments (enumerate/itemize) and replace with placeholders
  const listHtmlSnippets: string[] = [];
  const listBlockRegex = /\\begin\{(enumerate|itemize)\}(?:\[([^\]]*)\])?([\s\S]*?)\\end\{\1\}/g;

  const buildListHtml = (type: string, inner: string, options?: string): string => {
    // Capture and strip leading \hspace*{...} as indentation for the first item
    let leadingIndentPx = 0;
    const hspaceMatch = inner.match(/^\s*\\hspace\*\{([0-9.]+)em\}/);
    if (hspaceMatch) {
      const em = parseFloat(hspaceMatch[1]);
      if (!isNaN(em)) leadingIndentPx = Math.round(em * 16);
      inner = inner.replace(/^\s*\\hspace\*\{[0-9.]+em\}\s*/, '');
    }

    // Parse \\item entries; capture optional label: \\item[...]
    const itemPattern = /(^|\n)\\item(?:\s*\[([^\]]*)\])?\s*/g;
    const matches: Array<{ index: number; lastIndex: number; label?: string }> = [];
    let m: RegExpExecArray | null;
    while ((m = itemPattern.exec(inner)) !== null) {
      matches.push({ index: m.index, lastIndex: itemPattern.lastIndex, label: m[2] });
    }
    const items: string[] = [];
    for (let i = 0; i < matches.length; i++) {
      const startContent = matches[i].lastIndex;
      const endContent = i + 1 < matches.length ? matches[i + 1].index : inner.length;
      const raw = inner.slice(startContent, endContent).trim();
      const processed = processInline(raw);
      // Determine LI marker classes and color from label (for ordered lists)
      let liClasses: string[] = [];
      const label = matches[i].label || '';
      if (label) {
        if (/\\textbf/.test(label)) liClasses.push('marker-bold');
        if (/\\textit/.test(label)) liClasses.push('marker-italic');
        if (/\\underline/.test(label)) liClasses.push('marker-underline');
      }
      const classAttr = liClasses.length ? ` class=\"${liClasses.join(' ')}\"` : '';
      const styleProps: Record<string, string> = {};
      if (i === 0 && leadingIndentPx > 0) {
        styleProps['--indent-level'] = `${leadingIndentPx}px`;
      }
      if (label) {
        const colorMatch = label.match(/\\textcolor\{(#[0-9a-fA-F]{6})\}/);
        if (colorMatch) {
          styleProps['--marker-color'] = colorMatch[1];
        }
      }
      const styleAttr = Object.keys(styleProps).length > 0
        ? ` style=\"${Object.entries(styleProps).map(([k, v]) => `${k}: ${v}`).join('; ')}\"`
        : '';
      items.push(`<li${classAttr}${styleAttr}>${processed || '<br>'}</li>`);
    }
    if (type === 'enumerate') {
      // Detect label option for style
      let olClass = 'list-decimal';
      let alignStyle = '';
      if (options) {
        if (/label\s*=\s*\\alph\*\.?/.test(options)) olClass = 'list-alpha';
        else if (/label\s*=\s*\\roman\*\.?/.test(options)) olClass = 'list-roman';
      }
      // Alignment markers surrounding list
      if (inner.includes('__ALIGN_CENTER_BEGIN__') && inner.includes('__ALIGN_CENTER_END__')) alignStyle = ' style="text-align: center"';
      if (inner.includes('__ALIGN_RIGHT_BEGIN__') && inner.includes('__ALIGN_RIGHT_END__')) alignStyle = ' style="text-align: right"';
      return `<ol class="${olClass}"${alignStyle}>${items.join('')}</ol>`;
    }
    // itemize
    let ulClass = 'list-disc';
    let ulAlignStyle = '';
    if (options) {
      if (/label\s*=\s*\$\\circ\$/.test(options)) ulClass = 'list-circle';
      else if (/label\s*=\s*\$\\blacksquare\$/.test(options)) ulClass = 'list-square';
    }
    if (inner.includes('__ALIGN_CENTER_BEGIN__') && inner.includes('__ALIGN_CENTER_END__')) ulAlignStyle = ' style="text-align: center"';
    if (inner.includes('__ALIGN_RIGHT_BEGIN__') && inner.includes('__ALIGN_RIGHT_END__')) ulAlignStyle = ' style="text-align: right"';
    return `<ul class="${ulClass}"${ulAlignStyle}>${items.join('')}</ul>`;
  };

  body = body.replace(listBlockRegex, (_m, type, opts, inner) => {
    const html = buildListHtml(type, inner, opts);
    listHtmlSnippets.push(html);
    return `__LIST_PLACEHOLDER_${listHtmlSnippets.length - 1}__`;
  });

  // Extract tables first, replace with placeholders to keep paragraph splitting simple
  const tables: string[] = [];
  body = body.replace(/\\begin\{table\}[\s\S]*?\\end\{table\}/g, (m) => {
    tables.push(m);
    return `__TABLE_PLACEHOLDER_${tables.length - 1}__`;
  });

  // Split into paragraphs by blank lines
  const paras = body
    .split(/\n\s*\n+/)
    .map(p => p.trim())
    .filter(p => p.length > 0);

  const htmlParts: string[] = [];
  if (paras.length === 0) {
    htmlParts.push('<p><br></p>');
  } else {
    paras.forEach(p => {
      // Restore tables inside paragraphs if any
      let segment = p.replace(/__TABLE_PLACEHOLDER_(\d+)__/g, (_m, idxStr) => {
        const idx = parseInt(idxStr, 10);
        return parseTable(tables[idx]);
      });
      // Restore lists inside paragraphs if any
      segment = segment.replace(/__LIST_PLACEHOLDER_(\d+)__/g, (_m, idxStr) => {
        const idx = parseInt(idxStr, 10);
        return listHtmlSnippets[idx];
      });
      // Paragraph-level alignment and indentation
      let align = '';
      if (segment.includes('__ALIGN_CENTER_BEGIN__') && segment.includes('__ALIGN_CENTER_END__')) align = 'center';
      if (segment.includes('__ALIGN_RIGHT_BEGIN__') && segment.includes('__ALIGN_RIGHT_END__')) align = 'right';
      segment = segment.replace(/__ALIGN_CENTER_BEGIN__|__ALIGN_CENTER_END__|__ALIGN_RIGHT_BEGIN__|__ALIGN_RIGHT_END__/g, '');
      // Leading hspace
      let paddingPx = 0;
      const hspacePara = segment.match(/^\\hspace\*\{([0-9.]+)em\}/);
      if (hspacePara) {
        const em = parseFloat(hspacePara[1]);
        if (!isNaN(em)) paddingPx = Math.round(em * 16);
        segment = segment.replace(/^\\hspace\*\{[0-9.]+em\}\s*/, '');
      }
      // Process inline constructs
      segment = processInline(segment);
      if (/^<table[\s\S]*<\/table>$/.test(segment) || /^(<ol[\s\S]*<\/ol>|<ul[\s\S]*<\/ul>)$/.test(segment)) {
        const style = align || paddingPx ? ` style=\"${align ? `text-align: ${align}; ` : ''}${paddingPx ? `padding-left: ${paddingPx}px` : ''}\"` : '';
        const wrapped = `<div${style}>${segment}</div>`;
        htmlParts.push(wrapped + '<p><br></p>');
      } else {
        const style = align || paddingPx ? ` style=\"${align ? `text-align: ${align}; ` : ''}${paddingPx ? `padding-left: ${paddingPx}px` : ''}\"` : '';
        htmlParts.push(`<p${style}>${segment || '<br>'}</p>`);
      }
    });
  }

  return htmlParts.join('');
};

export default parseLatexToHtml;


