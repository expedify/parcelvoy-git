import * as dotenv from 'dotenv'
import type { StorageConfig } from '../storage/Storage'
import type { QueueConfig } from '../queue/Queue'
import type { DatabaseConfig } from './database'
import type { AuthConfig } from '../auth/Auth'

export type Runner = 'api' | 'worker'
export interface Env {
    runners: Runner[]
    db: DatabaseConfig
    queue: QueueConfig
    storage: StorageConfig
    baseUrl: string
    port: number
    secret: string
    auth: AuthConfig
    tracking: {
        linkWrap: boolean,
        deeplinkMirrorUrl: string | undefined,
    }
}

export interface DriverConfig {
    driver: string
}

type DriverLoaders<T> = Record<string, () => T>
const driver = <T extends DriverConfig>(driver: string | undefined, loaders: DriverLoaders<Omit<T, 'driver'>>) => {
    const driverKey = driver ?? 'logger'
    const loadedDriver = loaders[driverKey] ? loaders[driverKey]() : {}
    return { ...loadedDriver, driver: driverKey } as T
}

// 24 hours?
const defaultTokenLife = 24 * 60 * 60

type EnvType = 'production' | 'test'
export default (type?: EnvType): Env => {
    dotenv.config({ path: `.env${type === 'test' ? '.test' : ''}` })

    return {
        runners: (process.env.RUNNER ?? 'api,worker').split(',') as Runner[],
        db: {
            client: process.env.DB_CLIENT as 'mysql2' | 'postgres',
            connection: {
                host: process.env.DB_HOST!,
                user: process.env.DB_USERNAME!,
                password: process.env.DB_PASSWORD!,
                port: parseInt(process.env.DB_PORT!),
                database: process.env.DB_DATABASE!,
            },
        },
        queue: driver<QueueConfig>(process.env.QUEUE_DRIVER, {
            sqs: () => ({
                queueUrl: process.env.AWS_SQS_QUEUE_URL!,
                region: process.env.AWS_REGION!,
                credentials: {
                    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
                    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
                },
            }),
            redis: () => ({
                host: process.env.REDIS_HOST!,
                port: parseInt(process.env.REDIS_PORT!),
            }),
        }),
        storage: driver<StorageConfig>(process.env.STORAGE_DRIVER ?? 'local', {
            s3: () => ({
                baseUrl: process.env.STORAGE_BASE_URL,
                bucket: process.env.AWS_S3_BUCKET!,
                region: process.env.AWS_REGION!,
                credentials: {
                    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
                    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
                },
            }),
            local: () => ({
                baseUrl: process.env.STORAGE_BASE_URL,
            }),
        }),
        baseUrl: process.env.BASE_URL!,
        port: parseInt(process.env.PORT!),
        secret: process.env.APP_SECRET!,
        auth: driver<AuthConfig>(process.env.AUTH_DRIVER, {
            basic: () => ({
                tokenLife: defaultTokenLife,
                email: process.env.AUTH_BASIC_EMAIL!,
                password: process.env.AUTH_BASIC_PASSWORD!,
            }),
            saml: () => ({
                tokenLife: defaultTokenLife,
                callbackUrl: process.env.AUTH_SAML_CALLBACK_URL,
                entryPoint: process.env.AUTH_SAML_ENTRY_POINT_URL,
                issuer: process.env.AUTH_SAML_ISSUER,
                cert: process.env.AUTH_SAML_CERT,
                wantAuthnResponseSigned: process.env.AUTH_SAML_IS_AUTHN_SIGNED === 'true',
            }),
            openid: () => ({
                tokenLife: defaultTokenLife,
                issuerUrl: process.env.AUTH_OPENID_ISSUER_URL,
                clientId: process.env.AUTH_OPENID_CLIENT_ID,
                clientSecret: process.env.AUTH_OPENID_CLIENT_SECRET,
                redirectUri: process.env.AUTH_OPENID_REDIRECT_URI,
                domainWhitelist: (process.env.AUTH_OPENID_DOMAIN_WHITELIST || '').split(','),
            }),
            logger: () => ({
                tokenLife: defaultTokenLife,
            }),
        }),
        tracking: {
            linkWrap: (process.env.TRACKING_LINK_WRAP ?? 'true') === 'true',
            deeplinkMirrorUrl: process.env.TRACKING_DEEPLINK_MIRROR_URL,
        },
    }
}
