import { ClientAliasParams, ClientIdentity } from '../client/Client'
import { SearchParams } from '../core/searchParams'
import { Device, DeviceParams, User } from '../users/User'

export const getUser = async (id: number): Promise<User | undefined> => {
    return await User.find(id)
}

export const getUserFromClientId = async (projectId: number, identity: Partial<ClientIdentity>): Promise<User | undefined> => {
    return await User.first(
        qb => qb.where(sqb => {
            if (identity.external_id) {
                sqb.where('external_id', identity.external_id)
            }
            if (identity.anonymous_id) {
                sqb.orWhere('anonymous_id', identity.anonymous_id)
            }
        }).where('project_id', projectId),
    )
}

export const getUserFromPhone = async (projectId: number, phone: string): Promise<User | undefined> => {
    return await User.first(
        qb => qb.where('phone', phone)
            .where('project_id', projectId),
    )
}

export const pagedUsers = async (params: SearchParams, projectId: number) => {
    return await User.searchParams(
        params,
        ['email', 'phone'],
        b => b.where({ project_id: projectId }),
    )
}

export const aliasUser = async (projectId: number, alias: ClientAliasParams): Promise<User | undefined> => {
    const user = await getUserFromClientId(projectId, alias)
    if (!user) return
    return await User.updateAndFetch(user.id, { external_id: alias.external_id })
}

export const saveDevice = async (projectId: number, { external_id, anonymous_id, ...params }: DeviceParams): Promise<Device | undefined> => {

    const user = await getUserFromClientId(projectId, { external_id, anonymous_id })
    if (!user) return

    const device = user.devices.find(
        device => device.device_id === params.device_id,
    )
    if (device) {
        Object.assign(device, params)
    } else {
        user.devices.push(Device.fromJson({
            ...params,
            device_id: params.device_id,
        }))
    }
    await User.updateAndFetch(user.id, { devices: user.devices })
    return device
}

export const disableNotifications = async (userId: number, tokens: string[]): Promise<boolean> => {
    const user = await User.find(userId)
    if (!user) return false
    const device = user.devices.find(device => device.token && tokens.includes(device.token))
    if (device) device.notifications_enabled = false
    await User.update(qb => qb.where('id', userId), {
        devices: user.devices,
    })
    return true
}
