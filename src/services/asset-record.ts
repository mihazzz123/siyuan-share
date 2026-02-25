import type SharePlugin from "../index";
import type { AssetUploadRecord, DocAssetMapping } from "../types";

const STORAGE_KEY = "asset-mappings";

/**
 * ресурсзагрузказаписьуправление
 * управлениедокумент S3 ресурс
 */
export class AssetRecordManager {
    private plugin: SharePlugin;
    private mappings: Map<string, DocAssetMapping>; // docId -> DocAssetMapping

    constructor(plugin: SharePlugin) {
        this.plugin = plugin;
        this.mappings = new Map();
    }

    /**
     * Загрузкалокальныйхранениезапись
     */
    async load(): Promise<void> {
        const data = await this.plugin.loadData(STORAGE_KEY);
        if (data && Array.isArray(data)) {
            data.forEach((mapping: DocAssetMapping) => {
                this.mappings.set(mapping.docId, mapping);
            });
        }
    }

    /**
     * Сохранитьзаписьлокальныйхранение
     */
    async save(): Promise<void> {
        const data = Array.from(this.mappings.values());
        await this.plugin.saveData(STORAGE_KEY, data);
    }

    /**
     *  или обновлениедокументресурс
     * @param docId документID
     * @param shareId поделитьсяID
     * @param assets ресурсзапись
     */
    async addOrUpdateMapping(
        docId: string,
        shareId: string,
        assets: AssetUploadRecord[]
    ): Promise<void> {
        const now = Date.now();
        const existing = this.mappings.get(docId);

        if (existing) {
            // обновлениезапись
            existing.shareId = shareId;
            existing.assets = assets;
            existing.updatedAt = now;
        } else {
            // созданиеновыйзапись
            const mapping: DocAssetMapping = {
                docId,
                shareId,
                assets,
                createdAt: now,
                updatedAt: now,
            };
            this.mappings.set(docId, mapping);
        }

        await this.save();
    }

    /**
     * получениедокументресурс
     */
    getMapping(docId: string): DocAssetMapping | null {
        return this.mappings.get(docId) || null;
    }

    /**
     * Удалитьдокументресурс
     */
    async removeMapping(docId: string): Promise<void> {
        this.mappings.delete(docId);
        await this.save();
    }

    /**
     * поделитьсяIDУдалить
     */
    async removeMappingByShareId(shareId: string): Promise<void> {
        for (const [docId, mapping] of this.mappings.entries()) {
            if (mapping.shareId === shareId) {
                this.mappings.delete(docId);
            }
        }
        await this.save();
    }

    /**
     * 
     */
    async clearAll(): Promise<void> {
        this.mappings.clear();
        await this.save();
    }

    /**
     * получениезапись
     */
    getAllMappings(): DocAssetMapping[] {
        return Array.from(this.mappings.values());
    }

    /**
     * проверкаресурсзагрузка（через）
     * @param hash файл
     * @returns загрузкаресурсзапись，есливозврат null
     */
    findAssetByHash(hash: string): AssetUploadRecord | null {
        for (const mapping of this.mappings.values()) {
            const asset = mapping.assets.find(a => a.hash === hash);
            if (asset) {
                return asset;
            }
        }
        return null;
    }

    /**
     * проверкаресурсзагрузка（черезлокальныйпуть）
     * @param localPath локальныйпуть
     * @returns загрузкаресурсзапись，есливозврат null
     */
    findAssetByLocalPath(localPath: string): AssetUploadRecord | null {
        for (const mapping of this.mappings.values()) {
            const asset = mapping.assets.find(a => a.localPath === localPath);
            if (asset) {
                return asset;
            }
        }
        return null;
    }

    /**
     * документ...литьресурс
     * @param docId документID
     * @param s3Key S3объектов
     * @returns еслиУдалитьвозврат true，иначевозврат false
     */
    async removeAssetFromDoc(docId: string, s3Key: string): Promise<boolean> {
        const mapping = this.mappings.get(docId);
        if (!mapping) {
            return false;
        }

        const originalLength = mapping.assets.length;
        mapping.assets = mapping.assets.filter(a => a.s3Key !== s3Key);
        
        if (mapping.assets.length === originalLength) {
            return false; // нетресурс
        }

        mapping.updatedAt = Date.now();
        
        // еслидокументресурс，Удалить
        if (mapping.assets.length === 0) {
            this.mappings.delete(docId);
        }

        await this.save();
        return true;
    }

    /**
     * Удалитьресурс（документ...）
     * @param s3Keys S3объектов
     * @returns Удалитьресурс
     */
    async removeAssets(s3Keys: string[]): Promise<number> {
        let removedCount = 0;
        const s3KeySet = new Set(s3Keys);

        for (const [docId, mapping] of this.mappings.entries()) {
            const originalLength = mapping.assets.length;
            mapping.assets = mapping.assets.filter(a => !s3KeySet.has(a.s3Key));
            
            if (mapping.assets.length < originalLength) {
                removedCount += originalLength - mapping.assets.length;
                mapping.updatedAt = Date.now();

                // еслидокументресурс，Удалить
                if (mapping.assets.length === 0) {
                    this.mappings.delete(docId);
                }
            }
        }

        if (removedCount > 0) {
            await this.save();
        }

        return removedCount;
    }

    /**
     * Удалитьресурс
     * @param filter 
     * @returns Удалитьресурс
     */
    async removeAssetsByFilter(
        filter: (asset: AssetUploadRecord, docId: string) => boolean
    ): Promise<string[]> {
        const toRemove: string[] = [];

        for (const [docId, mapping] of this.mappings.entries()) {
            for (const asset of mapping.assets) {
                if (filter(asset, docId)) {
                    toRemove.push(asset.s3Key);
                }
            }
        }

        if (toRemove.length > 0) {
            await this.removeAssets(toRemove);
        }

        return toRemove;
    }
}
