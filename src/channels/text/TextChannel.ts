import { TextTemplate } from '../../render/Template'
import render, { Variables } from '../../render'
import { TextProvider } from './TextProvider'

export default class TextChannel {
    private provider: TextProvider
    constructor(provider?: TextProvider) {
        if (provider) {
            this.provider = provider
        } else {
            throw new Error('A valid text message driver must be defined!')
        }
    }

    async send(options: TextTemplate, variables: Variables) {
        const message = {
            to: options.to,
            from: options.from,
            text: render(options.text, variables),
        }

        await this.provider.send(message)
    }
}
