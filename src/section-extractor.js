const core = require('@actions/core')

/**
 * Extracts the content of a specific changelog section from the changelog text.
 * A section is defined by a version header (e.g., "## [Unreleased]" or "## [v1.0.0]").
 *
 * @param {string} versionPattern - Regex pattern to match version headers
 * @param {string} sectionVersion - The version/section to extract (e.g., "Unreleased" or "v1.0.0")
 * @param {string} changelog - The full changelog content
 * @returns {string|null} The content of the section, or null if not found
 */
module.exports.extractSection = function (versionPattern, sectionVersion, changelog) {
    // Build a pattern to find the specific section
    // The section starts with the version header and ends at the next version header or end of file

    // Escape special regex characters in the section version (except for the ones we use in matching)
    const escapedVersion = sectionVersion.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

    // Create a pattern that matches:
    // 1. The version header with the specific section version
    // 2. Everything until the next version header (using negative lookahead)
    const sectionPattern = new RegExp(
        `^## \\[${escapedVersion}\\].*$(?:\\n(?!## \\[).*)*`,
        'mi'
    )

    const match = changelog.match(sectionPattern)
    if (match) {
        core.debug(`Found section for version: ${sectionVersion}`)
        return match[0]
    }

    core.debug(`Section not found for version: ${sectionVersion}`)
    return null
}

/**
 * Checks if a specific section header is being renamed/removed in the diff (release/hotfix branch scenario).
 * Returns true if the header appears ONLY as a removed line ('-' prefix) and not as a context
 * or added line, which indicates the section was renamed (e.g., "Unreleased" → "v1.2.0").
 * In that case callers should skip the section-modification check.
 *
 * @param {string} sectionVersion - The version/section to look for
 * @param {string} diff - The diff content
 * @returns {boolean} True if the section header is being removed/renamed
 */
module.exports.isSectionBeingRenamed = function (sectionVersion, diff) {
    const escapedVersion = sectionVersion.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    const removedPattern = new RegExp(`^-## \\[${escapedVersion}\\]`, 'im')
    const presentPattern = new RegExp(`^[+ ]## \\[${escapedVersion}\\]`, 'im')
    return removedPattern.test(diff) && !presentPattern.test(diff)
}

/**
 * Checks if a specific section was modified in the changelog diff.
 * This function analyzes the diff (added/removed lines) to see if a specific section changed.
 *
 * @param {string} versionPattern - Regex pattern to match version headers
 * @param {string} sectionVersion - The version/section to check (e.g., "Unreleased" or "v1.0.0")
 * @param {string} diff - The diff content (lines starting with + for additions, - for deletions)
 * @returns {boolean} True if the section was modified, false otherwise
 */
module.exports.isSectionModified = function (versionPattern, sectionVersion, diff) {
    // Escape special regex characters in the section version
    const escapedVersion = sectionVersion.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

    // Pattern to find the section header in the diff
    // This pattern matches lines that might have +/- prefix and contain ## [version]
    const sectionHeaderPattern = new RegExp(`[+-]?\\s*## \\[${escapedVersion}\\]`, 'i')
    // Pattern to match start of a line (no ^ since we split by newline)
    const sectionStartPattern = new RegExp(`[+-]?\\s*## \\[${escapedVersion}\\]`, 'i')

    // Check if the section header exists in the diff
    if (!sectionHeaderPattern.test(diff)) {
        return false
    }

    // Find the section content in the diff
    // We need to check if there are any added lines (starting with +) within this section
    const lines = diff.split('\n')
    let inSection = false
    let hasAddedContent = false

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i]

        // Check if we're entering the target section
        if (sectionStartPattern.test(line)) {
            inSection = true
            core.debug(`Entering section: ${sectionVersion}`)
            continue
        }

        // Check if we're leaving the section (hitting another section header)
        // Match any ## [ pattern but not the target section
        if (inSection && /^[+-]?\s*## \[/i.test(line) && !sectionStartPattern.test(line)) {
            core.debug(`Exiting section: ${sectionVersion}`)
            break
        }

        // If we're in the target section and find an added line, the section has been modified
        if (inSection && line.startsWith('+') && !line.startsWith('+++')) {
            hasAddedContent = true
            core.debug(`Found added content in section: ${sectionVersion}`)
            break
        }
    }

    return hasAddedContent
}

/**
 * Finds the 1-based line range of a specific section in the full changelog content.
 * Useful when the section header isn't visible in the patch (change is far from header).
 *
 * @param {string} versionPattern - Regex pattern to match any version header
 * @param {string} sectionVersion - The specific version/section to find
 * @param {string} content - The full changelog file content
 * @returns {{start: number, end: number}|null} 1-based start (inclusive) and end (exclusive) line numbers, or null if not found
 */
module.exports.findSectionLineRange = function (versionPattern, sectionVersion, content) {
    const lines = content.split('\n')
    const escapedVersion = sectionVersion.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

    // Support both "## [Version]" and "[Version]" style section headers.
    const targetHeaderPatterns = [
        new RegExp(`^## \\[${escapedVersion}\\]`, 'i'),
        new RegExp(`^\\[${escapedVersion}\\]`, 'i')
    ]

    let anyHeaderPattern
    try {
        anyHeaderPattern = new RegExp(versionPattern, 'im')
    } catch (err) {
        anyHeaderPattern = null
    }

    // Generic section-header fallback: bracketed version token at start of line,
    // optionally prefixed by markdown heading hashes.
    const genericHeaderPattern = /^#{0,6}\s*\[[^\]]+\]/i

    let start = -1
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i]
        const isTargetHeader = targetHeaderPatterns.some(pattern => pattern.test(line))

        if (start === -1) {
            if (isTargetHeader) {
                start = i + 1 // 1-based, inclusive
            }
            continue
        }

        const isVersionHeader = anyHeaderPattern ? anyHeaderPattern.test(line) : false
        const isGenericHeader = genericHeaderPattern.test(line)
        if (isVersionHeader || isGenericHeader) {
            // If we encounter the same target header with different casing, stay in section.
            if (!isTargetHeader) {
                return { start, end: i + 1 } // end is exclusive
            }
        }
    }

    if (start !== -1) {
        return { start, end: lines.length + 1 }
    }
    return null
}

/**
 * Parses a patch string and returns the set of new-file line numbers that have added lines.
 * Uses the @@ -a,b +c,d @@ hunk headers to track line positions.
 *
 * @param {string} patch - The patch content (from GitHub API or full diff)
 * @returns {Set<number>} Set of 1-based line numbers in the new file that were added
 */
module.exports.getAddedLineNumbers = function (patch) {
    const lines = patch.split('\n')
    const addedLines = new Set()
    let newLineNum = 0

    for (const line of lines) {
        const hunkMatch = line.match(/^@@ -\d+(?:,\d+)? \+(\d+)(?:,\d+)? @@/)
        if (hunkMatch) {
            newLineNum = parseInt(hunkMatch[1], 10)
            continue
        }
        // Skip diff file headers — they don't affect line numbers
        if (line.startsWith('+++') || line.startsWith('---') ||
            line.startsWith('diff ') || line.startsWith('index ')) {
            continue
        }
        if (line.startsWith('+')) {
            addedLines.add(newLineNum)
            newLineNum++
        } else if (line.startsWith('-')) {
            // Removed line: doesn't advance new-file counter
        } else {
            // Context line
            newLineNum++
        }
    }

    return addedLines
}
