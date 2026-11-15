/**
 * An error that answers the request with its own status, where any other error is a 500.
 */
export class HttpError extends Error {
    status: number

    constructor(status: number, message: string) {
        super(message)
        this.status = status
    }
}
