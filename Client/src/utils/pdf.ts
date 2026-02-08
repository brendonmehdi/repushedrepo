import { jsPDF } from 'jspdf';
import { remark } from 'remark';
import remarkParse from 'remark-parse';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import remarkHtml from 'remark-html';
import DOMPurify from 'dompurify';

export class EmptyMarkdownError extends Error {
    constructor(message = 'No content to download. Add some notes first!') {
        super(message);
        this.name = 'EmptyMarkdownError';
    }
}

// LaTeX to Unicode conversion
const LATEX_TO_UNICODE: Record<string, string> = {
    '\\rightarrow': '→', '\\leftarrow': '←', '\\uparrow': '↑', '\\downarrow': '↓',
    '\\leftrightarrow': '↔', '\\Rightarrow': '⇒', '\\Leftarrow': '⇐', '\\to': '→',
    '\\leq': '≤', '\\geq': '≥', '\\neq': '≠', '\\approx': '≈',
    '\\alpha': 'α', '\\beta': 'β', '\\gamma': 'γ', '\\delta': 'δ',
    '\\theta': 'θ', '\\lambda': 'λ', '\\mu': 'μ', '\\pi': 'π', '\\sigma': 'σ',
    '\\phi': 'φ', '\\omega': 'ω', '\\Sigma': 'Σ', '\\Omega': 'Ω',
    '\\star': '★', '\\square': '□', '\\bullet': '•', '\\circ': '○',
    '\\times': '×', '\\div': '÷', '\\pm': '±', '\\infty': '∞',
    '\\forall': '∀', '\\exists': '∃', '\\in': '∈', '\\sum': 'Σ',
    '\\checkmark': '✓', '\\ldots': '…', '\\degree': '°',
};

function convertLatexToUnicode(text: string): string {
    return text.replace(/\$([^$]+)\$/g, (_, latex) => {
        let result = latex.trim();
        for (const [cmd, unicode] of Object.entries(LATEX_TO_UNICODE)) {
            result = result.replace(new RegExp(cmd.replace(/\\/g, '\\\\'), 'g'), unicode);
        }
        return result.replace(/\\[a-zA-Z]+/g, '').replace(/[{}]/g, '').trim() || latex;
    });
}

async function markdownToHtml(markdown: string): Promise<string> {
    const processed = convertLatexToUnicode(markdown);
    const result = await remark()
        .use(remarkParse)
        .use(remarkGfm)
        .use(remarkMath)
        .use(remarkHtml, { sanitize: false })
        .process(processed);
    return String(result);
}

// PDF Configuration - use points (pt) for everything
const MARGIN = 50;
const FONT_SIZE = {
    H1: 24,
    H2: 18,
    H3: 14,
    H4: 12,
    BODY: 11,
    CODE: 10,
};

function extractText(node: Node, depth = 0): string {
    if (depth > 50) return node.textContent || '';
    if (node.nodeType === Node.TEXT_NODE) return node.textContent || '';
    if (node.nodeType === Node.ELEMENT_NODE) {
        const el = node as Element;
        const tag = el.tagName.toLowerCase();
        if (tag === 'code' && el.parentElement?.tagName.toLowerCase() !== 'pre') {
            return `\`${el.textContent || ''}\``;
        }
        let text = '';
        el.childNodes.forEach(child => { text += extractText(child, depth + 1); });
        return text;
    }
    return '';
}

function renderToPdf(doc: jsPDF, html: string): void {
    const parser = new DOMParser();
    const root = parser.parseFromString(`<div>${html}</div>`, 'text/html').body.firstElementChild;
    if (!root) return;

    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const contentWidth = pageWidth - MARGIN * 2;

    let y = MARGIN;
    let listDepth = 0;
    const listCounters: number[] = [];

    // Check for page break and add new page if needed
    function checkPageBreak(neededHeight: number): void {
        if (y + neededHeight > pageHeight - MARGIN) {
            doc.addPage();
            y = MARGIN;
        }
    }

    // Get line height for font size (1pt = 1.4 line height)
    function getLineHeight(fontSize: number): number {
        return fontSize * 1.4;
    }

    // Add vertical space
    function addSpace(points: number): void {
        y += points;
    }

    // Render a text block with word wrapping
    function renderText(text: string, fontSize: number, options: {
        bold?: boolean;
        italic?: boolean;
        indent?: number;
        prefix?: string;
        color?: [number, number, number];
    } = {}): void {
        const { bold = false, italic = false, indent = 0, prefix = '', color = [0, 0, 0] } = options;

        doc.setFontSize(fontSize);
        const fontStyle = bold ? (italic ? 'bolditalic' : 'bold') : (italic ? 'italic' : 'normal');
        doc.setFont('helvetica', fontStyle);
        doc.setTextColor(color[0], color[1], color[2]);

        const lineHeight = getLineHeight(fontSize);
        const x = MARGIN + indent;
        const availableWidth = contentWidth - indent;

        // Render prefix (bullet/number) if provided
        if (prefix) {
            checkPageBreak(lineHeight);
            doc.text(prefix, x, y);
        }

        // Calculate text start position
        const textIndent = prefix ? 15 : 0;
        const textWidth = availableWidth - textIndent;
        const textX = x + textIndent;

        // Split text into lines that fit width
        const lines = doc.splitTextToSize(text, textWidth);

        for (let i = 0; i < lines.length; i++) {
            checkPageBreak(lineHeight);
            doc.text(lines[i], textX, y);
            y += lineHeight;
        }

        doc.setTextColor(0, 0, 0);
    }

    function processNode(node: Element): void {
        const tag = node.tagName.toLowerCase();
        const indentPerLevel = 20;

        switch (tag) {
            case 'h1': {
                addSpace(20);
                const text = extractText(node).trim();
                if (text) renderText(text, FONT_SIZE.H1, { bold: true });
                addSpace(10);
                break;
            }
            case 'h2': {
                addSpace(16);
                const text = extractText(node).trim();
                if (text) renderText(text, FONT_SIZE.H2, { bold: true });
                addSpace(8);
                break;
            }
            case 'h3': {
                addSpace(12);
                const text = extractText(node).trim();
                if (text) renderText(text, FONT_SIZE.H3, { bold: true });
                addSpace(6);
                break;
            }
            case 'h4':
            case 'h5':
            case 'h6': {
                addSpace(10);
                const text = extractText(node).trim();
                if (text) renderText(text, FONT_SIZE.H4, { bold: true });
                addSpace(4);
                break;
            }
            case 'p': {
                const text = extractText(node).trim();
                if (text) {
                    const indent = listDepth * indentPerLevel;
                    renderText(text, FONT_SIZE.BODY, { indent });
                    addSpace(8);
                }
                break;
            }
            case 'ul':
            case 'ol': {
                listDepth++;
                listCounters.push(0);
                node.childNodes.forEach(child => {
                    if (child.nodeType === Node.ELEMENT_NODE) {
                        processNode(child as Element);
                    }
                });
                listCounters.pop();
                listDepth--;
                if (listDepth === 0) addSpace(6);
                break;
            }
            case 'li': {
                // Increment counter
                listCounters[listCounters.length - 1]++;
                const counter = listCounters[listCounters.length - 1];
                const isOrdered = node.parentElement?.tagName.toLowerCase() === 'ol';

                // Check for task list checkbox
                const checkbox = node.querySelector('input[type="checkbox"]');
                let prefix: string;
                if (checkbox) {
                    prefix = checkbox.hasAttribute('checked') ? '☑' : '☐';
                } else {
                    prefix = isOrdered ? `${counter}.` : '•';
                }

                // Get direct text content (not from nested lists)
                let directText = '';
                node.childNodes.forEach(child => {
                    if (child.nodeType === Node.TEXT_NODE) {
                        directText += child.textContent || '';
                    } else if (child.nodeType === Node.ELEMENT_NODE) {
                        const childTag = (child as Element).tagName.toLowerCase();
                        if (childTag !== 'ul' && childTag !== 'ol') {
                            directText += extractText(child);
                        }
                    }
                });

                const indent = (listDepth - 1) * indentPerLevel;
                if (directText.trim()) {
                    renderText(directText.trim(), FONT_SIZE.BODY, { indent, prefix });
                }

                // Process nested lists
                node.childNodes.forEach(child => {
                    if (child.nodeType === Node.ELEMENT_NODE) {
                        const childTag = (child as Element).tagName.toLowerCase();
                        if (childTag === 'ul' || childTag === 'ol') {
                            processNode(child as Element);
                        }
                    }
                });
                break;
            }
            case 'blockquote': {
                const text = extractText(node).trim();
                if (text) {
                    addSpace(8);
                    const startY = y;
                    renderText(text, FONT_SIZE.BODY, { italic: true, indent: 20, color: [100, 100, 100] });
                    // Draw left border
                    doc.setDrawColor(180, 180, 180);
                    doc.setLineWidth(3);
                    doc.line(MARGIN + 8, startY - 10, MARGIN + 8, y - 5);
                    addSpace(8);
                }
                break;
            }
            case 'pre': {
                const code = node.textContent?.trim() || '';
                if (code) {
                    addSpace(8);
                    const lines = code.split('\n');
                    const lineHeight = getLineHeight(FONT_SIZE.CODE);
                    const blockHeight = lines.length * lineHeight + 20;

                    checkPageBreak(Math.min(blockHeight, 100));

                    // Draw background
                    doc.setFillColor(245, 245, 245);
                    doc.roundedRect(MARGIN, y - 5, contentWidth, blockHeight, 4, 4, 'F');

                    // Draw code
                    doc.setFont('courier', 'normal');
                    doc.setFontSize(FONT_SIZE.CODE);
                    y += 10;

                    for (const line of lines) {
                        checkPageBreak(lineHeight);
                        doc.text(line || ' ', MARGIN + 10, y);
                        y += lineHeight;
                    }

                    y += 10;
                    addSpace(8);
                }
                break;
            }
            case 'table': {
                addSpace(10);
                const rows = Array.from(node.querySelectorAll('tr'));
                if (rows.length === 0) break;

                const cols = rows[0].querySelectorAll('th, td').length || 1;
                const colWidth = contentWidth / cols;
                const rowHeight = getLineHeight(FONT_SIZE.BODY) + 12;

                for (const row of rows) {
                    checkPageBreak(rowHeight);
                    const cells = Array.from(row.querySelectorAll('th, td'));
                    const isHeader = row.querySelector('th') !== null;

                    // Header background
                    if (isHeader) {
                        doc.setFillColor(240, 240, 240);
                        doc.rect(MARGIN, y, contentWidth, rowHeight, 'F');
                    }

                    // Cell text
                    cells.forEach((cell, i) => {
                        doc.setFontSize(FONT_SIZE.BODY);
                        doc.setFont('helvetica', isHeader ? 'bold' : 'normal');
                        const text = extractText(cell).trim();
                        const truncated = doc.splitTextToSize(text, colWidth - 10)[0] || '';
                        doc.text(truncated, MARGIN + i * colWidth + 5, y + rowHeight / 2 + 3);
                    });

                    // Borders
                    doc.setDrawColor(200, 200, 200);
                    doc.setLineWidth(0.5);
                    doc.rect(MARGIN, y, contentWidth, rowHeight);
                    for (let i = 1; i < cols; i++) {
                        doc.line(MARGIN + i * colWidth, y, MARGIN + i * colWidth, y + rowHeight);
                    }

                    y += rowHeight;
                }
                addSpace(10);
                break;
            }
            case 'hr': {
                addSpace(15);
                checkPageBreak(5);
                doc.setDrawColor(200, 200, 200);
                doc.setLineWidth(1);
                doc.line(MARGIN, y, pageWidth - MARGIN, y);
                addSpace(15);
                break;
            }
            default: {
                // Process children for unknown elements
                node.childNodes.forEach(child => {
                    if (child.nodeType === Node.ELEMENT_NODE) {
                        processNode(child as Element);
                    }
                });
            }
        }
    }

    // Process all top-level nodes
    root.childNodes.forEach(child => {
        if (child.nodeType === Node.ELEMENT_NODE) {
            processNode(child as Element);
        }
    });
}

export async function downloadMarkdownAsPdf(
    markdown: string,
    filenamePrefix = 'vibescribe-notes'
): Promise<void> {
    console.log('[PDF] Starting PDF generation...');

    if (!markdown.trim()) {
        throw new EmptyMarkdownError();
    }

    try {
        console.log('[PDF] Converting markdown to HTML...');
        const html = await markdownToHtml(markdown);

        console.log('[PDF] Sanitizing HTML...');
        const clean = DOMPurify.sanitize(html, {
            USE_PROFILES: { html: true },
            ALLOWED_TAGS: ['h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'p', 'br', 'hr', 'ul', 'ol', 'li',
                'blockquote', 'pre', 'code', 'table', 'thead', 'tbody', 'tr', 'th', 'td',
                'a', 'strong', 'em', 'del', 's', 'b', 'i', 'input', 'span', 'div'],
            ALLOWED_ATTR: ['href', 'type', 'checked', 'disabled', 'class']
        });

        console.log('[PDF] Creating PDF document...');
        const doc = new jsPDF({
            unit: 'pt',
            format: 'letter',
            orientation: 'portrait'
        });

        console.log('[PDF] Rendering content...');
        renderToPdf(doc, clean);

        const timestamp = new Date().toISOString().slice(0, 10);
        const filename = `${filenamePrefix}-${timestamp}.pdf`;

        console.log('[PDF] Saving as:', filename);
        doc.save(filename);
        console.log('[PDF] Done!');

    } catch (error) {
        console.error('[PDF] Error:', error);
        throw error;
    }
}
