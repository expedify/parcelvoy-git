import { cleanupExpiredRevokedTokens } from '../auth/TokenRepository'
import { subDays, subHours } from 'date-fns'
import nodeScheduler from 'node-schedule'
import App from '../app'
import ProcessCampaignsJob from '../campaigns/ProcessCampaignsJob'
import JourneyDelayJob from '../journey/JourneyDelayJob'
import ProcessListsJob from '../lists/ProcessListsJob'
import CampaignStateJob from '../campaigns/CampaignStateJob'
import UserSchemaSyncJob from '../schema/UserSchemaSyncJob'
import { uuid } from '../utilities'
import UpdateJourneysJob from '../journey/UpdateJourneysJob'
import ScheduledEntranceOrchestratorJob from '../journey/ScheduledEntranceOrchestratorJob'

export default (app: App) => {
    const scheduler = new Scheduler(app)
    scheduler.schedule({
        rule: '* * * * *',
        callback: () => {
            JourneyDelayJob.enqueueActive(app)
            app.queue.enqueue(ProcessCampaignsJob.from())
            app.queue.enqueue(CampaignStateJob.from())
        },
        lockLength: 120,
    })
    scheduler.schedule({
        rule: '*/5 * * * *',
        callback: () => {
            app.queue.enqueue(ProcessListsJob.from())
        },
        lockLength: 360,
    })
    scheduler.schedule({
        rule: '0 * * * *',
        callback: () => {
            cleanupExpiredRevokedTokens(subDays(new Date(), 1))
            app.queue.enqueue(UserSchemaSyncJob.from({
                delta: subHours(new Date(), 1),
            }))
            app.queue.enqueue(UpdateJourneysJob.from())
            app.queue.enqueue(ScheduledEntranceOrchestratorJob.from())
        },
    })
    return scheduler
}

interface Schedule {
    rule: string
    name?: string
    callback: () => void
    lockLength?: number
}

export class Scheduler {
    app: App
    constructor(app: App) {
        this.app = app
    }

    async schedule({ rule, name, callback, lockLength = 3600 }: Schedule) {
        nodeScheduler.scheduleJob(rule, async () => {
            const lock = await acquireLock({
                key: name ?? rule,
                owner: this.app.uuid,
                timeout: lockLength,
            })
            if (lock) {
                callback()
            }
        })
    }

    async close() {
        return await nodeScheduler.gracefulShutdown()
    }
}

interface LockParams {
    key: string
    owner?: string
    timeout?: number
}

export const acquireLock = async ({
    key,
    owner,
    timeout = 60,
}: LockParams) => {
    try {
        const result = await App.main.redis.set(
            `lock:${key}`,
            owner ?? uuid(),
            'EX',
            timeout,
            'NX',
        )

        // Because of the NX condition, value will only be set
        // if it hasn't been set already (original owner)
        if (result === null) {

            // Since we know there already is a lock, lets see if
            // it is this instance that owns it
            if (owner) {
                const value = await App.main.redis.get(`lock:${key}`)
                return value === owner
            }
            return false
        }
        return true
    } catch {
        return false
    }
}

export const releaseLock = async (key: string) => {
    await App.main.redis.del(`lock:${key}`)
}
