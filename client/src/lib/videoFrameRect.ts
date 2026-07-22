export type Rect = { left: number; top: number; width: number; height: number };

// The object-contain rectangle of a video with intrinsic size (videoW x videoH)
// centered inside a container (containerW x containerH). Preserves aspect ratio,
// so the returned rect always has the video's aspect and scales uniformly.
export function containVideoRect(
  containerW: number,
  containerH: number,
  videoW: number,
  videoH: number,
): Rect {
  if (containerW <= 0 || containerH <= 0 || videoW <= 0 || videoH <= 0) {
    return { left: 0, top: 0, width: 0, height: 0 };
  }
  const videoAspect = videoW / videoH;
  const containerAspect = containerW / containerH;
  let width: number;
  let height: number;
  if (containerAspect > videoAspect) {
    height = containerH;
    width = containerH * videoAspect;
  } else {
    width = containerW;
    height = containerW / videoAspect;
  }
  return { left: (containerW - width) / 2, top: (containerH - height) / 2, width, height };
}
