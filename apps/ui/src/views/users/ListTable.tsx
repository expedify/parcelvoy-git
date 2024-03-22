import { Key } from 'react'
import { List, ListState, SearchParams, SearchResult } from '../../types'
import { SearchTable, useSearchTableState } from '../../ui/SearchTable'
import Tag, { TagVariant } from '../../ui/Tag'
import { snakeToTitle } from '../../utils'
import { useRoute } from '../router'
import Menu, { MenuItem } from '../../ui/Menu'
import { ArchiveIcon, EditIcon } from '../../ui/icons'
import api from '../../api'
import { useParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'

interface ListTableParams {
    search: (params: SearchParams) => Promise<SearchResult<List>>
    title?: string
    selectedRow?: Key
    onSelectRow?: (list: List) => void
}

export const ListTag = ({ state }: { state: ListState }) => {
    const { t } = useTranslation()
    const variant: Record<ListState, TagVariant> = {
        draft: 'plain',
        loading: 'info',
        ready: 'success',
    }

    const title: Record<ListState, string> = {
        draft: t('draft'),
        loading: t('loading'),
        ready: t('ready'),
    }

    return <Tag variant={variant[state]}>{title[state]}</Tag>
}

export default function ListTable({ search, selectedRow, onSelectRow, title }: ListTableParams) {
    const route = useRoute()
    const { t } = useTranslation()
    const { projectId = '' } = useParams()

    function handleOnSelectRow(list: List) {
        onSelectRow ? onSelectRow(list) : route(`lists/${list.id}`)
    }

    const handleArchiveList = async (id: number) => {
        await api.lists.delete(projectId, id)
        await state.reload()
    }

    const state = useSearchTableState(search)

    return (
        <SearchTable
            {...state}
            title={title}
            itemKey={({ item }) => item.id}
            columns={[
                {
                    key: 'name',
                    title: t('name'),
                    sortable: true,
                },
                {
                    key: 'type',
                    title: t('type'),
                    cell: ({ item: { type } }) => snakeToTitle(type),
                    sortable: true,
                },
                {
                    key: 'state',
                    title: t('state'),
                    cell: ({ item: { state } }) => ListTag({ state }),
                    sortable: true,
                },
                {
                    key: 'users_count',
                    title: t('users_count'),
                    cell: ({ item }) => item.users_count?.toLocaleString(),
                },
                {
                    key: 'created_at',
                    title: t('created_at'),
                    sortable: true,
                },
                {
                    key: 'updated_at',
                    title: t('updated_at'),
                    sortable: true,
                },
                {
                    key: 'options',
                    title: t('options'),
                    cell: ({ item }) => (
                        <Menu size="small">
                            <MenuItem onClick={() => handleOnSelectRow(item)}>
                                <EditIcon />{t('edit')}
                            </MenuItem>
                            <MenuItem onClick={async () => await handleArchiveList(item.id)}>
                                <ArchiveIcon />{t('archive')}
                            </MenuItem>
                        </Menu>
                    ),
                },
            ]}
            selectedRow={selectedRow}
            onSelectRow={list => handleOnSelectRow(list)}
            enableSearch
            tagEntity="lists"
        />
    )
}
