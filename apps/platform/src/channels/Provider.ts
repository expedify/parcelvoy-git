import Model, { ModelParams } from '../core/Model'
import { JSONSchemaType } from '../core/validate'

export type ProviderGroup = 'email' | 'text' | 'push' | 'webhook'
export interface ProviderMeta {
    name: string
    description?: string
    url?: string
    icon?: string
    type: string
    channel: string
    schema?: any
}

export const ProviderSchema = <T extends ExternalProviderParams, D>(id: string, data: JSONSchemaType<D>): JSONSchemaType<T> => {
    return {
        $id: id,
        type: 'object',
        required: ['data'],
        properties: {
            name: {
                type: 'string',
                nullable: true,
            },
            external_id: {
                type: 'string',
                nullable: true,
            },
            data,
        },
        additionalProperties: false,
    } as any
}

export default class Provider extends Model {
    type!: string
    name!: string
    project_id!: number
    external_id?: string
    group!: ProviderGroup
    data!: Record<string, any>

    static jsonAttributes = ['data']

    static namespace = this.name
    static meta: Omit<ProviderMeta, 'channel' | 'type'> = {
        name: '',
        description: '',
        url: '',
    }

    static get cacheKey() {
        return {
            external(externalId: string) {
                return `providers_external_${externalId}`
            },
            internal(id: number) {
                return `providers_${id}`
            },
        }
    }

    static externalCacheKey(externalId: string) {
        return `providers_${externalId}`
    }

    parseJson(json: any): void {
        super.parseJson(json)

        Object.assign(this, this.data)
    }

    static schema: any = ProviderSchema('providerParams', {
        type: 'object',
        nullable: true,
        additionalProperties: true,
    } as any)
}

export type ProviderMap<T extends Provider> = (record: any) => T

export type ProviderParams = Omit<Provider, ModelParams>

export type ExternalProviderParams = Omit<ProviderParams, 'group'>
