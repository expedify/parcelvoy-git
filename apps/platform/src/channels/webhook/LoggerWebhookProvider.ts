import Router from '@koa/router'
import { logger } from '../../config/logger'
import { randomInt, sleep } from '../../utilities'
import { ProviderParams, ProviderSchema } from '../Provider'
import { createController } from '../ProviderService'
import { Webhook, WebhookResponse } from './Webhook'
import { WebhookProvider } from './WebhookProvider'

export default class LoggerWebhookProvider extends WebhookProvider {
    addLatency?: boolean

    static namespace = 'logger'
    static meta = {
        name: 'Logger',
        icon: 'https://parcelvoy.com/images/logger.svg',
    }

    static schema = ProviderSchema<ProviderParams, any>('loggerWebhookProviderParams', {
        type: 'object',
    })

    async send(options: Webhook): Promise<WebhookResponse> {

        // Allow for having random latency to aid in performance testing
        if (this.addLatency) await sleep(randomInt())

        logger.info(options, 'provider:webhook:logger')
        return {
            message: options,
            success: true,
            response: '',
        }
    }

    static controllers(): Router {
        return createController('webhook', this.namespace, this.schema)
    }
}
