import Router from '@koa/router'
import nodemailer from 'nodemailer'
import { ExternalProviderParams, ProviderSchema } from '../Provider'
import { createController } from '../ProviderService'
import EmailProvider from './EmailProvider'

interface SMTPDataParams {
    host: string
    port: number
    secure: boolean
    auth: { user: string, pass: string }
}

type SMTPEmailProviderParams = Pick<SMTPEmailProvider, keyof ExternalProviderParams>

export default class SMTPEmailProvider extends EmailProvider {
    host!: string
    port!: number
    secure!: boolean
    auth!: { user: string, pass: string }

    declare data: SMTPDataParams

    static namespace = 'smtp'
    static meta = {
        name: 'SMTP',
        icon: 'https://parcelvoy.com/images/smtp.svg',
    }

    static schema = ProviderSchema<SMTPEmailProviderParams, SMTPDataParams>('smtpProviderParams', {
        type: 'object',
        required: ['host', 'port', 'secure', 'auth'],
        properties: {
            host: { type: 'string' },
            port: { type: 'number' },
            secure: { type: 'boolean' },
            auth: {
                type: 'object',
                required: ['user', 'pass'],
                properties: {
                    user: { type: 'string' },
                    pass: { type: 'string' },
                },
            },
        },
        additionalProperties: false,
    })

    boot() {
        this.transport = nodemailer.createTransport({
            host: this.host,
            port: this.port,
            secure: this.secure,
            auth: this.auth,
        })
    }

    static controllers(): Router {
        return createController('email', this.namespace, this.schema)
    }
}
