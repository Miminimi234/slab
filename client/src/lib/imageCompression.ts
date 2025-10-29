export interface ImageCompressionOptions {
    maxBytes?: number;
    maxWidth?: number;
    maxHeight?: number;
    minQuality?: number;
    qualityStep?: number;
    minScale?: number;
    outputType?: string;
}

export interface CompressedImageResult {
    dataUrl: string;
    contentType: string;
    originalSize: number;
    compressedSize: number;
    width: number;
    height: number;
    wasCompressed: boolean;
}

const DEFAULT_OPTIONS: Required<ImageCompressionOptions> = {
    maxBytes: 50 * 1024,
    maxWidth: 512,
    maxHeight: 512,
    minQuality: 0.5,
    qualityStep: 0.1,
    minScale: 0.35,
    outputType: "image/webp",
};

const readFileAsDataUrl = (file: File): Promise<string> =>
    new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve((reader.result as string) ?? "");
        reader.onerror = () => reject(reader.error ?? new Error("Failed to read file"));
        reader.readAsDataURL(file);
    });

const loadImage = (dataUrl: string): Promise<HTMLImageElement> =>
    new Promise((resolve, reject) => {
        const image = new Image();
        image.onload = () => resolve(image);
        image.onerror = () => reject(new Error("Failed to load image"));
        image.src = dataUrl;
    });

const canvasToBlob = (canvas: HTMLCanvasElement, type: string, quality?: number): Promise<Blob> =>
    new Promise((resolve, reject) => {
        canvas.toBlob((blob) => {
            if (blob) {
                resolve(blob);
            } else {
                reject(new Error("Canvas compression failed"));
            }
        }, type, quality);
    });

const blobToDataUrl = (blob: Blob): Promise<string> =>
    new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve((reader.result as string) ?? "");
        reader.onerror = () => reject(reader.error ?? new Error("Failed to convert blob to data URL"));
        reader.readAsDataURL(blob);
    });

export async function compressImageFile(
    file: File,
    options: ImageCompressionOptions = {}
): Promise<CompressedImageResult> {
    if (!file.type.startsWith("image/")) {
        throw new Error("Unsupported file type");
    }

    const settings = { ...DEFAULT_OPTIONS, ...options };
    const originalDataUrl = await readFileAsDataUrl(file);
    const image = await loadImage(originalDataUrl);

    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    if (!ctx) {
        throw new Error("Canvas not supported in this environment");
    }

    const baseScale = Math.min(
        1,
        settings.maxWidth / image.width,
        settings.maxHeight / image.height
    );

    let scale = Number.isFinite(baseScale) && baseScale > 0 ? baseScale : 1;
    let quality = 0.92;
    let targetType = settings.outputType || file.type || "image/png";

    const applyScale = () => {
        const targetWidth = Math.max(1, Math.round(image.width * scale));
        const targetHeight = Math.max(1, Math.round(image.height * scale));
        canvas.width = targetWidth;
        canvas.height = targetHeight;
        ctx.clearRect(0, 0, targetWidth, targetHeight);
        ctx.drawImage(image, 0, 0, targetWidth, targetHeight);
    };

    const tryGenerateBlob = async (): Promise<Blob> => {
        try {
            return await canvasToBlob(canvas, targetType, quality);
        } catch (error) {
            if (targetType !== "image/jpeg") {
                targetType = "image/jpeg";
                return canvasToBlob(canvas, targetType, quality);
            }
            throw error;
        }
    };

    applyScale();

    let blob = await tryGenerateBlob();
    let iterations = 0;

    while (blob.size > settings.maxBytes && iterations < 10) {
        iterations += 1;

        if (quality > settings.minQuality + settings.qualityStep) {
            quality = Math.max(settings.minQuality, quality - settings.qualityStep);
        } else if (scale > settings.minScale) {
            scale = Math.max(settings.minScale, scale * 0.85);
            applyScale();
        } else {
            break;
        }

        blob = await tryGenerateBlob();
    }

    const compressedDataUrl = await blobToDataUrl(blob);

    return {
        dataUrl: compressedDataUrl,
        contentType: blob.type || targetType,
        originalSize: file.size,
        compressedSize: blob.size,
        width: canvas.width,
        height: canvas.height,
        wasCompressed: blob.size < file.size,
    };
}
