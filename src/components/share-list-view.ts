import { openTab, showMessage } from "siyuan";
import type SharePlugin from "../index";
import type { ShareRecord } from "../types";

export class ShareListView {
    private plugin: SharePlugin;
    private container: HTMLElement;
    private listContainer!: HTMLElement;
    private refreshBtn!: HTMLButtonElement;
    private emptyState!: HTMLElement;
    private loadingState!: HTMLElement;
    private isRefreshing = false;

    constructor(plugin: SharePlugin, container: HTMLElement) {
        this.plugin = plugin;
        this.container = container;
    }

    async render(): Promise<void> {
        this.container.innerHTML = `
            <div class="fn__flex-column" style="height: 100%; padding: 16px;">
                <div class="fn__flex" style="align-items: center; margin-bottom: 16px; gap: 8px;">
                    <h3 style="margin: 0; flex: 1;">${this.plugin.i18n.shareListTitle || "всеподелиться"}</h3>
                    <button class="b3-button b3-button--outline" id="shareListRefreshBtn">
                        <svg class="b3-button__icon"><use xlink:href="#iconRefresh"></use></svg>
                        ${this.plugin.i18n.shareListRefresh || "Обновить"}
                    </button>
                </div>

                <!-- Loading State -->
                <div class="share-list__loading" id="shareListLoading" style="display: none; text-align: center; padding: 40px;">
                    <div class="fn__loading" style="width: 48px; height: 48px; margin: 0 auto;"></div>
                    <div class="b3-label__text" style="margin-top: 16px;">${this.plugin.i18n.shareListLoading || "Загрузка..."}</div>
                </div>

                <!-- Empty State -->
                <div class="share-list__empty" id="shareListEmpty" style="display: none; text-align: center; padding: 40px; color: var(--b3-theme-on-surface-light);">
                    <svg style="width: 64px; height: 64px; margin: 0 auto; opacity: 0.3;"><use xlink:href="#iconShare"></use></svg>
                    <div class="b3-label__text" style="margin-top: 16px;">${this.plugin.i18n.shareListEmpty || "нетподелитьсязапись"}</div>
                </div>

                <!-- List Container -->
                <div class="share-list__container" id="shareListContainer" style="display: none; overflow-y: auto; flex: 1;">
                    <!-- Items will be inserted here -->
                </div>
            </div>
        `;

        this.cacheElements();
        this.bindEvents();
        await this.renderList();
    }

    private cacheElements(): void {
        this.listContainer = this.container.querySelector("#shareListContainer") as HTMLElement;
        this.refreshBtn = this.container.querySelector("#shareListRefreshBtn") as HTMLButtonElement;
        this.emptyState = this.container.querySelector("#shareListEmpty") as HTMLElement;
        this.loadingState = this.container.querySelector("#shareListLoading") as HTMLElement;
    }

    private bindEvents(): void {
        this.refreshBtn.addEventListener("click", async () => {
            await this.handleRefresh();
        });
    }

    private async renderList(): Promise<void> {
        const records = this.plugin.shareRecordManager.getRecords();

        if (records.length === 0) {
            this.showEmptyState();
            return;
        }

        this.showListState();
        this.listContainer.innerHTML = "";

        // Время создания
        const sortedRecords = [...records].sort((a, b) => b.createdAt - a.createdAt);

        for (const record of sortedRecords) {
            const item = this.createListItem(record);
            this.listContainer.appendChild(item);
        }
    }

    private createListItem(record: ShareRecord): HTMLElement {
        const isExpired = record.expireAt <= Date.now();
        const isValid = !isExpired;

        const item = document.createElement("div");
        item.className = "b3-list-item b3-list-item--hide-action";
        item.style.cssText = "padding: 12px 16px; margin-bottom: 8px; background: var(--b3-list-hover); border-radius: 4px;";

        const statusColor = isValid ? "var(--b3-card-success-color)" : "var(--b3-theme-on-surface-light)";
        const statusText = isValid 
            ? this.plugin.i18n.shareListStatusValid || "" 
            : this.plugin.i18n.shareListStatusExpired || "";

        const accessText = this.getAccessLabel(record);
        const createdDate = new Date(record.createdAt).toLocaleString();
        const expireDate = new Date(record.expireAt).toLocaleString();

        item.innerHTML = `
            <div class="fn__flex" style="align-items: flex-start;">
                <div class="fn__flex-1" style="min-width: 0;">
                    <div class="b3-list-item__text" style="font-weight: 500; margin-bottom: 8px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" title="${this.escapeHtml(record.docTitle)}">
                        ${this.escapeHtml(record.docTitle)}
                    </div>
                    <div class="fn__flex" style="gap: 16px; flex-wrap: wrap; color: var(--b3-theme-on-surface-light); font-size: 12px;">
                        <span>
                            <span style="color: ${statusColor};">● ${statusText}</span>
                        </span>
                        <span>
                            ${this.plugin.i18n.shareListViewCount || "доступ"}: ${record.viewCount || 0}
                        </span>
                        <span>
                            ${this.plugin.i18n.shareListAccessLabel || ""}: ${accessText}
                        </span>
                        <span>
                            ${this.plugin.i18n.shareListCreatedAt || "создание"}: ${createdDate}
                        </span>
                        <span>
                            ${this.plugin.i18n.shareListExpireAt || ""}: ${expireDate}
                        </span>
                    </div>
                </div>
                <div class="fn__flex" style="gap: 8px; margin-left: 16px;">
                    <button class="b3-button b3-button--outline" data-action="open" data-doc-id="${record.docId}" title="${this.plugin.i18n.shareListOpenDoc || "документ"}">
                        <svg class="b3-button__icon"><use xlink:href="#iconFile"></use></svg>
                    </button>
                    <button class="b3-button b3-button--outline" data-action="copy" data-url="${this.escapeHtml(record.shareUrl)}" title="${this.plugin.i18n.copyLink || "Копироватьссылка"}">
                        <svg class="b3-button__icon"><use xlink:href="#iconCopy"></use></svg>
                    </button>
                    <button class="b3-button b3-button--outline" data-action="delete" data-id="${record.id}" title="${this.plugin.i18n.shareListDelete || "Удалить"}">
                        <svg class="b3-button__icon"><use xlink:href="#iconTrashcan"></use></svg>
                    </button>
                </div>
            </div>
        `;

        // Действиякнопка
        const openBtn = item.querySelector('[data-action="open"]') as HTMLButtonElement;
        const copyBtn = item.querySelector('[data-action="copy"]') as HTMLButtonElement;
        const deleteBtn = item.querySelector('[data-action="delete"]') as HTMLButtonElement;

        openBtn.addEventListener("click", async () => {
            await this.handleOpenDoc(record.docId);
        });

        copyBtn.addEventListener("click", () => {
            this.handleCopyLink(record.shareUrl);
        });

        deleteBtn.addEventListener("click", async () => {
            await this.handleDelete(record.id);
        });

        return item;
    }

    private async handleOpenDoc(docId: string): Promise<void> {
        try {
            // проверкадокументсуществует
            const exists = await this.checkDocExists(docId);
            if (!exists) {
                const confirmClean = window.confirm(
                    this.plugin.i18n.shareListDocNotFound || "документне существует，Удалитьподелитьсязапись？"
                );
                if (confirmClean) {
                    const record = this.plugin.shareRecordManager.getRecordByDocId(docId);
                    if (record) {
                        await this.handleDelete(record.id);
                    }
                }
                return;
            }

            // документ
            openTab({
                app: this.plugin.app,
                doc: {
                    id: docId,
                    action: ["cb-get-focus"],
                },
                keepCursor: false,
                removeCurrentTab: false,
            });

            showMessage(this.plugin.i18n.shareListDocOpened || "документ", 2000, "info");
        } catch (error: any) {
            showMessage(
                error?.message || this.plugin.i18n.shareListOpenDocError || "документОшибка", 
                3000, 
                "error"
            );
        }
    }

    private async checkDocExists(docId: string): Promise<boolean> {
        try {
            const config = this.plugin.settings.getConfig();
            const response = await fetch("/api/attr/getBlockAttrs", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Token ${config.siyuanToken}`,
                },
                body: JSON.stringify({ id: docId }),
            });

            if (!response.ok) {
                return false;
            }

            const result = await response.json();
            return result.code === 0 && result.data;
        } catch {
            return false;
        }
    }

    private handleCopyLink(url: string): void {
        if (navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText(url).then(() => {
                showMessage(this.plugin.i18n.copySuccess || "Копировать", 2000, "info");
            }).catch(() => {
                this.copyFallback(url);
            });
        } else {
            this.copyFallback(url);
        }
    }

    private copyFallback(text: string): void {
        const tempInput = document.createElement("input");
        tempInput.value = text;
        document.body.appendChild(tempInput);
        tempInput.select();
        document.execCommand("copy");
        document.body.removeChild(tempInput);
        showMessage(this.plugin.i18n.copySuccess || "Копировать", 2000, "info");
    }

    private async handleDelete(shareId: string): Promise<void> {
        const confirmText = this.plugin.i18n.shareListDeleteConfirm || "ОКУдалитьподелиться？";
        if (!window.confirm(confirmText)) {
            return;
        }

        try {
            await this.plugin.shareService.deleteShare(shareId);
            showMessage(this.plugin.i18n.shareListDeleteSuccess || "УдалитьУспешно", 2000, "info");
            await this.renderList();
        } catch (error: any) {
            showMessage(
                error?.message || this.plugin.i18n.shareListDeleteError || "УдалитьОшибка", 
                3000, 
                "error"
            );
        }
    }

    private async handleRefresh(): Promise<void> {
        if (this.isRefreshing) {
            return;
        }

        this.isRefreshing = true;
        this.refreshBtn.disabled = true;
        this.showLoadingState();

        try {
            // получениеактуальныйданных
            await this.plugin.shareRecordManager.syncFromBackend();
            showMessage(this.plugin.i18n.shareListRefreshSuccess || "ОбновитьУспешно", 2000, "info");
            await this.renderList();
        } catch (error: any) {
            showMessage(
                error?.message || this.plugin.i18n.shareListRefreshError || "ОбновитьОшибка", 
                3000, 
                "error"
            );
            // Ошибкалокальныйкэш
            await this.renderList();
        } finally {
            this.isRefreshing = false;
            this.refreshBtn.disabled = false;
        }
    }

    private showLoadingState(): void {
        this.loadingState.style.display = "";
        this.emptyState.style.display = "none";
        this.listContainer.style.display = "none";
    }

    private showEmptyState(): void {
        this.loadingState.style.display = "none";
        this.emptyState.style.display = "";
        this.listContainer.style.display = "none";
    }

    private showListState(): void {
        this.loadingState.style.display = "none";
        this.emptyState.style.display = "none";
        this.listContainer.style.display = "";
    }

    private getAccessLabel(record: ShareRecord): string {
        if (record.requirePassword) {
            return this.plugin.i18n.shareDialogAccessPassword || "Защита паролем";
        }
        return record.isPublic
            ? this.plugin.i18n.shareDialogAccessPublic || "публичныйдоступ"
            : this.plugin.i18n.shareDialogAccessPrivate || "ссылка";
    }

    private escapeHtml(input: string): string {
        return input.replace(/[&<>'"]/g, (match) => {
            switch (match) {
                case "&":
                    return "&amp;";
                case "<":
                    return "&lt;";
                case ">":
                    return "&gt;";
                case "'":
                    return "&#39;";
                case '"':
                    return "&quot;";
                default:
                    return match;
            }
        });
    }
}
