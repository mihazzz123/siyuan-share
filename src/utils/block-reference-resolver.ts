/**
 * Блокссылкапарсинг
 * получениессылкаБлоксодержимоеобработкассылка
 */

import type { BlockReference, KramdownResponse } from "../types";
import { extractBlockReferences, parseKramdownToMarkdown } from "./kramdown-parser";

/**
 * Блокссылкапарсинг
 */
export interface ResolverOptions {
    siyuanToken: string;
    maxDepth?: number; // ,ссылка
}

/**
 * Блокссылкапарсинг
 */
export class BlockReferenceResolver {
    private siyuanToken: string;
    private maxDepth: number;
    private resolvedBlocks = new Map<string, BlockReference>(); // кэшпарсингБлок
    private resolving = new Set<string>(); // Процесс: парсингБлокID,дляссылка

    constructor(options: ResolverOptions) {
        this.siyuanToken = options.siyuanToken;
        this.maxDepth = options.maxDepth || 5;
    }

    /**
     * получениеБлоксодержимое
     */
    private async getBlockContent(blockId: string): Promise<string | null> {
        try {
            const controller = new AbortController();
            const timeout = setTimeout(() => controller.abort(), 10000);

            const response = await fetch("/api/block/getBlockKramdown", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Token ${this.siyuanToken}`,
                },
                body: JSON.stringify({
                    id: blockId,
                    mode: "md"
                }),
                signal: controller.signal,
            });

            clearTimeout(timeout);

            if (!response.ok) {
                console.error(`получениеБлоксодержимоеОшибка: HTTP ${response.status}`, blockId);
                return null;
            }

            const result: KramdownResponse = await response.json();

            if (result.code !== 0 || !result.data?.kramdown) {
                console.error("БлоксодержимоеAPIвозвратОшибка:", result.msg, blockId);
                return null;
            }

            //  Kramdown  Markdown
            const markdown = parseKramdownToMarkdown(result.data.kramdown);
            return markdown;
        } catch (error) {
            console.error("получениеБлоксодержимоеаномалия:", error, blockId);
            return null;
        }
    }

    /**
     * парсингБлокссылка()
     * @param blockId БлокID
     * @param displayText ()
     * @param depth текущий
     * @returns парсингБлокссылка
     */
    private async resolveBlockRecursive(
        blockId: string,
        displayText?: string,
        depth: number = 0
    ): Promise<BlockReference | null> {
        // проверкакэш
        if (this.resolvedBlocks.has(blockId)) {
            const cached = this.resolvedBlocks.get(blockId)!;
            cached.refCount = (cached.refCount || 0) + 1;
            // еслиновый displayText  и кэш...обновление
            if (displayText && !cached.displayText) {
                cached.displayText = displayText;
            }
            return cached;
        }

        // ссылка
        if (this.resolving.has(blockId)) {
            console.warn("ссылка,:", blockId);
            return null;
        }

        // проверка
        if (depth >= this.maxDepth) {
            console.warn(",:", blockId, depth);
            return null;
        }

        this.resolving.add(blockId);

        try {
            // получениеБлоксодержимое
            const content = await this.getBlockContent(blockId);
            if (!content) {
                return null;
            }

            // извлечениеБлок...ылка
            const refs = extractBlockReferences(content);

            // парсингссылка
            if (refs.length > 0) {
                await Promise.all(
                    refs.map(ref => this.resolveBlockRecursive(ref.blockId, ref.displayText, depth + 1))
                );
            }

            // Блокссылка
            const blockRef: BlockReference = {
                blockId,
                content,
                displayText, // Сохранить
                refCount: 1,
            };

            this.resolvedBlocks.set(blockId, blockRef);
            return blockRef;
        } finally {
            this.resolving.delete(blockId);
        }
    }

    /**
     * парсингдокументсодержимоессылка
     * @param docContent документсодержимое(Kramdown)
     * @returns ссылкаБлокгруппа(зависимость)
     */
    async resolveDocumentReferences(docContent: string): Promise<BlockReference[]> {
        // кэш
        this.resolvedBlocks.clear();
        this.resolving.clear();

        // извлечениедокумент...ссылка
        const directRefs = extractBlockReferences(docContent);

        if (directRefs.length === 0) {
            return [];
        }

        // парсингссылка(ссылка)
        await Promise.all(
            directRefs.map(ref => this.resolveBlockRecursive(ref.blockId, ref.displayText))
        );

        // возвратпарсингБлок(ссылкасортировка,ссылка)
        const allRefs = Array.from(this.resolvedBlocks.values());
        
        // зависимостьсортировка:ссылкаБлок
        allRefs.sort((a, b) => (b.refCount || 0) - (a.refCount || 0));

        console.debug("парсинг:", {
            ссылка: directRefs.length,
            ссылка: allRefs.length,
            ссылкаБлок: allRefs.map(r => ({ id: r.blockId, displayText: r.displayText, refCount: r.refCount }))
        });

        return allRefs;
    }
}
