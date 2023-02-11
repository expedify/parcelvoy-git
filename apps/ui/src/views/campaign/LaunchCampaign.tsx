import { formatISO } from 'date-fns'
import { useContext, useState } from 'react'
import api from '../../api'
import { CampaignContext, ProjectContext } from '../../contexts'
import { CampaignLaunchParams } from '../../types'
import OptionField from '../../ui/form/OptionField'
import SwitchField from '../../ui/form/SwitchField'
import TextField from '../../ui/form/TextField'
import FormWrapper from '../../ui/FormWrapper'
import Modal from '../../ui/Modal'

interface LaunchCampaignParams {
    open: boolean
    onClose: (open: boolean) => void
}

export default function LaunchCampaign({ open, onClose }: LaunchCampaignParams) {
    const [project] = useContext(ProjectContext)
    const [campaign, setCampaign] = useContext(CampaignContext)
    const [launchType, setLaunchType] = useState('now')

    async function handleLaunchCampaign(params: CampaignLaunchParams) {
        if (params.send_at) {
            params.send_at = formatISO(Date.parse(params.send_at))
        } else {
            params.send_at = formatISO(new Date())
        }
        const value = await api.campaigns.update(project.id, campaign.id, params)
        setCampaign(value)
        onClose(false)
    }

    return <Modal title="Launch Campaign" open={open} onClose={onClose}>
        <p>Please check to ensure all settings are correct before launching a campaign. A scheduled campaign can be aborted, but one sent immediately cannot.</p>
        <FormWrapper<CampaignLaunchParams>
            submitLabel="Launch"
            onSubmit={handleLaunchCampaign}>
            {form => <>
                <OptionField name="when"
                    label="Launch Period"
                    options={[{ key: 'now', label: 'Now' }, { key: 'later', label: 'Schedule' }]}
                    value={launchType}
                    onChange={setLaunchType} />
                {launchType === 'later' && <>
                    <TextField
                        type="datetime-local"
                        form={form}
                        name="send_at"
                        label="Send At" />
                    <SwitchField
                        form={form}
                        name="send_in_user_timezone"
                        label="Send In Users Timezone"
                        subtitle="Should the campaign go out at the selected time in the users timezone or in the project timezone?" />
                </>}
            </>}
        </FormWrapper>
    </Modal>
}
