import { Job } from '../../queue'
import { User } from '../../users/User'
import { UserEvent } from '../../users/UserEvent'
import { PushTemplate } from '../../render/Template'
import { createEvent } from '../../users/UserEventRepository'
import { MessageTrigger } from '../MessageTrigger'
import { loadChannel } from '../../config/channels'
import Campaign from '../../campaigns/Campaign'
import PushError from './PushError'
import { disableNotifications } from '../../users/UserRepository'

export default class PushJob extends Job {
    static $name = 'push'

    static from(data: MessageTrigger): PushJob {
        return new this(data)
    }

    static async handler({ campaign_id, user_id, event_id }: MessageTrigger) {

        // Pull user & event details
        const user = await User.find(user_id)
        const event = await UserEvent.find(event_id)
        const campaign = await Campaign.find(campaign_id)
        const template = await PushTemplate.find(campaign?.template_id)

        // If user or template has been deleted since, abort
        if (!user || !template || !campaign) return

        const context = {
            campaign_id: campaign?.id,
            template_id: template?.id,
        }

        try {
            // Send and render push
            const channel = await loadChannel(user.project_id, 'push')
            await channel.send(template, { user, event, context })

            // Create an event on the user about the push
            await createEvent({
                project_id: user.project_id,
                user_id: user.id,
                name: 'push_sent',
                data: context,
            })

        } catch (error) {
            if (error instanceof PushError) {

                // If the push is unable to send, find invalidated tokens
                // and disable those devices
                await disableNotifications(user.id, error.invalidTokens)

                // Create an event about the disabling
                await createEvent({
                    project_id: user.project_id,
                    user_id: user.id,
                    name: 'notifications_disabled',
                    data: {
                        ...context,
                        tokens: error.invalidTokens,
                    },
                })
            }
        }
    }
}
