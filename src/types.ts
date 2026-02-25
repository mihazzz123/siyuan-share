export interface S3Config {
    enabled: boolean;
    endpoint: string;
    region: string;
    bucket: string;
    accessKeyId: string;
    secretAccessKey: string;
    customDomain?: string;
    pathPrefix?: string;
    enablePasteUpload?: boolean;  // загрузка
    /**
     * хранениепредоставить：
     * aws:  AWS S3  или （использование Signature V4）
     * oss:  OSS（использование HMAC-SHA1 ）
     *  aws
     */
    provider?: 'aws' | 'oss';
}

export interface ShareOptions {
    docId: string;
    docTitle: string;
    requirePassword: boolean;
    password?: string;
    expireDays: number;
    isPublic: boolean;
}

/**
 * Информация о ссылаемом блоке
 */
export interface BlockReference {
    blockId: string;
    content: string;
    displayText?: string;
    refCount?: number;
}

/**
 * документсодержимоессылкаБлок
 */
export interface DocContentWithRefs {
    content: string;
    references: BlockReference[];
}

export interface ShareRecord {
    id: string;
    docId: string;
    docTitle: string;
    shareUrl: string;
    requirePassword: boolean;
    expireAt: number;
    isPublic: boolean;
    createdAt: number;
    updatedAt: number;
    viewCount?: number;
    reused?: boolean;
}

export interface ShareResponse {
    code: number;
    msg: string;
    data: {
        shareId: string;
        shareUrl: string;
        docId: string;
        docTitle: string;
        requirePassword: boolean;
        expireAt: string;
        isPublic: boolean;
        createdAt: string;
        updatedAt: string;
        reused: boolean;
    };
}

export interface ShareListResponse {
    code: number;
    msg: string;
    data: {
        shares: ShareRecord[];
    };
}

export interface SiyuanKernelResponse<T = any> {
    code: number;
    msg: string;
    data: T;
}

/**
 * Kramdown API формат
 */
export interface KramdownResponse {
    code: number;
    msg: string;
    data: {
        id: string;
        kramdown: string;
    };
}

/**
 * Блок
 */
export interface BlockAttrsResponse {
    code: number;
    msg: string;
    data: Record<string, string>;
}

/**
 * SQL 
 */
export interface SqlQueryResponse {
    code: number;
    msg: string;
    data: Array<Record<string, any>>;
}

export interface BatchDeleteShareResponseData {
    deleted?: string[];
    notFound?: string[];
    failed?: Record<string, string>;
    deletedAllCount?: number;
}

export interface BatchDeleteShareResponse {
    code: number;
    msg: string;
    data: BatchDeleteShareResponseData;
}

/**
 * ресурсзагрузкапрогресс
 */
export interface UploadProgress {
    fileName: string;       // файл
    current: number;        // текущийзагрузка
    total: number;          // 
    percentage: number;     //  (0-100)
    status: 'pending' | 'uploading' | 'success' | 'error';  // статус
    error?: string;         // Ошибка
}

/**
 * загрузкапрогресс
 */
export type UploadProgressCallback = (progress: UploadProgress) => void;

/**
 * загрузкапрогресс
 */
export interface BatchUploadProgress {
    totalFiles: number;     // файл
    completedFiles: number; // файл
    currentFile: string;    // текущийобработкафайл
    overallProgress: number; // прогресс (0-100)
    files: Map<string, UploadProgress>; // файлпрогресс
}

/**
 * ресурсзагрузказапись
 */
export interface AssetUploadRecord {
    localPath: string;     // локальныйфайлпуть（workspace）
    s3Key: string;         // S3хранение
    s3Url: string;         // S3доступURL
    contentType: string;   // файлMIME
    size: number;          // файл（）
    hash: string;          // файл（для）
    uploadedAt: number;    // загрузкавремени
}

/**
 * документресурсзапись
 */
export interface DocAssetMapping {
    docId: string;
    shareId: string;
    assets: AssetUploadRecord[];
    createdAt: number;
    updatedAt: number;
}
