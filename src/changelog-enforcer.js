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

        core.info(`Skip Labels: ${skipLabelList}`)
        core.info(`Changelog Path: ${changeLogPath}`)
        core.info(`Missing Update Error Message: ${missingUpdateErrorMessage}`)
        core.info(`Expected Latest Version: ${expectedLatestVersion}`)
        core.info(`Version Pattern: ${versionPattern}`)
        core.info(`Enforced Section Version: ${enforcedSectionVersion}`)

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
            await validateSectionModified(token, repository, pullRequest.number, changeLogPath, versionPattern, enforcedSectionVersion)
        }

        if (shouldEnforceVersion(expectedLatestVersion)) {
            await validateLatestVersion(token, expectedLatestVersion, versionPattern, changelog.contents_url)
        }
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

async function validateSectionModified(token, repository, pullRequestNumber, changeLogPath, versionPattern, enforcedSectionVersion) {
    const diff = await downloadFileDiff(token, repository, pullRequestNumber, changeLogPath)
    if (!diff) {
        throw new Error(`Unable to retrieve diff for ${changeLogPath}`)
    }

    const isModified = sectionExtractor.isSectionModified(versionPattern, enforcedSectionVersion, diff)
    if (!isModified) {
        throw new Error(`The "${enforcedSectionVersion}" section in ${changeLogPath} was not modified!`)
    }
}
