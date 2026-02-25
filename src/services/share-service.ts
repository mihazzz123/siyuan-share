import { showMessage } from "siyuan";
import type SharePlugin from "../index";
import type { AssetUploadRecord, BatchDeleteShareResponse, BlockReference, KramdownResponse, ShareOptions, ShareRecord, ShareResponse, UploadProgressCallback } from "../types";
import { BlockReferenceResolver } from "../utils/block-reference-resolver";
import { parseKramdownToMarkdown } from "../utils/kramdown-parser";
import { S3UploadService } from "./s3-upload";

export class ShareService {
    private plugin: SharePlugin;
    // содержимоекэш：，избежаниевременидокумент
    private contentCache = new Map<string, { content: string; ts: number }>();
    private contentPromiseCache = new Map<string, Promise<string | null>>();

    constructor(plugin: SharePlugin) {
        this.plugin = plugin;
    }

    /**
     * Создание публикации
     */
    async createShare(
        options: ShareOptions, 
        onUploadProgress?: UploadProgressCallback
    ): Promise<ShareRecord> {
        const config = this.plugin.settings.getConfig();

        // проверкаконфигурация
        if (!config.serverUrl || !config.apiToken) {
            throw new Error(this.plugin.i18n.shareErrorNotConfigured);
        }

        if (!config.siyuanToken) {
            throw new Error(this.plugin.i18n.shareErrorSiyuanTokenMissing || "конфигурацияSiYuanядро Token");
        }

        // 1. документсодержимоессылкаБлок
        const { content, references } = await this.exportDocContentWithRefs(options.docId);
        if (!content) {
            throw new Error(this.plugin.i18n.shareErrorExportFailed);
        }

        // 2. обработкаресурсзагрузка（если S3）
        let processedContent = content;
        let uploadedAssets: AssetUploadRecord[] = [];
        
        if (config.s3.enabled) {
            try {
                const result = await this.processAndUploadAssets(
                    content, 
                    options.docId,
                    onUploadProgress
                );
                processedContent = result.content;
                uploadedAssets = result.assets;
            } catch (error) {
                console.error("ресурсзагрузкаОшибка:", error);
                showMessage(
                    this.plugin.i18n.uploadAssetsFailed || "ресурсзагрузкаОшибка，использованиесодержимое",
                    4000,
                    "error"
                );
                // использованиесодержимое，...
            }
        }

        // 3. данных
        const payload = {
            docId: options.docId,
            docTitle: options.docTitle,
            content: processedContent,
            requirePassword: options.requirePassword,
            password: options.requirePassword ? options.password ?? "" : "",
            expireDays: options.expireDays,
            isPublic: options.isPublic,
            references: references, // Информация о ссылаемом блоке
            assets: uploadedAssets, // загрузкаресурс
        };

        // 4.  API
        try {
            const response = await this.callShareAPI(config.serverUrl, config.apiToken, payload);
            
            if (response.code !== 0) {
                throw new Error(response.msg || this.plugin.i18n.shareErrorUnknown);
            }

            // 5. Сохранитьподелитьсязаписьлокальный
            const shareData = response.data;
            const record: ShareRecord = {
                id: shareData.shareId,
                docId: shareData.docId || options.docId,
                docTitle: shareData.docTitle || options.docTitle,
                shareUrl: shareData.shareUrl,
                requirePassword: shareData.requirePassword,
                expireAt: new Date(shareData.expireAt).getTime(),
                isPublic: shareData.isPublic,
                createdAt: new Date(shareData.createdAt).getTime(),
                updatedAt: new Date(shareData.updatedAt).getTime(),
                reused: shareData.reused,
            };

            await this.plugin.shareRecordManager.addRecord(record);

            // 6. Сохранитьресурсзаписьлокальный
            if (uploadedAssets.length > 0) {
                await this.plugin.assetRecordManager.addOrUpdateMapping(
                    options.docId,
                    shareData.shareId,
                    uploadedAssets
                );
            }

            return record;
        } catch (error) {
            console.error("Share creation failed:", error);
            throw error;
        }
    }

    /**
     * документсодержимоессылкаБлок(использование Kramdown )
     * @returns документсодержимоессылкаБлок
     */
    private async exportDocContentWithRefs(docId: string): Promise<{ content: string; references: BlockReference[] }> {
        const config = this.plugin.settings.getConfig();
        
        try {
            // 1. получениедокумент Kramdown содержимое
            const controller = new AbortController();
            const timeout = setTimeout(() => controller.abort(), 20_000);
            
            const response = await fetch("/api/block/getBlockKramdown", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Token ${config.siyuanToken}`,
                },
                body: JSON.stringify({ 
                    id: docId,
                    mode: "md"
                }),
                signal: controller.signal,
            });
            
            clearTimeout(timeout);

            if (!response.ok) {
                const errorMsg = `Kramdown API Ошибка: HTTP ${response.status} ${response.statusText}`;
                console.error(errorMsg);
                showMessage(this.plugin.i18n.kramdownApiFailed, 4000, "error");
                return { content: "", references: [] };
            }

            const result: KramdownResponse = await response.json();
            
            if (result.code !== 0) {
                const errorMsg = `Kramdown API возвратОшибка: ${result.msg || 'Неизвестная ошибка'}`;
                console.error(errorMsg, { docId, code: result.code });
                showMessage(this.plugin.i18n.kramdownApiFailed, 4000, "error");
                return { content: "", references: [] };
            }
            
            if (!result.data || !result.data.kramdown) {
                console.error("Kramdown API возвратданных", { docId, data: result.data });
                showMessage(this.plugin.i18n.kramdownApiFailed, 4000, "error");
                return { content: "", references: [] };
            }

            const kramdownContent = result.data.kramdown;

            // 2. парсингдокумент...ссылкаБлок
            const resolver = new BlockReferenceResolver({
                siyuanToken: config.siyuanToken,
                maxDepth: 5,
            });

            const references = await resolver.resolveDocumentReferences(kramdownContent);

            console.debug("документссылкапарсинг:", {
                docId,
                ссылкаБлок: references.length,
                ссылкаБлокID: references.map(r => r.blockId),
            });

            // 3.  Kramdown  Markdown
            const markdown = parseKramdownToMarkdown(kramdownContent);
            
            if (!markdown) {
                console.error("Kramdown парсинг", { docId, kramdownLength: kramdownContent.length });
                showMessage(this.plugin.i18n.kramdownParseError, 4000, "error");
                return { content: "", references: [] };
            }

            return { content: markdown, references };
        } catch (error) {
            console.error("документаномалия:", error, { docId });
            
            if (error instanceof Error) {
                if (error.name === 'AbortError') {
                    showMessage(this.plugin.i18n.kramdownTimeout, 4000, "error");
                } else {
                    showMessage(this.plugin.i18n.kramdownApiFailed + ": " + error.message, 4000, "error");
                }
            } else {
                showMessage(this.plugin.i18n.shareErrorUnknown, 4000, "error");
            }
            
            return { content: "", references: [] };
        }
    }

    /**
     * документсодержимое(использование Kramdown ) - ,для
     */
    private async exportDocContent(docId: string): Promise<string | null> {
        // кэш...s）
        const cached = this.contentCache.get(docId);
        if (cached && Date.now() - cached.ts < 60_000) {
            return cached.content;
        }
        const inflight = this.contentPromiseCache.get(docId);
        if (inflight) return inflight;

        const p = (async (): Promise<string | null> => {
        const config = this.plugin.settings.getConfig();
        
        try {
            // использованиеSiYuanядро Token  Kramdown API
            const controller = new AbortController();
            const timeout = setTimeout(() => controller.abort(), 20_000);
            
            const response = await fetch("/api/block/getBlockKramdown", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Token ${config.siyuanToken}`,
                },
                body: JSON.stringify({ 
                    id: docId,
                    mode: "md" // использование md тема，ссылка URL 
                }),
                signal: controller.signal,
            });
            
            clearTimeout(timeout);

            if (!response.ok) {
                const errorMsg = `Kramdown API Ошибка: HTTP ${response.status} ${response.statusText}`;
                console.error(errorMsg);
                showMessage(this.plugin.i18n.kramdownApiFailed, 4000, "error");
                return null;
            }

            const result: KramdownResponse = await response.json();
            
            if (result.code !== 0) {
                const errorMsg = `Kramdown API возвратОшибка: ${result.msg || 'Неизвестная ошибка'}`;
                console.error(errorMsg, { docId, code: result.code });
                showMessage(this.plugin.i18n.kramdownApiFailed, 4000, "error");
                return null;
            }
            
            if (!result.data || !result.data.kramdown) {
                console.error("Kramdown API возвратданных", { docId, data: result.data });
                showMessage(this.plugin.i18n.kramdownApiFailed, 4000, "error");
                return null;
            }

            // использованиепарсинг Kramdown  Markdown
            try {
                const markdown = parseKramdownToMarkdown(result.data.kramdown);
                
                if (!markdown) {
                    console.error("Kramdown парсинг", { docId, kramdownLength: result.data.kramdown.length });
                    showMessage(this.plugin.i18n.kramdownParseError, 4000, "error");
                    return null;
                }
                
                // кэшсодержимое
                this.contentCache.set(docId, { content: markdown, ts: Date.now() });
                console.debug("документУспешно", { 
                    docId, 
                    kramdownLength: result.data.kramdown.length,
                    markdownLength: markdown.length 
                });
                
                return markdown;
            } catch (parseError) {
                console.error("Kramdown парсингОшибка:", parseError, { 
                    docId, 
                    kramdownPreview: result.data.kramdown.substring(0, 200) 
                });
                showMessage(this.plugin.i18n.kramdownParseError, 4000, "error");
                return null;
            }
        } catch (error) {
            // Ошибка или 
            console.error("документаномалия:", error, { docId });
            
            if (error instanceof Error) {
                if (error.name === 'AbortError') {
                    showMessage(this.plugin.i18n.kramdownTimeout, 4000, "error");
                } else {
                    showMessage(this.plugin.i18n.kramdownApiFailed + ": " + error.message, 4000, "error");
                }
            } else {
                showMessage(this.plugin.i18n.shareErrorUnknown, 4000, "error");
            }
            
            return null;
        } finally {
            this.contentPromiseCache.delete(docId);
        }
        })();

        this.contentPromiseCache.set(docId, p);
        return p;
    }



    /**
     * поделиться API
     */
    private async callShareAPI(serverUrl: string, apiToken: string, payload: any): Promise<ShareResponse> {
        const base = serverUrl.replace(/\/$/, "");
        try {
            const response = await fetch(`${base}/api/share/create`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${apiToken}`,
                    //  Base URL（，）
                    "X-Base-URL": base,
                },
                body: JSON.stringify(payload),
            });

            if (!response.ok) {
                const errorText = await response.text().catch(() => response.statusText);
                throw new Error(`HTTP ${response.status}: ${errorText}`);
            }

            const result = await response.json();
            return result as ShareResponse;
        } catch (error: any) {
            console.error("API call failed:", error);
            if (error.message) {
                throw new Error(this.plugin.i18n.shareErrorNetworkFailed + ": " + error.message);
            }
            throw new Error(this.plugin.i18n.shareErrorNetworkFailed + ": " + String(error));
        }
    }

    /**
     * Удаление публикации
     */
    async deleteShare(shareId: string): Promise<void> {
        const config = this.plugin.settings.getConfig();

        if (!config.serverUrl || !config.apiToken) {
            throw new Error(this.plugin.i18n.shareErrorNotConfigured);
        }

        const base = config.serverUrl.replace(/\/$/, "");
        //  API Удаление публикации
        const resp = await fetch(`${base}/api/share/${encodeURIComponent(shareId)}`, {
            method: "DELETE",
            headers: {
                "Authorization": `Bearer ${config.apiToken}`,
            },
        });
        if (!resp.ok) {
            if (resp.status === 404) {
                await this.plugin.shareRecordManager.removeRecord(shareId);
                return;
            }
            const text = await resp.text();
            console.error("Delete share failed:", resp.status, text);
            throw new Error(this.plugin.i18n.shareErrorNetworkFailed + `: HTTP ${resp.status}`);
        }

        // локальныйзапись...лить
        await this.plugin.shareRecordManager.removeRecord(shareId);
    }

    /**
     * Удаление публикации（ shareIds Удалить，иначеУдалитьвсе）
     */
    async deleteShares(shareIds?: string[]): Promise<BatchDeleteShareResponse["data"]> {
        const config = this.plugin.settings.getConfig();

        if (!config.serverUrl || !config.apiToken) {
            throw new Error(this.plugin.i18n.shareErrorNotConfigured);
        }

        const base = config.serverUrl.replace(/\/$/, "");

        const response = await fetch(`${base}/api/share/batch`, {
            method: "DELETE",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${config.apiToken}`,
            },
            body: shareIds ? JSON.stringify({ shareIds }) : JSON.stringify({ shareIds: [] }),
        });

        if (!response.ok) {
            const text = await response.text().catch(() => response.statusText);
            throw new Error(this.plugin.i18n.shareErrorNetworkFailed + `: HTTP ${response.status} ${text}`);
        }

        const result = (await response.json()) as BatchDeleteShareResponse;
        if (result.code !== 0) {
            throw new Error(result.msg || this.plugin.i18n.shareErrorUnknown);
        }

        const data = result.data || {};
        if (shareIds && shareIds.length) {
            const deleted = data.deleted ?? [];
            const notFound = data.notFound ?? [];
            const toRemove = [...deleted, ...notFound];
            if (toRemove.length) {
                await this.plugin.shareRecordManager.removeRecords(toRemove);
            }
        } else {
            await this.plugin.shareRecordManager.clearAll();
        }

        return data;
    }

    /**
     * обработкадокумент...загрузка S3
    /**
     * обработкадокумент...загрузка S3
     * @param content Markdown содержимое
     * @param docId документID
     * @param onProgress загрузкапрогресс
     * @returns обработкасодержимоезагрузказапись
     */
    private async processAndUploadAssets(
        content: string,
        docId: string,
        onProgress?: UploadProgressCallback
    ): Promise<{ content: string; assets: AssetUploadRecord[] }> {
        const config = this.plugin.settings.getConfig();
        const s3Service = new S3UploadService(config.s3);
        const uploadedAssets: AssetUploadRecord[] = [];

        // извлечениересурсссылка
        const assetPaths = this.extractAssetPaths(content);
        
        if (assetPaths.length === 0) {
            return { content, assets: [] };
        }

        console.log(` ${assetPaths.length} ресурсобработка`);

        // получениересурсфайлзагрузка
        const filesToUpload: Array<{ file: File; localPath: string; originalUrl: string }> = [];

        for (const assetPath of assetPaths) {
            try {
                // проверказагрузка（）
                const existingAsset = this.plugin.assetRecordManager.findAssetByLocalPath(assetPath);
                if (existingAsset) {
                    console.log(`ресурссуществует，загрузка: ${assetPath}`);
                    uploadedAssets.push(existingAsset);
                    continue;
                }

                // получениефайл
                const file = await this.fetchAssetFile(assetPath);
                if (file) {
                    filesToUpload.push({ file, localPath: assetPath, originalUrl: assetPath });
                }
            } catch (error) {
                console.error(`получениересурсфайлОшибка: ${assetPath}`, error);
            }
        }

        // загрузка
        if (filesToUpload.length > 0) {
            const uploaded = await s3Service.uploadFiles(
                filesToUpload.map(({ file, localPath }) => ({ file, localPath })),
                onProgress
            );
            uploadedAssets.push(...uploaded);
        }

        // содержимое...ссылка
        let processedContent = content;
        for (const asset of uploadedAssets) {
            //  Markdown ссылка
            const imagePattern = new RegExp(
                `!\\[([^\\]]*)\\]\\(${this.escapeRegex(asset.localPath)}\\)`,
                'g'
            );
            processedContent = processedContent.replace(imagePattern, `![$1](${asset.s3Url})`);

            // ссылка
            const linkPattern = new RegExp(
                `\\[([^\\]]*)\\]\\(${this.escapeRegex(asset.localPath)}\\)`,
                'g'
            );
            processedContent = processedContent.replace(linkPattern, `[$1](${asset.s3Url})`);

            //  URL ссылка
            const urlPattern = new RegExp(this.escapeRegex(asset.localPath), 'g');
            processedContent = processedContent.replace(urlPattern, asset.s3Url);
        }

        return { content: processedContent, assets: uploadedAssets };
    }

    /**
     *  Markdown содержимое...путь
     */
    private extractAssetPaths(content: string): string[] {
        const paths = new Set<string>();

        //  Markdown ：![alt](path)
        const imageRegex = /!\[([^\]]*)\]\(([^)]+)\)/g;
        let match;
        while ((match = imageRegex.exec(content)) !== null) {
            const path = match[2];
            if (this.isLocalAsset(path)) {
                paths.add(path);
            }
        }

        //  Markdown ссылка：[text](path)
        const linkRegex = /\[([^\]]*)\]\(([^)]+)\)/g;
        while ((match = linkRegex.exec(content)) !== null) {
            const path = match[2];
            if (this.isLocalAsset(path)) {
                paths.add(path);
            }
        }

        //  HTML img метка
        const htmlImgRegex = /<img[^>]+src=["']([^"']+)["']/g;
        while ((match = htmlImgRegex.exec(content)) !== null) {
            const path = match[1];
            if (this.isLocalAsset(path)) {
                paths.add(path);
            }
        }

        return Array.from(paths);
    }

    /**
     * локальныйресурс
     */
    private isLocalAsset(path: string): boolean {
        // исключениессылка
        if (path.startsWith('http://') || path.startsWith('https://')) {
            return false;
        }
        // исключение data URI
        if (path.startsWith('data:')) {
            return false;
        }
        // локальныйресурс assets/  или  / 
        return path.startsWith('assets/') || path.startsWith('/assets/');
    }

    /**
     * получениересурсфайл
     */
    private async fetchAssetFile(assetPath: string): Promise<File | null> {
        const config = this.plugin.settings.getConfig();

        try {
            //  API путь
            let apiPath = assetPath;
            if (!apiPath.startsWith('/')) {
                apiPath = '/' + apiPath;
            }

            const response = await fetch(apiPath, {
                method: 'GET',
                headers: {
                    'Authorization': `Token ${config.siyuanToken}`,
                },
            });

            if (!response.ok) {
                console.error(`получениересурсОшибка: ${assetPath}, HTTP ${response.status}`);
                return null;
            }

            const blob = await response.blob();
            const filename = assetPath.split('/').pop() || 'asset';
            return new File([blob], filename, { type: blob.type });
        } catch (error) {
            console.error(`получениересурсаномалия: ${assetPath}`, error);
            return null;
        }
    }

    /**
     * 
     */
    private escapeRegex(str: string): string {
        return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    }
}
