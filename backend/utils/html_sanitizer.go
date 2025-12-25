package utils

import (
	"regexp"
	"strings"

	"github.com/microcosm-cc/bluemonday"
)

// SanitizePageHTML sanitizes user-provided HTML/CSS for custom pages
// Removes all JavaScript while allowing safe HTML tags and CSS (both inline and <style> tags)
func SanitizePageHTML(html string) string {
	// Extract <style> tags and their content before sanitization
	styleRegex := regexp.MustCompile(`(?s)<style[^>]*>(.*?)</style>`)
	styleMatches := styleRegex.FindAllString(html, -1)

	// Extract inline CSS from style attributes before sanitization
	// We'll sanitize the HTML first, then re-inject the CSS

	// Start with UGC policy as a base
	policy := bluemonday.UGCPolicy()

	// Allow additional structural elements for page content
	policy.AllowElements("article", "section", "header", "footer", "nav", "aside", "main")
	policy.AllowElements("figure", "figcaption")

	// Allow class and id attributes for CSS targeting
	policy.AllowAttrs("class", "id").Globally()

	// Allow style attribute on all elements for inline CSS
	policy.AllowAttrs("style").Globally()

	// Whitelist safe inline CSS properties
	safeCSSProperties := []string{
		// Typography
		"color", "font-family", "font-size", "font-weight", "font-style",
		"line-height", "letter-spacing", "text-align", "text-decoration",
		"text-transform", "text-indent", "word-spacing", "white-space",

		// Layout & Box Model
		"display", "position", "top", "right", "bottom", "left",
		"width", "height", "min-width", "min-height", "max-width", "max-height",
		"margin", "margin-top", "margin-right", "margin-bottom", "margin-left",
		"padding", "padding-top", "padding-right", "padding-bottom", "padding-left",
		"border", "border-width", "border-style", "border-color",
		"border-top", "border-right", "border-bottom", "border-left",
		"border-radius", "box-sizing", "overflow", "overflow-x", "overflow-y",

		// Flexbox
		"flex", "flex-direction", "flex-wrap", "flex-flow", "justify-content",
		"align-items", "align-content", "align-self", "order", "flex-grow",
		"flex-shrink", "flex-basis",

		// Grid
		"grid", "grid-template-columns", "grid-template-rows", "grid-gap",
		"grid-column", "grid-row", "grid-area",

		// Background
		"background", "background-color", "background-image", "background-repeat",
		"background-position", "background-size", "background-attachment",

		// Visual
		"opacity", "visibility", "z-index",
		"box-shadow", "text-shadow",
		"border-spacing", "border-collapse",
		"vertical-align",

		// Lists
		"list-style", "list-style-type", "list-style-position", "list-style-image",

		// Tables
		"table-layout", "caption-side", "empty-cells",

		// Transform & Animation (safe subset - no transitions that could cause issues)
		"transform", "transform-origin",
	}

	// Allow these CSS properties on all elements
	policy.AllowStyles(safeCSSProperties...).Globally()

	// Sanitize the HTML (this will strip <style> tags)
	sanitized := policy.Sanitize(html)

	// Now sanitize and re-inject <style> tags
	if len(styleMatches) > 0 {
		var sanitizedStyles []string
		for _, styleTag := range styleMatches {
			// Extract CSS content from style tag
			cssContent := styleRegex.FindStringSubmatch(styleTag)
			if len(cssContent) > 1 {
				css := cssContent[1]
				// Sanitize CSS content
				sanitizedCSS := SanitizeCSS(css)
				if sanitizedCSS != "" {
					sanitizedStyles = append(sanitizedStyles, "<style>"+sanitizedCSS+"</style>")
				}
			}
		}

		// Prepend sanitized styles to the sanitized HTML
		if len(sanitizedStyles) > 0 {
			sanitized = strings.Join(sanitizedStyles, "\n") + "\n" + sanitized
		}
	}

	return sanitized
}

// SanitizeCSS removes dangerous CSS patterns while preserving safe styling
func SanitizeCSS(css string) string {
	// Remove any script-related content
	scriptPatterns := []string{
		`javascript:`,
		`<script`,
		`</script>`,
		`onerror=`,
		`onload=`,
		`expression\(`,
		`behavior:`,
		`-moz-binding`,
		`@import`,
	}

	sanitized := css
	for _, pattern := range scriptPatterns {
		re := regexp.MustCompile(`(?i)` + regexp.QuoteMeta(pattern))
		sanitized = re.ReplaceAllString(sanitized, "")
	}

	// Remove data: URLs and other potentially dangerous URL schemes
	urlPattern := regexp.MustCompile(`(?i)url\s*\(\s*["']?(data:|javascript:|vbscript:|file:)`)
	sanitized = urlPattern.ReplaceAllString(sanitized, "url(")

	return strings.TrimSpace(sanitized)
} // GetPageContentSecurityPolicy returns CSP headers for serving custom pages
func GetPageContentSecurityPolicy() string {
	return "default-src 'self'; " +
		"style-src 'self' 'unsafe-inline'; " + // Allow inline styles
		"script-src 'none'; " + // Block all scripts
		"object-src 'none'; " + // Block objects/embed
		"base-uri 'none'; " + // Block base tag
		"form-action 'self'; " +
		"frame-ancestors 'self';" // Prevent clickjacking
}
