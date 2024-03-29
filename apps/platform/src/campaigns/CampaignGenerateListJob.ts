import { logger } from '../config/logger'
import { acquireLock, releaseLock } from '../core/Lock'
import { Job } from '../queue'
import { CampaignJobParams, SentCampaign } from './Campaign'
import CampaignEnqueueSendsJob from './CampaignEnqueueSendsJob'
import { estimatedSendSize, generateSendList, getCampaign } from './CampaignService'

export default class CampaignGenerateListJob extends Job {
    static $name = 'campaign_generate_list_job'

    static from(data: CampaignJobParams): CampaignGenerateListJob {
        return new this(data)
    }

    static async handler({ id, project_id }: CampaignJobParams) {
        const key = `campaign_generate_${id}`

        logger.info({ id }, 'campaign:generate:loading')
        const campaign = await getCampaign(id, project_id) as SentCampaign
        if (!campaign) return
        if (campaign.state === 'aborted' || campaign.state === 'draft') return

        // Increase lock duration based on estimated send size
        const estimatedSize = await estimatedSendSize(campaign)
        const lockTime = Math.ceil(Math.max(estimatedSize / 1000, 900))
        logger.info({ id, estimatedSize, lockTime }, 'campaign:generate:estimated_size')

        const acquired = await acquireLock({ key, timeout: lockTime })
        logger.info({ id, acquired }, 'campaign:generate:lock')
        if (!acquired) return

        logger.info({ id }, 'campaign:generate:querying')
        await generateSendList(campaign)

        logger.info({ id }, 'campaign:generate:sending')
        await CampaignEnqueueSendsJob.from({
            id: campaign.id,
            project_id: campaign.project_id,
        }).queue()

        await releaseLock(key)
    }
}
