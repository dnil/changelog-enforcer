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
        'm'
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
    const sectionHeaderPattern = new RegExp(`[+-]?\\s*## \\[${escapedVersion}\\]`)
    // Pattern to match start of a line (no ^ since we split by newline)
    const sectionStartPattern = new RegExp(`[+-]?\\s*## \\[${escapedVersion}\\]`)

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
        if (inSection && /^[+-]?\s*## \[/.test(line) && !sectionStartPattern.test(line)) {
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
