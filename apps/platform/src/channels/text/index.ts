import Router from '@koa/router'
import { ProviderMeta } from '../Provider'
import { getProviderByExternalId, loadProvider } from '../ProviderRepository'
import LoggerTextProvider from './LoggerTextProvider'
import NexmoTextProvider from './NexmoTextProvider'
import PlivoTextProvider from './PlivoTextProvider'
import TextChannel from './TextChannel'
import { TextProvider, TextProviderName } from './TextProvider'
import TwilioTextProvider from './TwilioTextProvider'

const typeMap = {
    nexmo: NexmoTextProvider,
    plivo: PlivoTextProvider,
    twilio: TwilioTextProvider,
    logger: LoggerTextProvider,
}

export const providerMap = (record: { type: TextProviderName }): TextProvider => {
    return typeMap[record.type].fromJson(record)
}

export const loadTextChannel = async (providerId: number, projectId: number): Promise<TextChannel | undefined> => {
    const provider = await loadProvider(providerId, projectId, providerMap)
    if (!provider) return
    return new TextChannel(provider)
}

export const loadTextChannelInbound = async (inboundNumber: string): Promise<TextChannel | undefined> => {
    const provider = await getProviderByExternalId(inboundNumber, providerMap)
    if (!provider) return
    return new TextChannel(provider)
}

export const loadTextControllers = async (router: Router, providers: ProviderMeta[]) => {
    for (const type of Object.values(typeMap)) {
        const controllers = type.controllers()
        router.use(
            controllers.routes(),
            controllers.allowedMethods(),
        )
        providers.push({
            ...type.meta,
            type: type.namespace,
            channel: 'text',
            schema: type.schema,
        })
    }
}
