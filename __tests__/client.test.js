jest.mock('node-fetch');

const fetch = require('node-fetch')
const { Response } = jest.requireActual('node-fetch');
const client = require('../src/client')

describe('the client', () => {

  afterAll(() => {
    jest.restoreAllMocks()
  })

  beforeEach(() => {
    jest.clearAllMocks()
  })

  prepareResponse = (body) => {
    return Promise.resolve(new Response(body, { Headers: { 'Content-Type': 'application/json' } }))
  }

  it('should find the change file', async () => {
    const files = [
      {
        "filename": "CHANGELOG.md",
        "status": "modified",
        "contents_url": "./path/to/CHANGELOG.md"
      }
    ]

    fetch.mockReturnValueOnce(prepareResponse(JSON.stringify(files)))

    const changelogFile = await client.findChangelog('token', 'repo', 1, 1, 'CHANGELOG.md')
    expect(fetch).toHaveBeenCalled()
    expect(changelogFile).toStrictEqual({
      "filename": "CHANGELOG.md",
      "status": "modified",
      "contents_url": "./path/to/CHANGELOG.md"
    })
  })

  it('should not find the change file', async () => {
    const firstPage = [
      {
        "filename": "random.md",
        "status": "modified",
        "contents_url": "./path/to/random.md"
      }
    ]

    const secondPage = []

    fetch
      .mockReturnValueOnce(prepareResponse(JSON.stringify(firstPage)))
      .mockReturnValueOnce(prepareResponse(JSON.stringify(secondPage)))

    const changelogFile = await client.findChangelog('token', 'repo', 1, 1, 'CHANGELOG.md')
    expect(fetch).toHaveBeenCalledTimes(2)
    expect(changelogFile).toBeUndefined()
  })

  it('should get an error with bad response code', async () => {
    fetch
      .mockReturnValueOnce(Promise.resolve(new Response("", { status: 401 })))

    try {
      await client.findChangelog('token', 'repo', 1, 1, 'CHANGELOG.md')
    } catch (err) {
      expect(fetch).toHaveBeenCalled()
    }
  })

  it('should return changelog patch from pull request file payload', async () => {
    const files = [
      {
        "filename": "CHANGELOG.md",
        "status": "modified",
        "patch": "@@ -1,2 +1,3 @@\n ## [Unreleased]\n+- Added feature"
      }
    ]

    fetch.mockReturnValueOnce(prepareResponse(JSON.stringify(files)))

    const diff = await client.downloadFileDiff('token', 'repo', 1, 'CHANGELOG.md')
    expect(fetch).toHaveBeenCalledTimes(1)
    expect(diff).toBe(files[0].patch)
  })

  it('should throw when changelog file has no patch in payload', async () => {
    const files = [
      {
        "filename": "CHANGELOG.md",
        "status": "modified"
      }
    ]

    fetch.mockReturnValueOnce(prepareResponse(JSON.stringify(files)))

    await expect(client.downloadFileDiff('token', 'repo', 1, 'CHANGELOG.md')).rejects.toThrow('No patch found for CHANGELOG.md')
  })
})