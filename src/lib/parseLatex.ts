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
    .replace(/>/g, '&gt;');
};

const processInline = (s: string): string => {
  // Inline math \( ... \)
  s = s.replace(/\\\(([\s\S]*?)\\\)/g, (_m, latex) => {
    const value = (latex || '').trim();
    return `<math-field class="math-field" data-latex="${value}"></math-field>`;
  });

  // \textcolor{#RRGGBB}{...}
  s = s.replace(/\\textcolor\{(#[0-9a-fA-F]{6})\}\{([\s\S]*?)\}/g, (_m, color, inner) => {
    return `<span style="color: ${color}">${processInline(inner)}</span>`;
  });

  // Track nearest preceding \sethlcolor for \hl blocks within same string segment by simple backscan
  const resolveHl = (input: string): string => {
    // Find last \sethlcolor{...} before each \hl occurrence
    return input.replace(/(.*?)(\\hl\{([\s\S]*?)\})/g, (m, before, _hlAll, inner) => {
      const colorMatch = before.match(/\\sethlcolor\{([^}]+)\}[^\\]*$/);
      let colorHex = '#ffff99';
      if (colorMatch) {
        // Accept hex-like or named; if named, we cannot resolve reliably here, default.
        const val = colorMatch[1];
        if (/^#[0-9a-fA-F]{6}$/.test(val)) colorHex = val;
      }
      return `${before}<span style="background-color: ${colorHex}">${processInline(inner)}</span>`;
    });
  };

  // \hl{...} -> background (use resolveHl to prefer nearby sethlcolor)
  s = resolveHl(s);

  // \textbf{...}, \textit{...}, \underline{...}
  s = s.replace(/\\textbf\{([\s\S]*?)\}/g, (_m, inner) => `<strong>${processInline(inner)}</strong>`);
  s = s.replace(/\\textit\{([\s\S]*?)\}/g, (_m, inner) => `<em>${processInline(inner)}</em>`);
  s = s.replace(/\\underline\{([\s\S]*?)\}/g, (_m, inner) => `<u>${processInline(inner)}</u>`);

  // Basic escapes from build side (keep literal backslashes for now)
  return s;
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
    table.push(`<th contenteditable="true">${htmlEscape(processInline(c)) || `Header ${i + 1}`}</th>`);
  });
  table.push('</tr></thead>');

  table.push('<tbody>');
  bodyRows.forEach(r => {
    table.push('<tr>');
    r.forEach(c => table.push(`<td contenteditable="true">${htmlEscape(processInline(c)) || 'Cell'}</td>`));
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
      let liStyle = '';
      const label = matches[i].label || '';
      if (label) {
        if (/\\textbf/.test(label)) liClasses.push('marker-bold');
        if (/\\textit/.test(label)) liClasses.push('marker-italic');
        if (/\\underline/.test(label)) liClasses.push('marker-underline');
        const colorMatch = label.match(/\\textcolor\{(#[0-9a-fA-F]{6})\}/);
        if (colorMatch) {
          liStyle = ` style=\"--marker-color: ${colorMatch[1]}\"`;
        }
      }
      const classAttr = liClasses.length ? ` class=\"${liClasses.join(' ')}\"` : '';
      const indentStyle = i === 0 && leadingIndentPx > 0 ? ` style=\"--indent-level: ${leadingIndentPx}px\"` : '';
      const combinedStyle = liStyle
        ? (indentStyle ? ` style=\"--marker-color: ${liStyle.split(': ')[1].replace('"', '')}; --indent-level: ${leadingIndentPx}px\"` : liStyle)
        : indentStyle;
      const styleAttr = combinedStyle ? combinedStyle : '';
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


