import { createProject } from '../../projects/ProjectService'
import Rule from '../../rules/Rule'
import { User } from '../../users/User'
import { JourneyStep, JourneyMap, JourneyGate, JourneyStepChild } from '../JourneyStep'

describe('JourneyGate', () => {

    const createUser = async () => {
        const email = 'test@test.com'
        const project = await createProject({ name: 'project' })
        return await User.insertAndFetch({ external_id: '1', email, project_id: project.id, data: {} })
    }

    describe('user gate', () => {
        const createGate = async (rule: Rule) => {
            return await JourneyGate.create(rule)
        }

        test('condition passes with valid equals rule', async () => {

            const user = await createUser()
            const entrance = await createGate({
                type: 'string',
                group: 'user',
                path: '$.email',
                operator: '=',
                value: user.email,
            })
            const value = await entrance.condition(user)

            expect(value).toBeTruthy()
        })

        test('condition fails with incorrect equals rule', async () => {

            const user = await createUser()
            const entrance = await createGate({
                type: 'string',
                group: 'user',
                path: '$.email',
                operator: '=',
                value: 'notequal@test.com',
            })
            const value = await entrance.condition(user)

            expect(value).toBeFalsy()
        })

        test('condition passes with valid not equals rule', async () => {

            const user = await createUser()
            const entrance = await createGate({
                type: 'string',
                group: 'user',
                path: '$.email',
                operator: '!=',
                value: 'notequal@test.com',
            })
            const value = await entrance.condition(user)

            expect(value).toBeTruthy()
        })

        test('condition passes with valid is set rule', async () => {

            const user = await createUser()
            const entrance = await createGate({
                type: 'string',
                group: 'user',
                path: '$.email',
                operator: 'is set',
            })
            const value = await entrance.condition(user)

            expect(value).toBeTruthy()
        })
    })
})

describe('Journey Map', () => {
    test('different options pick different paths', async () => {

        const user = User.fromJson({ data: { progress: 20 } })
        const step1 = await JourneyStep.insertAndFetch()
        const step2 = await JourneyStep.insertAndFetch()
        const step3 = await JourneyStep.insertAndFetch()

        const map = await JourneyMap.create('progress', {
            10: step1.id,
            20: step2.id,
            30: step3.id,
        })

        await Promise.all(([
            [10, step1],
            [20, step2],
            [30, step3],
        ] as const).map(([value, { id: child_id }]) => JourneyStepChild.insert({
            step_id: map.id,
            child_id,
            data: { value },
        })))

        const value1 = await map.next(user)
        expect(value1?.id).toEqual(step2.id)

        user.data.progress = 30
        const value2 = await map.next(user)
        expect(value2?.id).toEqual(step3.id)
    })
})
