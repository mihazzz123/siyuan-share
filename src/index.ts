import {
    getAllEditor,
    getFrontend,
    Plugin,
    showMessage
} from "siyuan";
import { ShareDialog } from "./components/share-dialog";
import "./index.scss";
import { AssetRecordManager } from "./services/asset-record";
import { PasteUploadService } from "./services/paste-upload";
import { ShareRecordManager } from "./services/share-record";
import { ShareService } from "./services/share-service";
import { ShareSettings } from "./settings";
import { PluginLogger } from "./utils/logger";

export default class SharePlugin extends Plugin {

    private isMobile: boolean;
    public settings: ShareSettings;
    public shareService: ShareService;
    public shareRecordManager: ShareRecordManager;
    public assetRecordManager: AssetRecordManager;
    public pasteUploadService: PasteUploadService;
    private logger?: PluginLogger;
    private lastActiveRootId?: string;
    // документзаголовкакэш（）
    private docTitleCache = new Map<string, { title: string; expires: number }>();
    private docTitlePromiseCache = new Map<string, Promise<string>>();
    private readonly DOC_TITLE_TTL = 5 * 60 * 1000; // 5 

    // обработкассылка，избежание
    private handleSwitchProtyle?: (evt: any) => void;
    private handleLoadedProtyleStatic?: (evt: any) => void;
    private handleLoadedProtyleDynamic?: (evt: any) => void;
    private handleOpenMenuDocTree?: (evt: any) => void;



    async onload() {
        const frontEnd = getFrontend();
        this.isMobile = frontEnd === "mobile" || frontEnd === "browser-mobile";

        // поделиться
        this.addIcons(`<symbol id="iconShare" viewBox="0 0 32 32">
<path d="M24 20c-1.607 0-3.04 0.78-3.947 1.973l-7.167-3.593c0.18-0.56 0.28-1.16 0.28-1.78 0-0.62-0.1-1.22-0.28-1.78l7.167-3.593c0.907 1.193 2.34 1.973 3.947 1.973 2.76 0 5-2.24 5-5s-2.24-5-5-5-5 2.24-5 5c0 0.62 0.1 1.22 0.28 1.78l-7.167 3.593c-0.907-1.193-2.34-1.973-3.947-1.973-2.76 0-5 2.24-5 5s2.24 5 5 5c1.607 0 3.04-0.78 3.947-1.973l7.167 3.593c-0.18 0.56-0.28 1.16-0.28 1.78 0 2.76 2.24 5 5 5s5-2.24 5-5-2.24-5-5-5z"></path>
</symbol>`);

        // Настройки
        this.settings = new ShareSettings(this);
        await this.settings.load();
        // 
        this.logger = new PluginLogger(this);
        await this.logger.load();
        this.logger.install();
        this.shareRecordManager = new ShareRecordManager(this);
        await this.shareRecordManager.load();
        this.assetRecordManager = new AssetRecordManager(this);
        await this.assetRecordManager.load();
        this.shareService = new ShareService(this);
        this.pasteUploadService = new PasteUploadService(this);

        // конфигурациязагрузка
        const config = this.settings.getConfig();
        if (config.s3.enabled && config.s3.enablePasteUpload) {
            this.pasteUploadService.enable();
        }

        // Настройки
        this.setting = this.settings.createSettingPanel();

        // попыткатекущийдокумент ID
        this.initLastActiveFromDOM();

        // ，записьдокумент ID
        this.handleSwitchProtyle = (evt: any) => {
            try {
                const rid = evt?.detail?.protyle?.block?.rootID;
                if (typeof rid === "string" && rid) {
                    this.lastActiveRootId = rid;
                }
            } catch (_) { /* ignore */ }
        };
        this.eventBus.on("switch-protyle", this.handleSwitchProtyle);

        // Загрузка， lastActiveRootId ...
        const updateOnLoad = (evt: any) => {
            try {
                const protyleEl = evt?.detail?.protyle?.element as HTMLElement | undefined;
                const rid = evt?.detail?.protyle?.block?.rootID as string | undefined;
                if (protyleEl && rid) {
                    const activeWnd = document.querySelector(".layout__wnd--active") as HTMLElement | null;
                    if (activeWnd && activeWnd.contains(protyleEl)) {
                        this.lastActiveRootId = rid;
                    }
                }
            } catch (_) { /* ignore */ }
        };
        this.handleLoadedProtyleStatic = updateOnLoad;
        this.handleLoadedProtyleDynamic = updateOnLoad;
        this.eventBus.on("loaded-protyle-static", this.handleLoadedProtyleStatic);
        this.eventBus.on("loaded-protyle-dynamic", this.handleLoadedProtyleDynamic);

        // документподелиться
        this.handleOpenMenuDocTree = (evt: any) => {
            const { detail } = evt;
            if (!detail || !detail.menu || !detail.doc) return;
            const docId = detail.doc.id;
            const docTitle = detail.doc.title || detail.doc.name || "Untitled";
            detail.menu.addSeparator();
            detail.menu.addItem({
                icon: "iconShare",
                label: this.i18n.shareMenuShareDoc || "Share Document",
                click: async () => {
                    if (!this.settings.isConfigured()) {
                        showMessage(this.i18n.shareErrorNotConfigured, 4000, "error");
                        this.openSetting();
                        return;
                    }
                    const realTitle = await this.getDocTitle(docId);
                    const dialog = new ShareDialog(this, docId, realTitle || docTitle);
                    dialog.show();
                }
            });
        };
        this.eventBus.on("open-menu-doctree", this.handleOpenMenuDocTree);

        // ссылкаБлок.../Token（ forwardProxy загрузка）
        try { (window as any).sharePlugin = this; } catch (_) { /* ignore */ }
    }

    onLayoutReady() {
        // поделитьсякнопка
        this.addTopBar({
            icon: "iconShare",
            title: this.i18n.shareTopBarTitle || "Share",
            position: "right",
            callback: async () => {
                const editor = this.getEditor();
                if (!editor) return;
                const docId = editor.protyle.block.rootID;

                if (!this.settings.isConfigured()) {
                    showMessage(this.i18n.shareErrorNotConfigured, 4000, "error");
                    this.openSetting();
                    return;
                }

                // получениедокументзаголовка
                const docTitle = await this.getDocTitle(docId);
                const d = new ShareDialog(this, docId, docTitle);
                d.show();
            }
        });
    }

    onunload() {
        console.log(this.i18n.byePlugin);
        try { if ((window as any).sharePlugin === this) (window as any).sharePlugin = undefined; } catch (_) { /* ignore */ }
        if (this.shareRecordManager) {
            this.shareRecordManager.stopAutoSync();
        }
        if (this.logger) {
            this.logger.uninstall();
        }
        // отключитьзагрузка
        if (this.pasteUploadService) {
            this.pasteUploadService.disable();
        }
        // 
        if (this.handleSwitchProtyle) this.eventBus.off("switch-protyle", this.handleSwitchProtyle);
        if (this.handleLoadedProtyleStatic) this.eventBus.off("loaded-protyle-static", this.handleLoadedProtyleStatic);
        if (this.handleLoadedProtyleDynamic) this.eventBus.off("loaded-protyle-dynamic", this.handleLoadedProtyleDynamic);
        if (this.handleOpenMenuDocTree) this.eventBus.off("open-menu-doctree", this.handleOpenMenuDocTree);
    }

    uninstall() {
        console.log("uninstall");
    }

    /**
     * Совет
     */
    showMessage(msg: string, timeout: number = 3000, type: "info" | "error" = "info") {
        showMessage(msg, timeout, type);
    }

    /**  */
    public getLogsText(): string {
        try { return this.logger?.toText() || ""; } catch { return ""; }
    }

    /**  */
    public clearLogs(): void {
        try { this.logger?.clear(); } catch { /* ignore */ }
    }

    private getEditor() {
        const editors = getAllEditor();
        if (editors.length === 0) {
            showMessage("please open doc first");
            return;
        }

        // 0) использование rootID（кнопка/）
        if (this.lastActiveRootId) {
            const byLast = editors.find((e: any) => e?.protyle?.block?.rootID === this.lastActiveRootId);
            if (byLast) return byLast;
        }

        // 1) текущийэлемент
        const activeEl = (document.activeElement as HTMLElement | null);
        if (activeEl) {
            const foundByActive = editors.find((e: any) => e?.protyle?.element && (e.protyle.element as HTMLElement).contains(activeEl));
            if (foundByActive) return foundByActive;
        }

        // 2) попыткатекущий
        const sel = window.getSelection && window.getSelection();
        const anchorNode = sel && sel.anchorNode as Node | null;
        if (anchorNode) {
            const anchorEl = (anchorNode instanceof Element ? anchorNode : anchorNode.parentElement) as HTMLElement | null;
            if (anchorEl) {
                const protyleRoot = anchorEl.closest?.(".protyle") as HTMLElement | null;
                if (protyleRoot) {
                    const foundBySelection = editors.find((e: any) => e?.protyle?.element === protyleRoot || (e?.protyle?.element as HTMLElement)?.contains(protyleRoot));
                    if (foundBySelection) return foundBySelection;
                }
            }
        }

        // 2.5) （Siyuan ）
        const activeWnd = document.querySelector(".layout__wnd--active") as HTMLElement | null;
        if (activeWnd) {
            const foundInActiveWnd = editors.find((e: any) => activeWnd.contains(e?.protyle?.element as HTMLElement));
            if (foundInActiveWnd) return foundInActiveWnd;
        }

        // 3) откат：“”（возможноверсия）
        const focusClassCandidates = [
            "protyle--focus",
            "protyle-focus",
        ];
        const foundByClass = editors.find((e: any) => {
            const el = e?.protyle?.element as HTMLElement | null;
            return !!(el && focusClassCandidates.some(c => el.classList?.contains(c)));
        });
        if (foundByClass) return foundByClass;

        // 4) откат：возврат
        return editors[0];
    }

    /**
     * текущий DOM ， lastActiveRootId
     */
    private initLastActiveFromDOM() {
        try {
            const editors = getAllEditor();
            if (!editors.length) return;

            const activeWnd = document.querySelector(".layout__wnd--active") as HTMLElement | null;
            if (activeWnd) {
                const foundInActiveWnd = editors.find((e: any) => activeWnd.contains(e?.protyle?.element as HTMLElement));
                if (foundInActiveWnd?.protyle?.block?.rootID) {
                    this.lastActiveRootId = foundInActiveWnd.protyle.block.rootID;
                    return;
                }
            }

            const focusClassCandidates = ["protyle--focus", "protyle-focus"];
            const foundByClass = editors.find((e: any) => {
                const el = e?.protyle?.element as HTMLElement | null;
                return !!(el && focusClassCandidates.some(c => el.classList?.contains(c)));
            });
            if (foundByClass?.protyle?.block?.rootID) {
                this.lastActiveRootId = foundByClass.protyle.block.rootID;
                return;
            }

            // ：，использование
            if (editors.length === 1 && editors[0]?.protyle?.block?.rootID) {
                this.lastActiveRootId = editors[0].protyle.block.rootID;
            }
        } catch (_) {
            // ignore
        }
    }

    /**
     * получениедокументзаголовка
     */
    private async getDocTitle(docId: string): Promise<string> {
        // 1. кэш...
        const cached = this.docTitleCache.get(docId);
        if (cached && cached.expires > Date.now()) {
            return cached.title;
        }

        // 2. ：...
        const inflight = this.docTitlePromiseCache.get(docId);
        if (inflight) return inflight;

        const p = (async () => {
            let title: string | undefined;
            // ：attr API
            try {
                const config = this.settings.getConfig();
                const response = await fetch("/api/attr/getBlockAttrs", {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                        "Authorization": `Token ${config.siyuanToken}`,
                    },
                    body: JSON.stringify({ id: docId }),
                });
                if (response.ok) {
                    const result = await response.json();
                    if (result.code === 0 && result.data) {
                        title = result.data.title || result.data.name;
                    }
                }
            } catch (e) { /* ignore */ }

            // Ошибка：SQL 
            if (!title) {
                try {
                    const config = this.settings.getConfig();
                    const response = await fetch("/api/query/sql", {
                        method: "POST",
                        headers: {
                            "Content-Type": "application/json",
                            "Authorization": `Token ${config.siyuanToken}`,
                        },
                        body: JSON.stringify({ stmt: `SELECT content FROM blocks WHERE id = '${docId}' AND type = 'd' LIMIT 1` }),
                    });
                    if (response.ok) {
                        const result = await response.json();
                        if (result.code === 0 && result.data && result.data.length > 0) {
                            title = result.data[0].content;
                        }
                    }
                } catch (e) { /* ignore */ }
            }

            const finalTitle = title || docId;
            this.docTitleCache.set(docId, { title: finalTitle, expires: Date.now() + this.DOC_TITLE_TTL });
            this.docTitlePromiseCache.delete(docId);
            return finalTitle;
        })();

        this.docTitlePromiseCache.set(docId, p);
        return p;
    }
}
