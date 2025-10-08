/**
 * Builds a complete LaTeX document from HTML content, preserving math expressions
 * @param htmlContent The HTML content from the editor
 * @returns A complete LaTeX document
 */
export const buildLatexDocument = (htmlContent: string): string => {
  let latexContent = convertHtmlToLatex(htmlContent);
  
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
  });
  
  // Handle paragraphs
  latexOutput = latexOutput.replace(/\n\n+/g, '\n\n');
  
  return latexOutput;
};

/**
 * Process DOM nodes and extract text with formatting context
 */
const processNode = (
  node: Node,
  callback: (text: string, isMath: boolean, formattingTags: string[], listContext: string | null, isLatexCommand?: boolean) => void,
  formattingTags: string[] = [],
  listContext: string | null = null
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
        processTableContent(element, callback, formattingTags);
        
        // End table environment
        callback('\\end{tabular}\n\\caption{Table Caption}\n\\label{tab:mytable}\n\\end{table}\n', false, [], listContext, true);
        return; // Skip further processing - we've handled children
      }
    }
    
    // Handle lists
    if (element.tagName === 'UL') {
      // Alignment wrappers for lists
      const listAlign = (element as HTMLElement).style.textAlign || '';
      if (listAlign === 'center') {
        callback('\n\\begin{center}\n', false, [], listContext, true);
      } else if (listAlign === 'right') {
        callback('\n\\begin{flushright}\n', false, [], listContext, true);
      }
      // Determine UL style -> enumitem label
      const classes = Array.from(element.classList || []);
      let options = 'leftmargin=*';
      if (classes.includes('list-circle')) {
        options = `${options},label=$\\circ$`;
      } else if (classes.includes('list-square')) {
        options = `${options},label=$\\blacksquare$`;
      }
      callback(`\n\\begin{itemize}[${options}]\n`, false, [], listContext, true);
      for (let i = 0; i < element.childNodes.length; i++) {
        processNode(element.childNodes[i], callback, formattingTags, 'itemize');
      }
      callback('\n\\end{itemize}\n', false, [], listContext, true);
      if (listAlign === 'center') {
        callback('\\end{center}\n', false, [], listContext, true);
      } else if (listAlign === 'right') {
        callback('\\end{flushright}\n', false, [], listContext, true);
      }
      return;
    }
    
    if (element.tagName === 'OL') {
      // Alignment wrappers for lists
      const listAlign = (element as HTMLElement).style.textAlign || '';
      if (listAlign === 'center') {
        callback('\n\\begin{center}\n', false, [], listContext, true);
      } else if (listAlign === 'right') {
        callback('\n\\begin{flushright}\n', false, [], listContext, true);
      }
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
      callback(`\n\\begin{enumerate}[${options}]\n`, false, [], listContext, true);
      for (let i = 0; i < element.childNodes.length; i++) {
        processNode(element.childNodes[i], callback, formattingTags, 'enumerate');
      }
      callback('\n\\end{enumerate}\n', false, [], listContext, true);
      if (listAlign === 'center') {
        callback('\\end{center}\n', false, [], listContext, true);
      } else if (listAlign === 'right') {
        callback('\\end{flushright}\n', false, [], listContext, true);
      }
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
            // ensure hex or valid color
            callback(`\\item[\\textcolor{${markerColor}}{${markerFormat}.}] `, false, [], listContext, true);
          } else {
            callback(`\\item[${markerFormat}.] `, false, [], listContext, true);
          }
        } else {
          // Standard numbered list item, with optional color
          if (markerColor) {
            callback(`\\item[\\textcolor{${markerColor}}{\\arabic*.}] `, false, [], listContext, true);
          } else {
            callback('\\item ', false, [], listContext, true);
          }
        }
      } else {
        // For unordered lists: Normal \item processing
        callback('\\item ', false, [], listContext, true);
      }
      
      // Indentation for list items via hspace based on --indent-level
      const liIndentPx = parseInt((element as HTMLElement).style.getPropertyValue('--indent-level') || '0', 10) || 0;
      if (liIndentPx > 0) {
        const em = (liIndentPx / 16).toFixed(2);
        callback(`\\hspace*{${em}em}`, false, [], listContext, true);
      }

      // Process all child nodes
      for (let i = 0; i < element.childNodes.length; i++) {
        processNode(element.childNodes[i], callback, formattingTags, listContext);
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
      const paddingLeftPx = parseInt((element as HTMLElement).style.paddingLeft || '0', 10) || 0;
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
    
    if (textColorAttr && rgbToHex(normalizeColor(textColorAttr)).toLowerCase() !== '#000000') {
      const hexColor = rgbToHex(normalizeColor(textColorAttr));
      colorPrefix += `\\textcolor{${hexColor}}{`;
      colorSuffix = `}${colorSuffix}`;
    }
    
    if (bgColorAttr && bgColorAttr !== 'rgba(0, 0, 0, 0)' && bgColorAttr !== 'transparent') {
      const hexColor = rgbToHex(normalizeColor(bgColorAttr));
      colorPrefix += `\\hl{`;
      colorSuffix = `}${colorSuffix}`;
      // Add a color definition for highlighting
      callback(`\\definecolor{highlightcolor}{HTML}{${hexColor.replace('#', '')}}\n\\sethlcolor{highlightcolor}\n`, false, [], listContext, true);
    }
    
    // Add color prefix if needed
    if (colorPrefix) {
      callback(colorPrefix, false, [], listContext, true);
    }
    
    // Process all child nodes
    for (let i = 0; i < element.childNodes.length; i++) {
      processNode(element.childNodes[i], callback, newFormattingTags, listContext);
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
  formattingTags: string[] = []
) => {
  // Process table headers (TH elements)
  const headerCells = tableElement.querySelectorAll('th');
  if (headerCells.length > 0) {
    for (let i = 0; i < headerCells.length; i++) {
      const cell = headerCells[i];
      // Process cell content
      let cellLatex = '';
      processNode(cell, (text, isMath, tags, listContext, isLatexCommand = false) => {
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
      }, ['b']);  // Default bold for headers
      
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
      let cellLatex = '';
      processNode(cell, (text, isMath, tags, listContext, isLatexCommand = false) => {
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
      }, formattingTags);
      
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

/**
 * Converts RGB color value to hex format
 * @param rgb RGB color as string (e.g., 'rgb(255, 0, 0)')
 * @returns Hex color (e.g., '#FF0000')
 */
const rgbToHex = (rgb: string): string => {
  // If already in hex format, return as is
  if (rgb.startsWith('#')) {
    return rgb;
  }
  
  // Parse RGB format
  const rgbMatch = rgb.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*[\d.]+)?\)/);
  if (!rgbMatch) {
    return '#000000'; // Default to black if unable to parse
  }
  
  const r = parseInt(rgbMatch[1], 10);
  const g = parseInt(rgbMatch[2], 10);
  const b = parseInt(rgbMatch[3], 10);
  
  // Convert to hex
  return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
}; 

/** Normalize CSS color strings into a hex string when possible. */
const normalizeColor = (value: string): string => {
  if (!value) return '#000000';
  const v = value.trim().toLowerCase();
  if (v.startsWith('#')) return v;
  // Named colors minimal map
  const map: Record<string, string> = {
    black: '#000000', white: '#ffffff', red: '#ff0000', lime: '#00ff00', green: '#008000', blue: '#0000ff',
    yellow: '#ffff00', cyan: '#00ffff', magenta: '#ff00ff', gray: '#808080', grey: '#808080',
    silver: '#c0c0c0', maroon: '#800000', olive: '#808000', purple: '#800080', teal: '#008080', navy: '#000080'
  };
  if (map[v]) return map[v];
  // rgb/rgba
  const m = v.match(/rgba?\((\d+)\s*,\s*(\d+)\s*,\s*(\d+)(?:,\s*([\d.]+))?\)/);
  if (m) {
    const r = parseInt(m[1], 10), g = parseInt(m[2], 10), b = parseInt(m[3], 10);
    return `#${r.toString(16).padStart(2,'0')}${g.toString(16).padStart(2,'0')}${b.toString(16).padStart(2,'0')}`;
  }
  return '#000000';
};