import {type Slim, slim} from "html-slim"

// What a reader of the page has no use for, taken out so that the HTML is light to store and to read.
const DEFAULT_SLIM_OPTIONS: Slim.Options = {
    selector: [
        // Inline images, icons for the most part.
        `svg`,
        `img[src^="data:"]`,

        `noscript`,

        // Tracking pixels.
        `img[width="0"]`,
        `img[width="1"]`,
        `img[height="0"]`,
        `img[height="1"]`,

        // Frames that show nothing.
        `iframe[aria-hidden="true"]`,
        `iframe[src="about:blank"]`,
        `iframe[width="0"]`,
        `iframe[width="1"]`,
        `iframe[height="0"]`,
        `iframe[height="1"]`,
    ].join(", "),

    // Elements a framework adds for itself.
    // tag: /^(next-|nextjs-)/,

    // Class names a build tool generated, which mean nothing outside the page's own CSS.
    className: /^[_-]/,

    script: true,

    // Structured data is content, though it sits in a script element.
    ldJson: false,

    style: true,

    space: true,

    comment: false,
}

/** Lightens the HTML of a page as capture.html returns it. */
export const slimHtml: (html: string) => string = slim([DEFAULT_SLIM_OPTIONS])
