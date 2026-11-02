import imageCompression from "browser-image-compression";

/** 사진 압축 (2장): 긴 변 1600px, 품질 0.8, 목표 500KB 이하, JPEG */
export async function compressPhoto(file: File): Promise<{ blob: Blob; width: number; height: number }> {
  const blob = await imageCompression(file, {
    maxWidthOrHeight: 1600,
    initialQuality: 0.8,
    maxSizeMB: 0.5,
    fileType: "image/jpeg",
    // 웹 워커는 라이브러리를 외부 CDN 에서 받아 오므로 쓰지 않는다
    useWebWorker: false,
  });
  const { width, height } = await imageSize(blob);
  return { blob, width, height };
}

function imageSize(blob: Blob): Promise<{ width: number; height: number }> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(blob);
    const img = new Image();
    img.onload = () => {
      resolve({ width: img.naturalWidth, height: img.naturalHeight });
      URL.revokeObjectURL(url);
    };
    img.onerror = () => {
      resolve({ width: 0, height: 0 });
      URL.revokeObjectURL(url);
    };
    img.src = url;
  });
}
