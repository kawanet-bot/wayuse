import type {CDP} from "./cdp.ts"

export interface PageVideo {
    x: number
    y: number
    width: number
    height: number
    visibleArea: number
}

// Runs inside the page. Positions are the viewport's, as a capture is, so a video scrolled away has a negative one.
const getVideosFn = () => {
    const videos: PageVideo[] = []
    const toFixed1 = (num: number) => (Math.round(num * 10) / 10)
    document.querySelectorAll("video").forEach(video => {
        const rect = video.getBoundingClientRect()
        const width = toFixed1(rect.width)
        if (!width) return
        const height = toFixed1(rect.height)
        if (!height) return
        const x = toFixed1(rect.left)
        const y = toFixed1(rect.top)
        const visibleWidth = Math.max(0, Math.min(rect.right, window.innerWidth) - Math.max(rect.left, 0))
        const visibleHeight = Math.max(0, Math.min(rect.bottom, window.innerHeight) - Math.max(rect.top, 0))
        const visibleArea = Math.round(visibleWidth * visibleHeight)
        videos.push({x, y, width, height, visibleArea})
    })
    return {videos, dpr: window.devicePixelRatio}
}

/**
 * A rectangle in the capture's pixels, in ImageMagick's notation: "880x495+16-427".
 */
export const toGeometry = (video: PageVideo, scale: number): string => {
    const width = Math.floor(video.width * scale)
    const height = Math.floor(video.height * scale)
    const x = Math.round(video.x * scale) || 0
    const y = Math.round(video.y * scale) || 0
    const offset = (n: number) => (n < 0 ? `${n}` : `+${n}`)
    return `${width}x${height}${offset(x)}${offset(y)}`
}

/** The video a viewer is looking at: a player may keep a second one of the same size off screen. */
export const mainVideoOf = (videos: PageVideo[]): PageVideo | undefined =>
    [...videos].sort((a, b) => (b.visibleArea - a.visibleArea) || (b.width * b.height - a.width * a.height))[0]

/**
 * Where the page's main video is in a capture of the attached page, or undefined without one.
 */
export const getVideoGeometry = async (cdp: CDP, sessionId: string): Promise<string | undefined> => {
    const {result} = await cdp.send("Runtime.evaluate", {expression: `(${getVideosFn})()`, returnByValue: true}, sessionId)
    const {videos, dpr} = result.value as {videos: PageVideo[], dpr: number}
    const video = mainVideoOf(videos)
    return video && toGeometry(video, dpr)
}
