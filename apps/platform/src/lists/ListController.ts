import Router from '@koa/router'
import { JSONSchemaType, validate } from '../core/validate'
import { extractQueryParams } from '../utilities'
import List, { ListCreateParams, ListUpdateParams } from './List'
import { archiveList, createList, deleteList, getList, getListUsers, importUsersToList, pagedLists, updateList } from './ListService'
import { searchParamsSchema } from '../core/searchParams'
import { ProjectState } from '../auth/AuthMiddleware'
import parse from '../storage/FileStream'
import { projectRoleMiddleware } from '../projects/ProjectService'

const router = new Router<
    ProjectState & { list?: List }
>({
    prefix: '/lists',
})

router.use(projectRoleMiddleware('editor'))

router.get('/', async ctx => {
    const params = extractQueryParams(ctx.query, searchParamsSchema)
    ctx.body = await pagedLists(params, ctx.state.project.id)
})

const ruleDefinition = (nullable = false) => ({
    type: 'object',
    required: ['type', 'group', 'path', 'operator'],
    properties: {
        type: { type: 'string', enum: ['wrapper', 'string', 'number', 'boolean', 'date', 'array'] },
        group: { type: 'string', enum: ['user', 'event'] },
        path: { type: 'string' },
        operator: { type: 'string' },
        value: {
            type: ['string', 'number', 'boolean'],
            nullable: true,
        },
        children: {
            type: 'array',
            nullable: true,
            minItems: 0,
            items: ({
                $ref: '#/definitions/rule',
            } as any),
        },
    },
    additionalProperties: false,
    nullable,
})

const listParams: JSONSchemaType<ListCreateParams> = {
    $id: 'listParams',
    definitions: {
        rule: ruleDefinition() as any,
    },
    oneOf: [{
        type: 'object',
        required: ['name', 'type', 'rule'],
        properties: {
            name: {
                type: 'string',
            },
            type: {
                type: 'string',
                enum: ['dynamic'],
            },
            rule: ({ $ref: '#/definitions/rule' } as any),
            tags: {
                type: 'array',
                items: {
                    type: 'string',
                },
                nullable: true,
            },
            is_visible: {
                type: 'boolean',
                nullable: true,
            },
            syncJourneys: {
                type: 'boolean',
                nullable: true,
            },
        },
        additionalProperties: false,
    },
    {
        type: 'object',
        required: ['name', 'type'],
        properties: {
            name: {
                type: 'string',
            },
            type: {
                type: 'string',
                enum: ['static'],
            },
            tags: {
                type: 'array',
                items: {
                    type: 'string',
                },
                nullable: true,
            },
            is_visible: {
                type: 'boolean',
                nullable: true,
            },
            syncJourneys: {
                type: 'boolean',
                nullable: true,
            },
        },
        additionalProperties: false,
    }] as any,
}

router.post('/', async ctx => {
    const payload = validate(listParams, ctx.request.body)
    ctx.body = await createList(ctx.state.project.id, payload)
})

router.param('listId', async (value, ctx, next) => {
    ctx.state.list = await getList(parseInt(value, 10), ctx.state.project.id)
    if (!ctx.state.list) {
        ctx.throw(404)
        return
    }
    return await next()
})

router.get('/:listId', async ctx => {
    ctx.body = ctx.state.list
})

const listUpdateParams: JSONSchemaType<ListUpdateParams> = {
    $id: 'listUpdateParams',
    definitions: {
        rule: ruleDefinition(true) as any,
    },
    type: 'object',
    required: ['name'],
    properties: {
        name: {
            type: 'string',
        },
        rule: ({ $ref: '#/definitions/rule' } as any),
        tags: {
            type: 'array',
            items: {
                type: 'string',
            },
            nullable: true,
        },
        syncJourneys: {
            type: 'boolean',
            nullable: true,
        },
    },
    additionalProperties: false,
}
router.patch('/:listId', async ctx => {
    const payload = validate(listUpdateParams, ctx.request.body)
    ctx.body = await updateList(ctx.state.list!.id, payload)
})

router.delete('/:listId', async ctx => {
    const { id, project_id, deleted_at } = ctx.state.list!
    if (deleted_at) {
        ctx.body = await deleteList(id, project_id)
    } else {
        ctx.body = await archiveList(id, project_id)
    }
})

router.get('/:listId/users', async ctx => {
    const params = extractQueryParams(ctx.query, searchParamsSchema)
    ctx.body = await getListUsers(ctx.state.list!.id, params, ctx.state.project.id)
})

router.post('/:listId/users', async ctx => {
    const stream = await parse(ctx)

    await importUsersToList(ctx.state.list!, stream)

    ctx.status = 204
})

export default router
