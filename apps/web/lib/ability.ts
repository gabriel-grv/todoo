import { AbilityBuilder, createMongoAbility, subject } from '@casl/ability'
import type { MongoAbility, ForcedSubject, ExtractSubjectType } from '@casl/ability'

export type Actions = 'manage' | 'create' | 'read' | 'update' | 'delete'
type TaskSubject = ForcedSubject<'Task'> & { userId: string }
type UserSubject = ForcedSubject<'User'> & { id: string }

export type Subjects = 'Task' | 'User' | 'all' | TaskSubject | UserSubject

export type AppAbility = MongoAbility<[Actions, Subjects]>

export type AbilityUser = {
  id: string
  role: 'ADMIN' | 'USER'
}

export function createAbilityFor(user: AbilityUser | null | undefined) {
  const { can, cannot, build } = new AbilityBuilder<AppAbility>(createMongoAbility)

  if (!user) {
    return build({
      detectSubjectType: (item): ExtractSubjectType<Subjects> => {
        if (typeof item === 'string') return item as ExtractSubjectType<Subjects>
        if (item && typeof item === 'object') {
          if ('__caslSubjectType__' in item) {
            const caslType = (item as { __caslSubjectType__?: unknown }).__caslSubjectType__
            if (typeof caslType === 'string') return caslType as ExtractSubjectType<Subjects>
          }
          if ('__typename' in item) {
            const typename = (item as { __typename?: unknown }).__typename
            if (typeof typename === 'string') return typename as ExtractSubjectType<Subjects>
          }
        }
        return 'all'
      },
    })
  }

  if (user.role === 'ADMIN') {
    can('manage', 'Task')
    can('manage', 'User')
  } else {
    can('create', 'Task', { userId: user.id })
    can('read', 'Task', { userId: user.id })
    can('update', 'Task', { userId: user.id })
    can('delete', 'Task', { userId: user.id })

    can('read', 'User', { id: user.id })
    can('update', 'User', { id: user.id })
    cannot('manage', 'Task', { userId: { $ne: user.id } })
  }

  return build({
    detectSubjectType: (item): ExtractSubjectType<Subjects> => {
      if (typeof item === 'string') return item as ExtractSubjectType<Subjects>
      if (!item) return 'all'
      if (typeof item === 'object') {
        if ('__caslSubjectType__' in item) {
          const caslType = (item as { __caslSubjectType__?: unknown }).__caslSubjectType__
          if (typeof caslType === 'string') return caslType as ExtractSubjectType<Subjects>
        }
        if ('type' in item) {
          const type = (item as { type?: unknown }).type
          if (typeof type === 'string') return type as ExtractSubjectType<Subjects>
        }
        if ('__typename' in item) {
          const typename = (item as { __typename?: unknown }).__typename
          if (typeof typename === 'string') return typename as ExtractSubjectType<Subjects>
        }
      }
      return 'all'
    },
  })
}

export { subject }

