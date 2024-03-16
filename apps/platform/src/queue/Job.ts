import App from '../app'

interface JobOptions {
    delay?: number // Milliseconds
    attempts?: number
    jobId?: string
}

export interface EncodedJob {
    data: any
    options: JobOptions
    name: string
    token?: string
}

export class JobError extends Error {}
export class RetryError extends JobError {}

export default class Job implements EncodedJob {
    data: any
    options: JobOptions = {
        delay: 0,
        attempts: 3,
    }

    static $name: string = Job.constructor.name

    get name() {
        return this.$static.$name
    }

    get $static() {
        return this.constructor as typeof Job
    }

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    static async handler(data: any, raw?: EncodedJob): Promise<any> {
        return Promise.reject(new Error('Handler not defined.'))
    }

    static from(...args: any[]): Job {
        return new this({ ...args })
    }

    async queue() {
        return App.main.queue.enqueue(this)
    }

    async handle<T>(): Promise<T> {
        return this.$static.handler(this.data, this)
    }

    constructor(data: any) {
        this.data = data
    }

    delay(milliseconds: number) {
        this.options.delay = milliseconds
        return this
    }

    jobId(id: string) {
        this.options.jobId = id
        return this
    }

    toJSON() {
        return {
            name: this.name,
            data: this.data,
            options: this.options,
        }
    }
}
