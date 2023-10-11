import { useCallback, useContext, useState } from 'react'
import api from '../../api'
import { ProjectContext } from '../../contexts'
import { Tag } from '../../types'
import Button from '../../ui/Button'
import FormWrapper from '../../ui/form/FormWrapper'
import TextInput from '../../ui/form/TextInput'
import { PlusIcon } from '../../ui/icons'
import Modal from '../../ui/Modal'
import { SearchTable, useSearchTableState } from '../../ui/SearchTable'

export default function Tags() {

    const [project] = useContext(ProjectContext)
    const search = useSearchTableState(useCallback(async params => await api.tags.search(project.id, params), [project]))
    const [editing, setEditing] = useState<Tag>()

    return (
        <>
            <SearchTable
                {...search}
                columns={[
                    { key: 'name' },
                ]}
                title="Tags"
                description="Use tags to organize and report on your campaigns, journeys, lists, and users."
                actions={
                    <>
                        <Button
                            size="small"
                            variant="primary"
                            onClick={() => setEditing({ id: 0, name: 'New Tag' })}
                            icon={<PlusIcon />}
                        >
                            {'Create Tag'}
                        </Button>
                    </>
                }
                onSelectRow={setEditing}
            />
            <Modal
                open={!!editing}
                onClose={() => setEditing(undefined)}
                title={editing?.id ? 'Update Tag' : 'Create Tag'}
            >
                {
                    editing && (
                        <FormWrapper<Tag>
                            onSubmit={async ({ id, name }) => {
                                id != null
                                    ? await api.tags.update(project.id, id, { name })
                                    : await api.tags.create(project.id, { name })
                                await search.reload()
                                setEditing(undefined)
                            }}
                            defaultValues={editing}
                        >
                            {form => (
                                <TextInput.Field form={form} name="name" required />
                            )}
                        </FormWrapper>
                    )
                }
            </Modal>
        </>
    )
}
