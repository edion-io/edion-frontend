// Bidirectional LaTeX ↔ Slate.js converter
import { Descendant, Text, Element } from 'slate';
import { 
  CustomElement, 
  CustomText, 
  ParagraphElement, 
  BulletedListElement, 
  NumberedListElement,
  ListItemElement,
  MathElement,
  TextAlign
} from './types';

export class LaTeXConverter {
  
  // ==================== SLATE → LATEX ====================
  
  serializeToLatex(nodes: Descendant[]): string {
    const body = nodes.map(node => this.serializeNode(node)).join('\n\n');
    return this.buildLatexDocument(body);
  }
  
  private serializeNode(node: Descendant): string {
    if (Text.isText(node)) {
      return this.serializeText(node);
    }
    
    if (Element.isElement(node)) {
      const element = node as CustomElement;
      
      switch (element.type) {
        case 'paragraph':
          return this.serializeParagraph(element);
        case 'heading':
          return this.serializeHeading(element);
        case 'bulleted-list':
          return this.serializeBulletedList(element);
        case 'numbered-list':
          return this.serializeNumberedList(element);
        case 'list-item':
          return this.serializeListItem(element);
        case 'math':
          return this.serializeMath(element);
        default:
          return this.serializeChildren(element.children);
      }
    }
    
    return '';
  }
  
  private serializeText(text: CustomText): string {
    let result = text.text;
    
    // Apply formatting
    if (text.bold) result = `\\textbf{${result}}`;
    if (text.italic) result = `\\textit{${result}}`;
    if (text.underline) result = `\\underline{${result}}`;
    if (text.color && text.color !== '#000000') {
      result = `\\textcolor{${this.hexToLatexColor(text.color)}}{${result}}`;
    }
    if (text.backgroundColor && text.backgroundColor !== 'transparent') {
      result = `\\colorbox{${this.hexToLatexColor(text.backgroundColor)}}{${result}}`;
    }
    
    return result;
  }
  
  private serializeParagraph(element: ParagraphElement): string {
    const content = this.serializeChildren(element.children);
    
    if (element.align === 'center') {
      return `\\begin{center}\n${content}\n\\end{center}`;
    } else if (element.align === 'right') {
      return `\\begin{flushright}\n${content}\n\\end{flushright}`;
    }
    
    return content;
  }
  
  private serializeHeading(element: any): string {
    const content = this.serializeChildren(element.children);
    const commands = ['\\section', '\\subsection', '\\subsubsection', '\\paragraph', '\\subparagraph'];
    const command = commands[element.level - 1] || '\\paragraph';
    return `${command}{${content}}`;
  }
  
  private serializeBulletedList(element: BulletedListElement): string {
    const items = element.children.map(child => this.serializeNode(child)).join('\n');
    const listContent = `\\begin{itemize}\n${items}\n\\end{itemize}`;
    
    if (element.align === 'center') {
      return `\\begin{center}\n${listContent}\n\\end{center}`;
    } else if (element.align === 'right') {
      return `\\begin{flushright}\n${listContent}\n\\end{flushright}`;
    }
    
    return listContent;
  }
  
  private serializeNumberedList(element: NumberedListElement): string {
    const items = element.children.map(child => this.serializeNode(child)).join('\n');
    const listContent = `\\begin{enumerate}\n${items}\n\\end{enumerate}`;
    
    if (element.align === 'center') {
      return `\\begin{center}\n${listContent}\n\\end{center}`;
    } else if (element.align === 'right') {
      return `\\begin{flushright}\n${listContent}\n\\end{flushright}`;
    }
    
    return listContent;
  }
  
  private serializeListItem(element: ListItemElement): string {
    const content = this.serializeChildren(element.children);
    const indent = element.indentLevel ? '  '.repeat(element.indentLevel) : '';
    return `${indent}\\item ${content}`;
  }
  
  private serializeMath(element: MathElement): string {
    if (element.display) {
      return `\\[\n${element.formula}\n\\]`;
    } else {
      return `\\(${element.formula}\\)`;
    }
  }
  
  private serializeChildren(children: Descendant[]): string {
    return children.map(child => this.serializeNode(child)).join('');
  }
  
  private buildLatexDocument(content: string): string {
    return `\\documentclass{article}
\\usepackage[utf8]{inputenc}
\\usepackage{amsmath}
\\usepackage{amsfonts}
\\usepackage{amssymb}
\\usepackage{xcolor}
\\usepackage{graphicx}

\\begin{document}

${content}

\\end{document}`;
  }
  
  // ==================== LATEX → SLATE ====================
  
  parseFromLatex(latex: string): Descendant[] {
    // Extract the document body (between \begin{document} and \end{document})
    const bodyMatch = latex.match(/\\begin\{document\}([\s\S]*?)\\end\{document\}/);
    const body = bodyMatch ? bodyMatch[1].trim() : latex;
    
    return this.parseLatexContent(body);
  }
  
  private parseLatexContent(content: string): Descendant[] {
    const nodes: Descendant[] = [];
    let currentIndex = 0;
    
    while (currentIndex < content.length) {
      const result = this.parseNextElement(content, currentIndex);
      if (result.node) {
        nodes.push(result.node);
      }
      currentIndex = result.nextIndex;
    }
    
    return nodes.length > 0 ? nodes : [{ type: 'paragraph', children: [{ text: '' }] }];
  }
  
  private parseNextElement(content: string, startIndex: number): { node: Descendant | null; nextIndex: number } {
    // Skip whitespace
    while (startIndex < content.length && /\s/.test(content[startIndex])) {
      startIndex++;
    }
    
    if (startIndex >= content.length) {
      return { node: null, nextIndex: startIndex };
    }
    
    // Try to parse different elements
    const matchers = [
      this.parseDisplayMath.bind(this),
      this.parseInlineMath.bind(this),
      this.parseItemize.bind(this),
      this.parseEnumerate.bind(this),
      this.parseCenter.bind(this),
      this.parseFlushright.bind(this),
      this.parseSection.bind(this),
      this.parseParagraph.bind(this)
    ];
    
    for (const matcher of matchers) {
      const result = matcher(content, startIndex);
      if (result.node) {
        return result;
      }
    }
    
    // Fallback: parse as text until next command or end
    return this.parseText(content, startIndex);
  }
  
  private parseDisplayMath(content: string, startIndex: number): { node: Descendant | null; nextIndex: number } {
    if (!content.substring(startIndex).startsWith('\\[')) {
      return { node: null, nextIndex: startIndex };
    }
    
    const endIndex = content.indexOf('\\]', startIndex + 2);
    if (endIndex === -1) {
      return { node: null, nextIndex: startIndex };
    }
    
    const formula = content.substring(startIndex + 2, endIndex).trim();
    return {
      node: { type: 'math', formula, display: true, children: [{ text: '' }] },
      nextIndex: endIndex + 2
    };
  }
  
  private parseInlineMath(content: string, startIndex: number): { node: Descendant | null; nextIndex: number } {
    if (!content.substring(startIndex).startsWith('\\(')) {
      return { node: null, nextIndex: startIndex };
    }
    
    const endIndex = content.indexOf('\\)', startIndex + 2);
    if (endIndex === -1) {
      return { node: null, nextIndex: startIndex };
    }
    
    const formula = content.substring(startIndex + 2, endIndex).trim();
    return {
      node: { type: 'math', formula, display: false, children: [{ text: '' }] },
      nextIndex: endIndex + 2
    };
  }
  
  private parseItemize(content: string, startIndex: number): { node: Descendant | null; nextIndex: number } {
    return this.parseList(content, startIndex, 'itemize', 'bulleted-list');
  }
  
  private parseEnumerate(content: string, startIndex: number): { node: Descendant | null; nextIndex: number } {
    return this.parseList(content, startIndex, 'enumerate', 'numbered-list');
  }
  
  private parseList(content: string, startIndex: number, envName: string, listType: 'bulleted-list' | 'numbered-list'): { node: Descendant | null; nextIndex: number } {
    const beginPattern = `\\begin{${envName}}`;
    const endPattern = `\\end{${envName}}`;
    
    if (!content.substring(startIndex).startsWith(beginPattern)) {
      return { node: null, nextIndex: startIndex };
    }
    
    const beginIndex = startIndex + beginPattern.length;
    const endIndex = content.indexOf(endPattern, beginIndex);
    if (endIndex === -1) {
      return { node: null, nextIndex: startIndex };
    }
    
    const listContent = content.substring(beginIndex, endIndex);
    const items = this.parseListItems(listContent);
    
    return {
      node: { type: listType, children: items },
      nextIndex: endIndex + endPattern.length
    };
  }
  
  private parseListItems(content: string): ListItemElement[] {
    const items: ListItemElement[] = [];
    const itemPattern = /\\item\s+/g;
    let match;
    let lastIndex = 0;
    
    while ((match = itemPattern.exec(content)) !== null) {
      if (lastIndex > 0) {
        // Process previous item
        const itemContent = content.substring(lastIndex, match.index);
        const children = this.parseInlineContent(itemContent.trim());
        items.push({ type: 'list-item', children });
      }
      lastIndex = match.index + match[0].length;
    }
    
    // Process last item
    if (lastIndex < content.length) {
      const itemContent = content.substring(lastIndex);
      const children = this.parseInlineContent(itemContent.trim());
      items.push({ type: 'list-item', children });
    }
    
    return items;
  }
  
  private parseCenter(content: string, startIndex: number): { node: Descendant | null; nextIndex: number } {
    return this.parseEnvironment(content, startIndex, 'center', 'center');
  }
  
  private parseFlushright(content: string, startIndex: number): { node: Descendant | null; nextIndex: number } {
    return this.parseEnvironment(content, startIndex, 'flushright', 'right');
  }
  
  private parseEnvironment(content: string, startIndex: number, envName: string, align: TextAlign): { node: Descendant | null; nextIndex: number } {
    const beginPattern = `\\begin{${envName}}`;
    const endPattern = `\\end{${envName}}`;
    
    if (!content.substring(startIndex).startsWith(beginPattern)) {
      return { node: null, nextIndex: startIndex };
    }
    
    const beginIndex = startIndex + beginPattern.length;
    const endIndex = content.indexOf(endPattern, beginIndex);
    if (endIndex === -1) {
      return { node: null, nextIndex: startIndex };
    }
    
    const envContent = content.substring(beginIndex, endIndex).trim();
    const children = this.parseInlineContent(envContent);
    
    return {
      node: { type: 'paragraph', align, children },
      nextIndex: endIndex + endPattern.length
    };
  }
  
  private parseSection(content: string, startIndex: number): { node: Descendant | null; nextIndex: number } {
    const sectionPattern = /\\(sub)*section\{([^}]+)\}/;
    const match = content.substring(startIndex).match(sectionPattern);
    
    if (!match || content.substring(startIndex).indexOf(match[0]) !== 0) {
      return { node: null, nextIndex: startIndex };
    }
    
    const level = match[1] ? (match[1].length / 3) + 1 : 1; // sub = 3 chars, subsub = 6 chars
    const title = match[2];
    
    return {
      node: { type: 'heading', level: Math.min(level, 6) as any, children: [{ text: title }] },
      nextIndex: startIndex + match[0].length
    };
  }
  
  private parseParagraph(content: string, startIndex: number): { node: Descendant | null; nextIndex: number } {
    // Find the end of the paragraph (double newline or start of next command)
    let endIndex = startIndex;
    let foundEnd = false;
    
    while (endIndex < content.length && !foundEnd) {
      if (content.substring(endIndex).startsWith('\n\n')) {
        foundEnd = true;
        break;
      }
      if (content[endIndex] === '\\' && endIndex > startIndex) {
        // Check if this is a new command
        const nextSpace = content.indexOf(' ', endIndex);
        const nextNewline = content.indexOf('\n', endIndex);
        const nextEnd = Math.min(
          nextSpace === -1 ? content.length : nextSpace,
          nextNewline === -1 ? content.length : nextNewline
        );
        const possibleCommand = content.substring(endIndex, nextEnd);
        
        if (possibleCommand.match(/\\(begin|end|\w+)/)) {
          foundEnd = true;
          break;
        }
      }
      endIndex++;
    }
    
    if (endIndex === startIndex) {
      return { node: null, nextIndex: startIndex + 1 };
    }
    
    const paragraphContent = content.substring(startIndex, endIndex).trim();
    if (!paragraphContent) {
      return { node: null, nextIndex: endIndex };
    }
    
    const children = this.parseInlineContent(paragraphContent);
    
    return {
      node: { type: 'paragraph', children },
      nextIndex: endIndex
    };
  }
  
  private parseText(content: string, startIndex: number): { node: Descendant | null; nextIndex: number } {
    let endIndex = startIndex;
    
    while (endIndex < content.length && content[endIndex] !== '\\' && content[endIndex] !== '\n') {
      endIndex++;
    }
    
    const text = content.substring(startIndex, endIndex);
    if (!text.trim()) {
      return { node: null, nextIndex: endIndex };
    }
    
    return {
      node: { text },
      nextIndex: endIndex
    };
  }
  
  private parseInlineContent(content: string): CustomText[] {
    const result: CustomText[] = [];
    let currentIndex = 0;
    
    while (currentIndex < content.length) {
      const textResult = this.parseInlineText(content, currentIndex);
      if (textResult.text) {
        result.push(textResult.text);
      }
      currentIndex = textResult.nextIndex;
    }
    
    return result.length > 0 ? result : [{ text: content }];
  }
  
  private parseInlineText(content: string, startIndex: number): { text: CustomText | null; nextIndex: number } {
    // Skip whitespace at start
    while (startIndex < content.length && /\s/.test(content[startIndex])) {
      startIndex++;
    }
    
    if (startIndex >= content.length) {
      return { text: null, nextIndex: startIndex };
    }
    
    // Check for formatting commands
    const formatters = [
      { pattern: /\\textbf\{([^}]+)\}/, format: { bold: true } },
      { pattern: /\\textit\{([^}]+)\}/, format: { italic: true } },
      { pattern: /\\underline\{([^}]+)\}/, format: { underline: true } },
      { pattern: /\\textcolor\{([^}]+)\}\{([^}]+)\}/, format: (matches: RegExpMatchArray) => ({ color: this.latexColorToHex(matches[1]) }) },
    ];
    
    for (const formatter of formatters) {
      const match = content.substring(startIndex).match(formatter.pattern);
      if (match && content.substring(startIndex).indexOf(match[0]) === 0) {
        const text = match[formatter.pattern.source.includes('textcolor') ? 2 : 1];
        const format = typeof formatter.format === 'function' ? formatter.format(match) : formatter.format;
        
        return {
          text: { text, ...format },
          nextIndex: startIndex + match[0].length
        };
      }
    }
    
    // Parse regular text until next command
    let endIndex = startIndex;
    while (endIndex < content.length && content[endIndex] !== '\\') {
      endIndex++;
    }
    
    const text = content.substring(startIndex, endIndex);
    return {
      text: { text },
      nextIndex: endIndex
    };
  }
  
  // ==================== UTILITY FUNCTIONS ====================
  
  private hexToLatexColor(hex: string): string {
    // Convert hex colors to LaTeX color names or rgb values
    const colorMap: { [key: string]: string } = {
      '#ff0000': 'red',
      '#00ff00': 'green',
      '#0000ff': 'blue',
      '#ffff00': 'yellow',
      '#ff00ff': 'magenta',
      '#00ffff': 'cyan',
      '#000000': 'black',
      '#ffffff': 'white'
    };
    
    const knownColor = colorMap[hex.toLowerCase()];
    if (knownColor) {
      return knownColor;
    }
    
    // For unknown colors, try to convert hex to RGB format
    const rgbResult = this.hexToRgb(hex);
    return rgbResult || 'black'; // fallback to black if conversion fails
  }
  
  private hexToRgb(hex: string): string | null {
    // Validate and parse hex color (supports #rgb, #rrggbb formats)
    const hexMatch = hex.match(/^#([a-f\d]{3}|[a-f\d]{6})$/i);
    if (!hexMatch) {
      return null;
    }
    
    let r: number, g: number, b: number;
    
    if (hexMatch[1].length === 3) {
      // Handle #rgb format (expand to #rrggbb)
      const chars = hexMatch[1].split('');
      r = parseInt(chars[0] + chars[0], 16);
      g = parseInt(chars[1] + chars[1], 16);
      b = parseInt(chars[2] + chars[2], 16);
    } else {
      // Handle #rrggbb format
      r = parseInt(hexMatch[1].substr(0, 2), 16);
      g = parseInt(hexMatch[1].substr(2, 2), 16);
      b = parseInt(hexMatch[1].substr(4, 2), 16);
    }
    
    // Convert to 0-1 range with 3 decimal places for LaTeX
    const rNorm = (r / 255).toFixed(3);
    const gNorm = (g / 255).toFixed(3);
    const bNorm = (b / 255).toFixed(3);
    
    return `{rgb}{${rNorm},${gNorm},${bNorm}}`;
  }
  
  private latexColorToHex(latexColor: string): string {
    // Convert LaTeX color names to hex values
    const colorMap: { [key: string]: string } = {
      'red': '#ff0000',
      'green': '#00ff00',
      'blue': '#0000ff',
      'yellow': '#ffff00',
      'magenta': '#ff00ff',
      'cyan': '#00ffff',
      'black': '#000000',
      'white': '#ffffff'
    };
    
    return colorMap[latexColor.toLowerCase()] || latexColor;
  }
} 