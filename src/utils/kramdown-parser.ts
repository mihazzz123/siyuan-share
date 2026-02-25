/**
 * Kramdown парсинг
 * SiYuan Kramdown формат Markdown
 */

/**
 * парсингконфигурация（）
 */
export interface ParserOptions {
    /**
     * Блокссылка（）
     */
    preserveBlockRefs?: boolean;
    
    /**
     * парсинг（）
     */
    expandEmbedQueries?: boolean;
}

/**
 * парсинг Kramdown  Markdown
 * @param kramdown Kramdown 
 * @param options парсинг
 * @returns  Markdown 
 */
export function parseKramdownToMarkdown(kramdown: string, options?: ParserOptions): string {
    if (!kramdown || typeof kramdown !== 'string') {
        return '';
    }

    let result = kramdown;

    // 1. очистка IAL Блок {: id="..." ...}
    result = cleanIALAttributes(result);

    // 2. Блокссылка ((id))  или  ((id ""))
    result = convertBlockReferences(result, options?.preserveBlockRefs);

    // 3. очистка {{SELECT ...}}（，）
    result = cleanEmbedQueries(result);

    // 4. очистка
    result = cleanBasicSyntax(result);
    
    // 5. очистка(SiYuan)
    result = cleanFullWidthSpaces(result);

    return result.trim();
}

/**
 * очистка IAL (Inline Attribute List) 
 * 
 * IAL ：
 * 1. : "содержимое\n{: id=\"20210101-abc\" style=\"color:red\"}\n"
 * 2. : "* {: id=\"xxx\"}содержимое"  или  "`кода`{: id=\"xxx\"}"
 * 
 * : "содержимое\n{: id=\"20210101-abc\" style=\"color:red\"}\n"
 * : "содержимое\n"
 */
function cleanIALAttributes(content: string): string {
    let result = content;
    
    // 1. обработка IAL: "* {: id=\"xxx\"}содержимое" → "* содержимое"
    result = result.replace(/^(\s*[-*+]\s+)\{:.*?\}/gm, '$1');
    
    // 2. обработка IAL: "1. {: id=\"xxx\"}содержимое" → "1. содержимое"
    result = result.replace(/^(\s*\d+\.\s+)\{:.*?\}/gm, '$1');
    
    // 3. обработка IAL（кода、ссылка）
    result = result.replace(/\{:\s*[^}]*?\}/g, '');
    
    // 4.  IAL Блок（возможно）
    // ：очисткавозможнопод，обработка
    const ialPattern = /^[ \t]*\{:.*?\}\s*$/gm;
    result = result.replace(ialPattern, '');
    
    // 5. очистка（IAL очисткавозможно）
    // 、
    result = result.replace(/^[ \t\u3000]+$/gm, '');
    
    // 6. очистка（）
    result = result.replace(/\n{3,}/g, '\n\n');
    
    return result;
}

/**
 * Блокссылка
 * формат1: ((20210101-abc))
 * формат2: ((20210101-abc ""))
 * 
 * ：
 * - : ((id "")) → []
 * - : ((id)) → [ссылка]
 * 
 * @param preserveRefs метка（）
 */
function convertBlockReferences(content: string, preserveRefs?: boolean): string {
    // Блокссылка: ((id))  или  ((id "text"))
    // Блок ID формат: 20，yyyyMMddHHmmss-7
    const blockRefPattern = /\(\(([0-9]{14,}-[0-9a-z]{7,})(?:\s+"([^"]+)")?\)\)/g;
    
    return content.replace(blockRefPattern, (match, blockId, displayText) => {
        if (displayText) {
            // ，
            return `[${displayText}]`;
        } else {
            // ，использование
            return '[ссылка]';
        }
        
        // : возможноБлоксодержимое или метка
        // if (preserveRefs) {
        //     return `[block-ref:${blockId}]`;
        // }
    });
}

/**
 * очистка
 * формат: {{SELECT * FROM blocks WHERE ...}}
 * 
 * ：（）
 */
function cleanEmbedQueries(content: string): string {
    // Блок {{...}}（использование [\s\S]  . ）
    const embedPattern = /\{\{[\s\S]+?\}\}/g;
    
    return content.replace(embedPattern, (match) => {
        // запись（）
        console.debug('[Kramdown Parser] Removed embed query:', match.substring(0, 50) + '...');
        return ''; // 
    });
}

/**
 * очистка
 * - возможно YAML front matter
 * - SiYuanданных
 * - очистка
 */
function cleanBasicSyntax(content: string): string {
    const lines = content.split('\n');
    const filteredLines: string[] = [];
    let inFrontMatter = false;
    
    for (let i = 0; i < lines.length; i++) {
        const trimmed = lines[i].trim();
        
        // YAML front matter 
        if (trimmed === '---') {
            if (i === 0 || (i === 1 && !filteredLines.length)) {
                inFrontMatter = true;
                continue;
            } else if (inFrontMatter) {
                inFrontMatter = false;
                continue;
            }
        }
        
        if (inFrontMatter) {
            continue;
        }
        
        // данных
        if (trimmed.startsWith('title:') || 
            trimmed.startsWith('date:') || 
            trimmed.startsWith('lastmod:') ||
            trimmed.startsWith('updated:')) {
            continue;
        }
        
        filteredLines.push(lines[i]);
    }
    
    return filteredLines.join('\n');
}

/**
 * очистка
 * SiYuanподиспользование(U+3000) или 
 *  или 
 */
function cleanFullWidthSpaces(content: string): string {
    // : 　 (U+3000)
    // :
    // 1. ()
    // 2. Удалить
    // 3. ...
    
    const lines = content.split('\n');
    const processedLines = lines.map(line => {
        // ,Удалить
        if (/^[\u3000]+$/.test(line)) {
            return '';
        }
        
        // ()
        // : "　　" → "  "
        line = line.replace(/^[\u3000]+/, (match) => ' '.repeat(match.length));
        
        // Удалить
        line = line.replace(/[\u3000]+$/, '');
        
        // 
        line = line.replace(/[\u3000]+/g, ' ');
        
        return line;
    });
    
    return processedLines.join('\n');
}

/**
 * извлечениедокумент...Блокссылка ID
 * @param content Kramdown  или  Markdown содержимое
 * @returns Блокссылка ID группа()
 */
export function extractBlockReferences(content: string): Array<{ blockId: string; displayText?: string }> {
    if (!content || typeof content !== 'string') {
        return [];
    }

    const blockRefPattern = /\(\(([0-9]{14,}-[0-9a-z]{7,})(?:\s+["']([^"']+)["'])?\)\)/g;
    const refs: Array<{ blockId: string; displayText?: string }> = [];
    const seen = new Set<string>();

    let match: RegExpExecArray | null;
    while ((match = blockRefPattern.exec(content)) !== null) {
        const blockId = match[1];
        const displayText = match[2];
        
        if (!seen.has(blockId)) {
            seen.add(blockId);
            refs.push({ blockId, displayText });
        }
    }

    return refs;
}

/**
 * парсингБлокссылкаполучениесодержимое(интерфейс)
 * доступноБлоксодержимоессылка
 * 
 * @param blockId Блок ID
 * @returns Блоксодержимое или  null
 */
export async function resolveBlockRef(blockId: string): Promise<string | null> {
    // TODO:  /api/block/getBlockKramdown получениеБлоксодержимое
    //  или использование /api/query/sql Блок
    console.warn('[Kramdown Parser] resolveBlockRef not implemented yet:', blockId);
    return null;
}
