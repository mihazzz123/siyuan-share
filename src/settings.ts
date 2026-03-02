import { Setting } from "siyuan";
import { AssetListView } from "./components/asset-list-view";
import { ShareListDialog } from "./components/share-list";
import type SharePlugin from "./index";
import type { S3Config } from "./types";

export interface ShareConfig {
    serverUrl: string;
    apiToken: string;
    siyuanToken: string;
    defaultPassword: boolean;
    defaultExpireDays: number;
    defaultPublic: boolean;
    s3: S3Config;
}

export const DEFAULT_CONFIG: ShareConfig = {
    serverUrl: "",
    apiToken: "",
    siyuanToken: "",
    defaultPassword: false,
    defaultExpireDays: 7,
    defaultPublic: true,
    s3: {
        enabled: false,
        endpoint: "",
        region: "",
        bucket: "",
        accessKeyId: "",
        secretAccessKey: "",
        customDomain: "",
        pathPrefix: "",
        enablePasteUpload: false,
        provider: "aws",
    },
};

export class ShareSettings {
    private plugin: SharePlugin;
    private config: ShareConfig;

    constructor(plugin: SharePlugin) {
        this.plugin = plugin;
        this.config = { ...DEFAULT_CONFIG };
    }

    async load(): Promise<void> {
        const savedConfig = await this.plugin.loadData("share-config");
        if (savedConfig) {
            this.config = { ...DEFAULT_CONFIG, ...savedConfig };
        }
    }

    async save(): Promise<void> {
        await this.plugin.saveData("share-config", this.config);
        
        // конфигурация/отключитьзагрузка
        if (this.plugin.pasteUploadService) {
            if (this.config.s3.enabled && this.config.s3.enablePasteUpload) {
                this.plugin.pasteUploadService.enable();
            } else {
                this.plugin.pasteUploadService.disable();
            }
        }
    }

    getConfig(): ShareConfig {
        return { ...this.config };
    }

    updateConfig(config: Partial<ShareConfig>): void {
        this.config = { ...this.config, ...config };
    }

    createSettingPanel(): Setting {
        const setting = new Setting({
            confirmCallback: async () => {
                this.config.serverUrl = serverUrlInput.value.trim();
                this.config.apiToken = apiTokenInput.value.trim();
                this.config.siyuanToken = siyuanTokenInput.value.trim();
                this.config.defaultPassword = defaultPasswordCheckbox.checked;
                this.config.defaultExpireDays = parseInt(defaultExpireInput.value) || 7;
                this.config.defaultPublic = defaultPublicCheckbox.checked;
                
                this.config.s3.enabled = s3EnabledCheckbox.checked;
                this.config.s3.enablePasteUpload = s3PasteUploadCheckbox.checked;
                this.config.s3.endpoint = s3EndpointInput.value.trim();
                this.config.s3.region = s3RegionInput.value.trim();
                this.config.s3.bucket = s3BucketInput.value.trim();
                this.config.s3.accessKeyId = s3AccessKeyInput.value.trim();
                this.config.s3.secretAccessKey = s3SecretKeyInput.value.trim();
                this.config.s3.customDomain = s3CustomDomainInput.value.trim();
                this.config.s3.pathPrefix = s3PathPrefixInput.value.trim();
                this.config.s3.provider = (s3ProviderSelect.value as ('aws'|'oss')) || 'aws';
                this.config.s3.addressing = (s3AddressingSelect.value as ('auto'|'path'|'virtual')) || 'auto';
                
                await this.save();
            }
        });

        // Создаем элементы ввода
        const serverUrlInput = document.createElement("input");
        serverUrlInput.className = "b3-text-field fn__block";
        serverUrlInput.placeholder = "https://share.example.com";
        serverUrlInput.value = this.config.serverUrl;
        
        const apiTokenInput = document.createElement("input");
        apiTokenInput.className = "b3-text-field fn__block";
        apiTokenInput.type = "password";
        apiTokenInput.placeholder = this.plugin.i18n.settingApiTokenPlaceholder;
        apiTokenInput.value = this.config.apiToken;
        
        const siyuanTokenInput = document.createElement("input");
        siyuanTokenInput.className = "b3-text-field fn__block";
        siyuanTokenInput.type = "password";
        siyuanTokenInput.placeholder = this.plugin.i18n.settingSiyuanTokenPlaceholder || "SiYuanядро API Token";
        siyuanTokenInput.value = this.config.siyuanToken;
        
        const defaultPasswordCheckbox = document.createElement("input");
        defaultPasswordCheckbox.type = "checkbox";
        defaultPasswordCheckbox.className = "b3-switch fn__flex-center";
        defaultPasswordCheckbox.checked = this.config.defaultPassword;
        
        const defaultExpireInput = document.createElement("input");
        defaultExpireInput.className = "b3-text-field fn__block";
        defaultExpireInput.type = "number";
        defaultExpireInput.min = "1";
        defaultExpireInput.max = "365";
        defaultExpireInput.value = this.config.defaultExpireDays.toString();
        
        const defaultPublicCheckbox = document.createElement("input");
        defaultPublicCheckbox.type = "checkbox";
        defaultPublicCheckbox.className = "b3-switch fn__flex-center";
        defaultPublicCheckbox.checked = this.config.defaultPublic;

        // S3 элементы
        const s3EnabledCheckbox = document.createElement("input");
        s3EnabledCheckbox.type = "checkbox";
        s3EnabledCheckbox.className = "b3-switch fn__flex-center";
        s3EnabledCheckbox.checked = this.config.s3.enabled;

        const s3PasteUploadCheckbox = document.createElement("input");
        s3PasteUploadCheckbox.type = "checkbox";
        s3PasteUploadCheckbox.className = "b3-switch fn__flex-center";
        s3PasteUploadCheckbox.checked = this.config.s3.enablePasteUpload || false;

        const s3EndpointInput = document.createElement("input");
        s3EndpointInput.className = "b3-text-field fn__block";
        s3EndpointInput.placeholder = "s3.amazonaws.com";
        s3EndpointInput.value = this.config.s3.endpoint;

        const s3ProviderSelect = document.createElement('select');
        s3ProviderSelect.className = 'b3-select fn__block';
        const providers: Array<{val:'aws'|'oss';text:string}> = [
            { val: 'aws', text: 'AWS / S3 compatible (SigV4)' },
            { val: 'oss', text: 'Aliyun OSS (HMAC-SHA1)' },
        ];
        for (const p of providers) {
            const opt = document.createElement('option');
            opt.value = p.val;
            opt.textContent = p.text;
            if ((this.config.s3.provider||'aws') === p.val) opt.selected = true;
            s3ProviderSelect.appendChild(opt);
        }

        const s3RegionInput = document.createElement("input");
        s3RegionInput.className = "b3-text-field fn__block";
        s3RegionInput.placeholder = "us-east-1";
        s3RegionInput.value = this.config.s3.region;

        const s3BucketInput = document.createElement("input");
        s3BucketInput.className = "b3-text-field fn__block";
        s3BucketInput.placeholder = "my-bucket";
        s3BucketInput.value = this.config.s3.bucket;

        const s3AccessKeyInput = document.createElement("input");
        s3AccessKeyInput.className = "b3-text-field fn__block";
        s3AccessKeyInput.type = "password";
        s3AccessKeyInput.placeholder = "Access Key ID";
        s3AccessKeyInput.value = this.config.s3.accessKeyId;

        const s3SecretKeyInput = document.createElement("input");
        s3SecretKeyInput.className = "b3-text-field fn__block";
        s3SecretKeyInput.type = "password";
        s3SecretKeyInput.placeholder = "Secret Access Key";
        s3SecretKeyInput.value = this.config.s3.secretAccessKey;

        const s3CustomDomainInput = document.createElement("input");
        s3CustomDomainInput.className = "b3-text-field fn__block";
        s3CustomDomainInput.placeholder = "https://cdn.example.com";
        s3CustomDomainInput.value = this.config.s3.customDomain || "";

        const s3PathPrefixInput = document.createElement("input");
        s3PathPrefixInput.className = "b3-text-field fn__block";
        s3PathPrefixInput.placeholder = "siyuan-share";
        s3PathPrefixInput.value = this.config.s3.pathPrefix || "";

        const s3AddressingSelect = document.createElement('select');
        s3AddressingSelect.className = 'b3-select fn__block';
        const addressings: Array<{val:'auto'|'path'|'virtual'; text:string}> = [
            { val: 'auto', text: this.plugin.i18n.settingS3AddressingAuto || 'Авто' },
            { val: 'path', text: this.plugin.i18n.settingS3AddressingPath || 'Path-style' },
            { val: 'virtual', text: this.plugin.i18n.settingS3AddressingVirtual || 'Virtual-host style' },
        ];
        for (const a of addressings) {
            const opt = document.createElement('option');
            opt.value = a.val;
            opt.textContent = a.text;
            if ((this.config.s3.addressing || 'auto') === a.val) opt.selected = true;
            s3AddressingSelect.appendChild(opt);
        }

        const s3UrlPreviewInput = document.createElement("input");
        s3UrlPreviewInput.className = "b3-text-field fn__block";
        s3UrlPreviewInput.readOnly = true;
        s3UrlPreviewInput.style.backgroundColor = "var(--b3-theme-surface-lighter)";
        s3UrlPreviewInput.style.cursor = "default";

        const updateUrlPreview = () => {
            const endpoint = s3EndpointInput.value.trim().replace(/\/$/, "");
            const bucket = s3BucketInput.value.trim();
            const addressing = s3AddressingSelect.value;
            const customDomain = s3CustomDomainInput.value.trim().replace(/\/$/, "");
            const prefix = s3PathPrefixInput.value.trim().replace(/\/$/, "");

            if (customDomain) {
                s3UrlPreviewInput.value = `${customDomain}/${prefix ? prefix + "/" : ""}example.png`;
                return;
            }

            if (!endpoint || !bucket) {
                s3UrlPreviewInput.value = "https://...";
                return;
            }

            const protocol = endpoint.startsWith("http") ? "" : "https://";
            const cleanEndpoint = endpoint.replace(/^https?:\/\//, "");

            if (addressing === "path") {
                s3UrlPreviewInput.value = `${protocol}${endpoint}/${bucket}/${prefix ? prefix + "/" : ""}example.png`;
            } else if (addressing === "virtual") {
                s3UrlPreviewInput.value = `${protocol}${bucket}.${cleanEndpoint}/${prefix ? prefix + "/" : ""}example.png`;
            } else {
                // Auto - same logic as in s3-upload.ts
                let style = "virtual";
                if (/:[0-9]+/.test(cleanEndpoint) || /^[0-9.]+$/.test(cleanEndpoint) || cleanEndpoint.includes("localhost") || !cleanEndpoint.includes("amazonaws.com") || bucket.includes(".")) {
                    style = "path";
                }
                if (style === "path") {
                    s3UrlPreviewInput.value = `${protocol}${endpoint}/${bucket}/${prefix ? prefix + "/" : ""}example.png`;
                } else {
                    s3UrlPreviewInput.value = `${protocol}${bucket}.${cleanEndpoint}/${prefix ? prefix + "/" : ""}example.png`;
                }
            }
        };

        s3EndpointInput.oninput = updateUrlPreview;
        s3BucketInput.oninput = updateUrlPreview;
        s3AddressingSelect.onchange = updateUrlPreview;
        s3CustomDomainInput.oninput = updateUrlPreview;
        s3PathPrefixInput.oninput = updateUrlPreview;

        // Добавляем элементы в панель
        setting.addItem({
            title: "⚙️ " + (this.plugin.i18n.settingTabGeneral || "Основные настройки"),
            createActionElement: () => document.createElement("div"),
        });

        setting.addItem({
            title: this.plugin.i18n.settingServerUrl,
            description: this.plugin.i18n.settingServerUrlDesc,
            createActionElement: () => serverUrlInput,
        });

        setting.addItem({
            title: this.plugin.i18n.settingApiToken,
            description: this.plugin.i18n.settingApiTokenDesc,
            createActionElement: () => apiTokenInput,
        });

        setting.addItem({
            title: this.plugin.i18n.settingSiyuanToken || "Токен ядра SiYuan",
            description: this.plugin.i18n.settingSiyuanTokenDesc || "Токен аутентификации для внутреннего API SiYuan (Настройки -> О программе -> API token)",
            createActionElement: () => siyuanTokenInput,
        });

        const testButton = document.createElement("button");
        testButton.className = "b3-button b3-button--outline fn__block";
        testButton.textContent = this.plugin.i18n.settingTestConnection;
        testButton.onclick = async () => {
            testButton.disabled = true;
            testButton.textContent = this.plugin.i18n.testConnectionTesting;
            try {
                const result = await this.testConnection({
                    serverUrl: serverUrlInput.value.trim(),
                    apiToken: apiTokenInput.value.trim(),
                    siyuanToken: siyuanTokenInput.value.trim(),
                });
                if (result.success) {
                    this.plugin.showMessage(this.plugin.i18n.testConnectionSuccess + "\n" + result.message, 4000);
                } else {
                    this.plugin.showMessage(this.plugin.i18n.testConnectionFailed + "\n" + result.message, 6000, "error");
                }
            } catch (error: any) {
                this.plugin.showMessage(this.plugin.i18n.testConnectionFailed + ": " + error.message, 5000, "error");
            } finally {
                testButton.disabled = false;
                testButton.textContent = this.plugin.i18n.settingTestConnection;
            }
        };

        setting.addItem({
            title: this.plugin.i18n.settingTestConnection,
            description: this.plugin.i18n.settingTestConnectionDesc,
            createActionElement: () => testButton,
        });

        setting.addItem({
            title: this.plugin.i18n.settingDefaultPassword,
            description: this.plugin.i18n.settingDefaultPasswordDesc,
            createActionElement: () => defaultPasswordCheckbox,
        });

        setting.addItem({
            title: this.plugin.i18n.settingDefaultExpire,
            description: this.plugin.i18n.settingDefaultExpireDesc,
            createActionElement: () => defaultExpireInput,
        });

        setting.addItem({
            title: this.plugin.i18n.settingDefaultPublic,
            description: this.plugin.i18n.settingDefaultPublicDesc,
            createActionElement: () => defaultPublicCheckbox,
        });

        setting.addItem({
            title: "☁️ " + (this.plugin.i18n.settingTabS3 || "S3 хранилище"),
            createActionElement: () => document.createElement("div"),
        });

        setting.addItem({
            title: this.plugin.i18n.settingS3Enabled || "Включить S3",
            description: this.plugin.i18n.settingS3EnabledDesc,
            createActionElement: () => s3EnabledCheckbox,
        });

        setting.addItem({
            title: this.plugin.i18n.settingS3PasteUpload || "Загрузка при вставке",
            description: this.plugin.i18n.settingS3PasteUploadDesc,
            createActionElement: () => s3PasteUploadCheckbox,
        });

        setting.addItem({
            title: this.plugin.i18n.settingS3Endpoint || "S3 эндпоинт",
            description: this.plugin.i18n.settingS3EndpointDesc,
            createActionElement: () => s3EndpointInput,
        });

        setting.addItem({
            title: this.plugin.i18n.settingS3Region || "Регион",
            createActionElement: () => s3RegionInput,
        });

        setting.addItem({
            title: this.plugin.i18n.settingS3Bucket || "Бакет",
            createActionElement: () => s3BucketInput,
        });

        setting.addItem({
            title: "Access Key ID",
            createActionElement: () => s3AccessKeyInput,
        });

        setting.addItem({
            title: "Secret Access Key",
            createActionElement: () => s3SecretKeyInput,
        });

        setting.addItem({
            title: this.plugin.i18n.settingS3CustomDomain || "CDN домен",
            createActionElement: () => s3CustomDomainInput,
        });

        setting.addItem({
            title: this.plugin.i18n.settingS3PathPrefix || "Префикс пути",
            createActionElement: () => s3PathPrefixInput,
        });

        setting.addItem({
            title: this.plugin.i18n.settingS3Addressing || 'S3 Addressing Style',
            description: this.plugin.i18n.settingS3AddressingDesc,
            createActionElement: () => s3AddressingSelect,
        });

        setting.addItem({
            title: this.plugin.i18n.settingS3Provider || 'S3 Provider',
            createActionElement: () => s3ProviderSelect,
        });

        setting.addItem({
            title: this.plugin.i18n.settingS3UrlPreview || 'S3 URL Preview',
            createActionElement: () => {
                setTimeout(updateUrlPreview, 0);
                return s3UrlPreviewInput;
            },
        });

        // Кнопки управления (Шары, Ресурсы, Логи)
        setting.addItem({
            title: "🛠️ " + (this.plugin.i18n.settingTabTools || "Инструменты"),
            createActionElement: () => document.createElement("div"),
        });

        const viewSharesButton = document.createElement("button");
        viewSharesButton.className = "b3-button b3-button--outline fn__block";
        viewSharesButton.innerHTML = `<svg class="b3-button__icon"><use xlink:href="#iconShare"></use></svg> ${this.plugin.i18n.shareListTitle || "Все активные шары"}`;
        viewSharesButton.onclick = async () => {
            if (!this.isConfigured()) {
                this.plugin.showMessage(this.plugin.i18n.shareErrorNotConfigured, 3000, "error");
                return;
            }
            new ShareListDialog(this.plugin).show();
        };

        setting.addItem({
            title: this.plugin.i18n.shareListTitle || "Все активные шары",
            description: this.plugin.i18n.shareListViewDesc,
            createActionElement: () => viewSharesButton,
        });

        const viewAssetsButton = document.createElement("button");
        viewAssetsButton.className = "b3-button b3-button--outline fn__block";
        viewAssetsButton.innerHTML = `<svg class="b3-button__icon"><use xlink:href="#iconImage"></use></svg> ${this.plugin.i18n.assetListTitle || "Управление ресурсами S3"}`;
        viewAssetsButton.onclick = async () => {
            new AssetListView(this.plugin).show();
        };

        setting.addItem({
            title: this.plugin.i18n.assetListTitle || "Управление ресурсами S3",
            description: this.plugin.i18n.assetListViewDesc,
            createActionElement: () => viewAssetsButton,
        });

        // Логи
        const logWrapper = document.createElement("div");
        logWrapper.className = "fn__flex-column";
        logWrapper.style.gap = "8px";

        const logPreview = document.createElement("textarea");
        logPreview.className = "b3-text-field fn__block";
        logPreview.style.height = "100px";
        logPreview.readOnly = true;
        logPreview.placeholder = "Нажмите 'Обновить' для просмотра логов";

        const logBtns = document.createElement("div");
        logBtns.className = "fn__flex";
        logBtns.style.gap = "8px";

        const refreshLogBtn = document.createElement("button");
        refreshLogBtn.className = "b3-button b3-button--outline fn__flex-1";
        refreshLogBtn.textContent = "Обновить";
        refreshLogBtn.onclick = () => { logPreview.value = this.plugin.getLogsText() || "Логов пока нет"; };

        const clearLogBtn = document.createElement("button");
        clearLogBtn.className = "b3-button b3-button--outline fn__flex-1";
        clearLogBtn.textContent = "Очистить";
        clearLogBtn.onclick = () => { if(confirm("Очистить логи?")) { this.plugin.clearLogs(); logPreview.value = ""; } };

        logBtns.appendChild(refreshLogBtn);
        logBtns.appendChild(clearLogBtn);
        logWrapper.appendChild(logPreview);
        logWrapper.appendChild(logBtns);

        setting.addItem({
            title: "🔍 " + (this.plugin.i18n.settingLogs || "Логи плагина"),
            createActionElement: () => logWrapper,
        });

        return setting;
    }

    isConfigured(): boolean {
        return !!(this.config.serverUrl && this.config.apiToken && this.config.siyuanToken);
    }

    /**
     * тестподключения
     * @param testConfig тестконфигурация,еслипредоставитьиспользованиетекущийСохранитьконфигурация
     */
    async testConnection(testConfig?: { serverUrl: string; apiToken: string; siyuanToken: string }): Promise<{ success: boolean; message: string }> {
        const config = testConfig || this.config;
        const results: string[] = [];
        let hasError = false;

        // 1. Тестирование API токена сервера (приоритет /api/auth/health, откат к /api/health)
        if (!config.serverUrl || !config.apiToken) {
            results.push("❌ " + this.plugin.i18n.testBackendFailed + ": Конфигурация отсутствует");
            hasError = true;
        } else {
            const base = config.serverUrl.replace(/\/$/, "");
            const authHealth = `${base}/api/auth/health`;
            const publicHealth = `${base}/api/health`;

            const fetchWithToken = async (url: string) => {
                return fetch(url, {
                    method: "GET",
                    headers: { "Authorization": `Bearer ${config.apiToken}` },
                });
            };

            try {
                let response = await fetchWithToken(authHealth);
                let usedAuthEndpoint = true;

                // Откат: 404 или 405 означает, что на старой версии бэкенда может не быть /auth/health
                if (response.status === 404 || response.status === 405) {
                    usedAuthEndpoint = false;
                    response = await fetchWithToken(publicHealth);
                }

                if (response.status === 401 || response.status === 403) {
                    results.push("❌ " + this.plugin.i18n.testBackendFailed + ": Токен недействителен или не авторизован");
                    hasError = true;
                } else if (!response.ok) {
                    const errorText = await response.text().catch(() => response.statusText);
                    results.push(`❌ ${this.plugin.i18n.testBackendFailed}: HTTP ${response.status} - ${errorText}`);
                    hasError = true;
                } else {
                    // Парсинг JSON
                    let json: any = null;
                    try { json = await response.json(); } catch { json = {}; }

                    if (usedAuthEndpoint) {
                        // Эндпоинт аутентификации должен вернуть code===0 для успеха
                        if (json && json.code === 0) {
                            const userID = json?.data?.userID || "unknown";
                            results.push(`✅ ${this.plugin.i18n.testBackendSuccess} (Пользователь: ${userID})`);
                        } else {
                            results.push(`❌ ${this.plugin.i18n.testBackendFailed}: Аномальный формат ответа или code!=0`);
                            hasError = true;
                        }
                    } else {
                        // Публичный эндпоинт не может проверить токен, только откат
                        results.push(`⚠️ ${this.plugin.i18n.testBackendFailed}: На сервере отсутствует /api/auth/health, откат к публичной проверке, невозможно подтвердить токен`);
                        hasError = true; // Помечено как ошибка во избежание неверной интерпретации
                    }
                }
            } catch (error: any) {
                results.push(`❌ ${this.plugin.i18n.testBackendFailed}: ${error.message}`);
                hasError = true;
            }
        }

        // 2. Тестирование API токена ядра SiYuan
        if (!config.siyuanToken) {
            results.push("❌ " + this.plugin.i18n.testSiyuanFailed + ": Токен отсутствует");
            hasError = true;
        } else {
            try {
                const response = await fetch("/api/system/version", {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                        "Authorization": `Token ${config.siyuanToken}`,
                    },
                    body: JSON.stringify({}),
                });

                if (response.status === 401 || response.status === 403) {
                    // Токен недействителен
                    results.push("❌ " + this.plugin.i18n.testSiyuanFailed + ": Токен недействителен");
                    hasError = true;
                } else if (!response.ok) {
                    results.push(`❌ ${this.plugin.i18n.testSiyuanFailed}: HTTP ${response.status}`);
                    hasError = true;
                } else {
                    const result = await response.json();
                    if (result.code !== 0) {
                        results.push(`❌ ${this.plugin.i18n.testSiyuanFailed}: ${result.msg || 'Неизвестная ошибка'}`);
                        hasError = true;
                    } else {
                        results.push(`✅ ${this.plugin.i18n.testSiyuanSuccess} (Версия: ${result.data || 'unknown'})`);
                    }
                }
            } catch (error: any) {
                results.push(`❌ ${this.plugin.i18n.testSiyuanFailed}: ${error.message}`);
                hasError = true;
            }
        }

        return {
            success: !hasError,
            message: results.join("\n"),
        };
    }
}
