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
        pathPrefix: "siyuan-share",
        enablePasteUpload: false,
        provider: 'aws',
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
        // созданиеэлемент
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

        // S3 конфигурацияэлемент
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

        // provider （aws / oss）
        const s3ProviderSelect = document.createElement('select');
        s3ProviderSelect.className = 'b3-select fn__block';
        const providers: Array<{val:'aws'|'oss';text:string}> = [
            { val: 'aws', text: 'AWS /  (SigV4)' },
            { val: 'oss', text: ' OSS (HMAC-SHA1)' },
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

        const setting = new Setting({
            confirmCallback: async () => {
                // Сохранитьконфигурация
                this.config.serverUrl = serverUrlInput.value.trim();
                this.config.apiToken = apiTokenInput.value.trim();
                this.config.siyuanToken = siyuanTokenInput.value.trim();
                this.config.defaultPassword = defaultPasswordCheckbox.checked;
                this.config.defaultExpireDays = parseInt(defaultExpireInput.value) || 7;
                this.config.defaultPublic = defaultPublicCheckbox.checked;
                
                // Сохранить S3 конфигурация
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
                
                await this.save();
            }
        });
        // 
        this.addGeneralTab(setting, serverUrlInput, apiTokenInput, siyuanTokenInput, defaultPasswordCheckbox, defaultExpireInput, defaultPublicCheckbox);
        this.addS3Tab(setting, s3EnabledCheckbox, s3PasteUploadCheckbox, s3EndpointInput, s3RegionInput, s3BucketInput, s3AccessKeyInput, s3SecretKeyInput, s3CustomDomainInput, s3PathPrefixInput);
        //  S3 метка provider 
        setting.addItem({
            title: 'S3 Provider ',
            description: 'использованиехранение： AWS S3 ， или  OSS（использование）',
            createActionElement: () => s3ProviderSelect,
        });

        return setting;
    }

    private addGeneralTab(
        setting: Setting,
        serverUrlInput: HTMLInputElement,
        apiTokenInput: HTMLInputElement,
        siyuanTokenInput: HTMLInputElement,
        defaultPasswordCheckbox: HTMLInputElement,
        defaultExpireInput: HTMLInputElement,
        defaultPublicCheckbox: HTMLInputElement
    ): void {
        // созданиеНастройкиметка
        setting.addItem({
            title: "⚙️ " + (this.plugin.i18n.settingTabGeneral || "Настройки"),
            createActionElement: () => {
                const element = document.createElement("div");
                return element;
            },
        });
        
        //  URL
        setting.addItem({
            title: this.plugin.i18n.settingServerUrl,
            description: this.plugin.i18n.settingServerUrlDesc,
            createActionElement: () => serverUrlInput,
        });

        // API Token
        setting.addItem({
            title: this.plugin.i18n.settingApiToken,
            description: this.plugin.i18n.settingApiTokenDesc,
            createActionElement: () => apiTokenInput,
        });

        // SiYuanядро Token
        setting.addItem({
            title: this.plugin.i18n.settingSiyuanToken || "SiYuanядро Token",
            description: this.plugin.i18n.settingSiyuanTokenDesc || "дляSiYuanвнутри API аутентификациятокен（Настройки -> о программе -> API token）",
            createActionElement: () => siyuanTokenInput,
        });

        // тестподключениякнопка
        const testButton = document.createElement("button");
        testButton.className = "b3-button b3-button--outline fn__block";
        testButton.textContent = this.plugin.i18n.settingTestConnection;
        testButton.addEventListener("click", async () => {
            testButton.disabled = true;
            testButton.textContent = this.plugin.i18n.testConnectionTesting;
            
            try {
                // использованиетекущийтест,не являетсяСохранитьконфигурация
                const testConfig = {
                    serverUrl: serverUrlInput.value.trim(),
                    apiToken: apiTokenInput.value.trim(),
                    siyuanToken: siyuanTokenInput.value.trim(),
                };
                const result = await this.testConnection(testConfig);
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
        });

        setting.addItem({
            title: this.plugin.i18n.settingTestConnection,
            description: this.plugin.i18n.settingTestConnectionDesc,
            createActionElement: () => testButton,
        });

        // Защита паролем
        setting.addItem({
            title: this.plugin.i18n.settingDefaultPassword,
            description: this.plugin.i18n.settingDefaultPasswordDesc,
            createActionElement: () => defaultPasswordCheckbox,
        });

        // （）
        setting.addItem({
            title: this.plugin.i18n.settingDefaultExpire,
            description: this.plugin.i18n.settingDefaultExpireDesc,
            createActionElement: () => defaultExpireInput,
        });

        // публичныйподелиться
        setting.addItem({
            title: this.plugin.i18n.settingDefaultPublic,
            description: this.plugin.i18n.settingDefaultPublicDesc,
            createActionElement: () => defaultPublicCheckbox,
        });

        // просмотрвсеподелитьсякнопка
        const viewSharesButton = document.createElement("button");
        viewSharesButton.className = "b3-button b3-button--outline fn__block";
        viewSharesButton.innerHTML = `
            <svg class="b3-button__icon"><use xlink:href="#iconShare"></use></svg>
            ${this.plugin.i18n.shareListTitle || "всеподелиться"}
        `;
        viewSharesButton.addEventListener("click", async () => {
            // проверкаконфигурация
            if (!this.isConfigured()) {
                this.plugin.showMessage(
                    this.plugin.i18n.shareErrorNotConfigured || "конфигурация",
                    3000,
                    "error"
                );
                return;
            }
            
            // поделитьсядиалог
            const shareListDialog = new ShareListDialog(this.plugin);
            await shareListDialog.show();
        });

        setting.addItem({
            title: this.plugin.i18n.shareListTitle || "всеподелиться",
            description: this.plugin.i18n.shareListViewDesc || "просмотруправлениесозданиеподелитьсяссылка",
            createActionElement: () => viewSharesButton,
        });

        // просмотрстатическийресурскнопка
        const viewAssetsButton = document.createElement("button");
        viewAssetsButton.className = "b3-button b3-button--outline fn__block";
        viewAssetsButton.innerHTML = `
            <svg class="b3-button__icon"><use xlink:href="#iconImage"></use></svg>
            ${this.plugin.i18n.assetListTitle || "статическийУправление ресурсами"}
        `;
        viewAssetsButton.addEventListener("click", async () => {
            // ресурсдиалог
            const assetListView = new AssetListView(this.plugin);
            await assetListView.show();
        });

        setting.addItem({
            title: this.plugin.i18n.assetListTitle || "статическийУправление ресурсами",
            description: this.plugin.i18n.assetListViewDesc || "просмотруправлениезагрузка S3 статическийресурсфайл",
            createActionElement: () => viewAssetsButton,
        });

        // подочистка
        const logExportWrapper = document.createElement('div');
        logExportWrapper.style.display = 'flex';
        logExportWrapper.style.flexDirection = 'column';
        logExportWrapper.style.gap = '8px';

        const downloadBtn = document.createElement('button');
        downloadBtn.className = 'b3-button b3-button--outline fn__block';
        downloadBtn.textContent = 'подплагин';
        downloadBtn.addEventListener('click', () => {
            const text = this.plugin.getLogsText();
            if (!text) {
                this.plugin.showMessage('нетпод', 3000, 'error');
                return;
            }
            try {
                const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                const ts = new Date();
                const tsStr = ts.toISOString().replace(/[:.]/g,'-');
                a.download = `siyuan-share-logs-${tsStr}.txt`;
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                URL.revokeObjectURL(url);
                this.plugin.showMessage('под', 3000, 'info');
            } catch (e:any) {
                this.plugin.showMessage('подОшибка: ' + (e?.message||e), 4000, 'error');
            }
        });

        const clearBtn = document.createElement('button');
        clearBtn.className = 'b3-button b3-button--outline fn__block';
        clearBtn.textContent = '';
        clearBtn.addEventListener('click', () => {
            if (!confirm('ОКтекущийкэш？Действиянеобратимо。')) return;
            this.plugin.clearLogs();
            this.plugin.showMessage('', 2500, 'info');
        });

        const previewArea = document.createElement('textarea');
        previewArea.className = 'b3-text-field fn__block';
        previewArea.style.height = '120px';
        previewArea.placeholder = '“Обновить”получениетекущийсодержимое';
        previewArea.readOnly = true;

        const refreshBtn = document.createElement('button');
        refreshBtn.className = 'b3-button b3-button--outline fn__block';
        refreshBtn.textContent = 'Обновить';
        refreshBtn.addEventListener('click', () => {
            previewArea.value = this.plugin.getLogsText() || '（）';
        });

        logExportWrapper.appendChild(refreshBtn);
        logExportWrapper.appendChild(previewArea);
        logExportWrapper.appendChild(downloadBtn);
        logExportWrapper.appendChild(clearBtn);

        setting.addItem({
            title: '🔍 ',
            description: 'под、просмотр или плагин（Ошибка、загрузка，доступно）。',
            createActionElement: () => logExportWrapper,
        });
    }

    private addS3Tab(
        setting: Setting,
        s3EnabledCheckbox: HTMLInputElement,
        s3PasteUploadCheckbox: HTMLInputElement,
        s3EndpointInput: HTMLInputElement,
        s3RegionInput: HTMLInputElement,
        s3BucketInput: HTMLInputElement,
        s3AccessKeyInput: HTMLInputElement,
        s3SecretKeyInput: HTMLInputElement,
        s3CustomDomainInput: HTMLInputElement,
        s3PathPrefixInput: HTMLInputElement
    ): void {
        // создание S3 Настройкиметка
        setting.addItem({
            title: "☁️ " + (this.plugin.i18n.settingTabS3 || "S3 хранениеконфигурация"),
            createActionElement: () => {
                const element = document.createElement("div");
                return element;
            },
        });
        //  S3
        setting.addItem({
            title: this.plugin.i18n.settingS3Enabled || " S3 хранение",
            description: this.plugin.i18n.settingS3EnabledDesc || "загрузка S3 хранение，поделитьсядоступ",
            createActionElement: () => s3EnabledCheckbox,
        });

        // загрузка
        setting.addItem({
            title: this.plugin.i18n.settingS3PasteUpload || "загрузка",
            description: this.plugin.i18n.settingS3PasteUploadDesc || "использование，файлзагрузка S3 ссылка（ S3 доступ）",
            createActionElement: () => s3PasteUploadCheckbox,
        });

        // S3 эндпоинт
        // S3 эндпоинт
        setting.addItem({
            title: this.plugin.i18n.settingS3Endpoint || "S3 эндпоинтадрес",
            description: this.plugin.i18n.settingS3EndpointDesc || "S3 эндпоинт， s3.amazonaws.com  или  MinIO адрес",
            createActionElement: () => s3EndpointInput,
        });

        // S3 
        setting.addItem({
            title: this.plugin.i18n.settingS3Region || " (Region)",
            description: this.plugin.i18n.settingS3RegionDesc || "хранение， us-east-1",
            createActionElement: () => s3RegionInput,
        });

        // S3 хранение
        setting.addItem({
            title: this.plugin.i18n.settingS3Bucket || "хранение (Bucket)",
            description: this.plugin.i18n.settingS3BucketDesc || "дляхранениеподелитьсяресурсхранение",
            createActionElement: () => s3BucketInput,
        });

        // Access Key ID
        setting.addItem({
            title: this.plugin.i18n.settingS3AccessKey || "Access Key ID",
            description: this.plugin.i18n.settingS3AccessKeyDesc || "S3 доступключ ID（Сохранитьлокальный компьютер）",
            createActionElement: () => s3AccessKeyInput,
        });

        // Secret Access Key
        setting.addItem({
            title: this.plugin.i18n.settingS3SecretKey || "Secret Access Key",
            description: this.plugin.i18n.settingS3SecretKeyDesc || "S3 доступключ（Сохранитьлокальный компьютер）",
            createActionElement: () => s3SecretKeyInput,
        });

        // пользовательскийдомен
        setting.addItem({
            title: this.plugin.i18n.settingS3CustomDomain || "пользовательский CDN домен",
            description: this.plugin.i18n.settingS3CustomDomainDesc || "，использованиепользовательскийдомендоступресурс， https://cdn.example.com",
            createActionElement: () => s3CustomDomainInput,
        });

        // путьпрефикс
        setting.addItem({
            title: this.plugin.i18n.settingS3PathPrefix || "путьпрефикс",
            description: this.plugin.i18n.settingS3PathPrefixDesc || "хранениеобъектовпутьпрефикс，длягруппаструктурыфайлструктура",
            createActionElement: () => s3PathPrefixInput,
        });
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
