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

