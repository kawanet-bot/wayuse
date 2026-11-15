import assert from "node:assert/strict"
import {describe, it} from "node:test"
import {slimHtml} from "./html-slim.ts"

const TITLE = "server/chrome/html-slim.test.ts"

// language=HTML
const source = `<!DOCTYPE html>
    <html lang="ja">
    <head>
        <title>SAMPLE</title>
        <link rel="stylesheet" href="/css/main.css">
        <link rel="preload" as="script" href="/js/main.js">
        <link rel="icon" href="/favicon.ico">
        <meta name="twitter:card" content="summary">
        <meta property="og:title" content="SAMPLE">
        <script>console.log("inline")</script>
        <script type="application/ld+json">{"@type": "NewsArticle"}</script>
        <style>body { color: red }</style>
    </head>
    <body>
    <!-- comment -->
    <main class="_22j9o20 article" style="--gap: 0px" onclick="alert(1)">
        <h1>Heading</h1>
        <p>Body   text</p>
        <svg viewBox="0 0 1 1"><path d="M0 0"/></svg>
        <img src="data:image/gif;base64,R0lGODlhAQABAAAAACw=" alt="">
        <img src="/photo.jpg" alt="Photo">
        <iframe src="about:blank"></iframe>
        <noscript><img src="/beacon.gif" alt=""></noscript>
    </main>
    <next-route-announcer></next-route-announcer>
    </body>
    </html>
`

describe(TITLE, () => {
    const result = slimHtml(source)

    it("keeps the content and the structured data", () => {
        assert.match(result, /^<!DOCTYPE html>/i)
        assert.match(result, /<title>SAMPLE<\/title>/)
        assert.match(result, /<h1>Heading<\/h1>/)
        assert.match(result, /<meta property="og:title"/)
        assert.match(result, /<img src="\/photo\.jpg"/)
        assert.match(result, /application\/ld\+json/)
        assert.match(result, /NewsArticle/)
    })

    it("takes out scripts, styles and event attributes", () => {
        assert.doesNotMatch(result, /console\.log/)
        assert.doesNotMatch(result, /<style/)
        assert.doesNotMatch(result, /style=/)
        assert.doesNotMatch(result, /onclick/)
        assert.doesNotMatch(result, /<link rel="preload"/)
    })

    it("takes out what a reader has no use for", () => {
        assert.doesNotMatch(result, /<link rel="icon"/)
        assert.doesNotMatch(result, /twitter:card/)
        assert.doesNotMatch(result, /<svg/)
        assert.doesNotMatch(result, /data:image/)
        assert.doesNotMatch(result, /<iframe/)
        assert.doesNotMatch(result, /<noscript/)
        assert.doesNotMatch(result, /next-route-announcer/)
        assert.doesNotMatch(result, /<!-- comment -->/)
    })

    it("drops generated class names and keeps the others, and folds runs of spaces", () => {
        assert.match(result, /<main class="article">/)
        assert.match(result, /<p>Body text<\/p>/)
        assert.ok(result.length < source.length / 2)
    })
})
