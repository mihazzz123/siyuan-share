import { showMessage } from "siyuan";
import type { AssetUploadRecord, S3Config, UploadProgressCallback } from "../types";

/**
 * S3 загрузка
 * ресурсзагрузка S3 хранение
 */
export class S3UploadService {
    private config: S3Config;

    constructor(config: S3Config) {
        this.config = config;
    }

    /**
     * загрузкафайл S3
     * @param file файлобъектов
     * @param localPath локальныйпуть（длязапись）
     * @param onProgress прогресс
     * @returns загрузказапись
     */
    async uploadFile(
        file: File, 
        localPath: string, 
        onProgress?: UploadProgressCallback,
        precomputedHash?: string
    ): Promise<AssetUploadRecord> {
        if (!this.config.enabled) {
            throw new Error("S3 хранение");
        }

        if (!this.validateConfig()) {
            throw new Error("S3 конфигурация");
        }

        // 
        if (onProgress) {
            onProgress({
                fileName: file.name,
                current: 0,
                total: file.size,
                percentage: 0,
                status: 'pending',
            });
        }

        try {
            // генерацияфайл（）
            const hash = precomputedHash || await this.calculateFileHash(file);
            
            //  S3 объектов
            const timestamp = Date.now();
            const ext = this.getFileExtension(file.name);
            const s3Key = `${this.config.pathPrefix || 'siyuan-share'}/${timestamp}-${hash}${ext}`;

            // загрузка S3
            if (onProgress) {
                onProgress({
                    fileName: file.name,
                    current: 0,
                    total: file.size,
                    percentage: 0,
                    status: 'uploading',
                });
            }

            const s3Url = await this.performUpload(file, s3Key, onProgress);

            // загрузкаУспешно
            if (onProgress) {
                onProgress({
                    fileName: file.name,
                    current: file.size,
                    total: file.size,
                    percentage: 100,
                    status: 'success',
                });
            }

            // возвратзагрузказапись
            return {
                localPath,
                s3Key,
                s3Url,
                contentType: file.type || this.guessContentType(file.name),
                size: file.size,
                hash,
                uploadedAt: timestamp,
            };
        } catch (error) {
            // загрузкаОшибка
            if (onProgress) {
                onProgress({
                    fileName: file.name,
                    current: 0,
                    total: file.size,
                    percentage: 0,
                    status: 'error',
                    error: error instanceof Error ? error.message : String(error),
                });
            }
            throw error;
        }
    }

    /**
     * загрузкафайл
     * @param files файллокальныйпуть
     * @param onProgress прогресс
     * @returns загрузказапись
     */
    async uploadFiles(
        files: Array<{ file: File; localPath: string }>,
        onProgress?: UploadProgressCallback
    ): Promise<AssetUploadRecord[]> {
        const results: AssetUploadRecord[] = [];
        const errors: string[] = [];

        for (const { file, localPath } of files) {
            try {
                const record = await this.uploadFile(file, localPath, onProgress);
                results.push(record);
            } catch (error) {
                console.error(`загрузкафайлОшибка: ${localPath}`, error);
                errors.push(`${localPath}: ${error instanceof Error ? error.message : String(error)}`);
            }
        }

        if (errors.length > 0) {
            showMessage(`файлзагрузкаОшибка:\n${errors.join('\n')}`, 5000, 'error');
        }

        return results;
    }

    /**
     * Удалить S3 файл
     * @param s3Key S3 объектов
     */
    async deleteFile(s3Key: string): Promise<void> {
        if (!this.config.enabled) {
            throw new Error("S3 хранение");
        }

        if (!this.validateConfig()) {
            throw new Error("S3 конфигурация");
        }

        try {
            await this.performDelete(s3Key);
        } catch (error) {
            console.error(`УдалитьфайлОшибка: ${s3Key}`, error);
            throw error;
        }
    }

    /**
     * Удалить S3 файл
     * @param s3Keys S3 объектов
     * @returns Удалить { success: УспешноУдалить, failed: Ошибка }
     */
    async deleteFiles(s3Keys: string[]): Promise<{ success: string[]; failed: string[] }> {
        const success: string[] = [];
        const failed: string[] = [];

        for (const s3Key of s3Keys) {
            try {
                await this.deleteFile(s3Key);
                success.push(s3Key);
            } catch (error) {
                console.error(`УдалитьфайлОшибка: ${s3Key}`, error);
                failed.push(s3Key);
            }
        }

        return { success, failed };
    }

    /**
     * S3 addressing resolver
     */
    private resolveAddressing(): 'path' | 'virtual' {
        const addr = this.config.addressing || 'auto';
        if (addr !== 'auto') return addr;

        const endpoint = this.config.endpoint.toLowerCase();
        // Heuristics for auto:
        // 1. If endpoint is an IP address or localhost or has a port, use path-style
        if (/:[0-9]+/.test(endpoint) || /^[0-9.]+$/.test(endpoint.replace(/^https?:\/\//, '')) || endpoint.includes('localhost')) {
            return 'path';
        }
        // 2. If it's not Amazon AWS, many self-hosted services prefer path-style
        if (!endpoint.includes('amazonaws.com')) {
            return 'path';
        }
        // 3. If bucket name contains dots and using HTTPS, use path-style (AWS requirement)
        if (this.config.bucket.includes('.') && endpoint.startsWith('https')) {
            return 'path';
        }

        return 'virtual';
    }

    /**
     * Build S3 request details
     */
    private buildS3Request(key: string) {
        const style = this.resolveAddressing();
        const endpointRaw = this.config.endpoint.replace(/^https?:\/\//, '').replace(/\/$/, '');
        const bucket = this.config.bucket;
        const isHttps = this.config.endpoint.startsWith('https');
        const protocol = isHttps ? 'https://' : 'http://';

        let url: string;
        let host: string;
        let canonicalUri: string;

        if (style === 'path') {
            url = `${protocol}${endpointRaw}/${bucket}/${key}`;
            host = endpointRaw;
            canonicalUri = `/${bucket}/${key.split('/').map(part => encodeURIComponent(part)).join('/')}`;
        } else {
            url = `${protocol}${bucket}.${endpointRaw}/${key}`;
            host = `${bucket}.${endpointRaw}`;
            canonicalUri = `/${key.split('/').map(part => encodeURIComponent(part)).join('/')}`;
        }

        return { url, host, canonicalUri };
    }

    /**
     *  S3 загрузка
     */
    private async performUpload(
        file: File, 
        s3Key: string,
        onProgress?: UploadProgressCallback
    ): Promise<string> {
        const { url, host, canonicalUri } = this.buildS3Request(s3Key);
        
        //  provider генерация
        const contentType = file.type || this.guessContentType(file.name);
        let headers: Record<string, string>;
        const provider = this.config.provider || 'aws';
        if (provider === 'oss') {
            headers = await this.generateOssHeaders('PUT', s3Key, contentType);
        } else {
            headers = await this.generateSignedHeaders(
                'PUT',
                s3Key,
                contentType,
                file.size,
                host,
                canonicalUri
            );
        }

        // использование XMLHttpRequest поддержказагрузкапрогресс（Ошибкаоткат forwardProxy загрузка）
        return new Promise((resolve, reject) => {
            const xhr = new XMLHttpRequest();
            const startTs = Date.now();
            const meta = { key: s3Key, size: file.size, name: file.name };
            console.debug('[S3Upload] start', meta, { url });
            
            // загрузкапрогресс
            if (onProgress) {
                xhr.upload.addEventListener('progress', (e) => {
                    if (e.lengthComputable) {
                        const percentage = Math.round((e.loaded / e.total) * 100);
                        onProgress({
                            fileName: file.name,
                            current: e.loaded,
                            total: e.total,
                            percentage,
                            status: 'uploading',
                        });
                    }
                });
            }

            // 
            xhr.addEventListener('load', () => {
                const duration = Date.now() - startTs;
                if (xhr.status >= 200 && xhr.status < 300) {
                    // возвратдоступ URL（использованиепользовательскийдомен или  URL）
                    if (this.config.customDomain) {
                        const domain = this.config.customDomain.replace(/\/$/, '');
                        const finalUrl = `${domain}/${s3Key}`;
                        console.debug('[S3Upload] success', { ...meta, duration, status: xhr.status, finalUrl });
                        resolve(finalUrl);
                    } else {
                        console.debug('[S3Upload] success', { ...meta, duration, status: xhr.status, finalUrl: url });
                        resolve(url);
                    }
                } else {
                    console.error('[S3Upload] http-error', { ...meta, status: xhr.status, resp: xhr.responseText, duration });
                    reject(new Error(`S3 загрузкаОшибка: HTTP ${xhr.status} - ${xhr.responseText}`));
                }
            });

            // Ошибка
            xhr.addEventListener('error', async () => {
                const duration = Date.now() - startTs;
                console.error('[S3Upload] network-error', { ...meta, duration });
                // попыткаиспользованиеSiYuanядро forwardProxy загрузка（ или /CORS）
                try {
                    if (onProgress) {
                        onProgress({ fileName: file.name, current: 0, total: file.size, percentage: 0, status: 'uploading' });
                    }
                    const proxiedUrl = await this.uploadViaForwardProxy(file, s3Key, headers, onProgress);
                    resolve(proxiedUrl);
                    return;
                } catch (proxyErr) {
                    reject(proxyErr instanceof Error ? proxyErr : new Error(String(proxyErr)));
                }
            });

            // ...
            xhr.addEventListener('abort', () => {
                const duration = Date.now() - startTs;
                console.warn('[S3Upload] aborted', { ...meta, duration });
                reject(new Error('загрузкаОтмена'));
            });

            // 
            xhr.open('PUT', url, true);
            //  header（ S3  Content-Length/Date ，просмотр Content-Length）
            
            // Настройки
            for (const key in headers) {
                if (headers.hasOwnProperty(key)) {
                    xhr.setRequestHeader(key, headers[key]);
                }
            }

            xhr.send(file);
        });
    }

    /**
     * черезSiYuanядро forwardProxy эндпоинтзагрузкафайл（/）
     *  URL Ошибкаоткат。
     * ядро Token конфигурация。
     */
    private async uploadViaForwardProxy(
        file: File,
        s3Key: string,
        originalHeaders: Record<string, string>,
        onProgress?: UploadProgressCallback
    ): Promise<string> {
        const { url } = this.buildS3Request(s3Key);

        // файл；forwardProxy ：url, method, headers, payload(base64)
        const arrayBuf = await file.arrayBuffer();
        const uint8 = new Uint8Array(arrayBuf);
        // Блок base64，избежание/
        const CHUNK = 0x8000; // 32KB
        let binary = '';
        for (let i = 0; i < uint8.length; i += CHUNK) {
            const slice = uint8.subarray(i, i + CHUNK);
            binary += String.fromCharCode.apply(null, Array.from(slice) as any);
        }
        const base64Payload = btoa(binary);

        // просмотр（Host ）
        const safeHeaders: Record<string, string> = {};
        for (const k of Object.keys(originalHeaders)) {
            if (/^host$/i.test(k)) continue;
            safeHeaders[k] = originalHeaders[k];
        }

        // прогрессполучение（），прогресс
        if (onProgress) {
            onProgress({ fileName: file.name, current: 0, total: file.size, percentage: 5, status: 'uploading' });
        }
        const configToken = (window as any).sharePlugin?.settings?.getConfig?.().siyuanToken || '';
        if (!configToken) throw new Error('forwardProxy Ошибка：SiYuanядро Token');
        const resp = await fetch('/api/network/forwardProxy', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Token ${configToken}`,
            },
            body: JSON.stringify({
                url,
                method: 'PUT',
                headers: safeHeaders,
                payload: base64Payload,
                // данныхдля（）
                meta: { s3Key, size: file.size, contentType: file.type || this.guessContentType(file.name) }
            })
        });
        const ct = resp.headers.get('content-type') || '';
        if (ct.includes('application/json')) {
            const result = await resp.json().catch(()=>({}));
            if (!resp.ok || (typeof result.code !== 'undefined' && result.code !== 0)) {
                throw new Error('forwardProxy загрузкаОшибка: ' + (result.msg || `HTTP ${resp.status}`));
            }
        } else if (!resp.ok) {
            throw new Error(`forwardProxy загрузкаОшибка: HTTP ${resp.status}`);
        }
        if (onProgress) {
            onProgress({ fileName: file.name, current: file.size, total: file.size, percentage: 100, status: 'success' });
        }
        // пользовательскийдоменобработка
        if (this.config.customDomain) {
            const domain = this.config.customDomain.replace(/\/$/, '');
            return `${domain}/${s3Key}`;
        }
        return url;
    }

    /**
     *  S3 Удалить
     */
    private async performDelete(s3Key: string): Promise<void> {
        const { url, host, canonicalUri } = this.buildS3Request(s3Key);
        
        const provider = this.config.provider || 'aws';
        let headers: Record<string, string>;
        if (provider === 'oss') {
            headers = await this.generateOssHeaders('DELETE', s3Key, '');
        } else {
            headers = await this.generateSignedHeaders(
                'DELETE',
                s3Key,
                '',
                0,
                host,
                canonicalUri
            );
        }

        return new Promise((resolve, reject) => {
            const xhr = new XMLHttpRequest();
            
            xhr.addEventListener('load', () => {
                if (xhr.status >= 200 && xhr.status < 300) {
                    resolve();
                } else if (xhr.status === 404) {
                    // файлне существует，считаетсяУдалитьУспешно
                    resolve();
                } else {
                    reject(new Error(`S3 УдалитьОшибка: HTTP ${xhr.status} - ${xhr.responseText}`));
                }
            });

            xhr.addEventListener('error', () => {
                reject(new Error('Ошибка，УдалитьОшибка'));
            });

            xhr.open('DELETE', url);
            
            for (const key in headers) {
                if (headers.hasOwnProperty(key)) {
                    xhr.setRequestHeader(key, headers[key]);
                }
            }

            xhr.send();
        });
    }

    /**
     * генерация AWS Signature V4 
     */
    private async generateSignedHeaders(
        method: string,
        key: string,
        contentType: string,
        contentLength: number,
        host: string,
        canonicalUri: string
    ): Promise<Record<string, string>> {
        const now = new Date();
        const dateStamp = this.formatDateStamp(now);
        const amzDate = this.formatAmzDate(now);

        //  1: создание
        const payloadHash = 'UNSIGNED-PAYLOAD';
        
        // （）
        const canonicalQueryString = '';
        
        // （сортировка：host, x-amz-content-sha256, x-amz-date）
        const canonicalHeaders = `host:${host}\n` +
            `x-amz-content-sha256:${payloadHash}\n` +
            `x-amz-date:${amzDate}\n`;
        
        // （ canonicalHeaders ）
        const signedHeaders = 'host;x-amz-content-sha256;x-amz-date';
        
        // 
        const canonicalRequest = 
            `${method}\n` +
            `${canonicalUri}\n` +
            `${canonicalQueryString}\n` +
            `${canonicalHeaders}\n` +
            `${signedHeaders}\n` +
            `${payloadHash}`;

        //  2: создание
        const algorithm = 'AWS4-HMAC-SHA256';
        const credentialScope = `${dateStamp}/${this.config.region}/s3/aws4_request`;
        
        // 
        const canonicalRequestHash = await this.sha256(canonicalRequest);
        
        const stringToSign = 
            `${algorithm}\n` +
            `${amzDate}\n` +
            `${credentialScope}\n` +
            `${canonicalRequestHash}`;

        //  3: 
        const signingKey = await this.getSignatureKey(
            this.config.secretAccessKey,
            dateStamp,
            this.config.region,
            's3'
        );
        
        const signature = await this.hmacSha256Hex(signingKey, stringToSign);

        //  4:  Authorization 
        const authorizationHeader = 
            `${algorithm} ` +
            `Credential=${this.config.accessKeyId}/${credentialScope}, ` +
            `SignedHeaders=${signedHeaders}, ` +
            `Signature=${signature}`;

        // возврат
        return {
            'Content-Type': contentType,
            'x-amz-date': amzDate,
            'x-amz-content-sha256': payloadHash,
            // возврат Host：просмотрНастройки，
            'Authorization': authorizationHeader,
        };
    }

    /**
     * генерация OSS （HMAC-SHA1）
     * ：https://help.aliyun.com/zh/oss/developer-reference/signature-methods
     *  AWS V4 ，OSS использование，
     */
    private async generateOssHeaders(
        method: string,
        key: string,
        contentType: string
    ): Promise<Record<string, string>> {
        const endpoint = this.config.endpoint.replace(/^https?:\/\//, '');
        const bucket = this.config.bucket;
        const resource = `/${bucket}/${key}`;
        const date = new Date().toUTCString();
        const contentMD5 = '';
        const canonicalizedOSSHeaders = '';
        const stringToSign = [
            method,
            contentMD5,
            contentType,
            date,
            canonicalizedOSSHeaders + resource
        ].join('\n');
        const signature = await this.hmacSha1Base64(this.config.secretAccessKey, stringToSign);
        return {
            'Date': date,
            'Content-Type': contentType || 'application/octet-stream',
            'Authorization': `OSS ${this.config.accessKeyId}:${signature}`,
        };
    }

    /**
     * HMAC-SHA1 возврат Base64 （для OSS）
     */
    private async hmacSha1Base64(secret: string, message: string): Promise<string> {
        const enc = new TextEncoder();
        const keyData = enc.encode(secret);
        const msgData = enc.encode(message);
        const cryptoKey = await crypto.subtle.importKey(
            'raw',
            keyData,
            { name: 'HMAC', hash: 'SHA-1' },
            false,
            ['sign']
        );
        const sigBuf = await crypto.subtle.sign('HMAC', cryptoKey, msgData);
        //  Base64
        const bytes = Array.from(new Uint8Array(sigBuf));
        const binary = bytes.map(b => String.fromCharCode(b)).join('');
        // просмотр btoa
        return btoa(binary);
    }

    /**
     *  SHA256 （）
     */
    private async sha256(message: string): Promise<string> {
        const encoder = new TextEncoder();
        const data = encoder.encode(message);
        const hashBuffer = await crypto.subtle.digest('SHA-256', data);
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        return hashArray.map(b => {
            const hex = b.toString(16);
            return hex.length === 1 ? '0' + hex : hex;
        }).join('');
    }

    /**
     * HMAC-SHA256 （возврат ArrayBuffer）
     */
    private async hmacSha256(key: ArrayBuffer | Uint8Array, message: string): Promise<ArrayBuffer> {
        const encoder = new TextEncoder();
        const messageData = encoder.encode(message);
        const cryptoKey = await crypto.subtle.importKey(
            'raw',
            key,
            { name: 'HMAC', hash: 'SHA-256' },
            false,
            ['sign']
        );
        return await crypto.subtle.sign('HMAC', cryptoKey, messageData);
    }

    /**
     * HMAC-SHA256 （возврат）
     */
    private async hmacSha256Hex(key: ArrayBuffer, message: string): Promise<string> {
        const signature = await this.hmacSha256(key, message);
        const signatureArray = Array.from(new Uint8Array(signature));
        return signatureArray.map(b => {
            const hex = b.toString(16);
            return hex.length === 1 ? '0' + hex : hex;
        }).join('');
    }

    /**
     * генерацияключ
     */
    private async getSignatureKey(
        secretKey: string,
        dateStamp: string,
        regionName: string,
        serviceName: string
    ): Promise<ArrayBuffer> {
        const encoder = new TextEncoder();
        const kDate = await this.hmacSha256(encoder.encode('AWS4' + secretKey), dateStamp);
        const kRegion = await this.hmacSha256(kDate, regionName);
        const kService = await this.hmacSha256(kRegion, serviceName);
        const kSigning = await this.hmacSha256(kService, 'aws4_request');
        return kSigning;
    }

    /**
     * файл
     */
    private async calculateFileHash(file: File): Promise<string> {
        const buffer = await file.arrayBuffer();
        const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        const hashHex = hashArray.map(b => {
            const hex = b.toString(16);
            return hex.length === 1 ? '0' + hex : hex;
        }).join('');
        return hashHex.substring(0, 16); // использование 16 
    }

    /**
     * публичный，
     */
    public async calculateFileHashPublic(file: File): Promise<string> {
        return this.calculateFileHash(file);
    }

    /**
     * получениефайл
     */
    private getFileExtension(filename: string): string {
        const lastDot = filename.lastIndexOf('.');
        return lastDot > 0 ? filename.substring(lastDot) : '';
    }

    /**
     * содержимое
     */
    private guessContentType(filename: string): string {
        const ext = this.getFileExtension(filename).toLowerCase();
        const mimeTypes: Record<string, string> = {
            '.jpg': 'image/jpeg',
            '.jpeg': 'image/jpeg',
            '.png': 'image/png',
            '.gif': 'image/gif',
            '.webp': 'image/webp',
            '.svg': 'image/svg+xml',
            '.pdf': 'application/pdf',
            '.mp4': 'video/mp4',
            '.mp3': 'audio/mpeg',
            '.zip': 'application/zip',
            '.txt': 'text/plain',
            '.md': 'text/markdown',
        };
        return mimeTypes[ext] || 'application/octet-stream';
    }

    /**
     * формат (YYYYMMDD)
     */
    private formatDateStamp(date: Date): string {
        const year = date.getUTCFullYear();
        const month = date.getUTCMonth() + 1;
        const day = date.getUTCDate();
        const monthStr = month < 10 ? '0' + month : String(month);
        const dayStr = day < 10 ? '0' + day : String(day);
        return `${year}${monthStr}${dayStr}`;
    }

    /**
     * формат AMZ  (YYYYMMDD'T'HHMMSS'Z')
     */
    private formatAmzDate(date: Date): string {
        const dateStamp = this.formatDateStamp(date);
        const hours = date.getUTCHours();
        const minutes = date.getUTCMinutes();
        const seconds = date.getUTCSeconds();
        const hoursStr = hours < 10 ? '0' + hours : String(hours);
        const minutesStr = minutes < 10 ? '0' + minutes : String(minutes);
        const secondsStr = seconds < 10 ? '0' + seconds : String(seconds);
        return `${dateStamp}T${hoursStr}${minutesStr}${secondsStr}Z`;
    }

    /**
     * конфигурация
     */
    private validateConfig(): boolean {
        return !!(
            this.config.enabled &&
            this.config.endpoint &&
            this.config.region &&
            this.config.bucket &&
            this.config.accessKeyId &&
            this.config.secretAccessKey
        );
    }
}
