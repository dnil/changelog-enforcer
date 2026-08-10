const core = require('@actions/core')
const github = require('@actions/github')
const versionExtractor = require('./version-extractor')
const labelExtractor = require('./label-extractor')
const contextExtractor = require('./context-extractor')
const sectionExtractor = require('./section-extractor')
const { findChangelog, downloadChangelog, downloadFileDiff } = require('./client')

// Input keys
const IN_CHANGELOG_PATH = 'changeLogPath'
const IN_EXPECTED_LATEST_VERSION = 'expectedLatestVersion'
const IN_VERSION_PATTERN = 'versionPattern'
const IN_UPDATE_CUSTOM_ERROR = 'missingUpdateErrorMessage'
const IN_SKIP_LABELS = 'skipLabels'
const IN_TOKEN = "token"
const IN_ENFORCED_SECTION_VERSION = 'enforcedSectionVersion'

// Output keys
const OUT_ERROR_MESSAGE = 'errorMessage'

module.exports.enforce = async function () {
    try {
        const skipLabelList = getSkipLabels()
        const changeLogPath = core.getInput(IN_CHANGELOG_PATH)
        const missingUpdateErrorMessage = getMissingUpdateErrorMessage(changeLogPath)
        const expectedLatestVersion = core.getInput(IN_EXPECTED_LATEST_VERSION)
        const versionPattern = core.getInput(IN_VERSION_PATTERN)
        const token = getToken()
        const enforcedSectionVersion = core.getInput(IN_ENFORCED_SECTION_VERSION)

        core.debug(`Skip Labels: ${skipLabelList}`)
        core.debug(`Changelog Path: ${changeLogPath}`)
        core.debug(`Expected Latest Version: ${expectedLatestVersion}`)
        core.debug(`Version Pattern: ${versionPattern}`)
        core.debug(`Enforced Section Version: ${enforcedSectionVersion}`)

        core.debug(`Missing Update Error Message: ${missingUpdateErrorMessage}`)

        const context = github.context
        const pullRequest = contextExtractor.getPullRequestContext(context)
        if (!pullRequest) {
            return
        }

        const repository = `${context.repo.owner}/${context.repo.repo}`
        const labelNames = pullRequest.labels.map(l => l.name)
        if (!shouldEnforceChangelog(labelNames, skipLabelList)) {
            return
        }
        const changelog = await checkChangeLog(token, repository, pullRequest.number, changeLogPath, missingUpdateErrorMessage)

        // Check enforced section if specified
        if (enforcedSectionVersion !== '') {
            await validateSectionModified(token, repository, pullRequest.number, changeLogPath, versionPattern, enforcedSectionVersion, changelog.contents_url)
        }

        if (shouldEnforceVersion(expectedLatestVersion)) {
            await validateLatestVersion(token, expectedLatestVersion, versionPattern, changelog.contents_url)
        }

        core.info('✅ Changelog section updated')
    } catch (err) {
        core.setOutput(OUT_ERROR_MESSAGE, err.message)
        core.setFailed(err.message)
    }
};

function getSkipLabels() {
    const skipLabels = core.getInput(IN_SKIP_LABELS)
    return labelExtractor.extractLabels(skipLabels)
}

function getMissingUpdateErrorMessage(changeLogPath) {
    const customMessage = core.getInput(IN_UPDATE_CUSTOM_ERROR)
    if (customMessage != null && customMessage != '') {
        return customMessage
    }
    return `No update to ${changeLogPath} found!`
}

function getToken() {
    const token = core.getInput(IN_TOKEN)
    if (!token) {
        throw new Error("Did not find token for using the GitHub API")
    }
    return token
}

function shouldEnforceChangelog(labelNames, skipLabelList) {
    return !labelNames.some(l => skipLabelList.includes(l))
}

function shouldEnforceVersion(expectedLatestVersion) {
    return expectedLatestVersion !== ''
}

function normalizeChangelogPath(changeLogPath) {
    if (changeLogPath.startsWith('./')) {
        return changeLogPath.substring(2)
    }
    return changeLogPath
}

async function checkChangeLog(token, repository, pullRequestNumber, changeLogPath, missingUpdateErrorMessage) {
    const normalizedChangeLogPath = normalizeChangelogPath(changeLogPath)
    const changelog = await findChangelog(token, repository, pullRequestNumber, 100, normalizedChangeLogPath)
    if (!changelog) {
        throw new Error(missingUpdateErrorMessage)
    }
    return changelog
}

async function validateLatestVersion(token, expectedLatestVersion, versionPattern, changelogUrl) {
    const changelog = await downloadChangelog(token, changelogUrl)
    const versions = versionExtractor.getVersions(versionPattern, changelog)
    let latest = versions[0]
    core.debug(`Latest version is ${latest}`)
    if (latest.toUpperCase() == "UNRELEASED") {
        if (versions.length == 1) {
            core.debug('There is only on unreleased version found in the changelog. Not validating expected version.')
            return
        }
        latest = versions[1]
    }
    if (latest !== expectedLatestVersion) {
        throw new Error(`The latest version in the changelog does not match the expected latest version of ${expectedLatestVersion}!`)
    }
}

async function validateSectionModified(token, repository, pullRequestNumber, changeLogPath, versionPattern, enforcedSectionVersion, changelogContentsUrl) {
    const normalizedChangeLogPath = normalizeChangelogPath(changeLogPath)
    const diff = await downloadFileDiff(token, repository, pullRequestNumber, normalizedChangeLogPath)
    if (!diff) {
        throw new Error(`Unable to retrieve diff for ${changeLogPath}`)
    }

    // If the enforced section header was removed/renamed in this diff (e.g. "Unreleased" → "v1.2.0"),
    // treat it as a release/hotfix branch and skip the section check.
    // The changelog file being modified is already confirmed by checkChangeLog.
    if (sectionExtractor.isSectionBeingRenamed(enforcedSectionVersion, diff)) {
        core.info(`Section "${enforcedSectionVersion}" appears to have been renamed — assuming release/hotfix branch. Skipping section check.`)
        return
    }

    // Primary check: look for added lines within the section in the visible patch.
    if (sectionExtractor.isSectionModified(versionPattern, enforcedSectionVersion, diff)) {
        return
    }

    // Secondary check: the section header may not be visible in the patch when the
    // change is more than ~3 context lines away from the header (common in long sections).
    // Fall back to matching added line numbers against the section's line range in the full file.
    if (changelogContentsUrl) {
        core.debug(`Section header not visible in patch — falling back to line-number check`)
        const fullContent = await downloadChangelog(token, changelogContentsUrl)
        const sectionRange = sectionExtractor.findSectionLineRange(versionPattern, enforcedSectionVersion, fullContent)
        if (sectionRange) {
            const addedLines = sectionExtractor.getAddedLineNumbers(diff)
            const hasAddedLineInSection = [...addedLines].some(
                line => line >= sectionRange.start && line < sectionRange.end
            )
            if (hasAddedLineInSection) {
                core.debug(`Found added content in section "${enforcedSectionVersion}" via line-number fallback`)
                return
            }
        }
    }

    throw new Error(`The "${enforcedSectionVersion}" section in ${changeLogPath} was not modified!`)
}
