import { getAllEditor, showMessage } from "siyuan";
import type SharePlugin from "../index";
import { S3UploadService } from "./s3-upload";

/**
 * загрузка
 * ，загрузкафайл S3，ссылка
 */
export class PasteUploadService {
    private plugin: SharePlugin;
    private enabled: boolean = false;
    private s3Service: S3UploadService | null = null;
    private pasteHandler: ((evt: ClipboardEvent) => void) | null = null;
    private processing: boolean = false; // ，избежание/обработка
    private hashCache: Map<string, { url: string; record: any }> = new Map(); //  -> ресурскэш

    constructor(plugin: SharePlugin) {
        this.plugin = plugin;
    }

    /**
     * загрузка
     */
    enable(): void {
        if (this.enabled) return;

        const config = this.plugin.settings.getConfig();
        if (!config.s3.enabled) {
            console.warn("S3 хранение，загрузка");
            return;
        }

        this.s3Service = new S3UploadService(config.s3);
        this.enabled = true;
        this.buildHashCache();

        //  DOM （），избежание
        this.pasteHandler = (evt: ClipboardEvent) => {
            this.handleDOMPaste(evt);
        };
        document.addEventListener("paste", this.pasteHandler, true);

        console.log("загрузка");
    }

    /**
     * отключитьзагрузка
     */
    disable(): void {
        if (!this.enabled) return;
        this.enabled = false;
        this.s3Service = null;

        //  DOM 
        if (this.pasteHandler) {
            document.removeEventListener("paste", this.pasteHandler, true);
            this.pasteHandler = null;
        }
        // очисткакэш
        this.hashCache.clear();

        console.log("загрузкаотключить");
    }

    /**
     * обработка DOM 
     */
    private async handleDOMPaste(evt: ClipboardEvent): Promise<void> {
        if (!this.enabled || !this.s3Service) return;
        if (this.processing) return;

        try {
            const rawTarget = evt.target as (Node | null);
            if (!this.isNodeInsideEditor(rawTarget)) return;

            const clipboardData = evt.clipboardData;
            if (!clipboardData) return;

            const files: File[] = [];
            if (clipboardData.items && clipboardData.items.length > 0) {
                for (let i = 0; i < clipboardData.items.length; i++) {
                    const it = clipboardData.items[i];
                    if (it.kind === "file") {
                        const f = it.getAsFile();
                        if (f) files.push(f);
                    }
                }
            }
            if (files.length === 0 && clipboardData.files) {
                for (let i = 0; i < clipboardData.files.length; i++) {
                    files.push(clipboardData.files[i]);
                }
            }
            if (files.length === 0) return;

            const supportedFiles = files.filter(f => this.isSupportedFile(f));
            if (supportedFiles.length === 0) return;

            evt.preventDefault();
            evt.stopPropagation();
            (evt as any).returnValue = false;

            this.processing = true;
            await this.uploadAndInsertFiles(supportedFiles);
        } catch (e) {
            console.error("обработка DOM Ошибка:", e);
        } finally {
            this.processing = false;
        }
    }

    /**
     * SiYuan... target.closest зависимость
     * поддержка Text/Element/Document/ShadowRoot 
     */
    private isNodeInsideEditor(node: Node | null): boolean {
        if (!node) return false;
        // элемент，
        const isEditorEl = (el: HTMLElement) => (
            el.classList.contains("protyle-wysiwyg") ||
            el.classList.contains("protyle")
        );

        let current: Node | null = node;
        let steps = 0;
        while (current && steps < 200) { // 
            if (current instanceof HTMLElement) {
                if (isEditorEl(current)) return true;
            }
            current = current.parentNode || (current instanceof HTMLElement ? current.closest?.(".protyle, .protyle-wysiwyg") || null : null);
            steps++;
        }
        // ：попыткачерез activeElement （пользователь）
        const active = document.activeElement as HTMLElement | null;
        if (active && (active.closest?.(".protyle-wysiwyg") || active.closest?.(".protyle"))) return true;
        return false;
    }

    /**
     * загрузкафайл
     */
    private async uploadAndInsertFiles(supportedFiles: File[]): Promise<void> {
        if (!this.s3Service) return;
        // категория（ / загрузка）
        const reusedRecords: Array<{ file: File; url: string }> = [];
        const toUpload: Array<{ file: File; hash: string }> = [];
        for (const file of supportedFiles) {
            try {
                const hash = await this.s3Service.calculateFileHashPublic(file);
                const cached = this.hashCache.get(hash);
                if (cached) {
                    reusedRecords.push({ file, url: cached.url });
                    continue;
                }
                const existing = this.plugin.assetRecordManager.findAssetByHash(hash);
                if (existing) {
                    this.hashCache.set(hash, { url: existing.s3Url, record: existing });
                    reusedRecords.push({ file, url: existing.s3Url });
                    continue;
                }
                toUpload.push({ file, hash });
            } catch (e) {
                console.warn("категорияОшибка，метказагрузка", e);
                toUpload.push({ file, hash: "unknown-" + Date.now() });
            }
        }

        // загрузка（） Markdown
        if (toUpload.length === 0) {
            if (reusedRecords.length > 0) {
                showMessage(` ${reusedRecords.length} файл`, 2000, "info");
                await this.insertToEditor(reusedRecords);
            }
            return;
        }

        // ：ссылка，загрузка uploading:// 
        const placeholderLines: string[] = [];
        // 
        if (reusedRecords.length > 0) {
            placeholderLines.push(...this.formatLinks(reusedRecords).split("\n"));
        }
        // загрузка
        for (const item of toUpload) {
            const fileName = item.file.name;
            const isImage = item.file.type.startsWith("image/");
            const proto = `uploading://${item.hash}`;
            placeholderLines.push(isImage ? `![${fileName}](${proto})` : `[${fileName}](${proto})`);
        }
        const placeholderMarkdown = placeholderLines.join("\n");

        // БлокполучениеБлок ID（использование API обеспечениеобновление）
        const placeholderBlockId = await this.insertMarkdownBlockAndGetId(placeholderMarkdown);
        if (!placeholderBlockId) {
            // Ошибка，：загрузкаСовет -> загрузка
            const uploadingMsgFallback = toUpload.length === 1
                ? `Процесс: загрузка ${toUpload[0].file.name}...`
                : `Процесс: загрузка ${toUpload.length} файл...`;
            showMessage(uploadingMsgFallback, 2000, "info");
            const uploadedRecords: Array<{ file: File; url: string }> = [];
            for (const item of toUpload) {
                try {
                    const record = await this.s3Service.uploadFile(
                        item.file,
                        item.file.name,
                        undefined,
                        item.hash.startsWith("unknown-") ? undefined : item.hash
                    );
                    uploadedRecords.push({ file: item.file, url: record.s3Url });
                    this.hashCache.set(record.hash, { url: record.s3Url, record });
                    await this.saveAssetRecord(record);
                } catch (error) {
                    console.error(`загрузкафайлОшибка: ${item.file.name}`, error);
                }
            }
            const insertionRecords = [...reusedRecords, ...uploadedRecords];
            if (insertionRecords.length > 0) {
                await this.insertToEditor(insertionRecords);
                const reuseCount = reusedRecords.length;
                const upCount = uploadedRecords.length;
                if (upCount > 0 && reuseCount > 0) {
                    showMessage(` ${reuseCount} ，Успешнозагрузка ${upCount} `, 2400, "info");
                } else if (upCount > 0) {
                    showMessage(`Успешнозагрузка ${upCount} файл`, 2000, "info");
                }
            }
            return;
        }

        // Успешно，загрузка
        const uploadingMsg = toUpload.length === 1
            ? `Процесс: загрузка ${toUpload[0].file.name}...`
            : `Процесс: загрузка ${toUpload.length} файл...`;
        showMessage(uploadingMsg, 1800, "info");

        // группа（）
        const currentLines = [...placeholderLines];
        // записьзагрузка...（）
        const startUploadIndex = reusedRecords.length;
        let uploadedCount = 0;
        for (let i = 0; i < toUpload.length; i++) {
            const item = toUpload[i];
            const lineIndex = startUploadIndex + i; // 
            try {
                const record = await this.s3Service.uploadFile(
                    item.file,
                    item.file.name,
                    (progress) => {
                        // прогресс，
                        if (progress.status === "uploading" && progress.percentage % 25 === 0) {
                            console.log(`${item.file.name} загрузкапрогресс ${progress.percentage}%`);
                        }
                    },
                    item.hash.startsWith("unknown-") ? undefined : item.hash
                );
                this.hashCache.set(record.hash, { url: record.s3Url, record });
                await this.saveAssetRecord(record);
                // ссылка
                const isImage = item.file.type.startsWith("image/");
                currentLines[lineIndex] = isImage ? `![${item.file.name}](${record.s3Url})` : `[${item.file.name}](${record.s3Url})`;
                uploadedCount++;
            } catch (error) {
                console.error(`загрузкафайлОшибка: ${item.file.name}`, error);
                currentLines[lineIndex] = `загрузкаОшибка: ${item.file.name}`;
            }
            // каждый раззагрузкаобновлениеБлоксодержимое
            await this.updateBlockMarkdown(placeholderBlockId, currentLines.join("\n"));
        }

        // Совет
        if (uploadedCount > 0 && reusedRecords.length > 0) {
            showMessage(` ${reusedRecords.length} ，Успешнозагрузка ${uploadedCount} `, 2400, "info");
        } else if (uploadedCount > 0) {
            showMessage(`Успешнозагрузка ${uploadedCount} файл`, 2000, "info");
        } else {
            showMessage("всезагрузкаОшибка，", 3000, "error");
        }
    }

    /**
     * кэш（Загрузкаресурс）
     */
    private buildHashCache(): void {
        try {
            this.hashCache.clear();
            const mappings = this.plugin.assetRecordManager.getAllMappings();
            for (const m of mappings) {
                for (const a of m.assets) {
                    if (a.hash && a.s3Url && !this.hashCache.has(a.hash)) {
                        this.hashCache.set(a.hash, { url: a.s3Url, record: a });
                    }
                }
            }
            console.log(`загрузкакэш: ${this.hashCache.size} `);
        } catch (e) {
            console.warn("кэшОшибка", e);
        }
    }

    /**
     * проверкаподдержкафайл
     */
    private isSupportedFile(file: File): boolean {
        // поддержка、、документ
        const supportedTypes = [
            "image/",
            "video/",
            "audio/",
            "application/pdf",
            "application/zip",
            "application/x-zip-compressed",
            "text/plain",
            "text/markdown",
        ];

        return supportedTypes.some(type => file.type.startsWith(type));
    }

    /**
     * Сохранитьресурсзапись
     */
    private async saveAssetRecord(record: any): Promise<void> {
        try {
            // использование docId метказагрузкаресурс
            const docId = "paste-upload";
            const shareId = "paste-upload";

            const mapping = this.plugin.assetRecordManager.getMapping(docId);
            if (mapping) {
                // запись
                mapping.assets.push(record);
                mapping.updatedAt = Date.now();
                await this.plugin.assetRecordManager.addOrUpdateMapping(
                    docId,
                    shareId,
                    mapping.assets
                );
            } else {
                // созданиеновыйзапись
                await this.plugin.assetRecordManager.addOrUpdateMapping(
                    docId,
                    shareId,
                    [record]
                );
            }
        } catch (error) {
            console.error("СохранитьресурсзаписьОшибка:", error);
        }
    }

    /**
     * форматссылка Markdown
     */
    private formatLinks(records: Array<{ file: File; url: string }>): string {
        const safeRecords = (records || []).filter(r => r && r.url);
        const toImage = (nameOrUrl: string) => /\.(png|jpe?g|gif|webp|svg)$/i.test(nameOrUrl);
        return safeRecords.map(r => {
            const fileName = r?.file?.name || decodeURIComponent(r.url.split("/").pop() || "file");
            const isImage = r?.file?.type ? r.file.type.startsWith("image/") : toImage(fileName) || toImage(r.url);
            return isImage ? `![${fileName}](${r.url})` : `[${fileName}](${r.url})`;
        }).join("\n");
    }

    /**
     * Копировать
     */
    private async copyToClipboard(text: string): Promise<void> {
        try {
            if (navigator.clipboard && navigator.clipboard.writeText) {
                await navigator.clipboard.writeText(text);
            } else {
                // 
                const textarea = document.createElement("textarea");
                textarea.value = text;
                textarea.style.position = "fixed";
                textarea.style.opacity = "0";
                document.body.appendChild(textarea);
                textarea.select();
                document.execCommand("copy");
                document.body.removeChild(textarea);
            }
        } catch (error) {
            console.error("КопироватьОшибка:", error);
        }
    }

    /**
     * 
     */
    private async insertToEditor(records: Array<{ file: File; url: string }>): Promise<void> {
        try {
            // получениетекущий
            const editors = getAllEditor();
            if (editors.length === 0) return;

            // 
            const activeEditor = editors.find((e: any) => {
                const el = e?.protyle?.element as HTMLElement | null;
                return el && el.contains(document.activeElement);
            }) || editors[0];

            if (!activeEditor?.protyle) return;

            // формат Markdown 
            const markdown = this.formatLinks(records);
            if (!markdown) {
                showMessage("генерациясодержимое，", 3000, "error");
                return;
            }

            // 
            // использованиеэлемент focus  protyle.focus 
            try { (activeEditor.protyle.element as HTMLElement | null)?.focus(); } catch (_) { /* empty */ }
            // 1：попыткаиспользование execCommand  Markdown（парсингобработка）
            let inserted = false;
            try {
                if (document.queryCommandSupported?.("insertText")) {
                    activeEditor.protyle.element?.focus();
                    inserted = document.execCommand("insertText", false, markdown);
                }
            } catch (_) { /* empty */ }

            // 2：текущийБлок markdown Блок（SiYuanядро API）
            if (!inserted) {
                try {
                    const config = this.plugin.settings.getConfig();
                    // получениетекущий rootID，для fallback 
                    const rootID = activeEditor?.protyle?.block?.rootID;
                    const response = await fetch("/api/block/insertBlock", {
                        method: "POST",
                        headers: {
                            "Content-Type": "application/json",
                            "Authorization": `Token ${config.siyuanToken}`,
                        },
                        body: JSON.stringify({
                            dataType: "markdown",
                            data: markdown,
                            parentID: rootID,
                            previousID: "",
                        })
                    });
                    const result = await response.json().catch(() => ({}));
                    if (response.ok && result.code === 0) {
                        inserted = true;
                    }
                } catch (e) {
                    console.warn("через API Ошибка", e);
                }
            }

            // 3：（）
            if (!inserted) {
                try {
                    const sel = window.getSelection();
                    if (sel && sel.rangeCount > 0) {
                        const range = sel.getRangeAt(0);
                        range.deleteContents();
                        range.insertNode(document.createTextNode("\n" + markdown + "\n"));
                        inserted = true;
                    }
                } catch (_) { /* empty */ }
            }

            if (!inserted) {
                showMessage("содержимоеОшибка，", 3000, "error");
            }
        } catch (error) {
            console.error("Ошибка:", error);
        }
    }

    /**
     * черезядро API  Markdown Блок，возвратБлок ID，Ошибкавозврат null
     */
    private async insertMarkdownBlockAndGetId(markdown: string): Promise<string | null> {
        try {
            const editors = getAllEditor();
            if (!editors.length) return null;
            const activeEditor = editors.find((e: any) => {
                const el = e?.protyle?.element as HTMLElement | null;
                return el && el.contains(document.activeElement);
            }) || editors[0];
            const rootID = activeEditor?.protyle?.block?.rootID;
            if (!rootID) return null;
            const config = this.plugin.settings.getConfig();
            const response = await fetch("/api/block/insertBlock", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Token ${config.siyuanToken}`,
                },
                body: JSON.stringify({
                    dataType: "markdown",
                    data: markdown,
                    parentID: rootID,
                    previousID: "",
                    nextID: ""
                })
            });
            const result = await response.json().catch(() => ({}));
            if (response.ok && result.code === 0 && Array.isArray(result.data)) {
                //  insert Действия...d
                for (const opWrap of result.data) {
                    if (opWrap.doOperations) {
                        for (const op of opWrap.doOperations) {
                            if (op.action === "insert" && op.id) {
                                return op.id as string;
                            }
                        }
                    }
                }
            }
            return null;
        } catch (e) {
            console.warn("БлокОшибка", e);
            return null;
        }
    }

    /**
     * обновлениеБлок Markdown содержимое
     */
    private async updateBlockMarkdown(blockId: string, markdown: string): Promise<boolean> {
        try {
            const config = this.plugin.settings.getConfig();
            const response = await fetch("/api/block/updateBlock", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Token ${config.siyuanToken}`,
                },
                body: JSON.stringify({
                    id: blockId,
                    dataType: "markdown",
                    data: markdown
                })
            });
            const result = await response.json().catch(() => ({}));
            if (response.ok && result.code === 0) return true;
            return false;
        } catch (e) {
            console.warn("обновлениеБлокОшибка", e);
            return false;
        }
    }

    /**
     * （длявсезагрузкаОшибка）
     */
    private async insertFallbackText(text: string): Promise<void> {
        try {
            const editors = getAllEditor();
            if (editors.length === 0) return;
            const activeEditor = editors.find((e: any) => {
                const el = e?.protyle?.element as HTMLElement | null;
                return el && el.contains(document.activeElement);
            }) || editors[0];
            if (!activeEditor?.protyle) return;
            try { (activeEditor.protyle.element as HTMLElement | null)?.focus(); } catch (_) { /* empty */ }
            let done = false;
            try {
                if (document.queryCommandSupported?.("insertText")) {
                    activeEditor.protyle.element?.focus();
                    done = document.execCommand("insertText", false, "\n" + text + "\n");
                }
            } catch (_) { /* empty */ }
            if (!done) {
                try {
                    const sel = window.getSelection();
                    if (sel && sel.rangeCount > 0) {
                        const range = sel.getRangeAt(0);
                        range.deleteContents();
                        range.insertNode(document.createTextNode("\n" + text + "\n"));
                        done = true;
                    }
                } catch (_) { /* empty */ }
            }
            if (!done) {
                showMessage("Ошибка，файл", 3000, "error");
            }
        } catch (e) {
            console.warn("Ошибка", e);
        }
    }

    /**
     * проверка
     */
    isEnabled(): boolean {
        return this.enabled;
    }
}
