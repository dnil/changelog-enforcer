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

describe('the changelog-enforcer section enforcement', () => {

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

    infoSpy = jest.spyOn(core, 'info').mockImplementation(jest.fn())
    failureSpy = jest.spyOn(core, 'setFailed').mockImplementation(jest.fn())
    outputSpy = jest.spyOn(core, 'setOutput').mockImplementation(jest.fn())
  })

  prepareResponse = (body) => {
    return Promise.resolve(new Response(body, { Headers: { 'Content-Type': 'application/json' } }))
  }

  it('should not enforce section when enforcedSectionVersion is empty', (done) => {
    inputs['skipLabels'] = 'A different label'
    inputs['enforcedSectionVersion'] = ''

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
        expect(infoSpy).toHaveBeenCalledTimes(6) // 5 original + 1 for enforced section
        expect(failureSpy).not.toHaveBeenCalled()
        expect(outputSpy).not.toHaveBeenCalled()

        expect(fetch).toHaveBeenCalledTimes(1)

        done()
      })
  })
})
