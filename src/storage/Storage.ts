import { DriverConfig } from '../config/env'
import { ImageStream } from './ImageStream'
import Image from './Image'
import { S3Config, S3StorageProvider } from './S3StorageProvider'
import { StorageProvider, StorageProviderName } from './StorageProvider'
import path from 'path'
import { uuid } from '../utilities'
import { InternalError } from '../core/errors'
import StorageError from './StorageError'

export type StorageConfig = S3Config
export interface StorageTypeConfig extends DriverConfig {
    driver: StorageProviderName
}

export interface ImageUpload {
    extension: string
}

export default class Storage {
    provider: StorageProvider

    constructor(config?: StorageConfig) {
        if (config?.driver === 's3') {
            this.provider = new S3StorageProvider(config)
        } else {
            throw new InternalError(StorageError.UndefinedStorageMethod)
        }
    }

    async upload(image: ImageStream): Promise<Partial<Image>> {
        const key = uuid()
        const originalPath = path.parse(image.metadata.fileName)
        const extension = originalPath.ext
        const fileName = originalPath.name
        const url = `${key}${extension}`

        await this.provider.upload({
            stream: image.file,
            url,
        })

        return {
            uuid: key,
            original_name: fileName,
            extension,
            file_size: image.metadata.size,
        }
    }
}
