import React from 'react'
import type { User } from '@/lib/types'

/**
 * Renders a message string with @mentions highlighted as styled badges.
 * Matches any @Name that corresponds to a known user.
 * Falls back to plain text for unrecognized @words.
 */
export function renderMentions(content: string | null, users: User[]): React.ReactNode {
    if (!content) return content

    // Build a set of known names for quick lookup (case-insensitive)
    const nameSet = new Map<string, User>()
    for (const user of users) {
        nameSet.set(user.name.toLowerCase(), user)
    }

    // Sort names by length descending so longer names match first
    // e.g. "John Smith" before "John"
    const sortedNames = [...nameSet.keys()].sort((a, b) => b.length - a.length)

    if (sortedNames.length === 0) return content

    // Build a regex that matches any known @Name
    const escaped = sortedNames.map(n => n.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
    const pattern = new RegExp(`@(${escaped.join('|')})(?=\\s|$|[.,!?;:)\\]}])`, 'gi')

    const parts: React.ReactNode[] = []
    let lastIndex = 0
    let match: RegExpExecArray | null

    while ((match = pattern.exec(content)) !== null) {
        // Add text before the match
        if (match.index > lastIndex) {
            parts.push(content.slice(lastIndex, match.index))
        }

        const mentionedName = match[1]
        const user = nameSet.get(mentionedName.toLowerCase())

        parts.push(
            <span
                key={`${match.index}-${mentionedName}`}
                className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-semibold bg-blue-100 text-blue-700 dark:bg-blue-900/60 dark:text-blue-200"
            >
                @{user ? user.name : mentionedName}
            </span>
        )

        lastIndex = match.index + match[0].length
    }

    // Append remaining text
    if (lastIndex < content.length) {
        parts.push(content.slice(lastIndex))
    }

    // If no mentions found, return original string (avoids wrapping in fragment)
    if (parts.length === 1 && typeof parts[0] === 'string') return parts[0]

    return <>{parts}</>
}
