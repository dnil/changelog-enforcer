const sectionExtractor = require('../src/section-extractor')

describe('section-extractor', () => {
  const versionPattern = "^## \\[((v|V)?\\d*\\.\\d*\\.\\d*-?\\w*|unreleased|Unreleased|UNRELEASED)\\]"

  describe('isSectionModified', () => {
    it('should return true when Unreleased section has added content', () => {
      const diff = `diff --git a/CHANGELOG.md b/CHANGELOG.md
index 1234567..abcdefg 100644
--- a/CHANGELOG.md
+++ b/CHANGELOG.md
@@ -1,3 +1,5 @@
+## [Unreleased]
+- Added new feature
 ## [v1.0.0]
 - Initial release
`
      const result = sectionExtractor.isSectionModified(versionPattern, 'Unreleased', diff)
      expect(result).toBe(true)
    })

    it('should return true when Unreleased section has content with special characters', () => {
      const diff = `diff --git a/CHANGELOG.md b/CHANGELOG.md
--- a/CHANGELOG.md
+++ b/CHANGELOG.md
@@ -1,3 +1,4 @@
 ## [Unreleased]
+- Fixed issue with v1.0 backwards compatibility
 ## [v1.0.0]
`
      const result = sectionExtractor.isSectionModified(versionPattern, 'Unreleased', diff)
      expect(result).toBe(true)
    })

    it('should return false when Unreleased section exists but has no added content', () => {
      const diff = `diff --git a/CHANGELOG.md b/CHANGELOG.md
--- a/CHANGELOG.md
+++ b/CHANGELOG.md
@@ -5,3 +5,5 @@
 ## [v1.0.0]
-- Old change
+- Updated change
`
      const result = sectionExtractor.isSectionModified(versionPattern, 'Unreleased', diff)
      expect(result).toBe(false)
    })

    it('should return false when section header not found in diff', () => {
      const diff = `diff --git a/CHANGELOG.md b/CHANGELOG.md
--- a/CHANGELOG.md
+++ b/CHANGELOG.md
@@ -5,3 +5,5 @@
 ## [v1.0.0]
-- Old change
+- Updated change
`
      const result = sectionExtractor.isSectionModified(versionPattern, 'v2.0.0', diff)
      expect(result).toBe(false)
    })

    it('should detect modifications in specific version sections', () => {
      const diff = `diff --git a/CHANGELOG.md b/CHANGELOG.md
--- a/CHANGELOG.md
+++ b/CHANGELOG.md
@@ -1,5 +1,7 @@
 ## [v2.0.0]
-
+- New feature A
+- New feature B
 ## [v1.0.0]
 - Old feature
`
      const result = sectionExtractor.isSectionModified(versionPattern, 'v2.0.0', diff)
      expect(result).toBe(true)
    })

    it('should not detect modifications outside the target section', () => {
      const diff = `diff --git a/CHANGELOG.md b/CHANGELOG.md
--- a/CHANGELOG.md
+++ b/CHANGELOG.md
@@ -3,5 +3,7 @@
 ## [v2.0.0]
 ## [v1.0.0]
 - Old feature
-
+- Added more details
`
      const result = sectionExtractor.isSectionModified(versionPattern, 'v2.0.0', diff)
      expect(result).toBe(false)
    })

    it('should handle case-insensitive unreleased versions', () => {
      const diffWithUNRELEASED = `diff --git a/CHANGELOG.md b/CHANGELOG.md
--- a/CHANGELOG.md
+++ b/CHANGELOG.md
@@ -1,3 +1,5 @@
+## [UNRELEASED]
+- New change
 ## [v1.0.0]
`
      const resultUNRELEASED = sectionExtractor.isSectionModified(versionPattern, 'UNRELEASED', diffWithUNRELEASED)
      expect(resultUNRELEASED).toBe(true)

      const diffWithunrealeased = `diff --git a/CHANGELOG.md b/CHANGELOG.md
--- a/CHANGELOG.md
+++ b/CHANGELOG.md
@@ -1,3 +1,5 @@
+## [unreleased]
+- New change
 ## [v1.0.0]
`
      const resultUnreleased = sectionExtractor.isSectionModified(versionPattern, 'unreleased', diffWithunrealeased)
      expect(resultUnreleased).toBe(true)
    })

    it('should handle version strings with dashes', () => {
      const diff = `diff --git a/CHANGELOG.md b/CHANGELOG.md
--- a/CHANGELOG.md
+++ b/CHANGELOG.md
@@ -1,5 +1,7 @@
 ## [v2.0.0-beta]
-
+- Beta feature
 ## [v1.0.0]
`
      const result = sectionExtractor.isSectionModified(versionPattern, 'v2.0.0-beta', diff)
      expect(result).toBe(true)
    })

    it('should ignore +++ and --- markers from diff headers', () => {
      const diff = `diff --git a/CHANGELOG.md b/CHANGELOG.md
--- a/CHANGELOG.md
+++ b/CHANGELOG.md
@@ -1,3 +1,5 @@
 ## [Unreleased]
+- Added feature
 ## [v1.0.0]
`
      const result = sectionExtractor.isSectionModified(versionPattern, 'Unreleased', diff)
      expect(result).toBe(true)
    })

    it('should stop looking for modifications when next section is found', () => {
      const diff = `diff --git a/CHANGELOG.md b/CHANGELOG.md
--- a/CHANGELOG.md
+++ b/CHANGELOG.md
@@ -1,5 +1,7 @@
 ## [v2.0.0]
 ## [v1.0.0]
-- Old
+- New change in v1.0.0
`
      const result = sectionExtractor.isSectionModified(versionPattern, 'v2.0.0', diff)
      expect(result).toBe(false)
    })
  })

  describe('isSectionBeingRenamed', () => {
    it('should return false when the section header is a context line (section still exists)', () => {
      const diff = [
        'diff --git a/CHANGELOG.md b/CHANGELOG.md',
        '--- a/CHANGELOG.md',
        '+++ b/CHANGELOG.md',
        '@@ -1,3 +1,5 @@',
        ' ## [Unreleased]',
        '+- Added new feature',
        ' ## [v1.0.0]',
        ' - Initial release'
      ].join('\n')
      expect(sectionExtractor.isSectionBeingRenamed('Unreleased', diff)).toBe(false)
    })

    it('should return true when the section header is removed and replaced (release/hotfix branch)', () => {
      const diff = [
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
      expect(sectionExtractor.isSectionBeingRenamed('unreleased', diff)).toBe(true)
    })

    it('should return false when the section header is not in the diff at all', () => {
      const diff = [
        'diff --git a/CHANGELOG.md b/CHANGELOG.md',
        '--- a/CHANGELOG.md',
        '+++ b/CHANGELOG.md',
        '@@ -5,3 +5,5 @@',
        ' ## [v1.0.0]',
        '+- Fixed bug',
        ' - Initial release'
      ].join('\n')
      expect(sectionExtractor.isSectionBeingRenamed('unreleased', diff)).toBe(false)
    })

    it('should be case-insensitive when detecting removal', () => {
      const diff = '-## [UNRELEASED]\n+## [v2.0.0] - 2026-08-04'
      expect(sectionExtractor.isSectionBeingRenamed('unreleased', diff)).toBe(true)
    })
  })

  describe('findSectionLineRange', () => {
    it('should return start and end for the first section', () => {
      const content = `## [Unreleased]
- New feature

## [v1.0.0]
- Initial release
`
      const range = sectionExtractor.findSectionLineRange(versionPattern, 'Unreleased', content)
      expect(range).not.toBeNull()
      expect(range.start).toBe(1)
      expect(range.end).toBe(4) // line 4 is "## [v1.0.0]"
    })

    it('should return start and end for a middle section', () => {
      const content = `## [v2.0.0]
- New feature

## [v1.0.0]
- Initial release

## [v0.9.0]
- Pre-release
`
      const range = sectionExtractor.findSectionLineRange(versionPattern, 'v1.0.0', content)
      expect(range).not.toBeNull()
      expect(range.start).toBe(4) // line 4 is "## [v1.0.0]"
      expect(range.end).toBe(7) // line 7 is "## [v0.9.0]"
    })

    it('should return start and EOF for the last section', () => {
      const content = `## [Unreleased]
- New feature

## [v1.0.0]
- Initial release
`
      const range = sectionExtractor.findSectionLineRange(versionPattern, 'v1.0.0', content)
      expect(range).not.toBeNull()
      expect(range.start).toBe(4)
      // end should be past last line
      const lineCount = content.split('\n').length
      expect(range.end).toBe(lineCount + 1)
    })

    it('should return null when section not found', () => {
      const content = `## [v1.0.0]
- Initial release
`
      const range = sectionExtractor.findSectionLineRange(versionPattern, 'v2.0.0', content)
      expect(range).toBeNull()
    })

    it('should be case-insensitive', () => {
      const content = `## [UNRELEASED]
- New feature

## [v1.0.0]
- Initial release
`
      const range = sectionExtractor.findSectionLineRange(versionPattern, 'unreleased', content)
      expect(range).not.toBeNull()
      expect(range.start).toBe(1)
    })

    it('should support bracket-only section headers without markdown hashes', () => {
      const content = `[unreleased]
### Changed
- New change

[1.2.3]
- Older release
`
      const range = sectionExtractor.findSectionLineRange(versionPattern, 'unreleased', content)
      expect(range).not.toBeNull()
      expect(range.start).toBe(1)
      expect(range.end).toBe(5)
    })

    it('should support bracket-only headers for middle sections', () => {
      const content = `[2.0.0]
- Top

[unreleased]
- Middle change

[1.0.0]
- Bottom`
      const range = sectionExtractor.findSectionLineRange(versionPattern, 'unreleased', content)
      expect(range).not.toBeNull()
      expect(range.start).toBe(4)
      expect(range.end).toBe(7)
    })
  })

  describe('getAddedLineNumbers', () => {
    it('should return added line numbers from a single hunk', () => {
      const patch = `@@ -1,3 +1,5 @@
 ## [Unreleased]
+- New feature A
+- New feature B
 ## [v1.0.0]`
      const added = sectionExtractor.getAddedLineNumbers(patch)
      expect(added.has(2)).toBe(true) // line 2 in new file
      expect(added.has(3)).toBe(true) // line 3 in new file
      expect(added.size).toBe(2)
    })

    it('should handle multiple hunks', () => {
      const patch = `@@ -1,3 +1,4 @@
 ## [Unreleased]
+- New feature
 ## [v1.0.0]
@@ -10,3 +11,4 @@
 Some context
+- Another change
 More context`
      const added = sectionExtractor.getAddedLineNumbers(patch)
      expect(added.has(2)).toBe(true)  // first hunk addition
      expect(added.has(12)).toBe(true) // second hunk addition
    })

    it('should not count removed lines', () => {
      const patch = `@@ -1,4 +1,3 @@
 ## [Unreleased]
-- Old line
 ## [v1.0.0]`
      const added = sectionExtractor.getAddedLineNumbers(patch)
      expect(added.size).toBe(0)
    })

    it('should handle patch with diff headers', () => {
      const patch = `diff --git a/CHANGELOG.md b/CHANGELOG.md
--- a/CHANGELOG.md
+++ b/CHANGELOG.md
@@ -1,3 +1,4 @@
 ## [Unreleased]
+- New feature
 ## [v1.0.0]`
      const added = sectionExtractor.getAddedLineNumbers(patch)
      expect(added.has(2)).toBe(true)
      expect(added.size).toBe(1)
    })
  })

  describe('extractSection', () => {
    it('should extract Unreleased section content', () => {
      const changelog = `## [Unreleased]
- Added new feature
- Fixed bug

## [v1.0.0]
- Initial release
`
      const section = sectionExtractor.extractSection(versionPattern, 'Unreleased', changelog)
      expect(section).toBeTruthy()
      expect(section).toContain('Added new feature')
      expect(section).toContain('Fixed bug')
      expect(section).not.toContain('Initial release')
    })

    it('should extract specific version section', () => {
      const changelog = `## [v2.0.0]
- New feature A
- New feature B

## [v1.0.0]
- Old feature
`
      const section = sectionExtractor.extractSection(versionPattern, 'v2.0.0', changelog)
      expect(section).toBeTruthy()
      expect(section).toContain('New feature A')
      expect(section).toContain('New feature B')
      expect(section).not.toContain('Old feature')
    })

    it('should return null when section not found', () => {
      const changelog = `## [v1.0.0]
- Old feature
`
      const section = sectionExtractor.extractSection(versionPattern, 'v2.0.0', changelog)
      expect(section).toBeNull()
    })
  })
})

