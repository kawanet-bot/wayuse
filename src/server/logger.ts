import type {MiddlewareHandler} from "hono"

export interface Writer {
    write(text: string): unknown
}

export interface LoggerOptions {
    /** The destination of the lines. */
    stderr: Writer
}

/**
 * The access log in morgan's tiny format, without a time: journald or `docker logs -t` adds one.
 */
export const logger = ({stderr}: LoggerOptions): MiddlewareHandler => async (c, next) => {
    const started = performance.now()
    await next()
    const {status} = c.res
    const {method, url} = c.req
    const path = url.slice(url.indexOf("/", 8))
    // A body's length is known only once it is written, after the chain, so a "-" stands for one.
    const length = c.res.headers.get("content-length") ?? (c.res.body == null ? "0" : "-")
    stderr.write(`${method} ${path} ${status} ${length} - ${(performance.now() - started).toFixed(3)} ms\n`)
}
