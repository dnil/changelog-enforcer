jest.mock('node-fetch');

const core = require('@actions/core')
const fetch = require('node-fetch')
const { Response } = jest.requireActual('node-fetch');
const changelogEnforcer = require('../src/changelog-enforcer')

const SKIP_LABELS = "SomeLabel,Skip-Changelog,Skip-Release"
const CHANGELOG = "CHANGELOG.md"
const VERSION_PATTERN = "^## \\[((v|V)?\\d*\\.\\d*\\.\\d*-?\\w*|unreleased|Unreleased|UNRELEASED)\\]"

// Inputs for mock @actions/core
let inputs = {}

// Mocks via Jest
let infoSpy
let failureSpy
let outputSpy

describe('the changelog-enforcer', () => {

  afterAll(() => {
    jest.restoreAllMocks()
  })

  beforeEach(() => {
    jest.clearAllMocks()

    inputs['skipLabels'] = SKIP_LABELS
    inputs['changeLogPath'] = CHANGELOG
    inputs['expectedLatestVersion'] = ''
    inputs['versionPattern'] = VERSION_PATTERN
    inputs['token'] = 'token'
    inputs['enforcedSectionVersion'] = ''

    jest.spyOn(core, 'getInput').mockImplementation((name) => {
      return inputs[name]
    })

    octokit = {}

    infoSpy = jest.spyOn(core, 'info').mockImplementation(jest.fn())
    failureSpy = jest.spyOn(core, 'setFailed').mockImplementation(jest.fn())
    outputSpy = jest.spyOn(core, 'setOutput').mockImplementation(jest.fn())
  })

  prepareResponse = (body) => {
    return Promise.resolve(new Response(body, { Headers: { 'Content-Type': 'application/json' } }))
  }

   it('should skip enforcing when label is present', (done) => {
     changelogEnforcer.enforce()
       .then(() => {
         expect(infoSpy).toHaveBeenCalledTimes(0)
         expect(failureSpy).not.toHaveBeenCalled()
         expect(outputSpy).not.toHaveBeenCalled()

         done()
       })
   })

  it('should throw an error when token is missing', (done) => {
    inputs['token'] = ''

    changelogEnforcer.enforce()
      .then(() => {
        expect(infoSpy).not.toHaveBeenCalled()
        expect(failureSpy).toHaveBeenCalled()
        expect(outputSpy).toHaveBeenCalled()

        done()
      })
  })

   it('should enforce when label is not present; changelog is changed', (done) => {
     inputs['skipLabels'] = 'A different label'

     const files = [
       {
         "filename": "CHANGELOG.md",
         "status": "modified",
         "contents_url": "./path/to/CHANGELOG.md"
       }
     ]

     fetch.mockImplementation((url, options) => {
       return prepareResponse(JSON.stringify(files))
     })

     changelogEnforcer.enforce()
       .then(() => {
         expect(infoSpy).toHaveBeenCalledTimes(1)
         expect(failureSpy).not.toHaveBeenCalled()
         expect(outputSpy).not.toHaveBeenCalled()

         expect(fetch).toHaveBeenCalledTimes(1)

         done()
       })
   })

   it('should enforce when label is not present; changelog is not changed', (done) => {
     inputs['skipLabels'] = 'A different label'

     const files = [
       {
         "filename": "AnotherFile.md",
         "status": "modified",
         "contents_url": "/path/to/AnotherFile.md"
       }
     ]


     fetch.mockImplementation((url, options) => {
       return prepareResponse(JSON.stringify(files))
     })

     changelogEnforcer.enforce()
       .then(() => {
         expect(infoSpy).toHaveBeenCalledTimes(0)
         expect(failureSpy).toHaveBeenCalled()
         expect(outputSpy).toHaveBeenCalled()

         expect(fetch).toHaveBeenCalledTimes(1)

         done()
       })
   })

   it('should enforce when label is not present; changelog is not changed; custom error message', (done) => {
     const customErrorMessage = 'Some Message for you @Author!'
     inputs['skipLabels'] = 'A different label'
     inputs['missingUpdateErrorMessage'] = customErrorMessage

     const files = [
       {
         "filename": "AnotherFile.md",
         "status": "modified",
         "contents_url": "/path/to/AnotherFile.md"
       }
     ]

     fetch.mockImplementation((url, options) => {
       return prepareResponse(JSON.stringify(files))
     })

     changelogEnforcer.enforce()
       .then(() => {
         expect(infoSpy).toHaveBeenCalledTimes(0)
         expect(failureSpy).toHaveBeenCalled()
         expect(outputSpy).toHaveBeenCalledWith('errorMessage', customErrorMessage)

         expect(fetch).toHaveBeenCalledTimes(1)

         done()
       })
   })

   it('should enforce when label is not present; changelog is changed; versions do not match', (done) => {
     const contentsUrl = 'some-url'
     inputs['skipLabels'] = 'A different label'
     inputs['expectedLatestVersion'] = 'v2.0.0'

     const files = [
       {
         "filename": "CHANGELOG.md",
         "status": "modified",
         "contents_url": contentsUrl
       }
     ]

     const changelog =
       `## [v2.1.0]
     - Changelog   
 `

     fetch.mockImplementation((url, options) => {
       if (url === contentsUrl) {
         return Promise.resolve(new Response(changelog))
       }
       return prepareResponse(JSON.stringify(files))
     })

     changelogEnforcer.enforce()
       .then(() => {
         expect(infoSpy).toHaveBeenCalledTimes(0)
         expect(failureSpy).toHaveBeenCalled()
         expect(outputSpy).toHaveBeenCalled()

         expect(fetch).toHaveBeenCalledTimes(2)

         done()
       })
   })

   it('should enforce when label is not present; changelog is changed; only one unreleased version exists', (done) => {
     const contentsUrl = 'some-url'
     inputs['skipLabels'] = 'A different label'
     inputs['expectedLatestVersion'] = 'v2.0.0'

     const files = [
       {
         "filename": "CHANGELOG.md",
         "status": "modified",
         "contents_url": contentsUrl
       }
     ]

     const changelog =
       `## [Unreleased]
     - Changelog   
 `

     fetch.mockImplementation((url, options) => {
       if (url === contentsUrl) {
         return Promise.resolve(new Response(changelog))
       }
       return prepareResponse(JSON.stringify(files))
     })

     changelogEnforcer.enforce()
       .then(() => {
         expect(infoSpy).toHaveBeenCalledTimes(1)
         expect(failureSpy).not.toHaveBeenCalled()
         expect(outputSpy).not.toHaveBeenCalled()

         expect(fetch).toHaveBeenCalledTimes(2)

         done()
       })
   })

   it('should enforce section when enforcedSectionVersion is set and section is modified', (done) => {
     inputs['skipLabels'] = 'A different label'
     inputs['enforcedSectionVersion'] = 'unreleased'

     const files = [
       {
         "filename": "CHANGELOG.md",
         "status": "modified",
         "contents_url": "./path/to/CHANGELOG.md",
           "patch": [
             'diff --git a/CHANGELOG.md b/CHANGELOG.md',
             '--- a/CHANGELOG.md',
             '+++ b/CHANGELOG.md',
             '@@ -1,3 +1,5 @@',
             ' ## [Unreleased]',
             '+',
             '+- Added new feature',
             '+',
             ' ## [v1.0.0]',
             ' - Initial release'
           ].join('\n')
       }
     ]

      fetch.mockImplementation(() => prepareResponse(JSON.stringify(files)))

     changelogEnforcer.enforce()
       .then(() => {
         expect(infoSpy).toHaveBeenCalledTimes(1)
         expect(failureSpy).not.toHaveBeenCalled()
         expect(outputSpy).not.toHaveBeenCalled()

           expect(fetch).toHaveBeenCalledTimes(2)

         done()
       })
       .catch((err) => {
         console.error('Test promise rejected with:', err)
         done(err)
       })
   })

   it('should skip section check when enforcedSectionVersion is not present in diff (release/hotfix branch)', (done) => {
     inputs['skipLabels'] = 'A different label'
     inputs['enforcedSectionVersion'] = 'unreleased'

     // Simulates a release branch: "Unreleased" was renamed to a numbered version
     const files = [
       {
         "filename": "CHANGELOG.md",
         "status": "modified",
         "contents_url": "./path/to/CHANGELOG.md",
         "patch": [
           'diff --git a/CHANGELOG.md b/CHANGELOG.md',
           '--- a/CHANGELOG.md',
           '+++ b/CHANGELOG.md',
           '@@ -1,3 +1,5 @@',
           '-## [Unreleased]',
           '+## [v1.2.0] - 2026-08-04',
           '+- New feature',
           ' ## [v1.0.0]',
           ' - Initial release'
         ].join('\n')
       }
     ]

     fetch.mockImplementation(() => prepareResponse(JSON.stringify(files)))

     changelogEnforcer.enforce()
       .then(() => {
         // 1 info call: the fallback notice
         expect(infoSpy).toHaveBeenCalledTimes(2)
         expect(infoSpy).toHaveBeenCalledWith(expect.stringContaining('appears to have been renamed'))
         expect(failureSpy).not.toHaveBeenCalled()
         expect(outputSpy).not.toHaveBeenCalled()

         expect(fetch).toHaveBeenCalledTimes(2)

         done()
       })
       .catch((err) => {
         done(err)
       })
   })

   it('should enforce section when change is far from section header (line-number fallback)', (done) => {
     inputs['skipLabels'] = 'A different label'
     inputs['enforcedSectionVersion'] = 'unreleased'

     const contentsUrl = 'https://api.github.com/repos/repo/contents/CHANGELOG.md'

     // Patch where the section header is NOT visible — change is deep inside a long Unreleased section
     const patch = [
       '@@ -20,5 +20,6 @@',
       ' - Previous feature 15',
       ' - Previous feature 16',
       '+- New feature added deep in the section',
       ' - Previous feature 17',
       ' - Previous feature 18'
     ].join('\n')

     // Full changelog — Unreleased section covers lines 1–22, v1.0.0 starts at line 23
     const fullChangelog = [
       '## [Unreleased]',           // line 1
       '- Previous feature 1',
       '- Previous feature 2',
       '- Previous feature 3',
       '- Previous feature 4',
       '- Previous feature 5',
       '- Previous feature 6',
       '- Previous feature 7',
       '- Previous feature 8',
       '- Previous feature 9',
       '- Previous feature 10',
       '- Previous feature 11',
       '- Previous feature 12',
       '- Previous feature 13',
       '- Previous feature 14',
       '- Previous feature 15',
       '- Previous feature 16',
       '- New feature added deep in the section',
       '- Previous feature 17',
       '- Previous feature 18',
       '',
       '',
       '## [v1.0.0]',               // line 23
       '- Initial release'
     ].join('\n')

     const files = [
       {
         "filename": "CHANGELOG.md",
         "status": "modified",
         "contents_url": contentsUrl,
         "patch": patch
       }
     ]

     fetch.mockImplementation((url) => {
       if (url === contentsUrl) {
         return Promise.resolve(new Response(fullChangelog))
       }
       return prepareResponse(JSON.stringify(files))
     })

     changelogEnforcer.enforce()
       .then(() => {
         expect(failureSpy).not.toHaveBeenCalled()
         expect(infoSpy).toHaveBeenCalledWith('✅ Changelog section updated')
         // findChangelog + downloadFileDiff + downloadChangelog (fallback)
         expect(fetch).toHaveBeenCalledTimes(3)
         done()
       })
       .catch(done)
   })

   it('should fail when enforcedSectionVersion is set and section is not modified', (done) => {
     inputs['skipLabels'] = 'A different label'
     inputs['enforcedSectionVersion'] = 'unreleased'

     const contentsUrl = 'https://api.github.com/repos/repo/contents/CHANGELOG.md'

     // Patch: Unreleased section header IS visible, but the added lines are under v1.0.0
     const files = [
       {
         "filename": "CHANGELOG.md",
         "status": "modified",
         "contents_url": contentsUrl,
           "patch": [
             '@@ -1,5 +1,7 @@',
             ' ## [Unreleased]',
             ' ',
             ' ## [v1.0.0]',
             '+- Fixed bug',
             '+',
             ' - Initial release'
           ].join('\n')
       }
     ]

     // Full file: Unreleased section is lines 1-2 (header + blank), v1.0.0 starts at line 3
     // Added lines from patch are at new-file lines 4 and 5 — outside Unreleased range
     const fullChangelog = [
       '## [Unreleased]',
       '',
       '## [v1.0.0]',
       '- Fixed bug',
       '',
       '- Initial release'
     ].join('\n')

     fetch.mockImplementation((url) => {
       if (url === contentsUrl) {
         return Promise.resolve(new Response(fullChangelog))
       }
       return prepareResponse(JSON.stringify(files))
     })

     changelogEnforcer.enforce()
       .then(() => {
         expect(infoSpy).toHaveBeenCalledTimes(0)
         expect(failureSpy).toHaveBeenCalled()
         expect(outputSpy).toHaveBeenCalled()

         // findChangelog + downloadFileDiff + downloadChangelog (line-number fallback)
         expect(fetch).toHaveBeenCalledTimes(3)

         done()
       })
   })
})