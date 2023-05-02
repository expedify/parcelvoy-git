import Job from '../../queue/Job'
import { createEvent } from '../../users/UserEventRepository'
import { MessageTrigger } from '../MessageTrigger'
import { updateSendState } from '../../campaigns/CampaignService'
import { loadEmailChannel } from '.'
import { loadSendJob, requeueSend, throttleSend } from '../MessageTriggerService'
import { EmailTemplate } from '../../render/Template'
import { EncodedJob } from '../../queue'
import App from '../../app'

export default class EmailJob extends Job {
    static $name = 'email'

    static from(data: MessageTrigger): EmailJob {
        return new this(data)
    }

    static async handler(trigger: MessageTrigger, raw: EncodedJob) {
        const data = await loadSendJob<EmailTemplate>(trigger)
        if (!data) return

        const { campaign, template, user, project, event, context } = data

        // Send and render email
        const channel = await loadEmailChannel(campaign.provider_id, project.id)
        if (!channel) {
            await updateSendState(campaign, user, 'failed')
            return
        }

        // Check current send rate, if exceeded then requeue job
        // at a time in the future
        const rateCheck = await throttleSend(channel)
        if (rateCheck?.exceeded) {

            // Mark state as throttled so it is not continuously added
            // to the queue
            await updateSendState(campaign, user, 'throttled')

            // Schedule the resend for after the throttle finishes
            await requeueSend(raw, rateCheck.msRemaining)
            return
        }

        try {
            await channel.send(template, { user, event, context })
        } catch (error: any) {

            // On error, mark as failed and notify just in case
            await updateSendState(campaign, user, 'failed')
            App.main.error.notify(error)
        }

        // Update send record
        await updateSendState(campaign, user)

        // Create an event on the user about the email
        await createEvent(user, {
            name: 'email_sent',
            data: context,
        })
    }
}
