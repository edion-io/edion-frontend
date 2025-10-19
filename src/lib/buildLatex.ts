/**
 * Builds a complete LaTeX document from HTML content, preserving math expressions
 * @param htmlContent The HTML content from the editor
 * @returns A complete LaTeX document
 */
export const buildLatexDocument = (htmlContent: string): string => {
  const latexContent = convertHtmlToLatex(htmlContent);
  
  // Wrap with LaTeX document structure
  return `\\documentclass{article}
\\usepackage{amsmath}
\\usepackage{amssymb}
\\usepackage{enumitem}
\\usepackage{booktabs}
\\usepackage{xcolor}
\\usepackage{soul}
\\begin{document}

${latexContent}

\\end{document}`;
};

/**
 * Converts HTML content to LaTeX, preserving math expressions
 * @param htmlContent The HTML content from the editor
 * @returns LaTeX content
 */
const convertHtmlToLatex = (htmlContent: string): string => {
  // Create a temporary DOM element to parse the HTML
  const tempDiv = document.createElement('div');
  tempDiv.innerHTML = htmlContent;
  
  let latexOutput = '';
  // Track defined highlight colors and accumulate definitions to prepend once
  const definedHighlightColors = new Set<string>();
  let colorDefinitions = '';
  const registerHighlightColor = (hex: string): string => {
    const normalized = (hex || '').toLowerCase();
    const hexNoHash = normalized.replace('#', '');
    const colorName = `hlcolor${hexNoHash}`;
    if (!definedHighlightColors.has(colorName)) {
      definedHighlightColors.add(colorName);
      colorDefinitions += `\\definecolor{${colorName}}{HTML}{${hexNoHash}}\n`;
    }
    return colorName;
  };
  
  // Process the DOM nodes to extract text and math
  processNode(tempDiv, (text, isMath, formattingTags, listContext, isLatexCommand = false) => {
    if (isLatexCommand) {
      // This is a LaTeX command, add it directly without escaping
      latexOutput += text;
    } else if (isMath) {
      // This is a math expression, already in LaTeX format
      latexOutput += text;
    } else {
      // This is normal text, apply formatting
      let formattedText = escapeLatexSpecialChars(text);
      
      // Apply formatting from innermost to outermost
      formattingTags.forEach(tag => {
        switch (tag) {
          case 'b':
          case 'strong':
            formattedText = `\\textbf{${formattedText}}`;
            break;
          case 'i':
          case 'em':
            formattedText = `\\textit{${formattedText}}`;
            break;
          case 'u':
            formattedText = `\\underline{${formattedText}}`;
            break;
          // Add more formatting cases as needed
        }
      });
      
      latexOutput += formattedText;
    }
  }, [], null, registerHighlightColor);
  
  // Handle paragraphs
  latexOutput = latexOutput.replace(/\n\n+/g, '\n\n');
  
  return `${colorDefinitions}${latexOutput}`;
};

/**
 * Helper to process UL/OL lists with alignment wrappers and child processing
 */
function processListWithAlignment(
  element: HTMLElement,
  listType: 'itemize' | 'enumerate',
  options: string,
  callback: (text: string, isMath: boolean, formattingTags: string[], listContext: string | null, isLatexCommand?: boolean) => void,
  formattingTags: string[] = [],
  currentListContext: string | null = null,
  registerHighlightColor?: (hex: string) => string
): void {
  const listAlign = (element as HTMLElement).style.textAlign || '';
  if (listAlign === 'center') {
    callback('\n\\begin{center}\n', false, [], currentListContext, true);
  } else if (listAlign === 'right') {
    callback('\n\\begin{flushright}\n', false, [], currentListContext, true);
  }

  callback(`\n\\begin{${listType}}[${options}]\n`, false, [], currentListContext, true);
  for (let i = 0; i < element.childNodes.length; i++) {
    processNode(element.childNodes[i], callback, formattingTags, listType, registerHighlightColor);
  }
  callback(`\n\\end{${listType}}\n`, false, [], currentListContext, true);

  if (listAlign === 'center') {
    callback('\\end{center}\n', false, [], currentListContext, true);
  } else if (listAlign === 'right') {
    callback('\\end{flushright}\n', false, [], currentListContext, true);
  }
}

/**
 * Process DOM nodes and extract text with formatting context
 */
const processNode = (
  node: Node,
  callback: (text: string, isMath: boolean, formattingTags: string[], listContext: string | null, isLatexCommand?: boolean) => void,
  formattingTags: string[] = [],
  listContext: string | null = null,
  registerHighlightColor?: (hex: string) => string
) => {
  if (node.nodeType === Node.TEXT_NODE) {
    // This is a text node, add its content directly
    const text = node.textContent || '';
    if (text.trim()) {
      callback(text, false, formattingTags, listContext);
    }
  } else if (node.nodeType === Node.ELEMENT_NODE) {
    const element = node as HTMLElement;
    
    // Check if this is a math field
    if (element.classList.contains('math-field')) {
      const latex = element.getAttribute('data-latex') || '';
      callback(`\\(${latex}\\)`, true, [], listContext);
      return; // Don't process children of math fields
    }
    
    // Handle tables
    if (element.tagName === 'TABLE' && element.classList.contains('editor-table')) {
      const rows = parseInt(element.getAttribute('data-rows') || '0', 10);
      const cols = parseInt(element.getAttribute('data-cols') || '0', 10);
      
      if (rows > 0 && cols > 0) {
        // Start table environment
        const colDef = Array(cols).fill('c').join(' | ');
        callback('\n\\begin{table}[h]\n\\centering\n\\begin{tabular}{|' + colDef + '|}\n\\hline\n', false, [], listContext, true);
        
        // Process the table rows and cells
        processTableContent(element, callback, formattingTags, registerHighlightColor);
        
        // End table environment
        callback('\\end{tabular}\n\\caption{Table Caption}\n\\label{tab:mytable}\n\\end{table}\n', false, [], listContext, true);
        return; // Skip further processing - we've handled children
      }
    }
    
    // Handle lists
    if (element.tagName === 'UL') {
      // Determine UL style -> enumitem label
      const classes = Array.from(element.classList || []);
      let options = 'leftmargin=*';
      if (classes.includes('list-circle')) {
        options = `${options},label=$\\circ$`;
      } else if (classes.includes('list-square')) {
        options = `${options},label=$\\blacksquare$`;
      }
      processListWithAlignment(element as HTMLElement, 'itemize', options, callback, formattingTags, listContext, registerHighlightColor);
      return;
    }
    
    if (element.tagName === 'OL') {
      // Determine OL style -> enumitem label
      const classes = Array.from(element.classList || []);
      let options = 'leftmargin=*';
      if (classes.includes('list-alpha')) {
        options = `${options},label=\\alph*.`;
      } else if (classes.includes('list-roman')) {
        options = `${options},label=\\roman*.`;
      } else if (classes.includes('list-decimal')) {
        // explicit decimal if present (optional)
        // options = `${options},label=\\arabic*.`;
      }
      processListWithAlignment(element as HTMLElement, 'enumerate', options, callback, formattingTags, listContext, registerHighlightColor);
      return;
    }
    
    if (element.tagName === 'LI') {
      const isInOrderedList = listContext === 'enumerate';
      
      // Handle list item in the LaTeX output
      if (isInOrderedList) {
        // Check for marker formatting classes
        const hasMarkerBold = element.classList.contains('marker-bold');
        const hasMarkerItalic = element.classList.contains('marker-italic');
        const hasMarkerUnderline = element.classList.contains('marker-underline');
        const markerColor = (element as HTMLElement).style.getPropertyValue('--marker-color');
        const normalizedMarkerHex = markerColor ? normalizeColor(markerColor).replace('#', '') : '';
        
        if (hasMarkerBold || hasMarkerItalic || hasMarkerUnderline) {
          // Use LaTeX's \item[custom] feature to specify formatted counters
          let markerFormat = '\\arabic*';
          
          if (hasMarkerBold) {
            markerFormat = `\\textbf{${markerFormat}}`;
          }
          if (hasMarkerItalic) {
            markerFormat = `\\textit{${markerFormat}}`;
          }
          if (hasMarkerUnderline) {
            markerFormat = `\\underline{${markerFormat}}`;
          }
          
          if (markerColor) {
            // Use normalized HTML hex color for LaTeX
            callback(`\\item[\\textcolor[HTML]{${normalizedMarkerHex}}{${markerFormat}.}] `, false, [], listContext, true);
          } else {
            callback(`\\item[${markerFormat}.] `, false, [], listContext, true);
          }
        } else {
          // Standard numbered list item, with optional color
          if (markerColor) {
            callback(`\\item[\\textcolor[HTML]{${normalizedMarkerHex}}{\\arabic*.}] `, false, [], listContext, true);
          } else {
            callback('\\item ', false, [], listContext, true);
          }
        }
      } else {
        // For unordered lists: Normal \item processing
        callback('\\item ', false, [], listContext, true);
      }
      
      // Indentation for list items via hspace based on --indent-level
      const indentRaw = (element as HTMLElement).style.getPropertyValue('--indent-level') || '0';
      const indentParsed = parseFloat(indentRaw);
      const liIndentPx = Number.isNaN(indentParsed) ? 0 : indentParsed;
      if (liIndentPx > 0) {
        const em = (liIndentPx / 16).toFixed(2);
        callback(`\\hspace*{${em}em}`, false, [], listContext, true);
      }

      // Process all child nodes
      for (let i = 0; i < element.childNodes.length; i++) {
        processNode(element.childNodes[i], callback, formattingTags, listContext, registerHighlightColor);
      }
      
      callback('\n', false, [], listContext);
      return;
    }
    
    // Handle paragraph and div elements - add newline and alignment/indentation
    if (element.tagName === 'P' || element.tagName === 'DIV') {
      if (element.previousElementSibling) {
        callback('\n\n', false, [], listContext);
      }
      // Alignment wrappers for paragraphs
      const paraAlign = (element as HTMLElement).style.textAlign || '';
      if (paraAlign === 'center') {
        callback('\\begin{center}', false, [], listContext, true);
      } else if (paraAlign === 'right') {
        callback('\\begin{flushright}', false, [], listContext, true);
      }
      // Indentation via hspace for paragraphs
      const parsedPadding = parseInt((element as HTMLElement).style.paddingLeft || '0', 10);
      const paddingLeftPx = Number.isFinite(parsedPadding) ? parsedPadding : 0;
      if (paddingLeftPx > 0) {
        const em = (paddingLeftPx / 16).toFixed(2);
        callback(`\\hspace*{${em}em}`, false, [], listContext, true);
      }
    }
    
    // Add the current element to formatting tags if it's a formatting element
    const newFormattingTags = [...formattingTags];
    if (['B', 'STRONG', 'I', 'EM', 'U'].includes(element.tagName)) {
      newFormattingTags.push(element.tagName.toLowerCase());
    }
    
    // Handle text and background colors robustly (inline style + <font color="...">)
    const textColorAttr = (element as HTMLElement).style.color || (element.tagName === 'FONT' ? (element as HTMLElement).getAttribute('color') || '' : '');
    const bgColorAttr = (element as HTMLElement).style.backgroundColor || '';
    
    // If element has a text color or background color, create color command wrappers
    let colorPrefix = '';
    let colorSuffix = '';
    
    if (textColorAttr) {
      const hexColor = rgbToHex(textColorAttr).toLowerCase();
      if (hexColor !== '#000000') {
        colorPrefix += `\\textcolor{${hexColor}}{`;
        colorSuffix = `}${colorSuffix}`;
      }
    }
    
    if (bgColorAttr && bgColorAttr !== 'rgba(0, 0, 0, 0)' && bgColorAttr !== 'transparent') {
      const hexColor = rgbToHex(bgColorAttr).toLowerCase();
      const colorName = registerHighlightColor ? registerHighlightColor(hexColor) : `hlcolor${hexColor.replace('#', '')}`;
      // Scope the highlight color locally to the highlighted region
      colorPrefix += `{\\sethlcolor{${colorName}}\\hl{`;
      colorSuffix = `}}${colorSuffix}`;
    }
    
    // Add color prefix if needed
    if (colorPrefix) {
      callback(colorPrefix, false, [], listContext, true);
    }
    
    // Process all child nodes
    for (let i = 0; i < element.childNodes.length; i++) {
      processNode(element.childNodes[i], callback, newFormattingTags, listContext, registerHighlightColor);
    }
    
    // Add color suffix if needed
    if (colorSuffix) {
      callback(colorSuffix, false, [], listContext, true);
    }
    
    // Close alignment wrappers and add newline after paragraphs and divs
    if (element.tagName === 'P' || element.tagName === 'DIV') {
      const paraAlign = (element as HTMLElement).style.textAlign || '';
      if (paraAlign === 'center') {
        callback('\\end{center}', false, [], listContext, true);
      } else if (paraAlign === 'right') {
        callback('\\end{flushright}', false, [], listContext, true);
      }
      if (element.nextElementSibling) {
        callback('\n\n', false, [], listContext);
      }
    }
  }
};

/**
 * Process table content for LaTeX conversion
 */
const processTableContent = (
  tableElement: HTMLElement,
  callback: (text: string, isMath: boolean, formattingTags: string[], listContext: string | null, isLatexCommand?: boolean) => void,
  formattingTags: string[] = [],
  registerHighlightColor?: (hex: string) => string
) => {
  // Helper to process a single table cell's content and return accumulated LaTeX
  const processCellContent = (cell: Element, defaultTags: string[]): string => {
    let cellLatex = '';
    processNode(
      cell,
      (text, isMath, tags, listContext, isLatexCommand = false) => {
        if (isLatexCommand) {
          cellLatex += text;
        } else if (isMath) {
          cellLatex += text;
        } else {
          let formattedText = escapeLatexSpecialChars(text);
          tags.forEach(tag => {
            switch (tag) {
              case 'b':
              case 'strong':
                formattedText = `\\textbf{${formattedText}}`;
                break;
              case 'i':
              case 'em':
                formattedText = `\\textit{${formattedText}}`;
                break;
              case 'u':
                formattedText = `\\underline{${formattedText}}`;
                break;
            }
          });
          cellLatex += formattedText;
        }
      },
      defaultTags,
      null,
      registerHighlightColor
    );
    return cellLatex;
  };
  // Process table headers (TH elements)
  const headerCells = tableElement.querySelectorAll('th');
  if (headerCells.length > 0) {
    for (let i = 0; i < headerCells.length; i++) {
      const cell = headerCells[i];
      // Process cell content
      const cellLatex = processCellContent(cell, ['b']);  // Default bold for headers
      
      callback(cellLatex, false, [], null);
      
      // Add cell separator or end of row
      if (i < headerCells.length - 1) {
        callback(' & ', false, [], null, true);
      } else {
        callback(' \\\\ \\hline\n', false, [], null, true);
      }
    }
  }
  
  // Process table body rows (TR elements in TBODY)
  const rows = tableElement.querySelectorAll('tbody tr');
  for (let i = 0; i < rows.length; i++) {
    const cells = rows[i].querySelectorAll('td');
    for (let j = 0; j < cells.length; j++) {
      const cell = cells[j];
      // Process cell content
      const cellLatex = processCellContent(cell, formattingTags);
      
      callback(cellLatex, false, [], null);
      
      // Add cell separator or end of row
      if (j < cells.length - 1) {
        callback(' & ', false, [], null, true);
      } else {
        callback(' \\\\ \\hline\n', false, [], null, true);
      }
    }
  }
};

/**
 * Escape LaTeX special characters in regular text
 */
const escapeLatexSpecialChars = (text: string): string => {
  return text
    .replace(/\\/g, '\\textbackslash{}')
    .replace(/\{/g, '\\{')
    .replace(/\}/g, '\\}')
    .replace(/\$/g, '\\$')
    .replace(/&/g, '\\&')
    .replace(/#/g, '\\#')
    .replace(/_/g, '\\_')
    .replace(/~/g, '\\textasciitilde{}')
    .replace(/\^/g, '\\textasciicircum{}')
    .replace(/%/g, '\\%');
};

/** Normalize CSS color strings into an uppercase 6-digit hex string with leading '#'. */
const normalizeColor = (value: string): string => {
  if (!value) return '#000000';
  const v = value.trim().toLowerCase();

  // Common keyword handling
  if (v === 'transparent') return '#000000';

  // Hex inputs (#rgb or #rrggbb)
  if (v.startsWith('#')) {
    const hex = v.slice(1);
    if (/^[0-9a-f]{3}$/.test(hex)) {
      const r = hex[0] + hex[0];
      const g = hex[1] + hex[1];
      const b = hex[2] + hex[2];
      return (`#${r}${g}${b}`).toUpperCase();
    }
    if (/^[0-9a-f]{6}$/.test(hex)) {
      return (`#${hex}`).toUpperCase();
    }
    return '#000000';
  }

  // Named colors minimal map
  const map: Record<string, string> = {
    black: '#000000', white: '#ffffff', red: '#ff0000', lime: '#00ff00', green: '#008000', blue: '#0000ff',
    yellow: '#ffff00', cyan: '#00ffff', magenta: '#ff00ff', gray: '#808080', grey: '#808080',
    silver: '#c0c0c0', maroon: '#800000', olive: '#808000', purple: '#800080', teal: '#008080', navy: '#000080'
  };
  if (map[v]) return map[v].toUpperCase();

  // rgb/rgba functions
  const m = v.match(/rgba?\((\d+)\s*,\s*(\d+)\s*,\s*(\d+)(?:,\s*([\d.]+))?\)/);
  if (m) {
    const clamp = (n: number) => Math.max(0, Math.min(255, n));
    const r = clamp(parseInt(m[1], 10));
    const g = clamp(parseInt(m[2], 10));
    const b = clamp(parseInt(m[3], 10));
    return (`#${r.toString(16).padStart(2,'0')}${g.toString(16).padStart(2,'0')}${b.toString(16).padStart(2,'0')}`).toUpperCase();
  }

  return '#000000';
};

/** Convert a CSS color string to a 6-digit hex string with leading '#'. */
const rgbToHex = (value: string): string => {
  return normalizeColor(value);
};