import type SharePlugin from "../index";
import type { ShareRecord } from "../types";

export class ShareRecordManager {
    private plugin: SharePlugin;
    private records: ShareRecord[] = [];
    private syncInterval: number = 5 * 60 * 1000; //  5 
    private syncTimer: number | null = null;
    private syncing = false;

    constructor(plugin: SharePlugin) {
        this.plugin = plugin;
    }

    /**
     * Загрузкаподелитьсязапись
     */
    async load(): Promise<void> {
        // 1. Загрузкалокальныйкэш
        const localRecords = await this.plugin.loadData("share-records");
        if (localRecords && Array.isArray(localRecords)) {
            this.records = localRecords;
        }

        // 2. 
        await this.syncFromBackend();
    }

    /**
     * поделитьсязапись
     */
    async syncFromBackend(): Promise<void> {
        if (this.syncing) return; // 
        this.syncing = true;
        const config = this.plugin.settings.getConfig();

        // есликонфигурация，
        if (!config.serverUrl || !config.apiToken) {
            return;
        }

        try {
            const backendRecords = await this.fetchBackendRecords(config.serverUrl, config.apiToken);
            
            // локальныйзапись，
            this.mergeRecords(backendRecords);
            
            // Сохранитьлокальный
            await this.saveToLocal();
        } catch (error) {
            console.error("Sync from backend failed:", error);
            // Ошибкаиспользованиелокальныйкэш
        } finally {
            this.syncing = false;
        }
    }

    /**
     * получениеподелитьсязапись
     */
    getRecords(): ShareRecord[] {
        return [...this.records];
    }

    /**
     * документ ID получениеподелитьсязапись
     */
    getRecordByDocId(docId: string): ShareRecord | null {
        return this.records.find(r => r.docId === docId) || null;
    }

    /**
     * принудительнодокументактуальныйподелитьсязапись（зависимостьлокальныйкэш）
     * - ，обновлениелокальныйкэшвозврат
     * - ，локальныйдокументзапись（считаетсяУдалить или ）
     * - конфигурацияоткатлокальныйкэш
     */
    async fetchRecordByDocId(docId: string): Promise<ShareRecord | null> {
        const config = this.plugin.settings.getConfig();
        if (!config.serverUrl || !config.apiToken) {
            return this.getRecordByDocId(docId);
        }

        const base = config.serverUrl.replace(/\/$/, "");
        let page = 1;
        const size = 50; // ，
        let total = 0;
        let found: ShareRecord | null = null;
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 12_000);
        try {
            while (true) {
                const resp = await fetch(`${base}/api/share/list?page=${page}&size=${size}` , {
                    method: "GET",
                    headers: {
                        "Authorization": `Bearer ${config.apiToken}`,
                        "X-Base-URL": base,
                    },
                    signal: controller.signal,
                });
                if (!resp.ok) {
                    // Ошибка，возвратлокальныйзапись
                    break;
                }
                const result = await resp.json();
                if (result.code !== 0) {
                    // возвратОшибка，
                    break;
                }
                total = result.data?.total || 0;
                const items = (result.data?.items || []) as any[];
                for (const it of items) {
                    if (it.docId === docId) {
                        found = {
                            id: it.id,
                            docId: it.docId,
                            docTitle: it.docTitle,
                            shareUrl: it.shareUrl,
                            requirePassword: it.requirePassword,
                            expireAt: new Date(it.expireAt).getTime(),
                            isPublic: it.isPublic,
                            createdAt: new Date(it.createdAt).getTime(),
                            updatedAt: new Date(it.createdAt).getTime(),
                            viewCount: it.viewCount,
                        };
                        break;
                    }
                }
                if (found) {
                    break;
                }
                //  и  -> 
                if (items.length === 0 || page * size >= total || total === 0) {
                    break;
                }
                page++;
            }
        } catch (e) {
            //  или Ошибка，откатлокальныйзапись
        } finally {
            clearTimeout(timeout);
        }

        if (found) {
            // обновление/локальныйкэшзапись
            const idxByDoc = this.records.findIndex(r => r.docId === docId);
            if (idxByDoc >= 0) {
                this.records[idxByDoc] = found;
            } else {
                //  shareId запись（）
                const idxById = this.records.findIndex(r => r.id === found!.id);
                if (idxById >= 0) {
                    this.records[idxById] = found;
                } else {
                    this.records.push(found);
                }
            }
            await this.saveToLocal();
            return found;
        } else {
            // Удалитьлокальныйдокументзапись（избежание или Удалитьссылка）
            const beforeLen = this.records.length;
            this.records = this.records.filter(r => r.docId !== docId);
            if (this.records.length !== beforeLen) {
                await this.saveToLocal();
            }
            return null;
        }
    }

    /**
     * поделитьсязапись
     */
    async addRecord(record: ShareRecord): Promise<void> {
        // существуетдокументзапись，
        const docIndex = this.records.findIndex(r => r.docId === record.docId);
        if (docIndex >= 0) {
            this.records.splice(docIndex, 1);
        }

        // проверка ID запись
        const existingIndex = this.records.findIndex(r => r.id === record.id);
        if (existingIndex >= 0) {
            this.records[existingIndex] = record;
        } else {
            this.records.push(record);
        }

        await this.saveToLocal();
    }

    /**
     * Удаление публикациизапись
     */
    async removeRecord(shareId: string): Promise<void> {
        this.records = this.records.filter(r => r.id !== shareId);
        await this.saveToLocal();
    }

    /**
     * Удаление публикациизапись
     */
    async removeRecords(shareIds: string[]): Promise<void> {
        if (!shareIds.length) {
            return;
        }
        const idSet = new Set(shareIds);
        this.records = this.records.filter(r => !idSet.has(r.id));
        await this.saveToLocal();
    }

    /**
     * поделитьсязапись
     */
    async clearAll(): Promise<void> {
        this.records = [];
        await this.saveToLocal();
    }

    /**
     * очистказапись
     */
    async cleanExpiredRecords(): Promise<void> {
        const now = Date.now();
        this.records = this.records.filter(r => r.expireAt > now);
        await this.saveToLocal();
    }

    /**
     * 
     */
    startAutoSync(): void {
        if (this.syncTimer) {
            return;
        }
        // （，избежание）
        const isMobile = (this.plugin as any).isMobile === true;
        const base = isMobile ? this.syncInterval * 3 : this.syncInterval;
        const jitter = Math.floor(Math.random() * 30_000); // ±30s 
        const interval = base + jitter;

        // ，избежание
        const startDelay = 3_000 + Math.floor(Math.random() * 2_000);
        setTimeout(() => {
            this.syncFromBackend().catch(err => console.error("Auto sync (initial) failed:", err));
        }, startDelay);

        this.syncTimer = setInterval(() => {
            this.syncFromBackend().catch(err => {
                console.error("Auto sync failed:", err);
            });
        }, interval);
    }

    /**
     * 
     */
    stopAutoSync(): void {
        if (this.syncTimer) {
            clearInterval(this.syncTimer);
            this.syncTimer = null;
        }
    }

    /**
     * Сохранитьлокальный
     */
    private async saveToLocal(): Promise<void> {
        await this.plugin.saveData("share-records", this.records);
    }

    /**
     * получениеподелитьсязапись（）
     */
    private async fetchBackendRecords(serverUrl: string, apiToken: string): Promise<ShareRecord[]> {
        const base = serverUrl.replace(/\/$/, "");
        try {
            // ，всеполучение или （ 1000 ）
            const all: ShareRecord[] = [];
            let page = 1;
            const size = 100; // ，
            const controller = new AbortController();
            const timeout = setTimeout(() => controller.abort(), 15_000);
            while (true) {
                const resp = await fetch(`${base}/api/share/list?page=${page}&size=${size}`, {
                    method: "GET",
                    headers: {
                        "Authorization": `Bearer ${apiToken}`,
                        "X-Base-URL": base,
                    },
                    signal: controller.signal,
                });
                if (!resp.ok) {
                    throw new Error(`HTTP ${resp.status}: ${resp.statusText}`);
                }
                const result = await resp.json();
                if (result.code !== 0) {
                    throw new Error(result.msg || "API error");
                }
                const items = (result.data?.items || []) as any[];
                //  ShareRecord（отсутствуетсодержимое，черезлокальныйструктура）
                for (const it of items) {
                    all.push({
                        id: it.id,
                        docId: it.docId,
                        docTitle: it.docTitle,
                        shareUrl: it.shareUrl,
                        requirePassword: it.requirePassword,
                        expireAt: new Date(it.expireAt).getTime(),
                        isPublic: it.isPublic,
                        createdAt: new Date(it.createdAt).getTime(),
                        updatedAt: new Date(it.createdAt).getTime(),
                    });
                }
                const total = result.data?.total || 0;
                if (all.length >= total || all.length >= 1000 || items.length === 0) {
                    break;
                }
                page++;
            }
            clearTimeout(timeout);
            return all;
        } catch (error: any) {
            throw new Error("Network request failed: " + (error?.message || String(error)));
        }
    }

    /**
     * локальныйзапись
     */
    private mergeRecords(backendRecords: ShareRecord[]): void {
        if (backendRecords.length === 0) {
            // данных，локальный
            return;
        }

        // созданиезапись
        const backendMap = new Map<string, ShareRecord>();
        backendRecords.forEach(record => {
            backendMap.set(record.id, record);
        });

        // ：，локальныйзапись
        const mergedRecords: ShareRecord[] = [];

        // запись
        backendRecords.forEach(record => {
            mergedRecords.push(record);
        });

        // локальныйзапись（возможносоздание）
        this.records.forEach(localRecord => {
            if (!backendMap.has(localRecord.id)) {
                // проверкасоздание（5）
                if (Date.now() - localRecord.createdAt < 5 * 60 * 1000) {
                    mergedRecords.push(localRecord);
                }
            }
        });

        this.records = mergedRecords;
    }
}
