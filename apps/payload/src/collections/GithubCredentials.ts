import type { CollectionConfig } from 'payload'

import { isSuperAdmin } from '../access/isSuperAdmin'
import { clearGithubCredentialTokenEndpoint } from '../endpoints/githubCredentialActions'
import { encryptSecret } from '../lib/credentialEncryption'

export const GithubCredentials: CollectionConfig = {
  slug: 'github-credentials',
  endpoints: [clearGithubCredentialTokenEndpoint],
  labels: { singular: 'GitHub credential', plural: 'GitHub credentials' },
  admin: {
    useAsTitle: 'label',
    group: 'Platform',
    description:
      'Encrypted GitHub PATs for external client repositories. Tenants without a credential use platform tokens (EXTERNAL_REPO_GITHUB_TOKEN / GITHUB_TOKEN).',
    hidden: ({ user }) => !isSuperAdmin(user),
    defaultColumns: ['label', 'githubOwner', 'tokenLast4', 'lastValidatedAt'],
  },
  access: {
    read: ({ req }) => isSuperAdmin(req.user),
    create: ({ req }) => isSuperAdmin(req.user),
    update: ({ req }) => isSuperAdmin(req.user),
    delete: ({ req }) => isSuperAdmin(req.user),
  },
  hooks: {
    beforeValidate: [
      ({ data, operation }) => {
        if (!data || typeof data !== 'object') return data
        const row = data as Record<string, unknown>
        const token = typeof row.token === 'string' ? row.token.trim() : ''
        const hasEncrypted =
          typeof row.tokenEncrypted === 'string' && row.tokenEncrypted.length > 0
        if (operation === 'create' && !token && !hasEncrypted) {
          throw new Error('GitHub PAT is required. Paste a token in the Token field and save.')
        }
        return data
      },
    ],
    beforeChange: [
      ({ data }) => {
        if (!data || typeof data !== 'object') return data
        const row = data as Record<string, unknown>
        const token = typeof row.token === 'string' ? row.token.trim() : ''
        if (token) {
          row.tokenEncrypted = encryptSecret(token)
          row.tokenLast4 = token.length >= 4 ? token.slice(-4) : token
        }
        return row
      },
    ],
  },
  fields: [
    {
      name: 'label',
      type: 'text',
      required: true,
      admin: {
        description: 'e.g. "YOUR_ORG production" — shown when linking a tenant.',
      },
    },
    {
      name: 'githubOwner',
      type: 'text',
      admin: {
        description: 'Optional GitHub user or org (for your notes).',
      },
    },
    // Virtual — encrypted into tokenEncrypted on save; default UI is disabled so we hide it.
    {
      name: 'token',
      type: 'text',
      virtual: true,
      admin: {
        hidden: true,
      },
    },
    {
      name: 'tokenPanel',
      type: 'ui',
      admin: {
        components: {
          Field: '/components/GithubCredentialTokenField.client#GithubCredentialTokenPanel',
        },
      },
    },
    {
      name: 'tokenLast4',
      type: 'text',
      admin: {
        readOnly: true,
        description: 'Last four characters of the stored token.',
      },
    },
    {
      name: 'tokenEncrypted',
      type: 'text',
      access: {
        read: () => false,
      },
      admin: {
        hidden: true,
        readOnly: true,
      },
    },
    {
      name: 'notes',
      type: 'textarea',
      admin: { description: 'Scopes, expiry, rotation notes.' },
    },
    {
      name: 'lastValidatedAt',
      type: 'date',
      admin: {
        readOnly: true,
        date: { pickerAppearance: 'dayAndTime' },
      },
    },
    {
      name: 'lastValidationError',
      type: 'text',
      admin: { readOnly: true },
    },
  ],
}
