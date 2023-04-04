import './Sidebar.css'
import NavLink from './NavLink'
import { ReactComponent as Logo } from '../assets/logo.svg'
import { Link, NavLinkProps, useNavigate } from 'react-router-dom'
import { PropsWithChildren, ReactNode, useCallback, useContext, useState } from 'react'
import { AdminContext, ProjectContext } from '../contexts'
import api from '../api'
import { PreferencesContext } from './PreferencesContext'
import { useResolver } from '../hooks'
import { SingleSelect } from './form/SingleSelect'
import Button from './Button'
import ButtonGroup from './ButtonGroup'
import { MenuIcon, MoonIcon, SunIcon } from './icons'
import { checkProjectRole, getRecentProjects } from '../utils'
import { ProjectRole } from '../types'
import clsx from 'clsx'

interface SidebarProps {
    links?: Array<NavLinkProps & {
        key: string
        icon: ReactNode
        minRole?: ProjectRole
    }>
}

export default function Sidebar({ children, links }: PropsWithChildren<SidebarProps>) {
    const navigate = useNavigate()
    const profile = useContext(AdminContext)
    const [project] = useContext(ProjectContext)
    const [preferences, setPreferences] = useContext(PreferencesContext)
    const [recents] = useResolver(useCallback(async () => {
        const recentIds = getRecentProjects().filter(p => p.id !== project.id).map(p => p.id)
        const recents: Array<typeof project> = []
        if (recentIds.length) {
            const projects = await api.projects.search({
                page: 0,
                itemsPerPage: recentIds.length,
                id: recentIds,
            }).then(r => r.results ?? [])
            for (const id of recentIds) {
                const recent = projects.find(p => p.id === id)
                if (recent) {
                    recents.push(recent)
                }
            }
        }
        return [
            project,
            ...recents,
            {
                id: 0,
                name: 'View All',
            },
        ]
    }, [project]))
    const [isOpen, setIsOpen] = useState(false)

    return (
        <>
            <header className="header">
                <Button onClick={() => setIsOpen(!isOpen)} icon={<MenuIcon />} aria-label="Menu" variant="secondary" size="small"/>
                <Link className="logo" to="/">
                    <Logo />
                </Link>
            </header>
            <section className={clsx('sidebar', { 'is-open': isOpen })}>
                <div className="sidebar-header">
                    <Link className="logo" to="/">
                        <Logo />
                    </Link>
                </div>
                <SingleSelect
                    value={project}
                    onChange={project => {
                        if (project.id === 0) {
                            navigate('/')
                        } else {
                            navigate(`/projects/${project.id}`)
                        }
                    }}
                    options={recents ?? []}
                    getSelectedOptionDisplay={p => (
                        <>
                            <div className="project-switcher-label">Project</div>
                            <div className="project-switcher-value">{p.name}</div>
                        </>
                    )}
                    hideLabel
                    buttonClassName="project-switcher"
                    variant="minimal"
                />
                <nav>
                    {
                        links
                            ?.filter(({ minRole }) => !minRole || checkProjectRole(minRole, project.role))
                            .map(({ key, minRole, ...props }) => (
                                <NavLink {...props} key={key} onClick={() => setIsOpen(false)} />
                            ))
                    }
                </nav>
                {
                    profile && (
                        <div className="sidebar-profile">
                            <div className="profile-image">
                                <img src={profile.image_url} referrerPolicy="no-referrer" />
                            </div>
                            <span className="profile-name">{`${profile.first_name} ${profile.last_name}`}</span>
                            <div className="profile-role">
                                <ButtonGroup>
                                    <Button
                                        variant="secondary"
                                        size="small"
                                        icon={preferences.mode === 'dark' ? <MoonIcon /> : <SunIcon />}
                                        onClick={() => setPreferences({ ...preferences, mode: preferences.mode === 'dark' ? 'light' : 'dark' })}
                                    />
                                    <Button
                                        variant="secondary"
                                        size="small"
                                        onClick={async () => await api.logout()}
                                    >
                                        {'Sign Out'}
                                    </Button>
                                </ButtonGroup>
                            </div>
                        </div>
                    )
                }
            </section>
            <main className={clsx({ 'is-open': isOpen })}>
                {children}
            </main>
        </>
    )
}
