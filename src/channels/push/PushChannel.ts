import { PushTemplate } from '../../render/Template'
import Render, { Variables } from '../../render'
import { PushProvider } from './PushProvider'

export default class PushChannel {
    readonly provider: PushProvider
    constructor(provider?: PushProvider) {
        if (provider) {
            this.provider = provider
        } else {
            throw new Error('A valid push notification provider must be defined!')
        }
    }

    async send(options: PushTemplate, variables: Variables) {

        // Find tokens from active devices with push enabled
        const tokens = variables.user.pushEnabledDevices.map(device => device.token)

        const custom = Object.keys(options.custom).reduce((body, key) => {
            body[key] = Render(options.custom[key], variables)
            return body
        }, {} as Record<string, any>)

        const push = {
            tokens,
            topic: options.topic,
            title: Render(options.title, variables),
            body: Render(options.body, variables),
            custom,
        }

        await this.provider.send(push)
    }
}
